import { playersMonthKey, playersWeekStart, shiftPlayersDay } from './day';
import { playersPosition, playersTotalsInRange, type PlayersPosition } from './results';
import type { PlayersScoreStore } from './scores';

/**
 * Consecutive days played, counting back from today. A streak survives until a
 * whole day is missed, so before today's game it still counts through yesterday.
 */
export function playersStreak(store: PlayersScoreStore, todayKey: string): number {
  let day = store[todayKey] ? todayKey : shiftPlayersDay(todayKey, -1);
  let streak = 0;
  while (store[day]) {
    streak += 1;
    day = shiftPlayersDay(day, -1);
  }
  return streak;
}

/**
 * All-time position by total correct answers, as on the Scoreboard's overall tab.
 * Ties share a position. Null when this player has no scores yet.
 */
export function playersOverallRank(scoresByUser: Record<string, PlayersScoreStore>, userId: string): number | null {
  const totals = playersTotalsInRange(scoresByUser, { from: '0000-00-00', to: '9999-12-31' });
  return playersPosition(totals, userId)?.rank ?? null;
}

export type PlayersPeriodRanks = {
  today: PlayersPosition | null;
  week: PlayersPosition | null;
  month: PlayersPosition | null;
  overall: PlayersPosition | null;
};

export type PlayersCareerDay = {
  dayKey: string;
  correct: number;
  total: number;
};

export type PlayersCareerStats = {
  daysPlayed: number;
  bestDay: PlayersCareerDay | null;
  worstDay: PlayersCareerDay | null;
  perfects: number;
  streak: number;
  weekCorrect: number | null;
  weekDaysPlayed: number;
};

export function computePlayersCareerStats(
  store: PlayersScoreStore | undefined,
  todayKey: string
): PlayersCareerStats {
  const days: PlayersCareerDay[] = [];
  for (const [dayKey, row] of Object.entries(store ?? {})) {
    const correct = Number(row?.correct);
    const total = Number(row?.total);
    if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) continue;
    days.push({ dayKey, correct, total });
  }
  days.sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  let perfects = 0;
  let bestDay: PlayersCareerDay | null = null;
  let worstDay: PlayersCareerDay | null = null;
  for (const day of days) {
    if (day.correct === day.total) perfects += 1;
    if (!bestDay || day.correct > bestDay.correct) bestDay = day;
    if (!worstDay || day.correct < worstDay.correct) worstDay = day;
  }

  const monday = playersWeekStart(todayKey);
  const weekDays = days.filter((day) => day.dayKey >= monday && day.dayKey <= todayKey);

  return {
    daysPlayed: days.length,
    bestDay,
    worstDay,
    perfects,
    streak: playersStreak(store ?? {}, todayKey),
    weekCorrect: weekDays.length ? weekDays.reduce((sum, day) => sum + day.correct, 0) : null,
    weekDaysPlayed: weekDays.length,
  };
}

export type PlayersTodayField = {
  mine: number;
  average: number;
  players: number;
  beatPct: number;
  topPct: number;
};

/** How today's score sits vs everyone who has played today. */
export function computePlayersTodayField(
  scoresByUser: Record<string, PlayersScoreStore> | undefined,
  userId: string,
  todayKey: string
): PlayersTodayField | null {
  const scores: Array<{ id: string; correct: number }> = [];
  for (const [id, store] of Object.entries(scoresByUser ?? {})) {
    const row = store?.[todayKey];
    const pts = Number(row?.correct);
    if (!Number.isFinite(pts)) continue;
    scores.push({ id, correct: pts });
  }
  const mine = scores.find((row) => row.id === userId);
  if (!mine) return null;
  const average = scores.reduce((sum, row) => sum + row.correct, 0) / scores.length;
  const others = scores.filter((row) => row.id !== userId);
  const beatPct = others.length ? (others.filter((row) => row.correct < mine.correct).length / others.length) * 100 : 100;
  const atOrAbove = scores.filter((row) => row.correct >= mine.correct).length;
  const topPct = Math.max(1, Math.min(99, Math.round((atOrAbove / scores.length) * 100)));
  return { mine: mine.correct, average, players: scores.length, beatPct, topPct };
}

export function playersPeriodRanks(
  scoresByUser: Record<string, PlayersScoreStore>,
  userId: string,
  todayKey: string
): PlayersPeriodRanks {
  const weekFrom = playersWeekStart(todayKey);
  const monthFrom = `${playersMonthKey(todayKey)}-01`;
  return {
    today: playersPosition(playersTotalsInRange(scoresByUser, { from: todayKey, to: todayKey }), userId),
    week: playersPosition(playersTotalsInRange(scoresByUser, { from: weekFrom, to: todayKey }), userId),
    month: playersPosition(playersTotalsInRange(scoresByUser, { from: monthFrom, to: todayKey }), userId),
    overall: playersPosition(playersTotalsInRange(scoresByUser, { from: '0000-00-00', to: todayKey }), userId),
  };
}
