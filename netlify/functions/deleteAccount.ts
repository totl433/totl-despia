import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      // Same-origin in production; allow CORS for local/dev tooling.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

type DeleteTarget = { table: string; column: string };

const DELETE_TARGETS: DeleteTarget[] = [
  // App tables
  { table: 'app_picks', column: 'user_id' },
  { table: 'app_gw_submissions', column: 'user_id' },

  // Web tables (legacy)
  { table: 'picks', column: 'user_id' },
  { table: 'gw_submissions', column: 'user_id' },

  // Leagues / chat
  { table: 'league_message_reactions', column: 'user_id' },
  { table: 'league_members', column: 'user_id' },
  { table: 'league_notification_settings', column: 'user_id' },
  { table: 'chat_presence', column: 'user_id' },

  // Preferences / notifications
  { table: 'user_notification_preferences', column: 'user_id' },
  { table: 'email_preferences', column: 'user_id' },

  // Push subscriptions (not FK’d to auth.users in SQL here)
  { table: 'push_subscriptions', column: 'user_id' },
];

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: 'Missing Supabase environment variables' });
  }

  // Parse body (optional, but we accept a confirm flag to reduce accidental calls)
  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  if (payload?.confirm !== true) {
    return json(400, { ok: false, error: 'Missing confirm flag' });
  }

  // Identify caller via Supabase JWT
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
  if (!bearer) return json(401, { ok: false, error: 'Unauthorized: missing token' });

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supaUser.auth.getUser();
  if (userError) return json(401, { ok: false, error: 'Unauthorized: invalid token' });

  const userId = userData?.user?.id;
  if (!userId) return json(401, { ok: false, error: 'Unauthorized: no user' });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const deletions: Array<{ table: string; ok: boolean; details?: string }> = [];

  // Best-effort delete rows across known tables.
  for (const target of DELETE_TARGETS) {
    try {
      const { error } = await admin.from(target.table).delete().eq(target.column, userId);
      if (error) {
        deletions.push({ table: target.table, ok: false, details: error.message });
      } else {
        deletions.push({ table: target.table, ok: true });
      }
    } catch (e: any) {
      deletions.push({ table: target.table, ok: false, details: e?.message || String(e) });
    }
  }

  // Remove / anonymize the public.users row (used for display name / avatars).
  // If hard-delete fails due to FK constraints (e.g. chat history), anonymize instead.
  let usersRowHandled: { ok: boolean; mode: 'deleted' | 'anonymized'; details?: string } | null = null;
  try {
    const { error } = await admin.from('users').delete().eq('id', userId);
    if (!error) {
      usersRowHandled = { ok: true, mode: 'deleted' };
    } else {
      // Fallback: anonymize
      const { error: updError } = await admin
        .from('users')
        .update({
          name: 'Deleted User',
          avatar_url: null,
          email: null,
          first_name: null,
          last_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updError) {
        usersRowHandled = { ok: false, mode: 'anonymized', details: `${error.message}; ${updError.message}` };
      } else {
        usersRowHandled = { ok: true, mode: 'anonymized', details: error.message };
      }
    }
  } catch (e: any) {
    usersRowHandled = { ok: false, mode: 'anonymized', details: e?.message || String(e) };
  }

  // Finally, delete the auth user (this disables login and removes email from auth.users).
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    return json(500, {
      ok: false,
      error: 'Failed to delete auth user',
      details: deleteAuthError.message,
      deletions,
      usersRowHandled,
    });
  }

  return json(200, {
    ok: true,
    userId,
    usersRowHandled,
    deletions,
  });
};

