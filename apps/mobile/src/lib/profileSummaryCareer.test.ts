import { describe, expect, it } from 'vitest';

import { mergeProfileCareerTotals } from './profileSummaryCareerLogic';

describe('mergeProfileCareerTotals', () => {
  const all = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('adds this season onto a complete last-season streak', () => {
    expect(
      mergeProfileCareerTotals({
        priorOcp: 1779,
        seasonOcp: 42,
        priorPlayed: all(38),
        priorThroughGw: 38,
        seasonPlayed: all(8),
        seasonThroughGw: 8,
      })
    ).toEqual({ ocp: 1821, weeksStreak: 46 });
  });

  it('does not carry last season if this season skipped a week', () => {
    expect(
      mergeProfileCareerTotals({
        priorOcp: 1779,
        seasonOcp: 30,
        priorPlayed: all(38),
        priorThroughGw: 38,
        seasonPlayed: [2, 3, 4, 5, 6, 7, 8],
        seasonThroughGw: 8,
      }).weeksStreak
    ).toBe(7);
  });
});
