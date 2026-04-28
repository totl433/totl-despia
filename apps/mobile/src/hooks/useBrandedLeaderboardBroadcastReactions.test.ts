import { describe, expect, it } from 'vitest';

import type { BrandedLeaderboardBroadcastUiMessage } from '../lib/brandedLeaderboardBroadcastUnread';
import {
  applyDelete,
  applyInsert,
  buildReactionsFromMessages,
  type BroadcastReactionsByMessage,
} from '../lib/brandedLeaderboardBroadcastReactions';

function makeMessage(
  overrides: Partial<BrandedLeaderboardBroadcastUiMessage>
): BrandedLeaderboardBroadcastUiMessage {
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
    reactions: overrides.reactions ?? [],
    status: overrides.status,
  };
}

describe('buildReactionsFromMessages', () => {
  it('collects seeded reaction summaries by message id', () => {
    expect(
      buildReactionsFromMessages([
        makeMessage({
          id: 'm1',
          reactions: [
            { emoji: '🔥', count: 2, hasUserReacted: true },
            { emoji: '👏', count: 1, hasUserReacted: false },
          ],
        }),
        makeMessage({ id: 'm2', reactions: [] }),
      ])
    ).toEqual({
      m1: [
        { emoji: '🔥', count: 2, hasUserReacted: true },
        { emoji: '👏', count: 1, hasUserReacted: false },
      ],
    });
  });
});

describe('broadcast reaction optimistic helpers', () => {
  it('increments or inserts on optimistic add', () => {
    const previous: BroadcastReactionsByMessage = {
      m1: [{ emoji: '🔥', count: 1, hasUserReacted: false }],
    };

    expect(
      applyInsert(previous, { message_id: 'm1', emoji: '🔥', user_id: 'viewer-1' }, 'viewer-1')
    ).toEqual({
      m1: [{ emoji: '🔥', count: 2, hasUserReacted: true }],
    });

    expect(
      applyInsert(previous, { message_id: 'm1', emoji: '👏', user_id: 'viewer-1' }, 'viewer-1')
    ).toEqual({
      m1: [
        { emoji: '🔥', count: 1, hasUserReacted: false },
        { emoji: '👏', count: 1, hasUserReacted: true },
      ],
    });
  });

  it('decrements and removes empty reactions on optimistic delete', () => {
    const previous: BroadcastReactionsByMessage = {
      m1: [
        { emoji: '🔥', count: 2, hasUserReacted: true },
        { emoji: '👏', count: 1, hasUserReacted: false },
      ],
    };

    expect(
      applyDelete(previous, { message_id: 'm1', emoji: '🔥', user_id: 'viewer-1' }, 'viewer-1')
    ).toEqual({
      m1: [
        { emoji: '🔥', count: 1, hasUserReacted: false },
        { emoji: '👏', count: 1, hasUserReacted: false },
      ],
    });

    expect(
      applyDelete(
        { m1: [{ emoji: '👏', count: 1, hasUserReacted: true }] },
        { message_id: 'm1', emoji: '👏', user_id: 'viewer-1' },
        'viewer-1'
      )
    ).toEqual({});
  });
});
