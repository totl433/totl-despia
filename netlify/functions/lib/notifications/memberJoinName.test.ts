import { describe, expect, it } from 'vitest';

import { resolveMemberJoinName } from './memberJoinName';

describe('member join display name', () => {
  it('prefers the canonical profile username', () => {
    expect(
      resolveMemberJoinName({
        profileName: 'Jof',
        authMetadata: { display_name: 'Fallback name' },
      })
    ).toBe('Jof');
  });

  it('uses authenticated metadata when the profile row is missing', () => {
    expect(
      resolveMemberJoinName({
        authMetadata: { display_name: 'Carl' },
        suppliedName: 'Someone',
      })
    ).toBe('Carl');
  });

  it('never emits the anonymous Someone placeholder', () => {
    expect(resolveMemberJoinName({ suppliedName: 'Someone' })).toBe('A player');
  });
});
