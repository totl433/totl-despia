/**
 * Fix missing external_user_id for existing users
 * 
 * This function scans push_subscriptions for active devices and ensures
 * their external_user_id is set correctly in OneSignal.
 * 
 * Usage:
 *   POST /.netlify/functions/fixExternalUserIds
 *   Body: { limit?: number, userId?: string }
 * 
 * If userId is provided, only fixes that user.
 * If limit is provided, only processes that many users (default: 100).
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { setExternalUserId, verifyExternalUserId, isSubscribed } from './utils/notificationHelpers';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  // Parse body
  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const limit = payload.limit || 100;
  const targetUserId = payload.userId;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Query active subscriptions
  let query = admin
    .from('push_subscriptions')
    .select('user_id, player_id, platform, subscribed')
    .eq('is_active', true)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (targetUserId) {
    query = query.eq('user_id', targetUserId) as any;
  }

  const { data: subscriptions, error } = await query;

  if (error) {
    console.error('[fixExternalUserIds] Error querying subscriptions:', error);
    return json(500, { error: 'Failed to query subscriptions', details: error.message });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return json(200, {
      message: 'No active subscriptions found',
      processed: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
  }

  console.log(`[fixExternalUserIds] Processing ${subscriptions.length} active subscriptions...`);

  const results = {
    processed: 0,
    fixed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ userId: string; playerId: string; error: string }>,
  };

  for (const sub of subscriptions) {
    results.processed++;

    try {
      const { user_id, player_id } = sub;

      // Check if player exists and is subscribed in OneSignal
      const { subscribed } = await isSubscribed(player_id, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);
      
      if (!subscribed) {
        console.log(`[fixExternalUserIds] Skipping ${player_id.slice(0, 8)}… - not subscribed in OneSignal`);
        results.skipped++;
        continue;
      }

      // Verify current external_user_id
      const verifyResult = await verifyExternalUserId(player_id, user_id, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);

      if (verifyResult.verified) {
        console.log(`[fixExternalUserIds] ✅ ${player_id.slice(0, 8)}… already has correct external_user_id`);
        continue; // Already correct, skip
      }

      // Set external_user_id
      console.log(`[fixExternalUserIds] Setting external_user_id for ${player_id.slice(0, 8)}… (user: ${user_id.slice(0, 8)}…)`);
      const setResult = await setExternalUserId(player_id, user_id, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);

      if (!setResult.success) {
        console.error(`[fixExternalUserIds] ❌ Failed to set external_user_id for ${player_id.slice(0, 8)}…:`, setResult.error);
        results.failed++;
        results.errors.push({
          userId: user_id,
          playerId: player_id,
          error: JSON.stringify(setResult.error),
        });
        continue;
      }

      // Verify it was set
      const verifyAfterSet = await verifyExternalUserId(player_id, user_id, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);

      if (verifyAfterSet.verified) {
        console.log(`[fixExternalUserIds] ✅ Successfully set external_user_id for ${player_id.slice(0, 8)}…`);
        results.fixed++;

        // Update last_checked_at in database
        await admin
          .from('push_subscriptions')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('player_id', player_id)
          .then(() => {}, (err) => console.warn(`[fixExternalUserIds] Failed to update last_checked_at:`, err));
      } else {
        console.error(`[fixExternalUserIds] ❌ Set external_user_id but verification failed for ${player_id.slice(0, 8)}…`);
        results.failed++;
        results.errors.push({
          userId: user_id,
          playerId: player_id,
          error: `Verification failed: ${JSON.stringify(verifyAfterSet.error || verifyAfterSet.actualExternalUserId)}`,
        });
      }
    } catch (e: any) {
      console.error(`[fixExternalUserIds] Exception processing subscription:`, e);
      results.failed++;
      results.errors.push({
        userId: sub.user_id,
        playerId: sub.player_id,
        error: e?.message || String(e),
      });
    }
  }

  console.log(`[fixExternalUserIds] Complete: ${results.fixed} fixed, ${results.failed} failed, ${results.skipped} skipped`);

  return json(200, {
    message: `Processed ${results.processed} subscriptions`,
    ...results,
  });
};

