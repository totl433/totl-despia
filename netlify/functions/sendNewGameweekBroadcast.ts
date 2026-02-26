import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { claimIdempotencyLock } from './lib/notifications/idempotency';
import { dispatchNotification } from './lib/notifications';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Automatic "new gameweek published" push.
 *
 * Runs on a schedule and sends the `new-gameweek` notification once per GW (global lock),
 * using `app_meta.current_gw` as the source of truth.
 *
 * Why this exists:
 * - `new-gameweek` is admin-triggered in the UI, which is easy to forget.
 * - This makes it reliable without requiring manual intervention.
 */
export const handler: Handler = async () => {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data: meta, error: metaError } = await admin
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();

    if (metaError || !meta?.current_gw) {
      return json(500, { error: 'Failed to load current_gw', details: metaError?.message });
    }

    const gw = Number(meta.current_gw);
    const eventId = `new_gw:${gw}`;

    // Global idempotency lock (user_id = null) so the scheduled task only triggers once per GW.
    const globalLock = await claimIdempotencyLock('new-gameweek', eventId, null);
    if (!globalLock.claimed) {
      return json(200, {
        ok: true,
        skipped: true,
        reason: 'Already announced (global lock exists)',
        event_id: eventId,
        existing_result: globalLock.existing_result,
      });
    }

    // Audience: all users with an active device registration (do not rely on subscribed=true)
    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('user_id')
      .eq('is_active', true);

    if (subErr) {
      return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
    }

    const userIds = Array.from(new Set((subs || []).map((s: any) => s.user_id).filter(Boolean)));
    if (userIds.length === 0) {
      return json(200, { ok: true, warning: 'No active users found', event_id: eventId });
    }

    const result = await dispatchNotification({
      notification_key: 'new-gameweek',
      event_id: eventId,
      user_ids: userIds,
      title: `⚽ Gameweek ${gw} is live!`,
      body: 'Fixtures are now available. Make your picks before kickoff!',
      data: { type: 'new-gameweek', gw },
      grouping_params: { gw },
    });

    return json(200, {
      ok: true,
      event_id: eventId,
      user_count: userIds.length,
      results: result.results,
    });
  } catch (e: any) {
    return json(500, { error: e?.message || 'Internal error' });
  }
};

