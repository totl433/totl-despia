import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verifyAndFilterSubscriptions } from './lib/notifications/targeting';

/**
 * Re-verify OneSignal subscription status for all known player IDs.
 * - Fetches all rows from push_subscriptions
 * - Calls OneSignal for each player_id (batched by targeting helper)
 * - Updates subscribed/invalid/is_active timestamps via helper
 *
 * Can be run manually or wired to a Netlify scheduled function.
 */
export const handler: Handler = async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[reverifySubscriptions] Missing Supabase env vars');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Supabase environment variables' }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Get all player IDs (active or previously subscribed)
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('player_id')
    .not('player_id', 'is', null);

  if (error) {
    console.error('[reverifySubscriptions] Failed to fetch subscriptions', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch subscriptions' }),
    };
  }

  const playerIds = Array.from(
    new Set((data || []).map((row) => row.player_id as string).filter(Boolean))
  );

  if (playerIds.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'No player IDs to verify' }),
    };
  }

  // OneSignal limits: be gentle — verify helper already does per-ID calls
  // Batch the list to avoid long single requests
  const BATCH_SIZE = 200;
  let totalSubscribed = 0;
  let totalUnsubscribed = 0;

  for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
    const batch = playerIds.slice(i, i + BATCH_SIZE);
    const result = await verifyAndFilterSubscriptions(batch);
    totalSubscribed += result.subscribed.length;
    totalUnsubscribed += result.unsubscribed.length;
    console.log(
      `[reverifySubscriptions] Batch ${i / BATCH_SIZE + 1}: subscribed=${result.subscribed.length}, unsubscribed=${result.unsubscribed.length}`
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      total_player_ids: playerIds.length,
      subscribed: totalSubscribed,
      unsubscribed: totalUnsubscribed,
    }),
  };
};

