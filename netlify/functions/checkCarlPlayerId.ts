import type { Handler } from '@netlify/functions';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  const playerId = event.queryStringParameters?.playerId;
  
  if (!playerId) {
    return json(400, { error: 'Missing playerId query parameter' });
  }

  try {
    const url = `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;
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

    const player = await resp.json();

    // Convert last_active timestamp to readable date
    const lastActiveDate = player.last_active 
      ? new Date(player.last_active * 1000).toISOString()
      : null;

    return json(200, {
      ok: true,
      playerId: playerId.slice(0, 20) + '...',
      player: {
        id: player.id,
        identifier: player.identifier ? 'present' : 'missing',
        invalid_identifier: player.invalid_identifier,
        notification_types: player.notification_types,
        last_active: player.last_active,
        last_active_date: lastActiveDate,
        device_type: player.device_type,
        device_model: player.device_model,
        app_version: player.app_version,
        // Include full response for debugging
        full_response: player,
      },
      interpretation: {
        subscribed: player.notification_types === 1,
        unsubscribed: player.notification_types === -2,
        disabled: player.notification_types === 0,
        not_initialized: player.notification_types === null || player.notification_types === undefined,
        has_valid_token: !!player.identifier && !player.invalid_identifier,
        can_receive_notifications: player.notification_types === 1 && !!player.identifier && !player.invalid_identifier,
      },
    });
  } catch (error: any) {
    console.error('[checkCarlPlayerId] Error:', error);
    return json(500, {
      error: 'Failed to check player',
      message: error.message,
    });
  }
};

