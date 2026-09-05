import { describe, expect, it } from 'vitest';

import {
  shouldIgnoreTimedStatusRegression,
  shouldRunScheduledPollForSite,
} from './liveMatchGuards';

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

describe('shouldIgnoreTimedStatusRegression', () => {
  it('ignores TIMED/SCHEDULED after IN_PLAY or PAUSED', () => {
    expect(shouldIgnoreTimedStatusRegression('IN_PLAY', 'TIMED')).toBe(true);
    expect(shouldIgnoreTimedStatusRegression('IN_PLAY', 'SCHEDULED')).toBe(true);
    expect(shouldIgnoreTimedStatusRegression('PAUSED', 'TIMED')).toBe(true);
  });

  it('still accepts live, HT, and FT updates', () => {
    expect(shouldIgnoreTimedStatusRegression('IN_PLAY', 'IN_PLAY')).toBe(false);
    expect(shouldIgnoreTimedStatusRegression('IN_PLAY', 'PAUSED')).toBe(false);
    expect(shouldIgnoreTimedStatusRegression('PAUSED', 'IN_PLAY')).toBe(false);
    expect(shouldIgnoreTimedStatusRegression('IN_PLAY', 'FINISHED')).toBe(false);
    expect(shouldIgnoreTimedStatusRegression('PAUSED', 'FINISHED')).toBe(false);
  });

  it('does not block TIMED before a match has gone live in our DB', () => {
    expect(shouldIgnoreTimedStatusRegression('TIMED', 'TIMED')).toBe(false);
    expect(shouldIgnoreTimedStatusRegression(null, 'TIMED')).toBe(false);
    expect(shouldIgnoreTimedStatusRegression('SCHEDULED', 'TIMED')).toBe(false);
  });
});
