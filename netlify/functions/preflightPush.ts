import type { Handler } from '@netlify/functions';
import { dispatchNotification } from './lib/notifications';

/**
 * Lightweight preflight check to validate push delivery.
 * Use: /.netlify/functions/preflightPush?userId=<uuid>
 * Sends a small notification via dispatcher to the specified user.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'userId is required' }),
    };
  }

  const eventId = `preflight:${userId}:${Date.now()}`;

  const result = await dispatchNotification({
    notification_key: 'new-gameweek',
    event_id: eventId,
    user_ids: [userId],
    title: 'Push Preflight',
    body: 'This is a test notification to verify delivery.',
    data: { type: 'preflight' },
    grouping_params: { gw: 'preflight' },
    skip_cooldown_check: true,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      event_id: eventId,
      results: result.results,
      user_results: result.user_results,
    }),
  };
};

