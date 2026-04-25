export type BroadcastReactionRow = {
  message_id: string;
  emoji: string;
  user_id: string;
};

const BROADCAST_REACTION_EMOJIS = ['👍', '🔥', '👏', '🙌', '😮', '😬', '👎'] as const;

export function buildBroadcastReactionSummaries(
  rows: BroadcastReactionRow[],
  currentUserId: string
): Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>> {
  const grouped: Record<string, Record<string, { count: number; hasUserReacted: boolean }>> = {};

  for (const row of rows) {
    if (!grouped[row.message_id]) grouped[row.message_id] = {};
    if (!grouped[row.message_id][row.emoji]) {
      grouped[row.message_id][row.emoji] = { count: 0, hasUserReacted: false };
    }
    grouped[row.message_id][row.emoji].count += 1;
    if (row.user_id === currentUserId) grouped[row.message_id][row.emoji].hasUserReacted = true;
  }

  const orderIndex = new Map<string, number>(BROADCAST_REACTION_EMOJIS.map((emoji, index) => [emoji, index]));
  const output: Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>> = {};
  for (const [messageId, emojiMap] of Object.entries(grouped)) {
    output[messageId] = Object.entries(emojiMap)
      .map(([emoji, data]) => ({ emoji, count: data.count, hasUserReacted: data.hasUserReacted }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return (orderIndex.get(a.emoji) ?? 999) - (orderIndex.get(b.emoji) ?? 999);
      });
  }
  return output;
}
