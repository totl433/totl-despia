import { describe, expect, it, vi } from 'vitest';

import {
  BRANDED_BROADCAST_VOLLEY_USER_ID,
  BRANDED_LEADERBOARD_BROADCAST_WELCOME_SEED_KEY,
  buildBrandedBroadcastWelcomeMessage,
  canAccessBrandedBroadcast,
  canPostBrandedBroadcast,
  seedBrandedBroadcastWelcomeIfMissing,
} from './brandedLeaderboardBroadcast';
import {
  getBrandedBroadcastNotifierUrl,
  selectBrandedBroadcastRecipientIds,
} from './brandedLeaderboardBroadcastNotifications';
import { buildBroadcastReactionSummaries } from './brandedLeaderboardBroadcastReactions';

describe('brandedLeaderboardBroadcast permissions', () => {
  it('allows only hosts or admins to post', () => {
    expect(canPostBrandedBroadcast({ isHost: true, isAdmin: false })).toBe(true);
    expect(canPostBrandedBroadcast({ isHost: false, isAdmin: true })).toBe(true);
    expect(canPostBrandedBroadcast({ isHost: false, isAdmin: false })).toBe(false);
  });

  it('allows members with access, hosts, or admins to read broadcast', () => {
    expect(canAccessBrandedBroadcast({ hasAccess: true, isHost: false, isAdmin: false })).toBe(true);
    expect(canAccessBrandedBroadcast({ hasAccess: false, isHost: true, isAdmin: false })).toBe(true);
    expect(canAccessBrandedBroadcast({ hasAccess: false, isHost: false, isAdmin: true })).toBe(true);
    expect(canAccessBrandedBroadcast({ hasAccess: false, isHost: false, isAdmin: false })).toBe(false);
  });
});

describe('seedBrandedBroadcastWelcomeIfMissing', () => {
  it('does not insert when the welcome already exists', async () => {
    const insertWelcome = vi.fn(async () => {});

    await seedBrandedBroadcastWelcomeIfMissing({
      hasExistingWelcome: async () => true,
      insertWelcome,
      leaderboardName: 'FCB Picks',
      hostNames: ['Jof'],
    });

    expect(insertWelcome).not.toHaveBeenCalled();
  });

  it('inserts the Volley welcome once when missing', async () => {
    const insertWelcome = vi.fn(async () => {});

    await seedBrandedBroadcastWelcomeIfMissing({
      hasExistingWelcome: async () => false,
      insertWelcome,
      leaderboardName: 'FCB Picks',
      leaderboardCreatedAt: '2026-04-04T10:00:00.000Z',
      hostNames: ['Jof', 'Carl'],
    });

    expect(insertWelcome).toHaveBeenCalledWith({
      seedKey: BRANDED_LEADERBOARD_BROADCAST_WELCOME_SEED_KEY,
      userId: BRANDED_BROADCAST_VOLLEY_USER_ID,
      content: 'Welcome to FCB Picks. Jof and Carl will post updates for subscribers here throughout the season.',
      createdAt: '2026-04-04T10:00:00.000Z',
    });
  });

  it('treats duplicate-key insert races as a successful idempotent seed', async () => {
    await expect(
      seedBrandedBroadcastWelcomeIfMissing({
        hasExistingWelcome: async () => false,
        insertWelcome: async () => {
          throw { code: '23505' };
        },
        leaderboardName: 'FCB Picks',
        hostNames: ['Jof'],
      })
    ).resolves.toBeUndefined();
  });
});

describe('buildBrandedBroadcastWelcomeMessage', () => {
  it('falls back to a generic welcome when no host names exist', () => {
    expect(
      buildBrandedBroadcastWelcomeMessage({
        leaderboardName: 'FCB Picks',
        hostNames: [],
      })
    ).toBe('Welcome to FCB Picks. Hosts will post updates for subscribers here throughout the season.');
  });
});

describe('selectBrandedBroadcastRecipientIds', () => {
  it('keeps only active non-sender memberships once each', () => {
    expect(
      selectBrandedBroadcastRecipientIds(
        [
          { user_id: 'host-1', left_at: null },
          { user_id: 'user-1', left_at: null },
          { user_id: 'user-1', left_at: null },
          { user_id: 'user-2', left_at: '2026-04-19T10:00:00.000Z' },
          { user_id: null, left_at: null },
          {},
        ],
        'host-1'
      )
    ).toEqual(['user-1']);
  });
});

describe('getBrandedBroadcastNotifierUrl', () => {
  it('builds the notify function URL without duplicate slashes', () => {
    expect(getBrandedBroadcastNotifierUrl('https://playtotl.com/')).toBe(
      'https://playtotl.com/.netlify/functions/notifyBrandedBroadcastV2'
    );
  });

  it('falls back to the production site when SITE_URL is missing', () => {
    expect(getBrandedBroadcastNotifierUrl()).toBe(
      'https://playtotl.com/.netlify/functions/notifyBrandedBroadcastV2'
    );
  });
});

describe('buildBroadcastReactionSummaries', () => {
  it('aggregates counts per emoji and marks the viewer reaction', () => {
    expect(
      buildBroadcastReactionSummaries(
        [
          { message_id: 'm1', emoji: '🔥', user_id: 'user-1' },
          { message_id: 'm1', emoji: '🔥', user_id: 'user-2' },
          { message_id: 'm1', emoji: '👏', user_id: 'viewer-1' },
          { message_id: 'm2', emoji: '👍', user_id: 'viewer-1' },
        ],
        'viewer-1'
      )
    ).toEqual({
      m1: [
        { emoji: '🔥', count: 2, hasUserReacted: false },
        { emoji: '👏', count: 1, hasUserReacted: true },
      ],
      m2: [{ emoji: '👍', count: 1, hasUserReacted: true }],
    });
  });
});
