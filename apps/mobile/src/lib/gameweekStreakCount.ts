export type GameweekStreakRow = { gw: number; points: number | null };

/**
 * Consecutive gameweeks with a score, counting backward from the latest chip (Stats ladder order).
 */
export function countTrailingGameweekParticipationStreak(rows: GameweekStreakRow[]): number {
  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (typeof rows[i]!.points === 'number') streak++;
    else break;
  }
  return streak;
}
