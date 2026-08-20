/**
 * Active season for the signed-in user (Pile B override or legacy).
 * Used by chrome (bottom tab label) and leaderboards.
 *
 * `isNewSeasonFresh` means the active season folder has **no completed results yet**
 * (not a permanent "it's 2026" label). Once GW1 lands results, leaderboards unfreeze.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import {
  SEASON_2025_26_LABEL,
  SEASON_2026_27_LABEL,
} from './leaderboardMonths';

const NEW_USER_SEASON_STACK_CUTOFF_MS = Date.parse('2026-08-12T00:00:00Z');

function shouldDefaultNewUserToSeasonStack(
  createdAt: string | null | undefined,
  hasPreferences: boolean
): boolean {
  if (hasPreferences || !createdAt) return false;
  const createdAtMs = Date.parse(createdAt);
  return Number.isFinite(createdAtMs) && createdAtMs >= NEW_USER_SEASON_STACK_CUTOFF_MS;
}

export type ViewerSeason = {
  useSeasonStack: boolean;
  seasonId: string | null;
  seasonLabel: string;
  currentViewingGw: number | null;
  /**
   * True when on season stack and this season has zero completed results.
   * Empty overall tables / zeroed ranks until first scored fixture.
   */
  isNewSeasonFresh: boolean;
};

async function fetchViewerSeason(): Promise<ViewerSeason> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return {
      useSeasonStack: false,
      seasonId: null,
      seasonLabel: SEASON_2025_26_LABEL,
      currentViewingGw: null,
      isNewSeasonFresh: false,
    };
  }

  const { data: storedPrefs } = await supabase
    .from('user_notification_preferences')
    .select('use_season_stack, current_viewing_season_id, current_viewing_gw')
    .eq('user_id', user.id)
    .maybeSingle();

  let prefs = storedPrefs;

  // Same rule as BFF/web: post-launch accounts start on the live season,
  // even when Expo signup never created a public.users profile.
  if (!prefs && shouldDefaultNewUserToSeasonStack(user.created_at, false)) {
    const { data: runtime, error: runtimeErr } = await (supabase as any)
      .from('app_season_runtime')
      .select('current_season_id, current_gw')
      .eq('id', 1)
      .maybeSingle();
    if (runtimeErr) throw runtimeErr;

    if (runtime?.current_season_id) {
      const { data: createdPrefs, error: createPrefsErr } = await (supabase as any)
        .from('user_notification_preferences')
        .upsert(
          {
            user_id: user.id,
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

  const useSeasonStack = !!prefs?.use_season_stack;
  let seasonId = (prefs?.current_viewing_season_id as string | null) ?? null;

  // Mirror BFF: fall back to runtime season when prefs leave season_id null.
  if (useSeasonStack && !seasonId) {
    const { data: runtime } = await (supabase as any)
      .from('app_season_runtime')
      .select('current_season_id')
      .eq('id', 1)
      .maybeSingle();
    seasonId = (runtime?.current_season_id as string | null) ?? null;
  }

  let seasonLabel = SEASON_2025_26_LABEL;

  if (useSeasonStack && seasonId) {
    const { data: season } = await supabase
      .from('app_seasons')
      .select('label')
      .eq('id', seasonId)
      .maybeSingle();
    if (typeof season?.label === 'string' && season.label.trim()) {
      seasonLabel = season.label.trim();
    }
  } else if (useSeasonStack) {
    // Stack on but no id yet — still treat as upcoming season chrome.
    seasonLabel = SEASON_2026_27_LABEL;
  }

  let isNewSeasonFresh = false;
  if (useSeasonStack) {
    if (!seasonId) {
      isNewSeasonFresh = true;
    } else {
      const { data: anyResult } = await (supabase as any)
        .from('app_season_results')
        .select('gw')
        .eq('season_id', seasonId)
        .limit(1)
        .maybeSingle();
      isNewSeasonFresh = !anyResult;
    }
  }

  return {
    useSeasonStack,
    seasonId,
    seasonLabel,
    currentViewingGw:
      typeof prefs?.current_viewing_gw === 'number' ? prefs.current_viewing_gw : null,
    isNewSeasonFresh,
  };
}

export function useViewerSeason() {
  const q = useQuery({
    queryKey: ['viewer-season'],
    queryFn: fetchViewerSeason,
    staleTime: 30_000,
  });

  return {
    ...(q.data ?? {
      useSeasonStack: false,
      seasonId: null,
      seasonLabel: SEASON_2025_26_LABEL,
      currentViewingGw: null,
      isNewSeasonFresh: false,
    }),
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
