import type { BrandedBroadcastReactionSummary } from '@totl/domain';

import type { BrandedLeaderboardBroadcastUiMessage } from './brandedLeaderboardBroadcastUnread';

export const BROADCAST_REACTION_EMOJIS = ['👍', '🔥', '👏', '🙌', '😮', '😬', '👎'] as const;

export type BroadcastReactionsByMessage = Record<string, BrandedBroadcastReactionSummary[]>;

export type BroadcastReactionRow = {
  message_id: string;
  emoji: string;
  user_id: string;
};

export function buildReactionsFromMessages(
  messages: BrandedLeaderboardBroadcastUiMessage[]
): BroadcastReactionsByMessage {
  const output: BroadcastReactionsByMessage = {};
  for (const message of messages) {
    if (!message?.id || !Array.isArray(message.reactions) || message.reactions.length === 0) continue;
    output[String(message.id)] = message.reactions.map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      hasUserReacted: reaction.hasUserReacted,
    }));
  }
  return output;
}

export function applyInsert(
  prev: BroadcastReactionsByMessage,
  row: BroadcastReactionRow,
  currentUserId: string
): BroadcastReactionsByMessage {
  const next = { ...prev };
  const list = next[row.message_id] ? [...next[row.message_id]] : [];
  const index = list.findIndex((reaction) => reaction.emoji === row.emoji);

  if (index >= 0) {
    const existing = list[index];
    list[index] = {
      ...existing,
      count: existing.count + 1,
      hasUserReacted: existing.hasUserReacted || row.user_id === currentUserId,
    };
  } else {
    list.push({
      emoji: row.emoji as BrandedBroadcastReactionSummary['emoji'],
      count: 1,
      hasUserReacted: row.user_id === currentUserId,
    });
  }

  next[row.message_id] = list;
  return next;
}

export function applyDelete(
  prev: BroadcastReactionsByMessage,
  row: BroadcastReactionRow,
  currentUserId: string
): BroadcastReactionsByMessage {
  const next = { ...prev };
  const list = next[row.message_id] ? [...next[row.message_id]] : [];
  const index = list.findIndex((reaction) => reaction.emoji === row.emoji);
  if (index < 0) return prev;

  const existing = list[index];
  const nextCount = Math.max(0, existing.count - 1);
  if (nextCount === 0) {
    list.splice(index, 1);
  } else {
    list[index] = {
      ...existing,
      count: nextCount,
      hasUserReacted: row.user_id === currentUserId ? false : existing.hasUserReacted,
    };
  }

  if (list.length === 0) delete next[row.message_id];
  else next[row.message_id] = list;
  return next;
}
