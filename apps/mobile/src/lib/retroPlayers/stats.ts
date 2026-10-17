import { shiftPlayersDay } from './day';
import { playersPosition, playersTotalsInRange } from './results';
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
