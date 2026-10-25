import { describe, expect, it } from 'vitest';

import { liveScoreBelongsToFixture, liveScoresForFixtures } from './liveScoreMatch';

describe('liveScoreBelongsToFixture', () => {
  it('keeps this week’s match id and drops last season’s gw=8 row', () => {
    const fixture = { api_match_id: 560630, kickoff_time: '2026-10-25T14:00:00Z' };
    expect(liveScoreBelongsToFixture(fixture, { api_match_id: 560630 })).toBe(true);
    expect(liveScoreBelongsToFixture(fixture, { api_match_id: 499001, fixture_index: 5 })).toBe(false);
  });

  it('filters a snapshot down to this week’s rows', () => {
    const fixtures = [{ api_match_id: 560620, fixture_index: 0 }];
    const rows = [
      { api_match_id: 499000, fixture_index: 0 },
      { api_match_id: 560620, fixture_index: 0 },
    ];
    expect(liveScoresForFixtures(fixtures, rows)).toEqual([{ api_match_id: 560620, fixture_index: 0 }]);
  });
});
