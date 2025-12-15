import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed } from './utils/notificationHelpers';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Get all active subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, player_id, is_active, subscribed')
      .eq('is_active', true);

    if (subsError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch subscriptions', details: subsError.message }),
      };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No active subscriptions found' }),
      };
    }

    console.log(`[testNotificationAll] Found ${subscriptions.length} active subscriptions`);

    // Verify subscription status with OneSignal and collect valid player IDs
    const validPlayerIds: string[] = [];
    let checked = 0;

    for (const sub of subscriptions) {
      if (!sub.player_id) continue;
      
      checked++;
      const { subscribed } = await isSubscribed(
        sub.player_id,
        ONESIGNAL_APP_ID,
        ONESIGNAL_REST_API_KEY
      );

      if (subscribed) {
        validPlayerIds.push(sub.player_id);
      }

      // Update database with latest subscription status
      await supabase
        .from('push_subscriptions')
        .update({
          subscribed: subscribed,
          last_checked_at: new Date().toISOString(),
        })
        .eq('player_id', sub.player_id);
    }

    if (validPlayerIds.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No subscribed devices found',
          checked,
          activeSubscriptions: subscriptions.length,
        }),
      };
    }

    // Send notification to all subscribed devices
    const title = 'Test Notification';
    const message = 'Test notification to all subscribed devices';

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: validPlayerIds,
      headings: { en: title },
      contents: { en: message },
      data: {
        type: 'test',
        message: 'Test notification to all app users',
      },
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'OneSignal API error',
          details: result,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Test notification sent',
        sentTo: validPlayerIds.length,
        totalActive: subscriptions.length,
        checked,
        oneSignalResult: result,
      }),
    };
  } catch (error: any) {
    console.error('[testNotificationAll] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

