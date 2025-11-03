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
  const subscriptionIdRaw = payload.subscriptionId;
  const subscriptionId: string | undefined = typeof subscriptionIdRaw === 'string' && subscriptionIdRaw.trim() ? subscriptionIdRaw.trim() : undefined;
  const platform: string | null = (payload.platform || null);

  if (!playerId && !subscriptionId) {
    return json(400, { error: 'Provide subscriptionId (preferred) or playerId' });
  }
  
  // Ensure we have a valid identifier before proceeding
  if (playerId && playerId.length === 0) {
    return json(400, { error: 'playerId cannot be empty' });
  }
  if (subscriptionId && subscriptionId.length === 0) {
    return json(400, { error: 'subscriptionId cannot be empty' });
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

  // Upsert rows
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // We upsert whichever identifiers we received. It’s okay to have both.
  // Ensure you have a UNIQUE index to support these onConflict clauses:
  //   - UNIQUE(user_id, player_id)
  //   - UNIQUE(user_id, subscription_id)
  // (Nulls won’t violate the uniqueness.)
  const results: Array<{ player_id?: string; subscription_id?: string }> = [];

  if (playerId) {
    const { error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          player_id: playerId,
          platform,
          subscription_id: subscriptionId ?? null, // harmless if you want to store both on same row
          is_active: true,
        },
        { onConflict: 'user_id,player_id' }
      );
    if (error) return json(500, { error: 'Failed to upsert playerId', details: error.message });
    results.push({ player_id: playerId });
  }

  if (subscriptionId) {
    const { error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          subscription_id: subscriptionId,
          platform,
          // optionally keep player_id too if you passed it
          player_id: playerId ?? null,
          is_active: true,
        },
        { onConflict: 'user_id,subscription_id' }
      );
    if (error) return json(500, { error: 'Failed to upsert subscriptionId', details: error.message });
    results.push({ subscription_id: subscriptionId });
  }

  // Optional tidy (disable stale rows). Safe to skip if you don’t want this behavior.
  // await admin.rpc('deactivate_old_players', { p_user_id: userId, p_player_id: playerId ?? null });

  return json(200, {
    ok: true,
    userId,
    stored: results,
  });
};
