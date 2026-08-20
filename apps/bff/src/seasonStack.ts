/**
 * BFF season dual-stack resolver (production-ready Pile B).
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
  /** Points view: app_v_gw_points or app_v_season_gw_points */
  gwPoints: string;
  /** OCP view: app_v_ocp_overall or app_v_season_ocp_overall */
  ocpOverall: string;
};

const LEGACY: SeasonTables = {
  fixtures: 'app_fixtures',
  picks: 'app_picks',
  results: 'app_gw_results',
  submissions: 'app_gw_submissions',
  picksOnConflict: 'user_id,gw,fixture_index',
  submissionsOnConflict: 'user_id,gw',
  gwPoints: 'app_v_gw_points',
  ocpOverall: 'app_v_ocp_overall',
};

const SEASON: SeasonTables = {
  fixtures: 'app_season_fixtures',
  picks: 'app_season_picks',
  results: 'app_season_results',
  submissions: 'app_season_submissions',
  picksOnConflict: 'season_id,user_id,gw,fixture_index',
  submissionsOnConflict: 'season_id,user_id,gw',
  gwPoints: 'app_v_season_gw_points',
  ocpOverall: 'app_v_season_ocp_overall',
};

const NEW_USER_SEASON_STACK_CUTOFF_MS = Date.parse('2026-08-12T00:00:00Z');

export function shouldDefaultNewUserToSeasonStack(
  createdAt: string | null | undefined,
  hasPreferences: boolean
): boolean {
  if (hasPreferences || !createdAt) return false;
  const createdAtMs = Date.parse(createdAt);
  return Number.isFinite(createdAtMs) && createdAtMs >= NEW_USER_SEASON_STACK_CUTOFF_MS;
}

/**
 * Prefer the public profile timestamp, then the auth user timestamp.
 * Expo signups can exist in auth.users without a public.users row.
 */
async function resolveAccountCreatedAt(
  supa: SupabaseClient,
  userId: string,
  profileCreatedAt: string | null | undefined
): Promise<string | null> {
  if (typeof profileCreatedAt === 'string' && profileCreatedAt.trim()) {
    return profileCreatedAt;
  }
  const { data } = await supa.auth.getUser();
  if (data.user?.id === userId && data.user.created_at) {
    return data.user.created_at;
  }
  return null;
}

export function getSeasonTables(ctx: Pick<SeasonCtx, 'useSeasonStack'>): SeasonTables {
  return ctx.useSeasonStack ? SEASON : LEGACY;
}

/**
 * Resolve season/GW context for a user. Pass service or user-scoped client.
 */
export async function resolveSeasonCtx(
  supa: SupabaseClient,
  userId: string
): Promise<SeasonCtx> {
  const { data: storedPrefs, error: prefsErr } = await (supa as any)
    .from('user_notification_preferences')
    .select('use_season_stack, current_viewing_season_id, current_viewing_gw')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefsErr) throw prefsErr;

  let prefs = storedPrefs;
  let runtime: {
    current_season_id?: string | null;
    current_gw?: number | null;
  } | null = null;

  if (!prefs) {
    const { data: profile, error: profileErr } = await (supa as any)
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .maybeSingle();
    if (profileErr) throw profileErr;

    const createdAt = await resolveAccountCreatedAt(supa, userId, profile?.created_at);
    if (shouldDefaultNewUserToSeasonStack(createdAt, false)) {
      const { data: runtimeData, error: runtimeErr } = await (supa as any)
        .from('app_season_runtime')
        .select('current_season_id, current_gw')
        .eq('id', 1)
        .maybeSingle();
      if (runtimeErr) throw runtimeErr;
      runtime = runtimeData;

      if (runtime?.current_season_id) {
        const { data: createdPrefs, error: createPrefsErr } = await (supa as any)
          .from('user_notification_preferences')
          .upsert(
            {
              user_id: userId,
              preferences: {},
              use_season_stack: true,
              current_viewing_season_id: runtime.current_season_id,
              current_viewing_gw: runtime.current_gw ?? 1,
            },
            { onConflict: 'user_id' }
          )
          .select('use_season_stack, current_viewing_season_id, current_viewing_gw')
          .single();
        if (createPrefsErr) throw createPrefsErr;
        prefs = createdPrefs;
      }
    }
  }

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

  if (!runtime) {
    const { data: runtimeData, error: rtErr } = await (supa as any)
      .from('app_season_runtime')
      .select('current_season_id, current_gw')
      .eq('id', 1)
      .maybeSingle();
    if (rtErr) throw rtErr;
    runtime = runtimeData;
  }

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

/** Attach .eq('season_id', ...) when on stack and we have an id. */
export function applySeasonFilter(query: any, ctx: Pick<SeasonCtx, 'useSeasonStack' | 'seasonId'>): any {
  if (ctx.useSeasonStack && ctx.seasonId) {
    return query.eq('season_id', ctx.seasonId);
  }
  return query;
}

/** Alias for applySeasonFilter — matches web naming. */
export function withSeasonId(query: any, ctx: Pick<SeasonCtx, 'useSeasonStack' | 'seasonId'>): any {
  return applySeasonFilter(query, ctx);
}

/**
 * True when the season folder has no completed results yet.
 * Used to show empty leaderboards before GW1 finishes (not permanent label-based zeroing).
 */
export async function seasonHasCompletedResults(
  supa: SupabaseClient,
  ctx: Pick<SeasonCtx, 'useSeasonStack' | 'seasonId'>
): Promise<boolean> {
  if (!ctx.useSeasonStack) {
    const { data, error } = await (supa as any)
      .from('app_gw_results')
      .select('gw')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data != null;
  }
  if (!ctx.seasonId) return false;
  const { data, error } = await (supa as any)
    .from('app_season_results')
    .select('gw')
    .eq('season_id', ctx.seasonId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}
