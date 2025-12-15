import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed } from './utils/notificationHelpers';

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
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  // Parse body
  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const playerIdRaw = payload.playerId;
  const playerId: string | undefined = typeof playerIdRaw === 'string' && playerIdRaw.trim() ? playerIdRaw.trim() : undefined;
  const platform: string | null = (payload.platform || 'ios');

  // Despia uses legacy OneSignal SDK - only player_id is available
  if (!playerId) {
    return json(400, { error: 'playerId is required (Despia provides this via despia.onesignalplayerid)' });
  }
  
  // Ensure we have a valid identifier before proceeding
  if (playerId.length === 0) {
    return json(400, { error: 'playerId cannot be empty' });
  }

  // Work out the caller's userId
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : undefined;

  let userId: string | undefined;

  if (bearer) {
    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data, error } = await supaUser.auth.getUser();
    if (error) return json(401, { error: 'Invalid Supabase token' });
    userId = data?.user?.id;
  }

  // Dev override (explicitly enabled only) - allows registering devices for any user by UUID
  if (!userId && process.env.ALLOW_UNAUTH_DEV === 'true' && payload.userId) {
    userId = String(payload.userId).trim();
    console.log(`[registerPlayer] Using dev override for userId: ${userId}`);
  }

  if (!userId) return json(401, { error: 'Unauthorized: missing valid user' });

  // Log for debugging
  console.log(`[registerPlayer] userId: ${userId}, playerId: ${playerId}, platform: ${platform}`);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1) Mark other devices for this user as inactive (single-device mode)
  // If you want multi-device support, remove this block
  await admin
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .neq('player_id', playerId)
    .then(() => {}, (err) => console.warn(`[registerPlayer] Failed to deactivate old devices:`, err));

  // 2) Verify subscription status with OneSignal before marking as subscribed
  let subscriptionStatus = { subscribed: false, player: null as any };
  if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
    console.log(`[registerPlayer] Verifying subscription status with OneSignal for ${playerId.slice(0, 8)}…`);
    subscriptionStatus = await isSubscribed(playerId, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);
    console.log(`[registerPlayer] OneSignal subscription status: ${subscriptionStatus.subscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`);
    
    if (!subscriptionStatus.subscribed && subscriptionStatus.player) {
      console.warn(`[registerPlayer] Device not subscribed. Details:`, {
        hasToken: !!subscriptionStatus.player.identifier,
        invalid: subscriptionStatus.player.invalid_identifier,
        notificationTypes: subscriptionStatus.player.notification_types,
        lastActive: subscriptionStatus.player.last_active,
      });
    }
  }

  // 3) Upsert this device with actual subscription status
  const { error, data } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        player_id: playerId,
        platform,
        is_active: true,
        subscribed: subscriptionStatus.subscribed, // Use actual OneSignal subscription status
        last_checked_at: new Date().toISOString(),
        last_active_at: subscriptionStatus.player?.last_active ? new Date(subscriptionStatus.player.last_active * 1000).toISOString() : null,
        invalid: subscriptionStatus.player ? !!subscriptionStatus.player.invalid_identifier : false,
        os_payload: subscriptionStatus.player || null,
      },
      { onConflict: 'user_id,player_id' }
    );

  if (error) {
    console.error(`[registerPlayer] Failed to upsert for ${userId}:`, error);
    return json(500, { error: 'Failed to register device', details: error.message });
  }

  // 4) Set external_user_id in OneSignal (for user-based targeting)
  if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
    try {
      await fetch(`https://onesignal.com/api/v1/players/${playerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          external_user_id: userId,
        }),
      }).then(() => {}, (err) => console.warn(`[registerPlayer] Failed to set external_user_id:`, err));
    } catch (e) {
      console.warn(`[registerPlayer] Error setting external_user_id:`, e);
    }
  }

  console.log(`[registerPlayer] Successfully registered playerId ${playerId.slice(0, 8)}… for user ${userId} (subscribed: ${subscriptionStatus.subscribed})`);
  return json(200, {
    ok: true,
    userId,
    playerId: playerId.slice(0, 8) + '…', // mask for privacy
    subscribed: subscriptionStatus.subscribed,
    warning: !subscriptionStatus.subscribed ? 'Device registered but not subscribed in OneSignal. Please enable notifications in OS Settings.' : undefined,
  });
};
