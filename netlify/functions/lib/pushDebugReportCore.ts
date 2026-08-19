/**
 * Shared push diagnostics (used by pushDebugReport + envCheck fallback when CDN skips a function bundle).
 */
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function getAuthenticatedUserId(event: Parameters<Handler>[0]) {
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;

  if (!supabaseUrl || !supabaseAnonKey || !bearer) return null;

  const supaUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data, error } = await supaUser.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function fetchOneSignalPlayer(playerId: string) {
  const oneSignalAppId = (process.env.ONESIGNAL_APP_ID || '').trim();
  const oneSignalRestApiKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!oneSignalAppId || !oneSignalRestApiKey || !playerId) {
    return null;
  }

  try {
    const response = await fetch(`https://onesignal.com/api/v1/players/${playerId}?app_id=${oneSignalAppId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${oneSignalRestApiKey}`,
      },
    });

    const bodyText = await response.text().catch(() => '');
    let payload: Record<string, unknown> | null = null;
    try {
      payload = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : null;
    } catch {
      payload = { raw: bodyText };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload,
      };
    }

    const p = payload || {};
    const identifier = p.identifier as string | undefined;
    const notificationTypes = p.notification_types as number | undefined;

    return {
      ok: true,
      status: response.status,
      subscribed:
        !!identifier &&
        !p.invalid_identifier &&
        notificationTypes !== -2 &&
        notificationTypes !== 0,
      player: {
        id: (p.id as string | undefined) ?? null,
        identifier_present: !!identifier,
        invalid_identifier: !!p.invalid_identifier,
        notification_types: notificationTypes ?? null,
        device_type: (p.device_type as number | undefined) ?? null,
        device_model: (p.device_model as string | undefined) ?? null,
        external_user_id: (p.external_user_id as string | undefined) ?? null,
        last_active: p.last_active
          ? new Date((p.last_active as number) * 1000).toISOString()
          : null,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message,
    };
  }
}

/**
 * GET only. Requires Bearer Supabase access token.
 */
export async function buildPushDebugReportResponse(event: Parameters<Handler>[0]) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  const userId = await getAuthenticatedUserId(event);
  if (!userId) {
    return json(401, { error: 'Unauthorized' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const currentPlayerId = event.queryStringParameters?.playerId?.trim() || null;

  const [{ data: subscriptions, error: subscriptionsError }, { data: notificationLogs, error: logsError }, { data: prefsData }] =
    await Promise.all([
      admin
        .from('push_subscriptions')
        .select(
          'id, player_id, platform, is_active, subscribed, created_at, updated_at, last_checked_at, last_active_at, invalid'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      admin
        .from('notification_send_log')
        .select(
          'created_at, notification_key, event_id, result, onesignal_notification_id, target_type, targeting_summary, payload_summary, error'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15),
      admin.from('user_notification_preferences').select('preferences').eq('user_id', userId).maybeSingle(),
    ]);

  if (subscriptionsError) {
    return json(500, { error: 'Failed to load push subscriptions', details: subscriptionsError.message });
  }
  if (logsError) {
    return json(500, { error: 'Failed to load notification log', details: logsError.message });
  }

  const currentDeviceInDb = currentPlayerId
    ? (subscriptions || []).some((subscription) => subscription.player_id === currentPlayerId)
    : null;
  const currentPlayerCheck = currentPlayerId ? await fetchOneSignalPlayer(currentPlayerId) : null;
  const activeSubscriptions = (subscriptions || []).filter((subscription) => subscription.is_active);
  const subscribedSubscriptions = (subscriptions || []).filter((subscription) => subscription.subscribed);
  const recommendation =
    subscriptions && subscriptions.length === 0
      ? 'No push_subscriptions rows found for this user.'
      : currentPlayerId && currentDeviceInDb === false
        ? 'Current device player ID is not stored in push_subscriptions yet.'
        : activeSubscriptions.length === 0
          ? 'No active subscriptions are marked for this user.'
          : subscribedSubscriptions.length === 0
            ? 'Subscriptions exist, but none are marked subscribed in the database.'
            : currentPlayerCheck && currentPlayerCheck.ok === true && currentPlayerCheck.subscribed === false
              ? 'Current device exists in OneSignal but is not subscribed for push.'
              : 'Current user has at least one active subscribed path. Compare with recent notification log and last chat trace.';

  return json(200, {
    ok: true,
    generated_at: new Date().toISOString(),
    user_id: userId,
    current_player_id: currentPlayerId,
    current_player_in_db: currentDeviceInDb,
    current_player_check: currentPlayerCheck,
    recommendation,
    preferences: prefsData?.preferences || {},
    subscriptions: subscriptions || [],
    recent_notification_log: notificationLogs || [],
    recent_chat_log: (notificationLogs || []).filter((entry) => entry.notification_key === 'chat-message'),
  });
}
