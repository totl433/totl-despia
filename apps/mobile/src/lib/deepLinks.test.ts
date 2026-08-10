import { describe, expect, it } from 'vitest';

import {
  buildLeagueAppLink,
  buildMiniLeagueInviteLink,
  getDeepLinkDedupeKey,
  resolveDeepLinkTarget,
} from './deepLinks';

describe('resolveDeepLinkTarget', () => {
  it.each([
    ['https://playtotl.com/league/ABC12', { type: 'league', code: 'ABC12', openChat: false }],
    [
      'https://playtotl.com/league/ABC12?tab=chat',
      { type: 'league', code: 'ABC12', openChat: true },
    ],
    [
      'https://playtotl.com/league/ABC12?tab=predictions',
      { type: 'league', code: 'ABC12', openChat: false, initialTab: 'predictions' },
    ],
    [
      'https://playtotl.com/league/ABC12?tab=gw',
      { type: 'league', code: 'ABC12', openChat: false, initialTab: 'gwTable' },
    ],
    ['https://playtotl.com/predictions', { type: 'predictions' }],
    ['https://playtotl.com/leagues', { type: 'leagues' }],
    ['https://playtotl.com/join-league/ABC12', { type: 'miniLeagueInvite', code: 'ABC12' }],
    ['https://playtotl.com/join/RAMEN', { type: 'join', code: 'RAMEN' }],
    [
      'https://playtotl.com/branded-leaderboards/example-slug',
      { type: 'brandedLeaderboard', idOrSlug: 'example-slug' },
    ],
    [
      'https://playtotl.com/branded-leaderboards/example-slug?tab=broadcast',
      { type: 'brandedLeaderboard', idOrSlug: 'example-slug', initialTab: 'broadcast' },
    ],
  ])('maps %s to its native destination', (url, expected) => {
    expect(resolveDeepLinkTarget(url)).toEqual(expected);
  });

  it('supports current and legacy custom-scheme notification URLs', () => {
    expect(resolveDeepLinkTarget('com.despia.totlnative:///league/ABC12?tab=chat')).toEqual({
      type: 'league',
      code: 'ABC12',
      openChat: true,
    });
    expect(resolveDeepLinkTarget('com.despia.totlnative://league/ABC12?tab=chat')).toEqual({
      type: 'league',
      code: 'ABC12',
      openChat: true,
    });
  });

  it('keeps older staging-host league shares routable in the app', () => {
    expect(resolveDeepLinkTarget('https://totl-staging.netlify.app/league/TVYY4')).toEqual({
      type: 'league',
      code: 'TVYY4',
      openChat: false,
    });
  });

  it('keeps legacy final-submission URLs routable to the same league table', () => {
    expect(
      resolveDeepLinkTarget('https://totl-staging.netlify.app/?leagueCode=TVYY4&tab=gw')
    ).toEqual({
      type: 'league',
      code: 'TVYY4',
      openChat: false,
      initialTab: 'gwTable',
    });
  });

  it('rejects unsupported paths', () => {
    expect(resolveDeepLinkTarget('https://playtotl.com/privacy-policy')).toBeNull();
  });

  it('builds canonical production links for future league shares', () => {
    expect(buildLeagueAppLink('tvyy4')).toBe('https://playtotl.com/league/TVYY4');
    expect(buildLeagueAppLink('tvyy4', 'chat')).toBe('https://playtotl.com/league/TVYY4?tab=chat');
    expect(buildMiniLeagueInviteLink('tvyy4')).toBe('https://playtotl.com/join-league/TVYY4');
  });

  it('deduplicates universal and custom-scheme delivery of the same destination', () => {
    expect(getDeepLinkDedupeKey('https://playtotl.com/league/TVYY4?tab=chat')).toBe(
      getDeepLinkDedupeKey('com.despia.totlnative:///league/TVYY4?tab=chat')
    );
  });
});
