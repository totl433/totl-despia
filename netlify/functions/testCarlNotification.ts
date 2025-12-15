import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed } from './utils/notificationHelpers';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Get user_id from query parameter or body
  let userId: string | null = null;
  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    userId = event.queryStringParameters?.userId || payload.userId || null;
  } catch (e) {
    userId = event.queryStringParameters?.userId || null;
  }

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing userId parameter. Provide ?userId=... or in body' }),
    };
  }

  try {
    // Get all user's subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
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
          error: 'No devices found for user',
          userId,
          recommendation: 'User needs to register their device via the app',
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
          error: 'No subscribed devices found for user',
          userId,
          diagnostics,
          recommendation: 'User needs to enable notifications in iOS Settings or re-register their device',
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
    const message = payload.message || 'Test notification';

    // Send notification to user's devices
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

