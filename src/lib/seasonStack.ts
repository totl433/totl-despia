/**
 * Season stack (Pile B) helpers for dual-stack clients.
 *
 * When user_notification_preferences.use_season_stack is true, resolve GW +
 * tables from app_season_* using current_viewing_season_id (tester override)
 * or app_season_runtime. Legacy users stay 100% on app_meta + app_*.
 *
 * NEVER write app_meta from this path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type SeasonCtx = {
  useSeasonStack: boolean;
  seasonId: string | null;
  seasonLabel: string | null;
  /** Published GW for this user/stack (what "current" means) */
  currentGw: number;
  /** Preferencing viewing GW when set */
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

const LEGACY_TABLES: SeasonTables = {
  fixtures: 'app_fixtures',
  picks: 'app_picks',
  results: 'app_gw_results',
  submissions: 'app_gw_submissions',
  picksOnConflict: 'user_id,gw,fixture_index',
  submissionsOnConflict: 'user_id,gw',
};

const SEASON_TABLES: SeasonTables = {
  fixtures: 'app_season_fixtures',
  picks: 'app_season_picks',
  results: 'app_season_results',
  submissions: 'app_season_submissions',
  picksOnConflict: 'season_id,user_id,gw,fixture_index',
  submissionsOnConflict: 'season_id,user_id,gw',
};

export function getSeasonTables(ctx: Pick<SeasonCtx, 'useSeasonStack'>): SeasonTables {
  return ctx.useSeasonStack ? SEASON_TABLES : LEGACY_TABLES;
}

/**
 * Resolve season/GW context for a user. Pass service or user-scoped client.
 */
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

  // Legacy: app_meta only
  if (!useSeasonStack) {
    const { data: meta, error: metaErr } = await (supa as any)
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();
    if (metaErr) throw metaErr;
    const currentGw = (meta?.current_gw as number | null) ?? 1;
    return {
      useSeasonStack: false,
      seasonId: null,
      seasonLabel: null,
      currentGw,
      viewingGw: viewingGwPref,
    };
  }

  // Stack: season from prefs override, else global runtime
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

  // Tester on a draft season (id ≠ runtime season): treat viewing GW as published GW
  // so they sit on that folder’s gameweek without global hard-switch.
  const onRuntimeSeason =
    !!seasonId &&
    !!runtime?.current_season_id &&
    seasonId === runtime.current_season_id;

  let currentGw: number;
  if (onRuntimeSeason) {
    currentGw = (runtime?.current_gw as number | null) ?? viewingGwPref ?? 1;
  } else {
    // draft / tester override — don't inherit runtime GW 38 onto 26/27
    currentGw = viewingGwPref ?? 1;
  }

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

/** True for fresh 2026/27 (or later) season folder — leaderboards start empty until results. */
export function isNewSeasonFresh(ctx: Pick<SeasonCtx, 'useSeasonStack' | 'seasonLabel'> | null | undefined): boolean {
  if (!ctx?.useSeasonStack) return false;
  const label = (ctx.seasonLabel ?? '').trim();
  return label === '2026/27' || label.startsWith('2026');
}

/** Attach .eq('season_id', ...) when on stack and we have an id */
export function withSeasonId<T extends { eq: (col: string, val: unknown) => T }>(
  query: T,
  ctx: Pick<SeasonCtx, 'useSeasonStack' | 'seasonId'>
): T {
  if (ctx.useSeasonStack && ctx.seasonId) {
    return query.eq('season_id', ctx.seasonId);
  }
  return query;
}
