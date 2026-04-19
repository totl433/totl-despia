import { describe, expect, it } from 'vitest';

import { countUnreadBroadcastMessages, type BrandedLeaderboardBroadcastUiMessage } from '../lib/brandedLeaderboardBroadcastUnread';

function makeMessage(overrides: Partial<BrandedLeaderboardBroadcastUiMessage>): BrandedLeaderboardBroadcastUiMessage {
  return {
    id: overrides.id ?? 'm1',
    leaderboard_id: overrides.leaderboard_id ?? 'lb1',
    user_id: overrides.user_id ?? 'host-1',
    content: overrides.content ?? 'Update',
    message_type: overrides.message_type ?? 'host',
    seed_key: overrides.seed_key ?? null,
    created_at: overrides.created_at ?? '2026-04-04T10:00:00.000Z',
    user_name: overrides.user_name ?? 'Host',
    user_avatar_url: overrides.user_avatar_url ?? null,
    status: overrides.status,
  };
}

describe('countUnreadBroadcastMessages', () => {
  it('counts only host messages newer than the read cursor and not sent by the viewer', () => {
    expect(
      countUnreadBroadcastMessages({
        userId: 'viewer-1',
        lastReadAt: '2026-04-04T10:05:00.000Z',
        messages: [
          makeMessage({ id: 'welcome', user_id: '00000000-0000-0000-0000-000000000001', message_type: 'system', created_at: '2026-04-04T10:00:00.000Z' }),
          makeMessage({ id: 'mine', user_id: 'viewer-1', created_at: '2026-04-04T10:06:00.000Z' }),
          makeMessage({ id: 'old', user_id: 'host-1', created_at: '2026-04-04T10:04:00.000Z' }),
          makeMessage({ id: 'new', user_id: 'host-2', created_at: '2026-04-04T10:07:00.000Z' }),
        ],
      })
    ).toBe(1);
  });

  it('counts all non-system host messages when there is no read cursor yet', () => {
    expect(
      countUnreadBroadcastMessages({
        userId: 'viewer-1',
        lastReadAt: null,
        messages: [
          makeMessage({ id: 'welcome', user_id: '00000000-0000-0000-0000-000000000001', message_type: 'system' }),
          makeMessage({ id: 'new-1', user_id: 'host-1' }),
          makeMessage({ id: 'new-2', user_id: 'host-2', created_at: '2026-04-04T10:08:00.000Z' }),
        ],
      })
    ).toBe(2);
  });

  it('treats equivalent offset and Z timestamps as already read', () => {
    expect(
      countUnreadBroadcastMessages({
        userId: 'viewer-1',
        lastReadAt: '2026-04-04T10:07:00.000Z',
        messages: [makeMessage({ id: 'same-instant', user_id: 'host-2', created_at: '2026-04-04T10:07:00+00:00' })],
      })
    ).toBe(0);
  });
});
