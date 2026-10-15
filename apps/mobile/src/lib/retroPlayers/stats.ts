import { scoreOverall, type PlayersScoreStore } from './scores';

function shiftDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Consecutive days played, counting back from today. A streak survives until a
 * whole day is missed, so before today's game it still counts through yesterday.
 */
export function playersStreak(store: PlayersScoreStore, todayKey: string): number {
  let day = store[todayKey] ? todayKey : shiftDayKey(todayKey, -1);
  let streak = 0;
  while (store[day]) {
    streak += 1;
    day = shiftDayKey(day, -1);
  }
  return streak;
}

/**
 * All-time position by total correct answers, as on the Scoreboard's overall tab.
 * Ties share a position. Null when this player has no scores yet.
 */
export function playersOverallRank(scoresByUser: Record<string, PlayersScoreStore>, userId: string): number | null {
  const mine = scoreOverall(scoresByUser[userId] ?? {});
  if (mine == null) return null;
  let ahead = 0;
  for (const [id, store] of Object.entries(scoresByUser)) {
    if (id === userId) continue;
    const total = scoreOverall(store);
    if (total != null && total > mine) ahead += 1;
  }
  return ahead + 1;
}
