import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SP_USER_ID = '9c0bcf50-370d-412d-8826-95371a72b4fe';
const SEASON_KEY = '2026-27';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * One-off admin fix: swap highest_scorer and most_assists for a submitted Season Predictions row.
 * Uses service role and temporarily clears submitted_at to bypass the post-submit lock trigger.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ADMIN_SECRET = (process.env.ADMIN_DEVICE_REGISTRATION_SECRET || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  const providedSecret = event.headers['x-admin-secret'] || event.queryStringParameters?.secret;
  if (ADMIN_SECRET && providedSecret !== ADMIN_SECRET) {
    return json(401, { error: 'Unauthorized: invalid admin secret' });
  }

  let payload: { userId?: string; seasonKey?: string; action?: string } = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (payload.action !== 'swapScorerAssists') {
    return json(400, { error: 'Unsupported action. Use action=swapScorerAssists' });
  }

  const userId = payload.userId || SP_USER_ID;
  const seasonKey = payload.seasonKey || SEASON_KEY;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: row, error: readError } = await admin
    .from('season_prediction_picks')
    .select('highest_scorer, most_assists, submitted_at')
    .eq('season_key', seasonKey)
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    return json(500, { error: 'Failed to read picks', details: readError.message });
  }
  if (!row) {
    return json(404, { error: 'No season prediction row found for user' });
  }

  const originalSubmittedAt = row.submitted_at;

  const { error: unlockError } = await admin
    .from('season_prediction_picks')
    .update({ submitted_at: null })
    .eq('season_key', seasonKey)
    .eq('user_id', userId);

  if (unlockError) {
    return json(500, { error: 'Failed to unlock row', details: unlockError.message });
  }

  const { data: updated, error: swapError } = await admin
    .from('season_prediction_picks')
    .update({
      highest_scorer: row.most_assists,
      most_assists: row.highest_scorer,
      submitted_at: originalSubmittedAt,
    })
    .eq('season_key', seasonKey)
    .eq('user_id', userId)
    .select('highest_scorer, most_assists, submitted_at')
    .single();

  if (swapError) {
    return json(500, { error: 'Failed to swap picks', details: swapError.message });
  }

  return json(200, {
    ok: true,
    userId,
    seasonKey,
    before: {
      highest_scorer: row.highest_scorer,
      most_assists: row.most_assists,
    },
    after: {
      highest_scorer: updated.highest_scorer,
      most_assists: updated.most_assists,
    },
  });
};
