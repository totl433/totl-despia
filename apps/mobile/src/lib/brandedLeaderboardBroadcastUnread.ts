import type { BrandedLeaderboardBroadcastMessage } from '@totl/domain';

const BRANDED_BROADCAST_VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';

export type BrandedLeaderboardBroadcastUiMessage = BrandedLeaderboardBroadcastMessage & {
  status?: 'sending' | 'error';
};

export function countUnreadBroadcastMessages(input: {
  messages: BrandedLeaderboardBroadcastUiMessage[];
  lastReadAt: string | null;
  userId: string | null;
}): number {
  return input.messages.filter((message) => {
    if (message.message_type === 'system') return false;
    if (message.user_id === BRANDED_BROADCAST_VOLLEY_USER_ID) return false;
    if (input.userId && message.user_id === input.userId) return false;
    if (!input.lastReadAt) return true;
    return message.created_at > input.lastReadAt;
  }).length;
}
