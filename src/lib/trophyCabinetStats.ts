/**
 * Leaderboard trophy cabinet counts — matches app Stats cabinet:
 * Gameweek (#1 on weekly table), Monthly (month buckets), Season (champ cards).
 * Not the legacy 5/10-week form leaderboards.
 */

import { supabase } from './supabase';
import {
  getMonthAllocations,
  SEASON_LAST_GW,
  type LeaderboardSeasonKey,
} from './leaderboardMonths';
import { fetchUserLeaguesFromDb } from '../api/leagues';

export type GwPointsRow = { user_id: string; gw: number; points: number };

export type TrophyCabinetCounts = {
  gameweek: number;
  monthly: number;
  season: number;
};

/** #1 (ties share) on each completed gameweek the user appeared in `app_v_gw_points`. */
export function computeGameweekTrophyWins(userId: string, rows: GwPointsRow[]): number {
  const uid = String(userId).toLowerCase();
  const byGw = new Map<number, Array<{ uid: string; pts: number }>>();
  for (const r of rows) {
    const gw = Number(r.gw);
    if (!Number.isFinite(gw) || gw <= 0) continue;
    const id = String(r.user_id ?? '').toLowerCase();
    if (!id) continue;
    const list = byGw.get(gw) ?? [];
    list.push({ uid: id, pts: Number(r.points ?? 0) });
    byGw.set(gw, list);
  }

  let wins = 0;
  byGw.forEach((ladder) => {
    if (!ladder.some((x) => x.uid === uid)) return;
    let best = -Infinity;
    for (const x of ladder) {
      if (x.pts > best) best = x.pts;
    }
    const mine = ladder.find((x) => x.uid === uid)?.pts ?? -Infinity;
    if (mine === best && Number.isFinite(best)) wins += 1;
  });
  return wins;
}

