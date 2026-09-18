import { describe, expect, it } from 'vitest';
import { getOpeningFixtureIndex } from './openingFixture';

describe('getOpeningFixtureIndex', () => {
  it('returns solo Friday opener before Saturday batch', () => {
    const idx = getOpeningFixtureIndex([
      { fixture_index: 0, kickoff_time: '2025-09-19T19:00:00Z' },
      { fixture_index: 1, kickoff_time: '2025-09-20T11:30:00Z' },
      { fixture_index: 2, kickoff_time: '2025-09-20T14:00:00Z' },
    ]);
    expect(idx).toBe(0);
  });

  it('returns solo Sat 12:30 before 15:00 batch', () => {
    const idx = getOpeningFixtureIndex([
      { fixture_index: 1, kickoff_time: '2025-09-20T11:30:00Z' },
      { fixture_index: 2, kickoff_time: '2025-09-20T14:00:00Z' },
      { fixture_index: 3, kickoff_time: '2025-09-20T14:00:00Z' },
    ]);
    expect(idx).toBe(1);
  });

  it('returns null when all games share earliest kickoff', () => {
    const idx = getOpeningFixtureIndex([
      { fixture_index: 0, kickoff_time: '2025-09-20T14:00:00Z' },
      { fixture_index: 1, kickoff_time: '2025-09-20T14:00:00Z' },
    ]);
    expect(idx).toBe(null);
  });

  it('returns null when two fixtures tie for earliest kickoff', () => {
    const idx = getOpeningFixtureIndex([
      { fixture_index: 0, kickoff_time: '2025-09-20T11:30:00Z' },
      { fixture_index: 1, kickoff_time: '2025-09-20T11:30:00Z' },
      { fixture_index: 2, kickoff_time: '2025-09-20T14:00:00Z' },
    ]);
    expect(idx).toBe(null);
  });
});
