import { describe, expect, it } from 'vitest';

import { computePlayersCareerStats, computePlayersTodayField, playersPeriodRanks, playersStreak } from './stats';
import type { PlayersScoreStore } from './scores';

const ME = 'me';
const OTHER = 'other';

function s(correct: number, total = 10) {
  return { correct, total };
}

describe('playersPeriodRanks', () => {
  it('ranks today, week, month and overall from the same store as the scoreboard', () => {
    const mine: PlayersScoreStore = {
      '2026-10-19': s(8), // Monday
      '2026-10-24': s(3), // Saturday — today
    };
    const other: PlayersScoreStore = {
      '2026-10-19': s(9),
      '2026-10-24': s(6),
    };
    const ranks = playersPeriodRanks({ [ME]: mine, [OTHER]: other }, ME, '2026-10-24');
    expect(ranks.today).toEqual({ rank: 2, tied: false });
    expect(ranks.week).toEqual({ rank: 2, tied: false });
    expect(ranks.month).toEqual({ rank: 2, tied: false });
    expect(ranks.overall).toEqual({ rank: 2, tied: false });
  });

  it('returns null ranks when the player has no scores in that window', () => {
    const ranks = playersPeriodRanks({ [OTHER]: { '2026-10-24': s(4) } }, ME, '2026-10-24');
    expect(ranks.today).toBeNull();
    expect(ranks.week).toBeNull();
    expect(ranks.month).toBeNull();
    expect(ranks.overall).toBeNull();
  });
});

describe('playersStreak', () => {
  it('counts back through yesterday when today is not played yet', () => {
    expect(playersStreak({ '2026-10-23': s(5) }, '2026-10-24')).toBe(1);
  });
});

describe('computePlayersCareerStats', () => {
  it('builds best/worst, perfects, week and streak from day scores', () => {
    const store: PlayersScoreStore = {
      '2026-10-19': s(10),
      '2026-10-20': s(2),
      '2026-10-24': s(7),
    };
    const stats = computePlayersCareerStats(store, '2026-10-24');
    expect(stats.daysPlayed).toBe(3);
    expect(stats.bestDay).toEqual({ dayKey: '2026-10-19', correct: 10, total: 10 });
    expect(stats.worstDay).toEqual({ dayKey: '2026-10-20', correct: 2, total: 10 });
    expect(stats.perfects).toBe(1);
    expect(stats.weekCorrect).toBe(19);
    expect(stats.weekDaysPlayed).toBe(3);
    expect(stats.streak).toBe(1);
  });
});

describe('computePlayersTodayField', () => {
  it('compares the player to everyone who has a score today', () => {
    const field = computePlayersTodayField(
      {
        [ME]: { '2026-10-24': s(8) },
        [OTHER]: { '2026-10-24': s(4) },
        third: { '2026-10-24': s(6) },
      },
      ME,
      '2026-10-24'
    );
    expect(field?.mine).toBe(8);
    expect(field?.average).toBeCloseTo(6);
    expect(field?.players).toBe(3);
    expect(field?.beatPct).toBe(100);
    expect(field?.topPct).toBe(33);
  });

  it('is null when the player has not played today', () => {
    expect(computePlayersTodayField({ [OTHER]: { '2026-10-24': s(4) } }, ME, '2026-10-24')).toBeNull();
  });
});
