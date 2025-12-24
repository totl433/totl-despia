/**
 * Broadcast Push Notification (V2 - using unified dispatcher)
 * 
 * Migrated from sendPushAll.ts to use the new notification system.
 * Used for admin broadcasts like "new gameweek published".
 * 
 * Changes:
 * - Uses dispatchNotification() instead of direct OneSignal API calls
 * - Deterministic event_id based on notification type and timestamp/gw
 * - Idempotency via notification_send_log
 * - collapse_id/thread_id/android_group set automatically
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification } from './lib/notifications';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  console.log('[sendPushAllV2] Function invoked');
  
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { title, message, data } = payload || {};
  if (!title || !message) {
    return json(400, { error: 'Missing title or message' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Get all users with active subscriptions
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('user_id')
    .eq('is_active', true)
    .eq('subscribed', true);

  if (subErr) {
    console.error('[sendPushAllV2] Failed to fetch subscriptions:', subErr);
    return json(500, { error: 'Failed to load subscriptions' });
  }

  // Get unique user IDs
  const userIds = Array.from(new Set((subs || []).map((s: any) => s.user_id).filter(Boolean)));

  if (userIds.length === 0) {
    return json(200, { ok: true, warning: 'No subscribed users found', sentTo: 0 });
  }

  console.log(`[sendPushAllV2] Found ${userIds.length} unique users with active subscriptions`);

  // Determine notification key and event_id based on data.type
  let notificationKey = 'new-gameweek'; // default
  let eventId = '';

  if (data?.type === 'new-gameweek' || data?.type === 'fixtures_published') {
    notificationKey = 'new-gameweek';
    const gw = data?.gw || data?.gameweek || 'unknown';
    eventId = `new_gw:${gw}`;
  } else {
    // Generic admin broadcast
    notificationKey = 'new-gameweek'; // Use new-gameweek as fallback (has similar settings)
    eventId = `broadcast:${Date.now()}`;
  }

  // Dispatch via unified system
  const result = await dispatchNotification({
    notification_key: notificationKey,
    event_id: eventId,
    user_ids: userIds,
    title,
    body: message,
    data,
    grouping_params: data?.gw ? { gw: data.gw } : {},
    badge_count: notificationKey === 'new-gameweek' ? 1 : undefined,
  });

  console.log('[sendPushAllV2] Dispatch result:', {
    accepted: result.results.accepted,
    failed: result.results.failed,
    suppressed_duplicate: result.results.suppressed_duplicate,
    suppressed_preference: result.results.suppressed_preference,
  });

  // Get user names for response
  const acceptedUserIds = result.user_results
    .filter(r => r.result === 'accepted')
    .map(r => r.user_id);

  const { data: users } = await admin
    .from('users')
    .select('id, name')
    .in('id', acceptedUserIds)
    .then(r => r, () => ({ data: null }));

  const userNames = users ? acceptedUserIds.map(uid => {
    const user = users.find((u: any) => u.id === uid);
    return user?.name || uid.slice(0, 8) + '...';
  }) : [];

  return json(200, {
    ok: true,
    sentTo: result.results.accepted,
    userCount: userIds.length,
    results: result.results,
    userNames: userNames.slice(0, 10), // First 10 for brevity
    event_id: eventId,
  });
};

