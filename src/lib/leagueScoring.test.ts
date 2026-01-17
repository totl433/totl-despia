import { describe, expect, it } from 'vitest';
import { computeGwTableRows, type GwTableResultRow } from './leagueScoring';

describe('computeGwTableRows', () => {
  const members = [
    { id: 'user1', name: 'Alice' },
    { id: 'user2', name: 'Bob' },
    { id: 'user3', name: 'Charlie' },
  ];

  it('calculates scores + unicorns from results for a finished GW', () => {
    const picks = [
      { user_id: 'user1', gw: 1, fixture_index: 0, pick: 'H' as const },
      { user_id: 'user2', gw: 1, fixture_index: 0, pick: 'D' as const },
      { user_id: 'user3', gw: 1, fixture_index: 0, pick: 'H' as const },

      { user_id: 'user1', gw: 1, fixture_index: 1, pick: 'A' as const },
      { user_id: 'user2', gw: 1, fixture_index: 1, pick: 'A' as const },
      { user_id: 'user3', gw: 1, fixture_index: 1, pick: 'H' as const },

      { user_id: 'user1', gw: 1, fixture_index: 2, pick: 'D' as const },
      { user_id: 'user2', gw: 1, fixture_index: 2, pick: 'H' as const },
      { user_id: 'user3', gw: 1, fixture_index: 2, pick: 'D' as const },
    ];

    const results = [
      { gw: 1, fixture_index: 0, result: 'H' as const, home_goals: 2, away_goals: 1 },
      { gw: 1, fixture_index: 1, result: 'A' as const, home_goals: 0, away_goals: 3 },
      { gw: 1, fixture_index: 2, result: 'H' as const, home_goals: 1, away_goals: 0 },
    ];

    const expected: GwTableResultRow[] = [
      { user_id: 'user2', name: 'Bob', score: 2, unicorns: 1 },
      { user_id: 'user1', name: 'Alice', score: 2, unicorns: 0 },
      { user_id: 'user3', name: 'Charlie', score: 1, unicorns: 0 },
    ];

    expect(
      computeGwTableRows({
        members,
        picks,
        results,
        liveScores: {},
        resGw: 1,
        currentGw: 1,
        isApiTestLeague: false,
        currentTestGw: null,
      })
    ).toEqual(expected);
  });

  it('uses live scores for the current GW (regular league)', () => {
    const picks = [
      { user_id: 'user1', gw: 1, fixture_index: 0, pick: 'H' as const },
      { user_id: 'user2', gw: 1, fixture_index: 0, pick: 'D' as const },
      { user_id: 'user3', gw: 1, fixture_index: 0, pick: 'H' as const },
      { user_id: 'user1', gw: 1, fixture_index: 1, pick: 'A' as const },
      { user_id: 'user2', gw: 1, fixture_index: 1, pick: 'A' as const },
      { user_id: 'user3', gw: 1, fixture_index: 1, pick: 'H' as const },
    ];

    const liveScores = {
      0: { homeScore: 2, awayScore: 1, status: 'FINISHED' },
      1: { homeScore: 0, awayScore: 3, status: 'IN_PLAY', minute: 70 },
      2: { homeScore: 0, awayScore: 0, status: 'SCHEDULED' },
    };

    const expected: GwTableResultRow[] = [
      { user_id: 'user1', name: 'Alice', score: 2, unicorns: 0 },
      { user_id: 'user2', name: 'Bob', score: 1, unicorns: 0 },
      { user_id: 'user3', name: 'Charlie', score: 1, unicorns: 0 },
    ];

    expect(
      computeGwTableRows({
        members,
        picks,
        results: [],
        liveScores,
        resGw: 1,
        currentGw: 1,
        isApiTestLeague: false,
        currentTestGw: null,
      })
    ).toEqual(expected);
  });

  it('returns empty if no members', () => {
    expect(
      computeGwTableRows({
        members: [],
        picks: [],
        results: [],
        liveScores: {},
        resGw: 1,
        currentGw: 1,
        isApiTestLeague: false,
        currentTestGw: null,
      })
    ).toEqual([]);
  });
});

