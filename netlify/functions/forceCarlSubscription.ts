import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Get Carl's active device
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', CARL_USER_ID)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (subsError || !subscriptions || subscriptions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: 'No active device found for Carl',
        }),
      };
    }

    const device = subscriptions[0];
    const playerId = device.player_id;

    if (!playerId) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: 'No player ID found for Carl\'s device',
        }),
      };
    }

    // First, get current player data from OneSignal
    const OS_BASE = 'https://onesignal.com/api/v1';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
    };

    const getUrl = `${OS_BASE}/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;
    const getResp = await fetch(getUrl, { headers });
    
    if (!getResp.ok) {
      const errorData = await getResp.json().catch(() => ({}));
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: `Failed to get player data: ${getResp.status}`,
          details: errorData,
        }),
      };
    }

    const player = await getResp.json();
    console.log('[forceCarlSubscription] Current player data:', {
      identifier: player.identifier ? 'present' : 'missing',
      invalid_identifier: player.invalid_identifier,
      notification_types: player.notification_types,
      last_active: player.last_active,
    });

    // Try to force subscription by updating the player
    // Note: OneSignal may reject this if the device hasn't actually subscribed via SDK
    const updatePayload: any = {
      app_id: ONESIGNAL_APP_ID,
    };

    // Only try to set notification_types if we have a valid identifier
    if (player.identifier && !player.invalid_identifier) {
      // Try setting notification_types to 1 (subscribed)
      // This might not work if OneSignal requires SDK initialization, but worth trying
      updatePayload.notification_types = 1;
    }

    // Also try to update external_user_id to ensure it's set
    updatePayload.external_user_id = CARL_USER_ID;
    
    // Try to update last_active by setting it to current timestamp
    // This might help OneSignal recognize the device as active
    updatePayload.last_active = Math.floor(Date.now() / 1000);

    console.log('[forceCarlSubscription] Attempting to update player with:', {
      notification_types: updatePayload.notification_types,
      external_user_id: updatePayload.external_user_id,
      last_active: updatePayload.last_active,
    });

    const putUrl = `${OS_BASE}/players/${playerId}`;
    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updatePayload),
    });

    const putResult = await putResp.json().catch(() => ({}));

    if (!putResp.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          error: `Failed to update player: ${putResp.status}`,
          details: putResult,
          currentPlayer: {
            identifier: player.identifier ? 'present' : 'missing',
            invalid_identifier: player.invalid_identifier,
            notification_types: player.notification_types,
          },
        }),
      };
    }

    // Verify the update worked
    const verifyResp = await fetch(getUrl, { headers });
    const updatedPlayer = verifyResp.ok ? await verifyResp.json() : null;

    // Update database
    await supabase
      .from('push_subscriptions')
      .update({
        subscribed: updatedPlayer?.notification_types === 1,
        last_checked_at: new Date().toISOString(),
        os_payload: updatedPlayer || null,
      })
      .eq('id', device.id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        message: 'Attempted to force subscription status',
        before: {
          notification_types: player.notification_types,
          identifier: player.identifier ? 'present' : 'missing',
        },
        after: updatedPlayer ? {
          notification_types: updatedPlayer.notification_types,
          identifier: updatedPlayer.identifier ? 'present' : 'missing',
        } : null,
        oneSignalResponse: putResult,
        note: updatedPlayer?.notification_types === 1 
          ? 'Successfully set notification_types to 1'
          : 'OneSignal may have rejected the update. Device needs to subscribe via SDK.',
      }),
    };
  } catch (error: any) {
    console.error('[forceCarlSubscription] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

