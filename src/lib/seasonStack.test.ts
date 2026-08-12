import { describe, expect, it } from 'vitest';

import { shouldDefaultNewUserToSeasonStack } from './seasonStack';

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
});
