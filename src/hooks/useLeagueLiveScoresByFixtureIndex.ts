import { useMemo } from 'react';
import { useLiveScores } from './useLiveScores';

interface UseLeagueLiveScoresByFixtureIndexProps {
  gwForSubscription?: number;
  fixtures: Array<{ api_match_id?: number | null; fixture_index: number }>;
}

type LiveScoreByFixtureIndex = Record<
  number,
  { homeScore: number; awayScore: number; status: string; minute?: number | null }
>;

interface UseLeagueLiveScoresByFixtureIndexReturn {
  liveScoresByFixtureIndex: LiveScoreByFixtureIndex;
  loadingLiveScores: boolean;
  errorLiveScores: string | null;
}

/**
 * Wraps `useLiveScores` and maps results to `fixture_index` keys (stable reference),
 * filtering to the currently loaded fixtures.
 */
export function useLeagueLiveScoresByFixtureIndex({
  gwForSubscription,
  fixtures,
}: UseLeagueLiveScoresByFixtureIndexProps): UseLeagueLiveScoresByFixtureIndexReturn {
  const apiMatchIdsForHook = useMemo(() => {
    const ids =
      fixtures
        ?.map((f) => f.api_match_id)
        .filter((id): id is number => id !== null && id !== undefined) ?? [];
    return ids.length ? ids : undefined;
  }, [fixtures]);

  const { liveScores: liveScoresMap, loading, error } = useLiveScores(gwForSubscription, apiMatchIdsForHook);

  const liveScoresByFixtureIndex = useMemo<LiveScoreByFixtureIndex>(() => {
    const result: LiveScoreByFixtureIndex = {};
    const allow = fixtures?.length ? new Set(fixtures.map((f) => f.fixture_index)) : null;

    fixtures.forEach((fixture) => {
      const apiMatchId = fixture.api_match_id;
      if (!apiMatchId) return;
      const live = liveScoresMap.get(apiMatchId);
      if (!live) return;
      if (allow && !allow.has(fixture.fixture_index)) return;

      result[fixture.fixture_index] = {
        homeScore: live.home_score ?? 0,
        awayScore: live.away_score ?? 0,
        status: live.status || 'SCHEDULED',
        minute: live.minute ?? null,
      };
    });

    return result;
  }, [liveScoresMap, fixtures]);

  return {
    liveScoresByFixtureIndex,
    loadingLiveScores: loading,
    errorLiveScores: error,
  };
}

