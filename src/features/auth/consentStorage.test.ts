import { describe, expect, it } from 'vitest';
import { allowsAnalyticsCookies } from './consentStorage';

describe('allowsAnalyticsCookies', () => {
  it('allows analytics after accepting all cookies', () => {
    expect(
      allowsAnalyticsCookies({
        choice: 'all',
        preferences: {
          performance: true,
          analytics: true,
          marketing: true,
        },
      }),
    ).toBe(true);
  });

  it('uses the managed analytics preference', () => {
    expect(
      allowsAnalyticsCookies({
        choice: 'managed',
        preferences: {
          performance: true,
          analytics: true,
          marketing: false,
        },
      }),
    ).toBe(true);

    expect(
      allowsAnalyticsCookies({
        choice: 'managed',
        preferences: {
          performance: true,
          analytics: false,
          marketing: false,
        },
      }),
    ).toBe(false);
  });

  it('denies analytics without consent or with essential-only cookies', () => {
    expect(allowsAnalyticsCookies(null)).toBe(false);
    expect(allowsAnalyticsCookies({ choice: 'essential' })).toBe(false);
  });
});
