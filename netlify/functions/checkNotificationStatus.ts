import type { Handler } from '@netlify/functions';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal credentials' });
  }

  const notificationId = event.queryStringParameters?.notificationId;
  if (!notificationId) {
    return json(400, { error: 'Missing notificationId query parameter' });
  }

  try {
    // Query OneSignal for notification details
    const url = `https://onesignal.com/api/v1/notifications/${notificationId}?app_id=${ONESIGNAL_APP_ID}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
    });

    if (!resp.ok) {
      const errorBody = await resp.json().catch(() => ({}));
      return json(resp.status, {
        error: 'OneSignal API error',
        details: errorBody,
        status: resp.status,
      });
    }

    const notification = await resp.json();

    return json(200, {
      ok: true,
      notificationId,
      notification: {
        id: notification.id,
        successful: notification.successful,
        failed: notification.failed,
        errored: notification.errored,
        converted: notification.converted,
        remaining: notification.remaining,
        queued_at: notification.queued_at,
        send_after: notification.send_after,
        completed_at: notification.completed_at,
        // Include platform-specific delivery stats if available
        platform_delivery_stats: notification.platform_delivery_stats,
        // Include any errors
        errors: notification.errors,
        // Include invalid player IDs if available
        invalid_player_ids: notification.invalid_player_ids,
      },
    });
  } catch (error: any) {
    console.error('[checkNotificationStatus] Error:', error);
    return json(500, {
      error: 'Failed to check notification status',
      message: error.message,
    });
  }
};

