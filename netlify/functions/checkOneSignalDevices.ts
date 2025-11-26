import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal env vars' });
  }

  // Get player IDs from query or body
  const playerIdsParam = event.queryStringParameters?.playerIds || event.body;
  let playerIds: string[] = [];
  
  if (playerIdsParam) {
    try {
      const parsed = typeof playerIdsParam === 'string' ? JSON.parse(playerIdsParam) : playerIdsParam;
      playerIds = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      playerIds = playerIdsParam.split(',').map((p: string) => p.trim()).filter(Boolean);
    }
  }

  if (playerIds.length === 0) {
    return json(400, { error: 'Provide playerIds as comma-separated list or JSON array' });
  }

  // Check each player ID with OneSignal API
  const results = await Promise.all(
    playerIds.map(async (playerId: string) => {
      try {
        const resp = await fetch(`https://onesignal.com/api/v1/players/${playerId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          },
        });

        if (!resp.ok) {
          const errorBody = await resp.json().catch(() => ({}));
          return {
            playerId,
            exists: false,
            subscribed: false,
            error: `HTTP ${resp.status}: ${errorBody.errors?.[0] || resp.statusText}`,
          };
        }

        const player = await resp.json();
        // For legacy SDK, check valid identifier and subscription status
        // OneSignal API returns different fields for legacy vs new SDK
        const isValid = player.invalid_identifier === false;
        const isSubscribed = isValid && (
          player.subscription?.enabled === true || 
          player.subscription?.enabled === undefined || // legacy SDK might not have this field
          player.last_active != null // active device is likely subscribed
        );
        
        return {
          playerId,
          exists: true,
          subscribed: isSubscribed,
          subscriptionEnabled: player.subscription?.enabled,
          invalidIdentifier: player.invalid_identifier,
          appId: player.app_id,
          deviceType: player.device_type,
          lastActive: player.last_active,
          // Include full response for debugging
          fullResponse: player,
        };
      } catch (e: any) {
        return {
          playerId,
          exists: false,
          subscribed: false,
          error: e?.message || String(e),
        };
      }
    })
  );

  return json(200, {
    checked: playerIds.length,
    subscribed: results.filter((r) => r.subscribed).length,
    notSubscribed: results.filter((r) => !r.subscribed).length,
    results,
  });
};

