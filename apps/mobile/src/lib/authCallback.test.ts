import { describe, expect, it } from 'vitest';

import { isAuthCallbackUrl, isPasswordRecoveryUrl } from './authCallbackUrl';

describe('isAuthCallbackUrl', () => {
  it('accepts the native auth callback scheme', () => {
    expect(isAuthCallbackUrl('com.despia.totlnative://auth/callback#access_token=aaa&refresh_token=bbb')).toBe(true);
    expect(isAuthCallbackUrl('com.despia.totlnative://auth/callback?type=signup&token_hash=abc')).toBe(true);
  });

  it('accepts playtotl auth confirmation links', () => {
    expect(isAuthCallbackUrl('https://playtotl.com/auth?type=signup&token_hash=abc')).toBe(true);
    expect(isAuthCallbackUrl('https://playtotl.com/auth#access_token=aaa&refresh_token=bbb&type=signup')).toBe(true);
  });

  it('detects password recovery links', () => {
    expect(isPasswordRecoveryUrl('com.despia.totlnative://auth/callback?type=recovery&token_hash=abc')).toBe(true);
    expect(isPasswordRecoveryUrl('https://playtotl.com/auth?type=recovery&token_hash=abc')).toBe(true);
    expect(isPasswordRecoveryUrl('https://playtotl.com/auth#access_token=aaa&type=recovery')).toBe(true);
    expect(isPasswordRecoveryUrl('https://playtotl.com/auth?type=signup&token_hash=abc')).toBe(false);
  });

  it('ignores ordinary app links', () => {
    expect(isAuthCallbackUrl('https://playtotl.com/league/ABC12')).toBe(false);
    expect(isAuthCallbackUrl('https://playtotl.com/predictions')).toBe(false);
    expect(isAuthCallbackUrl('com.despia.totlnative://league/ABC12')).toBe(false);
  });
});
