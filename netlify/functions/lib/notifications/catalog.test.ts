import { describe, expect, it } from 'vitest';

import { formatDeepLink } from './catalog';

describe('live match notification deep links', () => {
  it.each([
    'goal-scored',
    'goal-disallowed',
    'kickoff',
    'half-time',
    'final-whistle',
  ])('routes %s notifications to home predictions', (notificationKey) => {
    expect(
      formatDeepLink(notificationKey, { api_match_id: 12345 }, 'https://playtotl.com')
    ).toBe('https://playtotl.com/predictions');
  });

  it('does not change gameweek-complete routing implicitly', () => {
    expect(formatDeepLink('gameweek-complete', { gw: 1 }, 'https://playtotl.com')).toBeNull();
  });

  it('routes final-submission to the exact mini-league gameweek table', () => {
    expect(
      formatDeepLink('final-submission', { leagueCode: 'TVYY4' }, 'https://playtotl.com')
    ).toBe('https://playtotl.com/league/TVYY4?tab=gw');
  });
});
