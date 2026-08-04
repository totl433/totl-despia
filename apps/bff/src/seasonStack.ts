/**
 * BFF season dual-stack resolver (tester-ready Pile B).
 * Same rules as web src/lib/seasonStack.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SeasonCtx = {
  useSeasonStack: boolean;
  seasonId: string | null;
  seasonLabel: string | null;
  currentGw: number;
  viewingGw: number | null;
};

export type SeasonTables = {
  fixtures: string;
  picks: string;
  results: string;
  submissions: string;
  picksOnConflict: string;
  submissionsOnConflict: string;
};

const LEGACY: SeasonTables = {
  fixtures: 'app_fixtures',
  picks: 'app_picks',
  results: 'app_gw_results',
  submissions: 'app_gw_submissions',
  picksOnConflict: 'user_id,gw,fixture_index',
  submissionsOnConflict: 'user_id,gw',
};

const SEASON: SeasonTables = {
  fixtures: 'app_season_fixtures',
  picks: 'app_season_picks',
  results: 'app_season_results',
  submissions: 'app_season_submissions',
  picksOnConflict: 'season_id,user_id,gw,fixture_index',
  submissionsOnConflict: 'season_id,user_id,gw',
};

export function getSeasonTables(ctx: Pick<SeasonCtx, 'useSeasonStack'>): SeasonTables {
  return ctx.useSeasonStack ? SEASON : LEGACY;
}

export async function resolveSeasonCtx(
  supa: SupabaseClient,
  userId: string
): Promise<SeasonCtx> {
  const { data: prefs, error: prefsErr } = await (supa as any)
    .from('user_notification_preferences')
    .select('use_season_stack, current_viewing_season_id, current_viewing_gw')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefsErr) throw prefsErr;

  const useSeasonStack = !!prefs?.use_season_stack;
  const viewingGwPref: number | null =
    typeof prefs?.current_viewing_gw === 'number' ? prefs.current_viewing_gw : null;

  if (!useSeasonStack) {
    const { data: meta, error: metaErr } = await (supa as any)
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();
    if (metaErr) throw metaErr;
    return {
      useSeasonStack: false,
      seasonId: null,
      seasonLabel: null,
      currentGw: (meta?.current_gw as number | null) ?? 1,
      viewingGw: viewingGwPref,
    };
  }

  const { data: runtime, error: rtErr } = await (supa as any)
    .from('app_season_runtime')
    .select('current_season_id, current_gw')
    .eq('id', 1)
    .maybeSingle();
  if (rtErr) throw rtErr;

  const seasonId: string | null =
    (prefs?.current_viewing_season_id as string | null) ||
    (runtime?.current_season_id as string | null) ||
    null;

  let seasonLabel: string | null = null;
  if (seasonId) {
    const { data: season } = await (supa as any)
      .from('app_seasons')
      .select('label')
      .eq('id', seasonId)
      .maybeSingle();
    seasonLabel = (season?.label as string | null) ?? null;
  }

  const onRuntimeSeason =
    !!seasonId &&
    !!runtime?.current_season_id &&
    seasonId === runtime.current_season_id;

  const currentGw = onRuntimeSeason
    ? (runtime?.current_gw as number | null) ?? viewingGwPref ?? 1
    : viewingGwPref ?? 1;

  return {
    useSeasonStack: true,
    seasonId,
    seasonLabel,
    currentGw,
    viewingGw: viewingGwPref,
  };
}

export function seasonDisplayGw(ctx: SeasonCtx, queryGw?: number | null): number {
  if (queryGw && queryGw > 0) return queryGw;
  const viewing = ctx.viewingGw;
  if (viewing !== null && viewing < ctx.currentGw) return viewing;
  return ctx.currentGw;
}

export function applySeasonFilter(query: any, ctx: SeasonCtx): any {
  if (ctx.useSeasonStack && ctx.seasonId) {
    return query.eq('season_id', ctx.seasonId);
  }
  return query;
}
