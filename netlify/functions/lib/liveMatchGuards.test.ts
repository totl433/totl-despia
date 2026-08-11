import { describe, expect, it } from 'vitest';

import { shouldRunScheduledPollForSite } from './liveMatchGuards';

describe('scheduled live-score polling site guard', () => {
  it('allows the canonical production site', () => {
    expect(shouldRunScheduledPollForSite('https://playtotl.com')).toBe(true);
    expect(shouldRunScheduledPollForSite('https://www.playtotl.com')).toBe(true);
  });

  it('blocks staging from competing for the production poll lock', () => {
    expect(shouldRunScheduledPollForSite('https://totl-staging.netlify.app')).toBe(false);
  });

  it('allows local invocation without a Netlify site URL', () => {
    expect(shouldRunScheduledPollForSite('')).toBe(true);
  });
});
