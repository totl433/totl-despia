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
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

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

  // Dev override (explicitly enabled only)
  if (!userId && process.env.ALLOW_UNAUTH_DEV === 'true' && payload.userId) {
    userId = String(payload.userId).trim();
  }

  if (!userId) return json(401, { error: 'Unauthorized: missing valid user' });

  // Log for debugging
  console.log(`[registerPlayer] userId: ${userId}, playerId: ${playerId}, platform: ${platform}`);

  // Upsert row (Despia uses legacy OneSignal SDK - only player_id available)
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error, data } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        player_id: playerId,
        platform,
        is_active: true,
      },
      { onConflict: 'user_id,player_id' }
    );

  if (error) {
    console.error(`[registerPlayer] Failed to upsert for ${userId}:`, error);
    return json(500, { error: 'Failed to register device', details: error.message });
  }

  console.log(`[registerPlayer] Successfully registered playerId ${playerId.slice(0, 8)}… for user ${userId}`);
  return json(200, {
    ok: true,
    userId,
    playerId: playerId.slice(0, 8) + '…', // mask for privacy
  });
};
