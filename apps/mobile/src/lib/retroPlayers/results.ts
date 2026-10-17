import { playersDaysInMonth, playersMonthName, playersWeekStart, shiftPlayersDay } from './day';
import type { PlayersScoreStore } from './scores';

/**
 * Result cards shown on entering The Players, before today's quiz: last month,
 * last week, then yesterday. Pure logic only (no storage or network), so the
 * rules are testable; the screen supplies scores, names and what has been seen.
 *
 * Ranking is the Scoreboard's: total correct answers, ties share a position and
 * the next position skips (1, 1, 3). A win is 1st with more than 0 points,
 * matching the Scoreboard's winner highlight.
 */

export type PlayersResultPeriod = 'month' | 'week' | 'day';

/** Shown in this order. */
export const PLAYERS_RESULT_ORDER: PlayersResultPeriod[] = ['month', 'week', 'day'];

/** Questions in one day's game, used when a period has no stored total. */
const DEFAULT_DAY_TOTAL = 10;

export type PlayersPosition = { rank: number; tied: boolean };

export type PlayersPeriodWinners = {
  score: number;
  userIds: string[];
};

export type PlayersResult = {
  period: PlayersResultPeriod;
  /** The day, the week's Monday, or the month ("2026-10"). Acknowledgement is stored against it. */
  key: string;
  /** Card heading: "Yesterday", "Last week" or the month's name. */
  title: string;
  winner: boolean;
  position: PlayersPosition;
  points: number;
  maxPoints: number;
  winners: PlayersPeriodWinners;
  /** Yesterday's card only: positions in yesterday's week and month, and overall, at the end of yesterday. */
  standings?: {
    monthName: string;
    week: PlayersPosition | null;
    month: PlayersPosition | null;
    overall: PlayersPosition | null;
  };
};

/** Last acknowledged key per period. Keys sort in time order, so anything at or before it has been seen. */
export type PlayersResultsSeen = Partial<Record<PlayersResultPeriod, string>>;

type Range = { from: string; to: string };

/** Each player's total over the range, for players with at least one game in it. */
export function playersTotalsInRange(scoresByUser: Record<string, PlayersScoreStore>, range: Range): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [userId, store] of Object.entries(scoresByUser)) {
    let played = false;
    let total = 0;
    for (const [day, score] of Object.entries(store ?? {})) {
      if (day < range.from || day > range.to || !score) continue;
      played = true;
      total += Number(score.correct) || 0;
    }
    if (played) totals[userId] = total;
  }
  return totals;
}

/** Competition ranking, as on the Scoreboard. Null when the player has no total. */
export function playersPosition(totals: Record<string, number>, userId: string): PlayersPosition | null {
  const mine = totals[userId];
  if (mine == null) return null;
  let ahead = 0;
  let level = 0;
  for (const [id, total] of Object.entries(totals)) {
    if (id === userId) continue;
    if (total > mine) ahead += 1;
    else if (total === mine) level += 1;
  }
  return { rank: ahead + 1, tied: level > 0 };
}

export function playersTopOf(totals: Record<string, number>): PlayersPeriodWinners {
  const values = Object.values(totals);
  if (!values.length) return { score: 0, userIds: [] };
  const score = Math.max(...values);
  const userIds = Object.keys(totals)
    .filter((id) => totals[id] === score)
    .sort();
  return { score, userIds };
}

function dayTotal(store: PlayersScoreStore | undefined, range: Range): number {
  let best = 0;
  for (const [day, score] of Object.entries(store ?? {})) {
    if (day < range.from || day > range.to) continue;
    best = Math.max(best, Number(score?.total) || 0);
  }
  return best || DEFAULT_DAY_TOTAL;
}

function daysInRange(range: Range): number {
  let n = 0;
  for (let day = range.from; day <= range.to; day = shiftPlayersDay(day, 1)) n += 1;
  return n;
}

function buildResult(
  period: PlayersResultPeriod,
  key: string,
  title: string,
  range: Range,
  scoresByUser: Record<string, PlayersScoreStore>,
  userId: string
): PlayersResult | null {
  const totals = playersTotalsInRange(scoresByUser, range);
  const position = playersPosition(totals, userId);
  if (!position) return null;
  const winners = playersTopOf(totals);
  const points = totals[userId] ?? 0;
  return {
    period,
    key,
    title,
    winner: position.rank === 1 && winners.score > 0,
    position,
    points,
    maxPoints: daysInRange(range) * dayTotal(scoresByUser[userId], range),
    winners,
  };
}

/** The completed periods a player returning on `todayKey` could see results for. */
export function playersResultPeriods(todayKey: string): Record<PlayersResultPeriod, { key: string; range: Range }> {
  const yesterday = shiftPlayersDay(todayKey, -1);
  const thisWeek = playersWeekStart(todayKey);
  const lastWeek = shiftPlayersDay(thisWeek, -7);
  const thisMonthStart = `${todayKey.slice(0, 7)}-01`;
  const lastMonthEnd = shiftPlayersDay(thisMonthStart, -1);
  const lastMonth = lastMonthEnd.slice(0, 7);
  return {
    day: { key: yesterday, range: { from: yesterday, to: yesterday } },
    week: { key: lastWeek, range: { from: lastWeek, to: shiftPlayersDay(lastWeek, 6) } },
    month: { key: lastMonth, range: { from: `${lastMonth}-01`, to: `${lastMonth}-${String(playersDaysInMonth(lastMonthEnd)).padStart(2, '0')}` } },
  };
}

