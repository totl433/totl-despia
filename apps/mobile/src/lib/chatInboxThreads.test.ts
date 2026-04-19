import { describe, expect, it } from 'vitest';

import { buildChatInboxRows } from './chatInboxThreads';

describe('buildChatInboxRows', () => {
  it('mixes broadcast rows alongside league chats and sorts unread first', () => {
    const rows = buildChatInboxRows({
      threadRouteName: 'Chat2Thread',
      leagues: [
        { id: 'league-1', name: 'Alpha FC', avatar: null },
        { id: 'league-2', name: 'Beta FC', avatar: null },
      ],
      unreadByLeagueId: {
        'league-1': 0,
        'league-2': 1,
      },
      lastLeagueMessageByLeagueId: {
        'league-1': {
          content: 'Earlier chat',
          created_at: '2026-04-18T10:00:00.000Z',
          user_id: 'user-1',
        },
        'league-2': {
          content: 'Latest league chat',
          created_at: '2026-04-19T10:00:00.000Z',
          user_id: 'user-2',
        },
      },
      leaguePreviewByLeagueId: {
        'league-1': 'Alice: Earlier chat',
        'league-2': 'Bob: Latest league chat',
      },
      brandedLeaderboards: [
        {
          leaderboard: {
            id: 'broadcast-1',
            display_name: 'Carl Broadcasts',
            header_image_url: null,
          },
          membership: {},
          subscription: null,
          canPostBroadcast: true,
        } as any,
      ],
      unreadBroadcastByLeaderboardId: {
        'broadcast-1': 2,
      },
      lastBroadcastByLeaderboardId: {
        'broadcast-1': {
          content: 'Host update',
          created_at: '2026-04-19T09:00:00.000Z',
          user_id: 'host-1',
        },
      },
      broadcastPreviewByLeaderboardId: {
        'broadcast-1': 'Host: Host update',
      },
    });

    expect(rows.map((row) => row.key)).toEqual([
      'league:league-2',
      'broadcast:broadcast-1',
      'league:league-1',
    ]);
    expect(rows[1]).toMatchObject({
      type: 'broadcast',
      title: 'Carl Broadcasts',
      preview: 'Host: Host update',
      unread: 2,
      canPostBroadcast: true,
    });
  });

  it('keeps row-specific navigation payloads for league and broadcast threads', () => {
    const rows = buildChatInboxRows({
      threadRouteName: 'ChatThread',
      leagues: [{ id: 'league-1', name: 'Alpha FC', avatar: null }],
      unreadByLeagueId: {},
      lastLeagueMessageByLeagueId: {},
      leaguePreviewByLeagueId: {},
      brandedLeaderboards: [
        {
          leaderboard: {
            id: 'broadcast-1',
            display_name: 'Carl Broadcasts',
            header_image_url: null,
          },
          membership: {},
          subscription: null,
          canPostBroadcast: false,
        } as any,
      ],
      unreadBroadcastByLeaderboardId: {},
      lastBroadcastByLeaderboardId: {},
      broadcastPreviewByLeaderboardId: {},
    });

    expect(rows.find((row) => row.type === 'broadcast')).toMatchObject({
      type: 'broadcast',
      leaderboardId: 'broadcast-1',
    });
    expect(rows.find((row) => row.type === 'league')).toMatchObject({
      type: 'league',
      leagueId: 'league-1',
      routeName: 'ChatThread',
    });
  });
});
