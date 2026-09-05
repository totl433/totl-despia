import { describe, expect, it } from 'vitest';

import {
  alignGoalsToMatchScore,
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

describe('alignGoalsToMatchScore', () => {
  it('drops scorers when the score is still 0-0', () => {
    const goals = [{ minute: 66, scorer: 'Williams', team: 'Forest' }];
    expect(alignGoalsToMatchScore(goals, 0, 0, 'Forest', 'Spurs')).toBeNull();
  });

  it('keeps only as many goals as the score allows', () => {
    const goals = [
      { minute: 12, scorer: 'A', team: 'Forest' },
      { minute: 66, scorer: 'Williams', team: 'Forest' },
      { minute: 70, scorer: 'B', team: 'Spurs' },
    ];
    const aligned = alignGoalsToMatchScore(goals, 1, 0, 'Forest', 'Spurs');
    expect(aligned).toEqual([{ minute: 12, scorer: 'A', team: 'Forest' }]);
  });

  it('keeps matching goals when counts already agree', () => {
    const goals = [
      { minute: 12, scorer: 'A', team: 'Forest' },
      { minute: 70, scorer: 'B', team: 'Spurs' },
    ];
    expect(alignGoalsToMatchScore(goals, 1, 1, 'Forest', 'Spurs')).toEqual(goals);
  });

  it('does not invent scorers when score is ahead of the goals list', () => {
    const goals = [{ minute: 12, scorer: 'A', team: 'Forest' }];
    expect(alignGoalsToMatchScore(goals, 2, 1, 'Forest', 'Spurs')).toEqual(goals);
  });

  it('drops a home-attributed scorer when only the away side has scored', () => {
    const goals = [{ minute: 66, scorer: 'Williams', team: 'Forest' }];
    expect(alignGoalsToMatchScore(goals, 0, 1, 'Forest', 'Spurs')).toBeNull();
  });

  it('matches longer API team names to canonical short names', () => {
    const goals = [{ minute: 66, scorer: 'Williams', team: 'Nottingham Forest' }];
    expect(alignGoalsToMatchScore(goals, 1, 0, 'Forest', 'Spurs')).toEqual(goals);
  });

  it('returns null for empty input', () => {
    expect(alignGoalsToMatchScore([], 1, 0, 'Forest', 'Spurs')).toBeNull();
    expect(alignGoalsToMatchScore(null, 1, 0, 'Forest', 'Spurs')).toBeNull();
  });
});
