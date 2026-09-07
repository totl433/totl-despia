import { describe, expect, it } from 'vitest';
import { friendlyAuthError, normalizeAuthEmail } from './authEmail';

describe('normalizeAuthEmail', () => {
  it('trims whitespace and lowercases email addresses', () => {
    expect(normalizeAuthEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('normalizes Googlemail aliases consistently with web sign-in', () => {
    expect(normalizeAuthEmail('User@googlemail.com')).toBe('user@gmail.com');
  });
});

describe('friendlyAuthError', () => {
  it('maps invalid credentials to actionable copy', () => {
    expect(friendlyAuthError(new Error('Invalid login credentials'))).toContain('email or password');
  });

  it('maps network timeouts to retry guidance', () => {
    expect(friendlyAuthError(new Error('Sign in timed out.'))).toContain('connection');
  });
});

