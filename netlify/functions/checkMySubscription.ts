import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  // Get authenticated user
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : undefined;

  if (!bearer) {
    return json(401, { error: 'Unauthorized' });
  }

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: userData, error: userError } = await supaUser.auth.getUser();
  if (userError || !userData?.user?.id) {
    return json(401, { error: 'Invalid token' });
  }

  const userId = userData.user.id;

  // Get user's Player ID from database
  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('player_id, subscribed, last_checked_at, invalid, os_payload')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_checked_at', { ascending: false })
    .limit(1);

  if (subErr || !subs || subs.length === 0) {
    return json(200, {
      ok: false,
      message: 'No registered device found',
      userId,
      suggestion: 'Click "Enable Notifications" in Profile to register your device',
    });
  }

  const playerId = subs[0].player_id;

  // Check OneSignal API for detailed status
  try {
    const url = `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;
    const resp = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
    });

    if (!resp.ok) {
      return json(200, {
        ok: false,
        message: 'Player ID not found in OneSignal',
        playerId: playerId.slice(0, 8) + '…',
        oneSignalStatus: resp.status,
        suggestion: 'Your device may not be properly initialized. Try restarting the app.',
      });
    }

    const player = await resp.json();

    // Detailed analysis
    const hasToken = !!player.identifier;
    const notInvalid = !player.invalid_identifier;
    const notificationTypes = player.notification_types;
    const isOptedIn = notificationTypes !== -2 && notificationTypes !== 0 && notificationTypes !== undefined;
    const subscribed = hasToken && notInvalid && isOptedIn;

    // Determine why not subscribed
    const reasons: string[] = [];
    if (!hasToken) {
      reasons.push('Missing push token (APNs/FCM) - iOS notifications may not be enabled');
    }
    if (player.invalid_identifier) {
      reasons.push('Invalid device token - device may need to re-register');
    }
    if (notificationTypes === -2) {
      reasons.push('User unsubscribed from notifications');
    }
    if (notificationTypes === 0) {
      reasons.push('Notifications disabled');
    }
    if (notificationTypes === undefined || notificationTypes === null) {
      reasons.push('Notification status unknown - OneSignal SDK may not be initialized');
    }

    return json(200, {
      ok: true,
      subscribed,
      playerId: playerId.slice(0, 8) + '…',
      details: {
        hasToken,
        invalid: player.invalid_identifier,
        notificationTypes,
        deviceType: player.device_type,
        lastActive: player.last_active ? new Date(player.last_active * 1000).toISOString() : null,
        appId: player.app_id,
      },
      reasons: subscribed ? [] : reasons,
      suggestion: subscribed
        ? 'Device is subscribed! Notifications should work.'
        : reasons.length > 0
        ? `Fix: ${reasons.join('; ')}. Enable notifications in iOS Settings → TotL → Notifications, then click "Enable Notifications" again.`
        : 'Enable notifications in iOS Settings → TotL → Notifications, then click "Enable Notifications" again.',
      fullResponse: player, // For debugging
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: 'Failed to check OneSignal status',
      details: e?.message || String(e),
    });
  }
};

