/**
 * Test Supabase Connection
 * 
 * Simple test function to verify Supabase credentials work
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from './lib/notifications/targeting';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const results: any = {
    envVars: {
      urlPresent: !!SUPABASE_URL,
      urlLength: SUPABASE_URL?.length,
      urlPreview: SUPABASE_URL?.substring(0, 40),
      keyPresent: !!SUPABASE_SERVICE_ROLE_KEY,
      keyLength: SUPABASE_SERVICE_ROLE_KEY?.length,
      keyStart: SUPABASE_SERVICE_ROLE_KEY?.substring(0, 50),
      keyEnd: SUPABASE_SERVICE_ROLE_KEY?.substring(SUPABASE_SERVICE_ROLE_KEY.length - 20),
      keyFull: SUPABASE_SERVICE_ROLE_KEY, // Show full key to verify it matches
    },
    tests: {} as any,
  };

  // Test 1: Direct client creation (like notifyLeagueMemberJoin was doing)
  try {
    const directClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await directClient.from('leagues').select('id').limit(1);
    results.tests.directClient = {
      success: !error,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      } : null,
      dataCount: data?.length || 0,
    };
  } catch (e: any) {
    results.tests.directClient = {
      success: false,
      error: { message: e?.message || String(e), stack: e?.stack?.substring(0, 200) },
    };
  }

  // Test 2: Direct client with auth config (like some functions do)
  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await authClient.from('leagues').select('id').limit(1);
    results.tests.authClient = {
      success: !error,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      } : null,
      dataCount: data?.length || 0,
    };
  } catch (e: any) {
    results.tests.authClient = {
      success: false,
      error: { message: e?.message || String(e), stack: e?.stack?.substring(0, 200) },
    };
  }

  // Test 3: Shared getSupabase() helper (like we're trying now)
  try {
    const sharedClient = getSupabase();
    const { data, error } = await sharedClient.from('leagues').select('id').limit(1);
    results.tests.sharedClient = {
      success: !error,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      } : null,
      dataCount: data?.length || 0,
    };
  } catch (e: any) {
    results.tests.sharedClient = {
      success: false,
      error: { message: e?.message || String(e), stack: e?.stack?.substring(0, 200) },
    };
  }

  return json(200, results);
};
