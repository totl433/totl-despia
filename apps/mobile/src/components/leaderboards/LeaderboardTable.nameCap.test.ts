import { describe, expect, it } from 'vitest';

import { leaderboardNameCharacterCap } from './leaderboardNameCap';

const week = {
  rankWidth: 24,
  compactCount: 7,
  compactColumnWidth: 18,
  valueColumnWidth: 44,
};

describe('leaderboardNameCharacterCap', () => {
  it('leaves names uncapped when there are no day columns', () => {
    expect(leaderboardNameCharacterCap({ tableWidth: 390, rankWidth: 36, compactCount: 0, compactColumnWidth: 34, valueColumnWidth: 70 })).toBeNull();
  });

  it('gives a smaller phone fewer letters than a larger one', () => {
    const se = leaderboardNameCharacterCap({ ...week, tableWidth: 320 });
    const pro = leaderboardNameCharacterCap({ ...week, tableWidth: 393 });
    const max = leaderboardNameCharacterCap({ ...week, tableWidth: 430 });
    expect(se).toBeLessThan(pro as number);
    expect(pro).toBeLessThanOrEqual(max as number);
    expect(se).toBeGreaterThanOrEqual(8);
    expect(max).toBeLessThanOrEqual(18);
  });
});
