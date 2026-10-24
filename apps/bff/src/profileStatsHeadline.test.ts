import { describe, expect, it } from 'vitest';

import {
  countTrailingPlayedWeeks,
  isLeftoverPriorSeasonLastCompleted,
  resolveStatsHeadlineGws,
} from './profileStatsHeadline';

describe('resolveStatsHeadlineGws', () => {
  it('uses the current season last completed week during results', () => {
    expect(resolveStatsHeadlineGws({ lastCompletedGw: 8, metaGw: 8 })).toEqual({
      lastCompletedGw: 8,
      highlightGw: 8,
    });
  });

  it('highlights the live / published meta week when it is ahead', () => {
    expect(resolveStatsHeadlineGws({ lastCompletedGw: 8, metaGw: 9 })).toEqual({
      lastCompletedGw: 8,
      highlightGw: 9,
    });
  });

  it('does not keep GW38 as latest after a new-season current_gw reset', () => {
    expect(resolveStatsHeadlineGws({ lastCompletedGw: 38, metaGw: 1 })).toEqual({
      lastCompletedGw: null,
      highlightGw: 1,
    });
  });

  it('shows the published week when the new season has no results yet', () => {
    expect(resolveStatsHeadlineGws({ lastCompletedGw: null, metaGw: 8 })).toEqual({
      lastCompletedGw: null,
      highlightGw: 8,
    });
  });
});

describe('countTrailingPlayedWeeks', () => {
  const all = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('adds this season onto a complete prior-season run', () => {
    expect(
      countTrailingPlayedWeeks([
        { played: all(38), throughGw: 38 },
        { played: all(8), throughGw: 8 },
      ])
    ).toBe(46);
  });

  it('breaks when this season skipped a week', () => {
    expect(
      countTrailingPlayedWeeks([
        { played: all(38), throughGw: 38 },
        { played: [2, 3, 4, 5, 6, 7, 8], throughGw: 8 },
      ])
    ).toBe(7);
  });

  it('keeps last season only when this season has no completed weeks', () => {
    expect(countTrailingPlayedWeeks([{ played: all(38), throughGw: 38 }, { played: [1], throughGw: 0 }])).toBe(38);
  });
});

describe('isLeftoverPriorSeasonLastCompleted', () => {
  it('detects 2025/26 GW38 left in app_gw_results after current_gw reset', () => {
    expect(isLeftoverPriorSeasonLastCompleted(38, 1)).toBe(true);
  });

  it('is false mid-season when results and meta line up', () => {
    expect(isLeftoverPriorSeasonLastCompleted(8, 9)).toBe(false);
    expect(isLeftoverPriorSeasonLastCompleted(8, 8)).toBe(false);
  });
});
