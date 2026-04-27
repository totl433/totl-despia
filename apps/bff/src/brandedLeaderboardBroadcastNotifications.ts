type BroadcastMembershipRow = {
  user_id?: string | null;
  left_at?: string | null;
};

const DEFAULT_SITE_URL = 'https://playtotl.com';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function selectBrandedBroadcastRecipientIds(
  memberships: BroadcastMembershipRow[],
  senderId: string
): string[] {
  const recipients = new Set<string>();
  for (const membership of memberships) {
    const userId = String(membership?.user_id ?? '').trim();
    if (!userId) continue;
    if (userId === senderId) continue;
    if (membership?.left_at) continue;
    recipients.add(userId);
  }
  return Array.from(recipients);
}

export function getBrandedBroadcastNotifierUrl(siteUrl?: string | null): string {
  return `${trimTrailingSlash(siteUrl?.trim() || DEFAULT_SITE_URL)}/.netlify/functions/notifyBrandedBroadcastV2`;
}

export async function notifyBrandedBroadcastFollowers(input: {
  siteUrl?: string | null;
  accessToken?: string | null;
  leaderboardId: string;
  leaderboardName: string;
  messageId: string;
  senderId: string;
  senderName: string | null;
  content: string;
  recipientIds: string[];
}): Promise<unknown> {
  const response = await fetch(getBrandedBroadcastNotifierUrl(input.siteUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    },
    body: JSON.stringify({
      leaderboardId: input.leaderboardId,
      leaderboardName: input.leaderboardName,
      messageId: input.messageId,
      senderId: input.senderId,
      senderName: input.senderName,
      content: input.content,
      recipientIds: input.recipientIds,
    }),
  });

  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;
  if (!response.ok) {
    throw new Error(
      `Broadcast notification request failed (${response.status}): ${body?.error ?? response.statusText}`
    );
  }
  return body;
}
