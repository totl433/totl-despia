import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed } from './utils/notificationHelpers';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    // Get all subscriptions with user info
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select(`
        user_id,
        player_id,
        platform,
        is_active,
        subscribed,
        last_checked_at,
        last_active_at,
        invalid,
        users!inner(name, email)
      `)
      .order('last_active_at', { ascending: false, nullsFirst: false });

    if (subsError) {
      console.error('[listSubscriptions] Error fetching subscriptions:', subsError);
      return json(500, { error: 'Failed to fetch subscriptions', details: subsError.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return json(200, {
        total: 0,
        active: 0,
        subscribed: 0,
        subscriptions: [],
      });
    }

    // Verify subscription status with OneSignal for each device
    const subscriptionsWithStatus = await Promise.all(
      subscriptions.map(async (sub: any) => {
        let oneSignalStatus = null;
        if (sub.player_id) {
          try {
            const { subscribed, player } = await isSubscribed(
              sub.player_id,
              ONESIGNAL_APP_ID,
              ONESIGNAL_REST_API_KEY
            );
            oneSignalStatus = {
              subscribed,
              notification_types: player?.notification_types,
              invalid_identifier: player?.invalid_identifier,
              last_active: player?.last_active ? new Date(player.last_active * 1000).toISOString() : null,
            };
          } catch (e) {
            oneSignalStatus = { error: (e as Error).message };
          }
        }

        return {
          user_id: sub.user_id,
          user_name: sub.users?.name || 'Unknown',
          user_email: sub.users?.email || 'Unknown',
          player_id: sub.player_id ? sub.player_id.slice(0, 20) + '...' : null,
          platform: sub.platform,
          is_active: sub.is_active,
          subscribed_db: sub.subscribed,
          subscribed_onesignal: oneSignalStatus?.subscribed ?? null,
          last_checked_at: sub.last_checked_at,
          last_active_at: sub.last_active_at,
          invalid: sub.invalid,
          oneSignalStatus,
        };
      })
    );

    // Calculate summary stats
    const total = subscriptions.length;
    const active = subscriptions.filter((s: any) => s.is_active).length;
    const subscribed = subscriptionsWithStatus.filter((s: any) => s.subscribed_onesignal === true).length;

    // Group by user
    const byUser = new Map<string, any[]>();
    subscriptionsWithStatus.forEach((sub: any) => {
      if (!byUser.has(sub.user_id)) {
        byUser.set(sub.user_id, []);
      }
      byUser.get(sub.user_id)!.push(sub);
    });

    return json(200, {
      summary: {
        total,
        active,
        subscribed,
        users: byUser.size,
      },
      subscriptions: subscriptionsWithStatus,
      byUser: Object.fromEntries(byUser),
    });
  } catch (error: any) {
    console.error('[listSubscriptions] Error:', error);
    return json(500, {
      error: 'Internal server error',
      details: error?.message || String(error),
    });
  }
};
