import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Check if a Player ID is actually subscribed in OneSignal
async function isSubscribed(
  playerId: string,
  appId: string,
  restKey: string
): Promise<{ subscribed: boolean; player?: any }> {
  const OS_BASE = 'https://onesignal.com/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${restKey}`,
  };

  try {
    const url = `${OS_BASE}/players/${playerId}?app_id=${appId}`;
    const r = await fetch(url, { headers });
    
    if (!r.ok) {
      return { subscribed: false };
    }

    const player = await r.json();

    // Heuristics that cover iOS/Android:
    // - must have a valid push token (identifier)
    // - must not be marked invalid
    // - must be opted in / subscribed (notification_types: 1 = subscribed, -2 = unsubscribed, 0 = disabled)
    // NOTE: If notification_types is null/undefined, OneSignal SDK hasn't initialized properly
    // In this case, we'll be lenient IF the device has a token and is not invalid
    const hasToken = !!player.identifier; // APNs/FCM token
    const notInvalid = !player.invalid_identifier;
    const notificationTypes = player.notification_types;
    
    // OneSignal considers a device subscribed if:
    // - notification_types === 1 (explicitly subscribed)
    // - notification_types is null/undefined BUT has valid token (legacy SDK, still initializing)
    // OneSignal considers NOT subscribed if:
    // - notification_types === -2 (unsubscribed)
    // - notification_types === 0 (disabled)
    const explicitlySubscribed = notificationTypes === 1;
    const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
    const stillInitializing = (notificationTypes === null || notificationTypes === undefined) && hasToken && notInvalid;
    
    // Be lenient: if device has token and isn't explicitly unsubscribed, consider it subscribed
    // This handles the case where OneSignal SDK hasn't fully initialized yet
    const subscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);

    return { subscribed, player };
  } catch (e) {
    console.error(`[sendPushAll] Error checking subscription for ${playerId}:`, e);
    return { subscribed: false };
  }
}

