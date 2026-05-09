import React from 'react';

import type { GwPointsRow } from '../lib/profileStreakRows';
import { computePersonalGwPodiumWins } from '../lib/gwPodiumsFromGwPoints';

type LiveGwRowLike = { user_id?: string | null; score?: number | null };

/**
 * Derives GW “cabinet” wins from leaderboard materialization (`app_v_gw_points`) in one pass.
 * Optionally substitutes the podium check for **`substituteLiveGw`** with already-fetched
 * **`/v1/leaderboards/gw/:gw/live`** rows (no N network fan-out).
 */
export function useGameweekTrophyWinsFromLeaderboardApi(
  userId: string | null,
  gwPointsRows: GwPointsRow[] | undefined,
  opts?: {
    substituteLiveGw?: number | null;
    substituteLiveRows?: LiveGwRowLike[] | null;
  }
): { wins: number; pending: boolean; error: boolean; winningGwsDescending: number[] } {
  const substituteGw = opts?.substituteLiveGw ?? null;
  const substituteRows = opts?.substituteLiveRows ?? null;

  return React.useMemo(() => {
    /** Parent defers leaderboard paging intentionally — treat as idle until snapshot arrives */
    const pending = gwPointsRows === undefined;
    const computed = computePersonalGwPodiumWins({
      gwPointsRows,
      userId,
      liveSubstitutionGw: substituteGw,
      liveTableRows: substituteRows ?? null,
    });
    return {
      wins: computed.wins,
      pending,
      error: false,
      winningGwsDescending: computed.winningGwsDescending,
    };
  }, [gwPointsRows, substituteGw, substituteRows, userId]);
}
