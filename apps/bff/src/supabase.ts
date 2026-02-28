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

