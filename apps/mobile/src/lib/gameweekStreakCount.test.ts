import { describe, expect, it } from 'vitest';

import { countTrailingGameweekParticipationStreak } from './gameweekStreakCount';

describe('countTrailingGameweekParticipationStreak', () => {
  it('counts only trailing scored gameweeks (skipped weeks break streak)', () => {
    const rows = [
      { gw: 32, points: null },
      { gw: 33, points: null },
      { gw: 34, points: null },
      { gw: 35, points: 6 },
    ];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(1);
  });

  it('counts a longer trailing run', () => {
    const rows = [
      { gw: 10, points: null },
      { gw: 11, points: 5 },
      { gw: 12, points: 4 },
      { gw: 13, points: 8 },
    ];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(3);
  });

  it('returns 0 when latest gameweek has no score', () => {
    const rows = [
      { gw: 34, points: 5 },
      { gw: 35, points: null },
    ];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(0);
  });

  it('counts gameweeks with 0 points as participation', () => {
    const rows = [{ gw: 35, points: 0 }];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(1);
  });
});
