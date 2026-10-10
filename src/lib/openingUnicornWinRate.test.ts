import { describe, expect, it } from 'vitest';
import { computeOpeningUnicornWinRate, buildGwDeadlinesFromFixtures } from './openingUnicornWinRate';

describe('computeOpeningUnicornWinRate', () => {
  const fixtures = [
    { gw: 1, fixture_index: 0, kickoff_time: '2025-09-20T11:30:00Z' },
    { gw: 1, fixture_index: 1, kickoff_time: '2025-09-20T14:00:00Z' },
    { gw: 1, fixture_index: 2, kickoff_time: '2025-09-20T14:00:00Z' },
  ];

  const gwDeadlines = buildGwDeadlinesFromFixtures(fixtures);

  it('counts a win when opening-unicorn player tops the gameweek', () => {
    const result = computeOpeningUnicornWinRate({
      leagues: [{ id: 'L1', name: 'Test League', created_at: '2020-01-01T00:00:00Z' }],
      members: [
        { league_id: 'L1', user_id: 'u1' },
        { league_id: 'L1', user_id: 'u2' },
        { league_id: 'L1', user_id: 'u3' },
      ],
      fixtures,
      picks: [
        { user_id: 'u1', gw: 1, fixture_index: 0, pick: 'H' },
        { user_id: 'u2', gw: 1, fixture_index: 0, pick: 'A' },
        { user_id: 'u3', gw: 1, fixture_index: 0, pick: 'A' },
        { user_id: 'u1', gw: 1, fixture_index: 1, pick: 'H' },
        { user_id: 'u2', gw: 1, fixture_index: 1, pick: 'H' },
        { user_id: 'u3', gw: 1, fixture_index: 1, pick: 'A' },
        { user_id: 'u1', gw: 1, fixture_index: 2, pick: 'D' },
        { user_id: 'u2', gw: 1, fixture_index: 2, pick: 'D' },
        { user_id: 'u3', gw: 1, fixture_index: 2, pick: 'H' },
      ],
      results: [
        { gw: 1, fixture_index: 0, result: 'H' },
        { gw: 1, fixture_index: 1, result: 'H' },
        { gw: 1, fixture_index: 2, result: 'D' },
      ],
      gwDeadlines,
    });

    expect(result.total).toBe(1);
    expect(result.wins).toBe(1);
    expect(result.winRatePercent).toBe(100);
    expect(result.events[0]?.userId).toBe('u1');
    expect(result.events[0]?.wonGw).toBe(true);
  });

  it('counts a loss when opening-unicorn player does not win the gameweek', () => {
    const result = computeOpeningUnicornWinRate({
      leagues: [{ id: 'L1', name: 'Test League', created_at: '2020-01-01T00:00:00Z' }],
      members: [
        { league_id: 'L1', user_id: 'u1' },
        { league_id: 'L1', user_id: 'u2' },
        { league_id: 'L1', user_id: 'u3' },
      ],
      fixtures,
      picks: [
        { user_id: 'u1', gw: 1, fixture_index: 0, pick: 'H' },
        { user_id: 'u2', gw: 1, fixture_index: 0, pick: 'A' },
        { user_id: 'u3', gw: 1, fixture_index: 0, pick: 'A' },
        { user_id: 'u1', gw: 1, fixture_index: 1, pick: 'A' },
        { user_id: 'u2', gw: 1, fixture_index: 1, pick: 'H' },
        { user_id: 'u3', gw: 1, fixture_index: 1, pick: 'H' },
        { user_id: 'u1', gw: 1, fixture_index: 2, pick: 'A' },
        { user_id: 'u2', gw: 1, fixture_index: 2, pick: 'H' },
        { user_id: 'u3', gw: 1, fixture_index: 2, pick: 'H' },
      ],
      results: [
        { gw: 1, fixture_index: 0, result: 'H' },
        { gw: 1, fixture_index: 1, result: 'H' },
        { gw: 1, fixture_index: 2, result: 'H' },
      ],
      gwDeadlines,
    });

    expect(result.total).toBe(1);
    expect(result.wins).toBe(0);
    expect(result.winRatePercent).toBe(0);
    expect(result.events[0]?.wonGw).toBe(false);
  });
});
