import { createClient } from '@supabase/supabase-js';
import type { Env } from './env.js';

export function createSupabaseClient(env: Env, opts?: { bearerToken?: string }) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: opts?.bearerToken
      ? { headers: { Authorization: `Bearer ${opts.bearerToken}` } }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseAdminClient(env: Env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin auth lookups'), { statusCode: 500 });
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

