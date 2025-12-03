import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const JOF_USER_ID = '4542c037-5b38-40d0-b189-847b8f17c222';

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
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Get all Jof's subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', JOF_USER_ID)
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
          message: 'No devices found for Jof',
          recommendation: 'Jof needs to register his device via the app',
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
        deviceInfo.last_active = player?.last_active ? new Date(player.last_active * 1000).toISOString() : null;
      }

      diagnostics.push(deviceInfo);
    }

    const activeDevices = diagnostics.filter(d => d.is_active);
    const subscribedDevices = diagnostics.filter(d => d.subscribed_in_onesignal === true);

    return {
      statusCode: 200,
      body: JSON.stringify({
        user_id: JOF_USER_ID,
        total_devices: subscriptions.length,
        active_devices: activeDevices.length,
        subscribed_devices: subscribedDevices.length,
        devices: diagnostics,
        recommendation: activeDevices.length === 0
          ? 'No active devices. Jof needs to re-register his device via the app or enable notifications in iOS Settings.'
          : subscribedDevices.length === 0
          ? 'Devices are registered but not subscribed in OneSignal. Jof may need to enable notifications in iOS Settings.'
          : 'Jof should receive notifications on active subscribed devices.',
      }),
    };
  } catch (error: any) {
    console.error('[checkJofDevices] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

