import { describe, expect, it } from 'vitest';

import { shouldDefaultNewUserToSeasonStack, isNewSeasonFresh } from './seasonStack';

describe('new user season stack defaults', () => {
  it('starts post-launch accounts on the active season when preferences are missing', () => {
    expect(shouldDefaultNewUserToSeasonStack('2026-08-12T10:29:00Z', false)).toBe(true);
  });

  it('does not move existing accounts without preferences', () => {
    expect(shouldDefaultNewUserToSeasonStack('2026-08-11T23:59:59Z', false)).toBe(false);
  });

  it('preserves an explicit preference row', () => {
    expect(shouldDefaultNewUserToSeasonStack('2026-08-12T10:29:00Z', true)).toBe(false);
  });

  it('does not treat a missing timestamp as a new-season account', () => {
    expect(shouldDefaultNewUserToSeasonStack(null, false)).toBe(false);
    expect(shouldDefaultNewUserToSeasonStack(undefined, false)).toBe(false);
  });
});

describe('isNewSeasonFresh', () => {
  it('is false on legacy stack', () => {
    expect(isNewSeasonFresh({ useSeasonStack: false, seasonId: null, hasCompletedResults: null })).toBe(false);
  });

  it('stays empty until the season folder has a result', () => {
    expect(
      isNewSeasonFresh({
        useSeasonStack: true,
        seasonId: 'e0a58f84-9575-4b6b-adca-320defc04b46',
        hasCompletedResults: false,
      })
    ).toBe(true);
  });

  it('unfreezes once GW1 results exist, even for 2026/27', () => {
    expect(
      isNewSeasonFresh({
        useSeasonStack: true,
        seasonId: 'e0a58f84-9575-4b6b-adca-320defc04b46',
        hasCompletedResults: true,
      })
    ).toBe(false);
  });
});
