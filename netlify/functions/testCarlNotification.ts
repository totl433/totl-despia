import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

// Check if a Player ID is subscribed in OneSignal
async function isSubscribed(
  playerId: string,
  appId: string,
  restKey: string
): Promise<{ subscribed: boolean; player?: any }> {
  const OS_BASE = 'https://onesignal.com/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${restKey}`,
  };

  try {
    const url = `${OS_BASE}/players/${playerId}?app_id=${appId}`;
    const r = await fetch(url, { headers });
    
    if (!r.ok) {
      return { subscribed: false, player: null };
    }

    const player = await r.json();
    const hasToken = !!player.identifier;
    const notInvalid = !player.invalid_identifier;
    const notificationTypes = player.notification_types;
    
    const explicitlySubscribed = notificationTypes === 1;
    const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
    const stillInitializing = (notificationTypes === null || notificationTypes === undefined) && hasToken && notInvalid;
    
    const subscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);

    return { subscribed, player };
  } catch (e) {
    console.error(`Error checking subscription for ${playerId}:`, e);
    return { subscribed: false, player: null };
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Get all Carl's subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', CARL_USER_ID)
      .order('created_at', { ascending: false });

    if (subsError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch subscriptions', details: subsError.message }),
      };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: 'No devices found for Carl',
          recommendation: 'Carl needs to register his device via the app',
        }),
      };
    }

    // Check each device and update status, then collect valid player IDs
    const validPlayerIds: string[] = [];
    const diagnostics: any[] = [];

    for (const sub of subscriptions) {
      const deviceInfo: any = {
        player_id: sub.player_id?.slice(0, 20) + '...',
        platform: sub.platform,
        is_active: sub.is_active,
        subscribed_in_db: sub.subscribed,
      };

      if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY && sub.player_id) {
        const { subscribed, player } = await isSubscribed(
          sub.player_id,
          ONESIGNAL_APP_ID,
          ONESIGNAL_REST_API_KEY
        );

        deviceInfo.subscribed_in_onesignal = subscribed;
        deviceInfo.has_token = !!player?.identifier;
        deviceInfo.invalid = player?.invalid_identifier || false;
        deviceInfo.notification_types = player?.notification_types;

        // Update database to match OneSignal status
        const shouldBeActive = subscribed && !deviceInfo.invalid;
        await supabase
          .from('push_subscriptions')
          .update({
            is_active: shouldBeActive,
            subscribed: subscribed,
            last_checked_at: new Date().toISOString(),
            invalid: deviceInfo.invalid,
            os_payload: player || null,
          })
          .eq('id', sub.id);

        deviceInfo.updated = true;
        deviceInfo.new_is_active = shouldBeActive;

        // If device is subscribed and active, add to valid player IDs
        if (subscribed && shouldBeActive) {
          validPlayerIds.push(sub.player_id);
        }
      }

      diagnostics.push(deviceInfo);
    }

    if (validPlayerIds.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: 'No subscribed devices found for Carl',
          diagnostics,
          recommendation: 'Carl needs to enable notifications in iOS Settings or re-register his device',
        }),
      };
    }

    // Parse notification payload
    let payload: any;
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
      payload = {};
    }

    const title = payload.title || 'Test Notification';
    const message = payload.message || 'Can Carl see this? 👀';

    // Send notification to Carl's devices
    // Use same format as OneSignal dashboard for better compatibility
    const resp = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: validPlayerIds,
        headings: { en: title },
        contents: { en: message },
        // Add iOS-specific settings
        ios_badgeType: 'SetTo',
        ios_badgeCount: 1,
        // Ensure delivery
        send_after: null, // Send immediately
      }),
    });

    const body = await resp.json().catch(() => ({}));
    
    return {
      statusCode: resp.ok ? 200 : resp.status,
      body: JSON.stringify({
        ok: resp.ok,
        sentTo: validPlayerIds.length,
        playerIds: validPlayerIds.map(id => id.slice(0, 20) + '...'),
        diagnostics,
        oneSignalResponse: body,
        errors: body.errors || [],
      }),
    };
  } catch (error: any) {
    console.error('[testCarlNotification] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

