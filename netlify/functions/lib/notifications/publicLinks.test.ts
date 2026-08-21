import { describe, expect, it } from 'vitest';

import {
  buildLeaguePublicUrl,
  canonicalizeNotificationData,
  canonicalizePublicAppUrl,
} from './publicLinks';

describe('public notification links', () => {
  it('builds exact production league destinations', () => {
    expect(buildLeaguePublicUrl('tvyy4')).toBe('https://playtotl.com/league/TVYY4');
    expect(buildLeaguePublicUrl('tvyy4', 'chat')).toBe('https://playtotl.com/league/TVYY4?tab=chat');
  });

  it('rewrites staging links without losing their destination', () => {
    expect(
      canonicalizePublicAppUrl('https://totl-staging.netlify.app/league/TVYY4?tab=chat')
    ).toBe('https://playtotl.com/league/TVYY4?tab=chat');
  });

  it('canonicalizes URL fields in notification data', () => {
    expect(
      canonicalizeNotificationData({
        url: '/league/TVYY4',
        navigateTo: 'https://totl-staging.netlify.app/league/TVYY4?tab=chat',
      })
    ).toEqual({
      url: 'https://playtotl.com/league/TVYY4',
      navigateTo: 'https://playtotl.com/league/TVYY4?tab=chat',
    });
  });
});
