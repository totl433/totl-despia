import React from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { GwPointsRow } from '../lib/profileStreakRows';
import { rankUserInGwLiveScores } from '../lib/gwLiveRank';

/**
 * Gameweek “cabinet” wins using the same `/v1/leaderboards/gw/:gw/live` payload as the Global GW tab,
 * so trophies stay aligned even if profile-stats aggregation lags.
 */
export function useGameweekTrophyWinsFromLeaderboardApi(
  userId: string | null,
  gwPointsRows: GwPointsRow[] | undefined
): { wins: number; pending: boolean; error: boolean; winningGwsDescending: number[] } {
  const myGws = React.useMemo(() => {
    if (!userId || !gwPointsRows?.length) return [];
    const uid = String(userId).toLowerCase();
    const s = new Set<number>();
    for (const r of gwPointsRows) {
      if (String(r.user_id).toLowerCase() !== uid) continue;
      const g = Number(r.gw);
      if (Number.isFinite(g) && g > 0) s.add(g);
    }
    return [...s].sort((a, b) => a - b);
  }, [userId, gwPointsRows]);

  const queries = useQueries({
    queries: myGws.map((gw) => ({
      queryKey: ['leaderboards', 'gwLiveTable', gw],
      queryFn: () => api.getGlobalGwLiveTable(gw),
      enabled: !!userId && myGws.length > 0,
      staleTime: 120_000,
    })),
  });

  return React.useMemo(() => {
    const pending = queries.some((q) => q.isPending || q.isFetching);
    const error = queries.some((q) => q.isError);
    let wins = 0;
    const winningGws: number[] = [];
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      const gw = myGws[i];
      const rows = q?.data?.rows;
      if (!rows?.length || !userId || typeof gw !== 'number') continue;
      const mapped = rows.map((r: { user_id?: string; score?: number | null }) => ({
        user_id: String(r.user_id),
        score: Number(r.score ?? 0),
      }));
      if (rankUserInGwLiveScores(userId, mapped) === 1) {
        wins++;
        winningGws.push(gw);
      }
    }
    winningGws.sort((a, b) => b - a);
    return { wins, pending, error, winningGwsDescending: winningGws };
  }, [myGws, queries, userId]);
}
