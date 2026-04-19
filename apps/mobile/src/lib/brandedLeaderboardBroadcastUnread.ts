import type { BrandedLeaderboardBroadcastMessage } from '@totl/domain';

export const BRANDED_BROADCAST_VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';

export type BrandedLeaderboardBroadcastUiMessage = BrandedLeaderboardBroadcastMessage & {
  status?: 'sending' | 'error';
};

function toTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function countUnreadBroadcastMessages(input: {
  messages: BrandedLeaderboardBroadcastUiMessage[];
  lastReadAt: string | null;
  userId: string | null;
}): number {
  const lastReadAtMs = toTimestampMs(input.lastReadAt);
  return input.messages.filter((message) => {
    if (message.message_type === 'system') return false;
    if (message.user_id === BRANDED_BROADCAST_VOLLEY_USER_ID) return false;
    if (input.userId && message.user_id === input.userId) return false;
    if (lastReadAtMs == null) return true;
    const createdAtMs = toTimestampMs(message.created_at);
    if (createdAtMs == null) return true;
    return createdAtMs > lastReadAtMs;
  }).length;
}
