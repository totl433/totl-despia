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
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Check for admin secret if provided (optional - allows diagnostic without secret)
  const ADMIN_SECRET = process.env.ADMIN_DEVICE_REGISTRATION_SECRET;
  const providedSecret = event.headers['x-admin-secret'] || event.queryStringParameters?.secret;
  
  // Only require secret if ADMIN_SECRET is set AND update=true is requested
  // This allows read-only diagnostics without auth, but requires auth for updates
  const requiresAuth = ADMIN_SECRET && event.queryStringParameters?.update === 'true';
  if (requiresAuth && providedSecret !== ADMIN_SECRET) {
    return {
      statusCode: 401,
      body: JSON.stringify({ 
        error: 'Unauthorized: admin secret required for updates',
        hint: 'Add ?secret=YOUR_SECRET or set x-admin-secret header'
      }),
    };
  }

  const forceUpdate = event.queryStringParameters?.update === 'true';

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
          message: 'No devices found for Carl',
          recommendation: 'Carl needs to register his device via the app',
        }),
      };
    }

    const diagnostics = [];

    // Check each device's OneSignal status
    for (const sub of subscriptions) {
      const deviceInfo: any = {
        player_id: sub.player_id?.slice(0, 20) + '...',
        platform: sub.platform,
        is_active: sub.is_active,
        subscribed_in_db: sub.subscribed,
        created_at: sub.created_at,
        last_checked_at: sub.last_checked_at,
      };

      if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
        const { subscribed, player } = await isSubscribed(
          sub.player_id,
          ONESIGNAL_APP_ID,
          ONESIGNAL_REST_API_KEY
        );

        deviceInfo.subscribed_in_onesignal = subscribed;
        deviceInfo.has_token = !!player?.identifier;
        deviceInfo.invalid = player?.invalid_identifier || false;
        deviceInfo.notification_types = player?.notification_types;
        deviceInfo.last_active = player?.last_active ? new Date(player.last_active * 1000).toISOString() : null;

        // Update database if status changed (or if forceUpdate is true)
        const shouldBeActive = subscribed && !deviceInfo.invalid;
        const needsUpdate = forceUpdate || sub.subscribed !== subscribed || sub.is_active !== shouldBeActive;
        
        if (needsUpdate) {
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
        }
      }

      diagnostics.push(deviceInfo);
    }

    const activeDevices = diagnostics.filter(d => d.is_active || d.new_is_active);
    const subscribedDevices = diagnostics.filter(d => d.subscribed_in_onesignal === true);

    return {
      statusCode: 200,
      body: JSON.stringify({
        user_id: CARL_USER_ID,
        total_devices: subscriptions.length,
        active_devices: activeDevices.length,
        subscribed_devices: subscribedDevices.length,
        devices: diagnostics,
        recommendation: activeDevices.length === 0
          ? 'No active devices. Carl needs to re-register his device via the app or enable notifications in iOS Settings.'
          : subscribedDevices.length === 0
          ? 'Devices are registered but not subscribed in OneSignal. Carl may need to enable notifications in iOS Settings.'
          : 'Carl should receive notifications on active subscribed devices.',
      }),
    };
  } catch (error: any) {
    console.error('[diagnoseCarlNotifications] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

