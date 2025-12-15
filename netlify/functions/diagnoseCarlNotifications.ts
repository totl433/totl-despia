import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed } from './utils/notificationHelpers';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get user IDs from query parameter (userId or userIds)
const getUserIds = (queryParams: any): string[] => {
  // Support single userId
  if (queryParams?.userId) {
    return [queryParams.userId];
  }
  
  // Support multiple userIds (comma-separated)
  if (queryParams?.userIds) {
    return queryParams.userIds.split(',').map((id: string) => id.trim()).filter(Boolean);
  }
  
  // Legacy support: 'carl' or 'jof' (for backward compatibility)
  // But require explicit userId going forward
  return [];
};

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
    
    if (userIds.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing userId parameter',
          usage: 'Provide ?userId=<user-id> or ?userIds=<id1>,<id2>',
        }),
      };
    }
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
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `No devices found for user(s)`,
          userIds,
          recommendation: `User(s) need to register their device via the app`,
        }),
      };
    }

    const diagnostics = [];

    // Check each device's OneSignal status
    for (const sub of subscriptions) {
      const deviceInfo: any = {
        player_id: sub.player_id, // Return full Player ID for API calls
        player_id_short: sub.player_id?.slice(0, 20) + '...', // Short version for display
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
        deviceInfo.identifier = player?.identifier ? player.identifier.substring(0, 30) + '...' : null; // Show if token exists
        deviceInfo.full_player_data = player ? {
          identifier: player.identifier ? 'present' : 'missing',
          invalid_identifier: player.invalid_identifier,
          notification_types: player.notification_types,
          last_active: player.last_active,
          device_type: player.device_type,
        } : null;

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

    // Get user names for response
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);
    
    const userNames = users ? users.map((u: any) => u.name).join(', ') : 'Unknown';
    
    // Check if the most recent device is different from the active one
    const activeDeviceId = activeDevices[0]?.player_id;
    const mostRecentDeviceId = mostRecentDevice?.player_id;
    const deviceMismatch = mostRecentDevice && activeDeviceId && mostRecentDeviceId !== activeDeviceId;
    
    let recommendation = '';
    if (activeDevices.length === 0) {
      recommendation = `No active devices. User(s) need to re-register their device via the app or enable notifications in iOS Settings.`;
    } else if (subscribedDevices.length === 0) {
      recommendation = `Devices are registered but not subscribed in OneSignal. User(s) may need to enable notifications in iOS Settings.`;
    } else if (deviceMismatch) {
      recommendation = `⚠️ Device mismatch detected! The most recently active device (${mostRecentDeviceId?.slice(0, 20)}...) is not marked as active. User(s) may be using a different device than what's registered.`;
    } else {
      recommendation = `User(s) should receive notifications on active subscribed devices.`;
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        user_ids: userIds,
        user_names: userNames,
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

