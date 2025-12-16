import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Deactivate a user's push subscriptions on logout
 * 
 * This prevents "ghost notifications" being sent to devices after the user logs out.
 * Called from deactivatePushSubscription() in pushNotificationsV2.ts
 */
export const handler: Handler = async (event) => {
  // Allow OPTIONS for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

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

  // Get user from auth token
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
    if (error) {
      // User might already be logged out on Supabase side, that's OK
      console.log('[deactivateDevice] Token invalid (user may already be logged out):', error.message);
    }
    userId = data?.user?.id;
  }

  // If we don't have a userId from token, try to infer from playerId
  // This can happen if the session was already invalidated
  if (!userId && !playerId) {
    return json(400, { error: 'Either valid auth token or playerId required' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Deactivate by userId (deactivates all devices for this user)
  if (userId) {
    console.log(`[deactivateDevice] Deactivating all devices for user ${userId}`);
    
    const { error, count } = await admin
      .from('push_subscriptions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error(`[deactivateDevice] Error deactivating devices for user ${userId}:`, error);
      return json(500, { error: 'Failed to deactivate devices', details: error.message });
    }

    console.log(`[deactivateDevice] Deactivated ${count ?? 'unknown'} device(s) for user ${userId}`);
    return json(200, { 
      ok: true, 
      deactivated: count ?? 0,
      method: 'by_user_id',
    });
  }

  // Deactivate by playerId only (fallback if session already expired)
  if (playerId) {
    console.log(`[deactivateDevice] Deactivating device ${playerId.slice(0, 8)}...`);
    
    const { error, count } = await admin
      .from('push_subscriptions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('player_id', playerId)
      .eq('is_active', true);

    if (error) {
      console.error(`[deactivateDevice] Error deactivating device ${playerId}:`, error);
      return json(500, { error: 'Failed to deactivate device', details: error.message });
    }

    console.log(`[deactivateDevice] Deactivated device ${playerId.slice(0, 8)}...`);
    return json(200, { 
      ok: true, 
      deactivated: count ?? 0,
      method: 'by_player_id',
    });
  }

  return json(400, { error: 'No valid identifier provided' });
};

