import { describe, expect, it, vi } from 'vitest';

import {
  BRANDED_BROADCAST_VOLLEY_USER_ID,
  BRANDED_LEADERBOARD_BROADCAST_WELCOME_SEED_KEY,
  buildBrandedBroadcastWelcomeMessage,
  canAccessBrandedBroadcast,
  canPostBrandedBroadcast,
  seedBrandedBroadcastWelcomeIfMissing,
} from './brandedLeaderboardBroadcast';

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
