import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';
const JOF_USER_ID = '4542c037-5b38-40d0-b189-847b8f17c222';

// Allow checking different users via query parameter
const getUserIds = (queryParams: any) => {
  const userParam = queryParams?.user;
  if (userParam === 'jof') {
    return [JOF_USER_ID];
  }
  if (userParam === 'carl') {
    return [CARL_USER_ID];
  }
  // Default to Carl for backward compatibility
  return [CARL_USER_ID];
};

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

  // Note: Updates to device subscription status are safe - they only sync OneSignal data to DB
  // No auth required for this operation as it doesn't modify sensitive data or send notifications

  const forceUpdate = event.queryStringParameters?.update === 'true';

  try {
    // Get subscriptions for the requested user(s)
    const userIds = getUserIds(event.queryStringParameters);
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (subsError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch subscriptions', details: subsError.message }),
      };
    }

    if (!subscriptions || subscriptions.length === 0) {
      const userName = event.queryStringParameters?.user === 'jof' ? 'Jof' : 'Carl';
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `No devices found for ${userName}`,
          recommendation: `${userName} needs to register his device via the app`,
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
        deviceInfo.last_active_timestamp = player?.last_active || null;

        // Update database if status changed (or if forceUpdate is true)
        const shouldBeActive = subscribed && !deviceInfo.invalid;
        const needsUpdate = forceUpdate || sub.subscribed !== subscribed || sub.is_active !== shouldBeActive;
        
        if (needsUpdate) {
          const updateResult = await supabase
            .from('push_subscriptions')
            .update({
              is_active: shouldBeActive,
              subscribed: subscribed,
              last_checked_at: new Date().toISOString(),
              invalid: deviceInfo.invalid,
              os_payload: player || null,
            })
            .eq('id', sub.id);

          if (updateResult.error) {
            console.error(`[diagnoseCarlNotifications] Failed to update device ${sub.id}:`, updateResult.error);
          } else {
            deviceInfo.updated = true;
            deviceInfo.new_is_active = shouldBeActive;
          }
        }
      }

      diagnostics.push(deviceInfo);
    }

    const activeDevices = diagnostics.filter(d => d.is_active || d.new_is_active);
    const subscribedDevices = diagnostics.filter(d => d.subscribed_in_onesignal === true);
    
    // Find the most recently active device
    const devicesWithActivity = diagnostics
      .filter(d => d.last_active_timestamp != null)
      .sort((a, b) => (b.last_active_timestamp || 0) - (a.last_active_timestamp || 0));
    const mostRecentDevice = devicesWithActivity[0];

    const userName = event.queryStringParameters?.user === 'jof' ? 'Jof' : 'Carl';
    const userId = event.queryStringParameters?.user === 'jof' ? JOF_USER_ID : CARL_USER_ID;
    
    // Check if the most recent device is different from the active one
    const activeDeviceId = activeDevices[0]?.player_id;
    const mostRecentDeviceId = mostRecentDevice?.player_id;
    const deviceMismatch = mostRecentDevice && activeDeviceId && mostRecentDeviceId !== activeDeviceId;
    
    let recommendation = '';
    if (activeDevices.length === 0) {
      recommendation = `No active devices. ${userName} needs to re-register his device via the app or enable notifications in iOS Settings.`;
    } else if (subscribedDevices.length === 0) {
      recommendation = `Devices are registered but not subscribed in OneSignal. ${userName} may need to enable notifications in iOS Settings.`;
    } else if (deviceMismatch) {
      recommendation = `⚠️ Device mismatch detected! The most recently active device (${mostRecentDeviceId?.slice(0, 20)}...) is not marked as active. ${userName} may be using a different device than what's registered.`;
    } else {
      recommendation = `${userName} should receive notifications on active subscribed devices.`;
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        user_id: userId,
        user_name: userName,
        total_devices: subscriptions.length,
        active_devices: activeDevices.length,
        subscribed_devices: subscribedDevices.length,
        devices: diagnostics,
        most_recent_device: mostRecentDevice ? {
          player_id: mostRecentDevice.player_id?.slice(0, 25) + '...',
          last_active: mostRecentDevice.last_active,
          is_active: mostRecentDevice.is_active || mostRecentDevice.new_is_active,
        } : null,
        device_mismatch: deviceMismatch,
        recommendation,
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

