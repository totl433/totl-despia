/**
 * Active season for the signed-in user (Pile B tester override or legacy).
 * Used by chrome (bottom tab label) and leaderboards for zeroed 26/27 tables.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import {
  SEASON_2025_26_LABEL,
  SEASON_2026_27_LABEL,
} from './leaderboardMonths';

export type ViewerSeason = {
  useSeasonStack: boolean;
  seasonId: string | null;
  seasonLabel: string;
  currentViewingGw: number | null;
  /** True when tester (or open) season is the new year — tables start at 0 until results. */
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

  const { data: prefs } = await supabase
    .from('user_notification_preferences')
    .select('use_season_stack, current_viewing_season_id, current_viewing_gw')
    .eq('user_id', user.id)
    .maybeSingle();

  const useSeasonStack = !!prefs?.use_season_stack;
  const seasonId = (prefs?.current_viewing_season_id as string | null) ?? null;
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
  }

  const isNewSeasonFresh =
    useSeasonStack &&
    (seasonLabel === SEASON_2026_27_LABEL || seasonLabel.startsWith('2026'));

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
