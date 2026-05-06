import type { UserStatsData } from '@totl/domain';

import type { GameweekStreakRow } from './gameweekStreakCount';
import { supabase } from './supabase';

export type { GameweekStreakRow };

export async function fetchAllSupabaseRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/** Same query + paging as Global monthly leaderboard — shared React Query cache key. */
export async function fetchAppGwPointsPaged(): Promise<GwPointsRow[]> {
  return fetchAllSupabaseRows<GwPointsRow>((from, to) =>
    supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .order('gw', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to)
  );
}

export type GwPointsRow = { user_id: string; gw: number; points: number };

export type WeeklyParChartRow = { gw: number; userPoints: number; averagePoints: number };

/** Distinct GW numbers present in leaderboard rows (materialized view), ascending. */
export function inferGwSequenceFromGwPointsRows(rows: GwPointsRow[]): number[] {
  const s = new Set<number>();
  for (const r of rows) {
    const gw = Number(r.gw);
    if (Number.isFinite(gw)) s.add(gw);
  }
  return [...s].sort((a, b) => a - b);
}

/**
 * “Vs the field” — full paged `app_v_gw_points` + optional live GW score.
 * Pass **`gwSequence` only for GWs this user played** (e.g. `inferUserPlayedGwSequence`), plus optional active GW when live score applies.
 */
export function buildWeeklyParFromLeaderboardGwPoints(args: {
  gwPointsRows: GwPointsRow[];
  userId: string;
  gwSequence: number[];
  activeLeaderboardGw: number | null;
  myLiveGwScore: number | null;
}): WeeklyParChartRow[] {
  const { gwPointsRows, userId, gwSequence, activeLeaderboardGw, myLiveGwScore } = args;

  const poolByGw = new Map<number, number[]>();
  const mineByGw = new Map<number, number>();

  for (const r of gwPointsRows) {
    const gw = Number(r.gw);
    const pts = Number(r.points ?? 0);
    const arr = poolByGw.get(gw) ?? [];
    arr.push(pts);
    poolByGw.set(gw, arr);
    if (String(r.user_id) === String(userId)) mineByGw.set(gw, pts);
  }

  const activeGw = activeLeaderboardGw;
  const liveScore =
    typeof activeGw === 'number' && myLiveGwScore != null && Number.isFinite(myLiveGwScore)
      ? myLiveGwScore
      : null;

  return gwSequence.map((gw) => {
    let userPoints = mineByGw.get(gw);
    if (liveScore != null && gw === activeGw) userPoints = liveScore;
    userPoints = userPoints ?? 0;

    const pool = poolByGw.get(gw) ?? [];
    const averagePoints = pool.length > 0 ? pool.reduce((a, b) => a + b, 0) / pool.length : userPoints;

    return { gw, userPoints, averagePoints };
  });
}

/** Ladder fallback when `gameweekStreak` is absent (aligned with BFF weekly par ladder). */
export function streakFallbackFromWeeklyPar(stats: UserStatsData): GameweekStreakRow[] | null {
  const lc =
    typeof stats.lastCompletedGw === 'number' && stats.lastCompletedGw > 0 ? stats.lastCompletedGw : null;
  const par = stats.weeklyParData;
  if (!lc || !Array.isArray(par) || par.length === 0) return null;
  const byGw = new Map(par.map((r) => [r.gw, r.userPoints]));
  const minGw = Math.min(...par.map((r) => r.gw));
  const rows: GameweekStreakRow[] = [];
  for (let gw = minGw; gw <= lc; gw++) {
    rows.push({ gw, points: byGw.has(gw) ? byGw.get(gw)! : null });
  }
  return rows;
}

/** Drop chips above `lastCompletedGw` so streak reflects finalized gameweeks only (matches BFF streak ladder). */
export function capGameweekStreakRowsAtLastCompleted(
  rows: GameweekStreakRow[] | null | undefined,
  lastCompletedGw: number | null | undefined
): GameweekStreakRow[] | null {
  if (!rows?.length) return rows ?? null;
  const cap =
    typeof lastCompletedGw === 'number' && lastCompletedGw > 0 ? lastCompletedGw : null;
  if (cap == null) return rows;
  const next = rows.filter((r) => r.gw <= cap);
  return next.length ? next : null;
}

/**
 * Fill streak chips from the same sources as the monthly leaderboard:
 * `app_v_gw_points` (paged view) per GW, and the active GW live table score when applicable.
 */
export function mergeGameweekStreakWithLeaderboardGwPoints(args: {
  stats: UserStatsData;
  userId: string;
  gwPointsRows: GwPointsRow[];
  activeLeaderboardGw: number | null;
  /** Your score for `activeLeaderboardGw` from `getGlobalGwLiveTable`, if available */
  myLiveGwScore: number | null;
}): GameweekStreakRow[] | null {
  const cap =
    typeof args.stats.lastCompletedGw === 'number' && args.stats.lastCompletedGw > 0
      ? args.stats.lastCompletedGw
      : null;

  const rawBase =
    args.stats.gameweekStreak && args.stats.gameweekStreak.length > 0
      ? args.stats.gameweekStreak
      : streakFallbackFromWeeklyPar(args.stats);
  const base =
    cap != null && rawBase?.length ? rawBase.filter((row) => row.gw <= cap) : rawBase;
  if (!base?.length) return null;

  const mine = new Map<number, number>();
  for (const r of args.gwPointsRows) {
    if (String(r.user_id) !== String(args.userId)) continue;
    mine.set(Number(r.gw), Number(r.points ?? 0));
  }

  const activeGw = args.activeLeaderboardGw;
  const liveScore =
    typeof activeGw === 'number' && args.myLiveGwScore != null && Number.isFinite(args.myLiveGwScore)
      ? args.myLiveGwScore
      : null;

  return base.map((row) => {
    let pts: number | null = null;
    const liveHere =
      liveScore != null &&
      typeof activeGw === 'number' &&
      row.gw === activeGw &&
      (cap == null || activeGw <= cap);
    if (liveHere) {
      pts = liveScore;
    } else if (mine.has(row.gw)) {
      pts = mine.get(row.gw)!;
    } else if (typeof row.points === 'number') {
      pts = row.points;
    }
    return { gw: row.gw, points: pts };
  });
}
