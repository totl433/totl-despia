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
  // Only allow POST for security
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  // Parse body
  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const userId = payload.userId;
  const playerId = payload.playerId;

  if (!userId) {
    return json(400, { error: 'userId is required' });
  }

  if (!playerId) {
    return json(400, { error: 'playerId is required' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify user exists
  const { data: user, error: userError } = await admin
    .from('users')
    .select('id, name')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return json(404, { error: 'User not found' });
  }

  console.log(`[forceUserRegistration] Forcing registration for user ${user.name} (${userId})`);

  // Check OneSignal subscription status
  let subscriptionStatus = { subscribed: false, player: null as any };
  if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
    subscriptionStatus = await isSubscribed(playerId, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);
    console.log(`[forceUserRegistration] OneSignal subscription status: ${subscriptionStatus.subscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`);
  }

  // Deactivate other devices for this user
  await admin
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .neq('player_id', playerId)
    .then(() => {}, (err) => console.warn(`[forceUserRegistration] Failed to deactivate old devices:`, err));

  // Upsert this device
  const { error: upsertError, data } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        player_id: playerId,
        platform: 'ios',
        is_active: true,
        subscribed: subscriptionStatus.subscribed,
        last_checked_at: new Date().toISOString(),
        last_active_at: subscriptionStatus.player?.last_active ? new Date(subscriptionStatus.player.last_active * 1000).toISOString() : null,
        invalid: subscriptionStatus.player ? !!subscriptionStatus.player.invalid_identifier : false,
        os_payload: subscriptionStatus.player || null,
      },
      { onConflict: 'user_id,player_id' }
    );

  if (upsertError) {
    console.error(`[forceUserRegistration] Failed to upsert:`, upsertError);
    return json(500, { error: 'Failed to register device', details: upsertError.message });
  }

  // Set external_user_id in OneSignal
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
      }).then(() => {}, (err) => console.warn(`[forceUserRegistration] Failed to set external_user_id:`, err));
    } catch (e) {
      console.warn(`[forceUserRegistration] Error setting external_user_id:`, e);
    }
  }

  console.log(`[forceUserRegistration] Successfully registered playerId ${playerId.slice(0, 8)}… for user ${user.name} (subscribed: ${subscriptionStatus.subscribed})`);

  return json(200, {
    ok: true,
    userId,
    userName: user.name,
    playerId: playerId.slice(0, 8) + '…',
    subscribed: subscriptionStatus.subscribed,
    message: 'Device registered successfully',
    warning: !subscriptionStatus.subscribed ? 'Device registered but not subscribed in OneSignal. User may need to enable notifications in OS Settings.' : undefined,
  });
};