export const handler: Handler = async (event) => {
  console.log('[sendPushAll] Function invoked');
  
  if (event.httpMethod !== 'POST') {
    console.log('[sendPushAll] Method not allowed:', event.httpMethod);
    return json(405, { error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[sendPushAll] Missing Supabase env vars');
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('[sendPushAll] Missing OneSignal env vars');
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  // Optional debug
  if (event.queryStringParameters?.debug === '1') {
    return json(200, {
      appId: ONESIGNAL_APP_ID.slice(0, 8) + '…',
      authHeader: 'Basic ' + ONESIGNAL_REST_API_KEY.slice(0, 4) + '…',
    });
  }

  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
    console.log('[sendPushAll] Payload parsed:', { 
      title: payload?.title, 
      message: payload?.message?.slice(0, 50) + '…',
      hasData: !!payload?.data 
    });
  } catch (e) {
    console.error('[sendPushAll] Failed to parse JSON:', e);
    return json(400, { error: 'Invalid JSON body' });
  }

  const { title, message, data } = payload || {};
  if (!title || !message) {
    console.log('[sendPushAll] Missing required fields:', { title: !!title, message: !!message });
    return json(400, { error: 'Missing title or message' });
  }

  try {
    // Initialize Supabase admin client
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Get all Player IDs from database (we'll verify subscription status and update is_active)
    // Include both active and potentially active devices to ensure we catch any that should be active
    console.log('[sendPushAll] Fetching Player IDs from database...');
    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('user_id, player_id, is_active, subscribed, last_checked_at')
      .or('is_active.eq.true,subscribed.eq.true'); // Include active OR subscribed devices

    if (subErr) {
      console.error('[sendPushAll] Failed to fetch subscriptions:', subErr);
      return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
    }

    const candidatePlayerIds = (subs || [])
      .map((s: any) => s.player_id)
      .filter(Boolean);

    // Remove duplicates (in case query returns same device multiple times)
    const uniquePlayerIds = Array.from(new Set(candidatePlayerIds));

    console.log(`[sendPushAll] Found ${uniquePlayerIds.length} candidate Player IDs (${candidatePlayerIds.length} total before deduplication)`);

    if (uniquePlayerIds.length === 0) {
      console.warn('[sendPushAll] No Player IDs found in database');
      return json(200, { 
        ok: true, 
        warning: 'No subscribed devices found',
        sentTo: 0,
        result: null 
      });
    }

    // Check subscription status for each Player ID (with caching from DB)
    // Use DB 'subscribed' flag if recently checked (< 1 hour), otherwise verify with OneSignal
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

    const checks = await Promise.allSettled(
      uniquePlayerIds.map(async (playerId: string) => {
        const sub = subs.find((s: any) => s.player_id === playerId);
        
        // Use cached status if recently checked
        if (sub?.subscribed === true && sub?.last_checked_at && sub.last_checked_at > oneHourAgo) {
          console.log(`[sendPushAll] Using cached subscription status for ${playerId.slice(0, 8)}…`);
          return { playerId, subscribed: true };
        }

        // Otherwise verify with OneSignal
        const result = await isSubscribed(playerId, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);

        // Update DB with subscription health and is_active status
        if (result.player) {
          const shouldBeActive = result.subscribed && !result.player.invalid_identifier;
          await admin
            .from('push_subscriptions')
            .update({
              subscribed: result.subscribed,
              is_active: shouldBeActive, // Ensure is_active matches subscription status
              last_checked_at: new Date().toISOString(),
              last_active_at: result.player.last_active ? new Date(result.player.last_active * 1000).toISOString() : null,
              invalid: !!result.player.invalid_identifier,
              os_payload: result.player,
            })
            .eq('player_id', playerId)
            .then(() => {}, (err) => console.error(`[sendPushAll] Failed to update subscription health for ${playerId}:`, err));
        }
        
        return { playerId, subscribed: result.subscribed };
      })
    );

    const validPlayerIds = uniquePlayerIds.filter((playerId, i) => {
      const check = checks[i];
      if (check.status === 'fulfilled') {
        return (check as PromiseFulfilledResult<{ playerId: string; subscribed: boolean }>).value.subscribed;
      }
      return false;
    });

    console.log(`[sendPushAll] Filtered to ${validPlayerIds.length} subscribed Player IDs (out of ${uniquePlayerIds.length} total)`);

    if (validPlayerIds.length === 0) {
      console.warn('[sendPushAll] No subscribed Player IDs found after filtering');
      return json(200, { 
        ok: true, 
        warning: 'No subscribed devices found',
        sentTo: 0,
        checked: uniquePlayerIds.length,
        result: null 
      });
    }

    // Send notification to subscribed devices
    console.log(`[sendPushAll] Sending notification to ${validPlayerIds.length} subscribed devices...`);
    
    // Log which user IDs are included (for debugging Carl's issue)
    const userIdsIncluded = new Set<string>();
    validPlayerIds.forEach(playerId => {
      const sub = subs.find((s: any) => s.player_id === playerId);
      if (sub?.user_id) userIdsIncluded.add(sub.user_id);
    });
    console.log(`[sendPushAll] Sending to ${userIdsIncluded.size} unique users:`, Array.from(userIdsIncluded));
    
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
        data: data ?? undefined,
      }),
    });

    const body = await resp.json().catch(() => ({}));
    
    if (!resp.ok) {
      console.error('[sendPushAll] OneSignal API error:', body);
      return json(resp.status, { 
        error: 'OneSignal error', 
        details: body,
        oneSignalErrors: body.errors || [],
        fullResponse: body
      });
    }

    // Check for errors in the response even if HTTP status is OK
    const oneSignalErrors = body.errors || [];
    const actualRecipients = body.recipients || 0;
    
    if (oneSignalErrors.length > 0) {
      console.warn('[sendPushAll] OneSignal returned errors:', oneSignalErrors);
      console.warn('[sendPushAll] Actual recipients:', actualRecipients, 'Expected:', validPlayerIds.length);
    }
    
    console.log(`[sendPushAll] OneSignal response: ${actualRecipients} recipients, ${oneSignalErrors.length} errors`);
    
    return json(200, { 
      ok: true, 
      sentTo: actualRecipients, // Use actual recipients from OneSignal, not our count
      expected: validPlayerIds.length,
      checked: uniquePlayerIds.length,
      oneSignalErrors: oneSignalErrors.length > 0 ? oneSignalErrors : undefined,
      result: body 
    });
  } catch (e: any) {
    console.error('[sendPushAll] Unexpected error:', e);
    return json(500, { error: 'Failed to send notification', details: e?.message || String(e) });
  }
};