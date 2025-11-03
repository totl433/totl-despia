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
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ADMIN_SECRET = (process.env.ADMIN_DEVICE_REGISTRATION_SECRET || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  // Simple secret check (set ADMIN_DEVICE_REGISTRATION_SECRET in Netlify env vars)
  const providedSecret = event.headers['x-admin-secret'] || event.queryStringParameters?.secret;
  if (ADMIN_SECRET && providedSecret !== ADMIN_SECRET) {
    return json(401, { error: 'Unauthorized: invalid admin secret' });
  }

  // Parse body
  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { userId, playerId, platform = 'ios' } = payload;

  if (!userId || !playerId) {
    return json(400, { error: 'Missing userId or playerId' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Upsert device registration
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
    console.error(`[adminRegisterDevice] Failed to upsert for ${userId}:`, error);
    return json(500, { error: 'Failed to register device', details: error.message });
  }

  console.log(`[adminRegisterDevice] Successfully registered playerId ${playerId.slice(0, 8)}… for user ${userId}`);
  return json(200, {
    ok: true,
    userId,
    playerId: playerId.slice(0, 8) + '…',
  });
};

