import { describe, expect, it } from 'vitest';

import { formatCollapseId, formatDeepLink } from './catalog';

const MATCH_NOTIFICATION_KEYS = [
  'kickoff',
  'goal-scored',
  'goal-disallowed',
  'half-time',
  'final-whistle',
  'gameweek-complete',
] as const;

describe('score notification catalog', () => {
  it.each(MATCH_NOTIFICATION_KEYS)('%s opens predictions in the app', notificationKey => {
    expect(formatDeepLink(notificationKey, {})).toBe('/predictions');
  });

  it('season-scopes gameweek completion device grouping', () => {
    expect(
      formatCollapseId('gameweek-complete', {
        season_scope: 'season-26-27',
        gw: 1,
      })
    ).toBe('gw_complete:season-26-27:1');
    expect(
      formatCollapseId('gameweek-complete', {
        season_scope: 'legacy',
        gw: 1,
      })
    ).toBe('gw_complete:legacy:1');
  });
});
