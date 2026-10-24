import { getMonthAllocations, getMonthForGw, type LeaderboardSeasonKey } from './leaderboardMonths';
import type { GwPointsRow } from './profileStreakRows';

export type PersonalWinnerBrowsePayload = {
  gw: number;
  victoryType: 'gameweek' | 'monthly';
  label: string;
  points: number;
  winnerCount: number;
  joint: boolean;
};

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

/**
 * Build a personal-winner card body from already-loaded GW points so the cabinet
 * can open without refetching every user's scores.
 */
export function buildPersonalWinnerPayloadFromGwPoints(opts: {
  gwPointsRows: GwPointsRow[] | undefined | null;
  userId: string;
  gw: number;
  victoryType: 'gameweek' | 'monthly';
  seasonKey?: LeaderboardSeasonKey;
  liveSubstitutionGw?: number | null;
  liveTableRows?: Array<{ user_id?: string | null; score?: number | null }> | null;
}): PersonalWinnerBrowsePayload | null {
  const uid = String(opts.userId).toLowerCase();
  const gw = opts.gw;
  if (!uid || !Number.isFinite(gw) || gw <= 0) return null;

  if (opts.victoryType === 'gameweek') {
    const useLive =
      opts.liveSubstitutionGw != null &&
      opts.liveSubstitutionGw === gw &&
      (opts.liveTableRows?.length ?? 0) > 0;
    if (useLive) {
      const scores = (opts.liveTableRows ?? [])
        .filter((row) => row?.user_id != null && String(row.user_id).trim() !== '')
        .map((row) => ({
          user_id: String(row.user_id).toLowerCase(),
          score: Number(row.score ?? 0),
        }));
      if (!scores.some((row) => row.user_id === uid)) return null;
      const top = Math.max(...scores.map((row) => row.score));
      const winnerCount = scores.filter((row) => row.score === top).length;
      const mine = scores.find((row) => row.user_id === uid)?.score ?? Number.NEGATIVE_INFINITY;
      if (mine !== top || !Number.isFinite(top)) return null;
      return {
        gw,
        victoryType: 'gameweek',
        label: `Gameweek ${gw}`,
        points: top,
        winnerCount,
        joint: winnerCount > 1,
      };
    }

    const ladder = (opts.gwPointsRows ?? []).filter((row) => Number(row.gw) === gw);
    if (!ladder.some((row) => String(row.user_id).toLowerCase() === uid)) return null;
    const top = Math.max(...ladder.map((row) => Number(row.points ?? 0)));
    const winnerCount = ladder.filter((row) => Number(row.points ?? 0) === top).length;
    const mine = Number(ladder.find((row) => String(row.user_id).toLowerCase() === uid)?.points ?? Number.NEGATIVE_INFINITY);
    if (mine !== top || !Number.isFinite(top)) return null;
    return {
      gw,
      victoryType: 'gameweek',
      label: `Gameweek ${gw}`,
      points: top,
      winnerCount,
      joint: winnerCount > 1,
    };
  }

  const month = getMonthForGw(gw, opts.seasonKey ?? '2025/26');
  if (!month || gw !== month.endGw) return null;
  const totals = new Map<string, number>();
  for (const row of opts.gwPointsRows ?? []) {
    const rowGw = Number(row.gw);
    if (rowGw < month.startGw || rowGw > month.endGw) continue;
    const rowUser = String(row.user_id).toLowerCase();
    if (!rowUser) continue;
    totals.set(rowUser, (totals.get(rowUser) ?? 0) + Number(row.points ?? 0));
  }
  if (!totals.has(uid)) return null;
  const top = Math.max(...Array.from(totals.values()));
  const winnerCount = Array.from(totals.values()).filter((score) => score === top).length;
  const mine = totals.get(uid) ?? Number.NEGATIVE_INFINITY;
  if (mine !== top || !Number.isFinite(top)) return null;
  return {
    gw,
    victoryType: 'monthly',
    label: month.label,
    points: top,
    winnerCount,
    joint: winnerCount > 1,
  };
}
