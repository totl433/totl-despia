import { describe, expect, it } from 'vitest';

import { extractSignupVerificationParams } from './authUrl';

describe('signup confirmation URL parsing', () => {
  it('reads confirmation parameters directly on the auth route', () => {
    expect(
      extractSignupVerificationParams({
        search: '?type=signup&token_hash=abc123&email=test%40example.com',
        hash: '',
        origin: 'https://playtotl.com',
      })
    ).toEqual({ tokenHash: 'abc123', email: 'test@example.com' });
  });

  it('recovers confirmation parameters nested by the auth redirect', () => {
    expect(
      extractSignupVerificationParams({
        search: '?returnTo=%2F%3Ftype%3Dsignup%26token_hash%3Dabc123%26email%3Dtest%2540example.com',
        hash: '',
        origin: 'https://playtotl.com',
        returnTo: '/?type=signup&token_hash=abc123&email=test%40example.com',
      })
    ).toEqual({ tokenHash: 'abc123', email: 'test@example.com' });
  });
});
