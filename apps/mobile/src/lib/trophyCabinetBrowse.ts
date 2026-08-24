import { getMonthAllocations, type LeaderboardSeasonKey } from './leaderboardMonths';
import type { GwPointsRow } from './profileStreakRows';

/**
 * Month-end GWs where the user tied or led the monthly points table.
 * Pass `seasonKey: '2026/27'` so August ends at GW2 (not last season’s GW3).
 * Only months with `lastCompletedGw >= endGw` are eligible. Sorted newest-first (`endGw` descending).
 */
export function computeMonthlyWinnerEndGwsDescending(opts: {
  gwPointsRows: GwPointsRow[];
  userId: string;
  lastCompletedGw: number;
  seasonKey?: LeaderboardSeasonKey;
}): number[] {
  const uid = String(opts.userId).toLowerCase();
  const lc = opts.lastCompletedGw;
  const wins: number[] = [];

  for (const m of getMonthAllocations(opts.seasonKey ?? '2025/26')) {
    if (lc < m.endGw) continue;
    const playedMonth = opts.gwPointsRows.some(
      (r) => String(r.user_id).toLowerCase() === uid && r.gw >= m.startGw && r.gw <= m.endGw
    );
    if (!playedMonth) continue;

    const totals = new Map<string, number>();
    for (const r of opts.gwPointsRows) {
      const g = Number(r.gw);
      if (g < m.startGw || g > m.endGw) continue;
      const ru = String(r.user_id).toLowerCase();
      totals.set(ru, (totals.get(ru) ?? 0) + Number(r.points ?? 0));
    }

    let maxMonth = -Infinity;
    totals.forEach((v) => {
      if (v > maxMonth) maxMonth = v;
    });
    if (!Number.isFinite(maxMonth)) continue;

    const mine = totals.get(uid) ?? Number.NEGATIVE_INFINITY;
    if (mine === maxMonth) wins.push(m.endGw);
  }

  wins.sort((a, b) => b - a);
  return wins;
}
