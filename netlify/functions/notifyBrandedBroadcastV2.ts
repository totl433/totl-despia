import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification, formatDeepLink, formatEventId } from './lib/notifications';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function getBaseUrl(event: Parameters<Handler>[0]): string {
  if (event.headers.host) {
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    return `${protocol}://${event.headers.host}`;
  }
  if (process.env.URL || process.env.SITE_URL) {
    return (process.env.URL || process.env.SITE_URL || '').trim();
  }
  return 'https://playtotl.com';
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const {
    leaderboardId,
    leaderboardName,
    messageId,
    senderId,
    senderName,
    content,
    recipientIds,
  } = payload || {};

  if (
    !leaderboardId ||
    !messageId ||
    !senderId ||
    !content ||
    !Array.isArray(recipientIds)
  ) {
    return json(400, {
      error: 'Missing leaderboardId, messageId, senderId, content, or recipientIds',
    });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;

  if (token) {
    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data, error } = await supaUser.auth.getUser();
    if (error || data.user?.id !== senderId) {
      return json(401, { error: 'Unauthorized' });
    }
  }

  const uniqueRecipientIds = Array.from(
    new Set(
      recipientIds
        .map((value: unknown) => String(value ?? '').trim())
        .filter((value: string) => Boolean(value) && value !== senderId)
    )
  );

  if (uniqueRecipientIds.length === 0) {
    return json(200, { ok: true, message: 'No eligible recipients' });
  }

  const eventId =
    formatEventId('branded-broadcast', {
      leaderboard_id: leaderboardId,
      message_id: messageId,
    }) ?? `branded_broadcast:${leaderboardId}:${messageId}`;

  const relativeUrl =
    formatDeepLink(
      'branded-broadcast',
      {
        leaderboard_id: leaderboardId,
      }
    ) ?? `/branded-leaderboards/${encodeURIComponent(String(leaderboardId))}?tab=broadcast`;
  const fullUrl = relativeUrl.startsWith('http')
    ? relativeUrl
    : `${getBaseUrl(event)}${relativeUrl}`;

  const result = await dispatchNotification({
    notification_key: 'branded-broadcast',
    event_id: eventId,
    user_ids: uniqueRecipientIds,
    title: leaderboardName ? `📣 ${leaderboardName} Broadcast` : '📣 New broadcast',
    body: senderName ? `${senderName}: ${String(content).slice(0, 180)}` : String(content).slice(0, 180),
    data: {
      type: 'branded_broadcast',
      leaderboardId,
      messageId,
      senderId,
      tab: 'broadcast',
      url: fullUrl,
      navigateTo: fullUrl,
    },
    url: fullUrl,
    grouping_params: {
      leaderboard_id: leaderboardId,
    },
  });

  return json(200, {
    ok: true,
    event_id: eventId,
    recipients: uniqueRecipientIds.length,
    results: result.results,
  });
};