/** Month-end periods completed (`lastCompletedGw >= endGw`) where user tied/led the monthly pool. */
export function computeMonthlyTrophyWins(
  userId: string,
  rows: GwPointsRow[],
  lastCompletedGw: number,
  seasonKey: LeaderboardSeasonKey = '2025/26'
): number {
  const uid = String(userId).toLowerCase();
  const lc = lastCompletedGw;
  let wins = 0;

  for (const m of getMonthAllocations(seasonKey)) {
    if (lc < m.endGw) continue;
    const playedMonth = rows.some(
      (r) => String(r.user_id).toLowerCase() === uid && r.gw >= m.startGw && r.gw <= m.endGw
    );
    if (!playedMonth) continue;

    const totals = new Map<string, number>();
    for (const r of rows) {
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
    if ((totals.get(uid) ?? Number.NEGATIVE_INFINITY) === maxMonth) wins += 1;
  }
  return wins;
}

/** True when every fixture in the season-finale GW has a settled H/D/A result. */
export async function isSeasonFinaleGwFullyComplete(
  seasonCtx?: { useSeasonStack?: boolean; seasonId?: string | null }
): Promise<boolean> {
  const gw = SEASON_LAST_GW;
  const useSeason = !!seasonCtx?.useSeasonStack;
  const fixturesTable = useSeason ? 'app_season_fixtures' : 'app_fixtures';
  const resultsTable = useSeason ? 'app_season_results' : 'app_gw_results';

  let fixturesQ = (supabase as any).from(fixturesTable).select('fixture_index').eq('gw', gw);
  if (useSeason && seasonCtx?.seasonId) fixturesQ = fixturesQ.eq('season_id', seasonCtx.seasonId);
  const fixturesRes = await fixturesQ;
  if (fixturesRes.error) return false;
  const fixtureCount = (fixturesRes.data ?? []).length;
  if (fixtureCount === 0) return false;

  let resultsQ = (supabase as any).from(resultsTable).select('fixture_index,result').eq('gw', gw);
  if (useSeason && seasonCtx?.seasonId) resultsQ = resultsQ.eq('season_id', seasonCtx.seasonId);
  const resultsRes = await resultsQ;
  if (resultsRes.error) return false;
  const settled = new Set<number>();
  for (const r of (resultsRes.data ?? []) as Array<{ fixture_index?: number; result?: string }>) {
    if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') continue;
    const fi = Number(r.fixture_index);
    if (Number.isFinite(fi)) settled.add(fi);
  }
  return settled.size >= fixtureCount;
}

function sumUserPointsInRange(rows: GwPointsRow[], userId: string, startGw: number, endGw: number): number {
  const uid = String(userId).toLowerCase();
  let s = 0;
  for (const r of rows) {
    if (String(r.user_id).toLowerCase() !== uid) continue;
    const g = Number(r.gw);
    if (g >= startGw && g <= endGw) s += Number(r.points ?? 0);
  }
  return s;
}

/**
 * Season trophies after the finale is fully resulted:
 * - +1 if joint/sole #1 on overall OCP for 2025/26 (legacy overall table)
 * - +1 per mini-league where the user is joint/sole #1 on season OCP among members
 *   (aligned with global overall champion + mini-league season win spirit on the app cabinet)
 */
export async function computeSeasonTrophyWins(
  userId: string,
  rows: GwPointsRow[],
  lastCompletedGw: number
): Promise<number> {
  if (lastCompletedGw < SEASON_LAST_GW) return 0;
  // Note: call sites pass stack rows already; finale completion still checks fixtures/results.
  // Prefer active season ctx when available in future; for now legacy finale (GW 38).
  if (!(await isSeasonFinaleGwFullyComplete())) return 0;

  let count = 0;
  const end = SEASON_LAST_GW;

  // Overall TOTL champion (joint OK) on cumulative season points in the GW materialization.
  const universe = new Set<string>();
  for (const r of rows) {
    if (r.gw >= 1 && r.gw <= end) universe.add(String(r.user_id));
  }
  let maxSeason = -Infinity;
  universe.forEach((uid) => {
    const v = sumUserPointsInRange(rows, uid, 1, end);
    if (v > maxSeason) maxSeason = v;
  });
  const mySeason = sumUserPointsInRange(rows, userId, 1, end);
  if (Number.isFinite(maxSeason) && mySeason === maxSeason && universe.has(String(userId))) {
    count += 1;
  }

  // Mini-league season wins: top cumulative OCP among league members for the full campaign.
  try {
    const leagues = await fetchUserLeaguesFromDb(userId);
    for (const league of leagues) {
      const leagueId = String(league.id ?? '');
      if (!leagueId) continue;
      const { data: memberRows, error } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);
      if (error || !memberRows?.length) continue;
      const memberIds = memberRows.map((m: { user_id?: string }) => String(m.user_id ?? '')).filter(Boolean);
      if (memberIds.length < 2) continue;
      if (!memberIds.includes(userId)) continue;

      let maxMl = -Infinity;
      const memberTotals = new Map<string, number>();
      for (const mid of memberIds) {
        const t = sumUserPointsInRange(rows, mid, 1, end);
        memberTotals.set(mid, t);
        if (t > maxMl) maxMl = t;
      }
      const mine = memberTotals.get(userId) ?? Number.NEGATIVE_INFINITY;
      if (Number.isFinite(maxMl) && mine === maxMl) count += 1;
    }
  } catch (e) {
    console.error('[trophyCabinetStats] Mini-league season count failed:', e);
  }

  return count;
}

export async function computeTrophyCabinetCounts(
  userId: string,
  rows: GwPointsRow[],
  lastCompletedGw: number,
  options?: { seasonKey?: LeaderboardSeasonKey }
): Promise<TrophyCabinetCounts> {
  const gameweek = computeGameweekTrophyWins(userId, rows);
  const monthly = computeMonthlyTrophyWins(
    userId,
    rows,
    lastCompletedGw,
    options?.seasonKey
  );
  const season = await computeSeasonTrophyWins(userId, rows, lastCompletedGw);
  return { gameweek, monthly, season };
}