export function isPlayersResultSeen(seen: PlayersResultsSeen, period: PlayersResultPeriod, key: string): boolean {
  const last = seen[period];
  return last != null && last >= key;
}

/**
 * Result cards still to show, monthly first. A period is only offered once it has ended
 * (each is the one before today's), only if the player played in it, and only until
 * it has been acknowledged. Yesterday's card needs a game yesterday; a missed
 * yesterday is never stood in for by an older day.
 */
export function pendingPlayersResults(opts: {
  scoresByUser: Record<string, PlayersScoreStore>;
  userId: string;
  todayKey: string;
  seen: PlayersResultsSeen;
}): PlayersResult[] {
  const { scoresByUser, userId, todayKey, seen } = opts;
  const periods = playersResultPeriods(todayKey);
  const out: PlayersResult[] = [];
  for (const period of PLAYERS_RESULT_ORDER) {
    const { key, range } = periods[period];
    if (isPlayersResultSeen(seen, period, key)) continue;
    const title = period === 'day' ? 'Yesterday' : period === 'week' ? 'Last week' : playersMonthName(`${key}-01`);
    const result = buildResult(period, key, title, range, scoresByUser, userId);
    if (!result) continue;
    if (period === 'day') {
      const weekFrom = playersWeekStart(key);
      const monthFrom = `${key.slice(0, 7)}-01`;
      result.standings = {
        monthName: playersMonthName(key),
        week: playersPosition(playersTotalsInRange(scoresByUser, { from: weekFrom, to: key }), userId),
        month: playersPosition(playersTotalsInRange(scoresByUser, { from: monthFrom, to: key }), userId),
        overall: playersPosition(playersTotalsInRange(scoresByUser, { from: '0000-00-00', to: key }), userId),
      };
    }
    out.push(result);
  }
  return out;
}

/** Marks a result as seen, never moving a period's mark backwards. */
export function markPlayersResultSeen(seen: PlayersResultsSeen, period: PlayersResultPeriod, key: string): PlayersResultsSeen {
  if (isPlayersResultSeen(seen, period, key)) return seen;
  return { ...seen, [period]: key };
}

/** Later mark per period from two copies (this phone and the account). */
export function mergePlayersResultsSeen(a: PlayersResultsSeen, b: PlayersResultsSeen): PlayersResultsSeen {
  const out: PlayersResultsSeen = {};
  for (const period of PLAYERS_RESULT_ORDER) {
    const x = a[period];
    const y = b[period];
    const later = x && y ? (x > y ? x : y) : x ?? y;
    if (later) out[period] = later;
  }
  return out;
}

/** Only well-formed marks survive (the account copy is free-form metadata). */
export function parsePlayersResultsSeen(value: unknown): PlayersResultsSeen {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const out: PlayersResultsSeen = {};
  for (const period of PLAYERS_RESULT_ORDER) {
    const v = raw[period];
    if (typeof v === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(v)) out[period] = v;
  }
  return out;
}

// ─── Wording ───────────────────────────────────────────────────────────────

/** 1st, 2nd, 3rd, 11th, 1,335th. */
export function playersOrdinal(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
  return `${n.toLocaleString('en-GB')}${suffix}`;
}

export function playersPositionLabel(position: PlayersPosition | null): string {
  if (!position) return '—';
  return position.tied ? `Joint ${playersOrdinal(position.rank)}` : playersOrdinal(position.rank);
}

/** "You · 52", "Jof · 59", "You + 2 others · 52" or "5 players tied · 59". */
export function playersWinnerLabel(winners: PlayersPeriodWinners, userId: string, names: Record<string, string>): string {
  const { userIds, score } = winners;
  if (!userIds.length) return '—';
  if (userIds.length === 1) {
    const id = userIds[0]!;
    return `${id === userId ? 'You' : names[id]?.trim() || 'Player'} · ${score}`;
  }
  if (userIds.includes(userId)) {
    const others = userIds.length - 1;
    return `You + ${others} ${others === 1 ? 'other' : 'others'} · ${score}`;
  }
  return `${userIds.length} players tied · ${score}`;
}

/** Message sent with the shared card image. */
export function playersResultShareMessage(result: PlayersResult): string {
  const when = result.period === 'day' ? 'yesterday' : result.period === 'week' ? 'last week' : `in ${result.title}`;
  const place = result.position.tied ? `joint ${playersOrdinal(result.position.rank)}` : playersOrdinal(result.position.rank);
  const lead = result.winner ? `I won The Players ${when}` : `I finished ${place} on The Players ${when}`;
  return `${lead} with ${result.points}/${result.maxPoints}. Can you beat me? https://playtotl.com`;
}
