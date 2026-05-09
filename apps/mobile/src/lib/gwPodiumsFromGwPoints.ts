import type { GwPointsRow } from './profileStreakRows';

import { rankUserInGwLiveScores } from './gwLiveRank';

/**
 * Gameweeks where the user finishes 1st (ties share podium), from `app_v_gw_points` rows,
 * optionally using live Global GW ladder for one GW (active GW during LIVE).
 */
export function computePersonalGwPodiumWins(params: {
  gwPointsRows: GwPointsRow[] | undefined | null;
  userId: string | null | undefined;
  liveSubstitutionGw?: number | null;
  liveTableRows?: Array<{ user_id?: string | null; score?: number | null }> | null;
}): { wins: number; winningGwsDescending: number[] } {
  const { gwPointsRows, userId, liveSubstitutionGw, liveTableRows } = params;

  const uidNorm = typeof userId === 'string' && userId ? String(userId).toLowerCase() : '';
  if (!uidNorm || !gwPointsRows?.length) {
    return { wins: 0, winningGwsDescending: [] };
  }
  const byGw = new Map<number, Array<{ uid: string; pts: number }>>();
  for (const row of gwPointsRows) {
    const gw = Number(row.gw);
    const pts = Number(row.points ?? 0);
    if (!Number.isFinite(gw) || gw <= 0) continue;
    const uid = String(row.user_id ?? '').toLowerCase();
    if (!uid) continue;

    let list = byGw.get(gw);
    if (!list) {
      list = [];
      byGw.set(gw, list);
    }
    list.push({ uid, pts: Number.isFinite(pts) ? pts : 0 });
  }

  const substitutionGw =
    typeof liveSubstitutionGw === 'number' && Number.isFinite(liveSubstitutionGw)
      ? Math.round(liveSubstitutionGw)
      : null;

  const winners: number[] = [];

  const gwsToEvaluate = new Set<number>(byGw.keys());
  if (substitutionGw != null && liveTableRows?.length) {
    gwsToEvaluate.add(substitutionGw);
  }

  Array.from(gwsToEvaluate)
    .sort((a, b) => a - b)
    .forEach((gw) => {
      const uid = uidNorm;

      if (
        substitutionGw != null &&
        gw === substitutionGw &&
        liveTableRows != null &&
        liveTableRows.length > 0
      ) {
        const rowsForRank = liveTableRows
          .filter((r) => r?.user_id != null && String(r.user_id).trim() !== '')
          .map((r) => ({
            user_id: String(r.user_id),
            score: Number(r.score ?? 0),
          }));
        const rk = rankUserInGwLiveScores(uid, rowsForRank);
        /** Only count as a win if this GW already materialized for the user OR live includes them */
        if (rk === 1 && rowsForRank.some((r) => String(r.user_id).toLowerCase() === uid)) winners.push(gw);
        return;
      }

      const ladder = byGw.get(gw) ?? [];
      if (!ladder.some((x) => x.uid === uid)) return;
      let best = -Infinity;
      for (const x of ladder) {
        if (x.pts > best) best = x.pts;
      }
      const minePts = ladder.find((x) => x.uid === uid)?.pts ?? -Infinity;
      if (minePts === best && Number.isFinite(best)) winners.push(gw);
    });

  winners.sort((a, b) => b - a);
  return { wins: winners.length, winningGwsDescending: winners };
}
