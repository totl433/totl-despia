/**
 * Netlify Function: Sync user email preferences to MailerLite
 * 
 * This function syncs a user's email preferences from the database to MailerLite.
 * It should be called when a user updates their preferences or as a batch sync job.
 * 
 * Usage:
 * POST /.netlify/functions/syncEmailPreferences
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { userId: "uuid" } (optional - if not provided, uses authenticated user)
 * 
 * Or call without auth to sync all users (admin only):
 * POST /.netlify/functions/syncEmailPreferences?all=true
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { upsertSubscriber, unsubscribeSubscriber } from './utils/mailerlite';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  console.log('[syncEmailPreferences] Function invoked');

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[syncEmailPreferences] Missing Supabase env vars');
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  // Check for MailerLite API key
  if (!process.env.MAILERLITE_API_KEY?.trim()) {
    console.error('[syncEmailPreferences] Missing MailerLite API key');
    return json(500, { error: 'Missing MAILERLITE_API_KEY environment variable' });
  }

  const syncAll = event.queryStringParameters?.all === 'true';

  // For syncing all users, require service role key in query param (basic security)
  if (syncAll) {
    const providedKey = event.queryStringParameters?.serviceKey;
    if (providedKey !== SUPABASE_SERVICE_ROLE_KEY) {
      return json(403, { error: 'Unauthorized: service key required for syncing all users' });
    }
  }

  // Create Supabase clients
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let userClient;
  let userId: string | null = null;

  if (!syncAll) {
    // Get authenticated user
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;

    if (!bearer) {
      return json(401, { error: 'Unauthorized: Bearer token required' });
    }

    userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return json(401, { error: 'Invalid token' });
    }

    userId = userData.user.id;
  }

  try {
    let body: { userId?: string } = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }

    // If userId provided in body, use that (for admin operations)
    if (body.userId) {
      userId = body.userId;
    }

    if (syncAll) {
      // Sync all users with email preferences
      console.log('[syncEmailPreferences] Syncing all users...');

      const { data: allPreferences, error: prefError } = await adminClient
        .from('email_preferences')
        .select('user_id, new_gameweek, results_published, news_updates');

      if (prefError) {
        console.error('[syncEmailPreferences] Error fetching preferences:', prefError);
        return json(500, { error: 'Failed to fetch email preferences', details: prefError.message });
      }

      if (!allPreferences || allPreferences.length === 0) {
        return json(200, { 
          synced: 0, 
          message: 'No email preferences found to sync' 
        });
      }

      // Get user emails for all user IDs
      const userIds = allPreferences.map((p: any) => p.user_id);
      const { data: users, error: usersError } = await adminClient.auth.admin.listUsers();

      if (usersError) {
        console.error('[syncEmailPreferences] Error fetching users:', usersError);
        return json(500, { error: 'Failed to fetch users', details: usersError.message });
      }

      const userEmailMap = new Map<string, string>();
      users?.users?.forEach((user: any) => {
        if (user.email) {
          userEmailMap.set(user.id, user.email);
        }
      });

      // Sync each user
      let syncedCount = 0;
      let errorCount = 0;

      for (const pref of allPreferences) {
        const email = userEmailMap.get(pref.user_id);
        if (!email) {
          console.warn(`[syncEmailPreferences] No email found for user ${pref.user_id}`);
          errorCount++;
          continue;
        }

        const success = await upsertSubscriber(email, {
          new_gameweek: pref.new_gameweek,
          results_published: pref.results_published,
          news_updates: pref.news_updates,
        });

        if (success) {
          syncedCount++;
        } else {
          errorCount++;
        }
      }

      return json(200, {
        synced: syncedCount,
        errors: errorCount,
        total: allPreferences.length,
      });
    } else {
      // Sync single user
      if (!userId) {
        return json(400, { error: 'User ID required' });
      }

      console.log(`[syncEmailPreferences] Syncing user ${userId}...`);

      // Get user's email preferences
      const { data: preferences, error: prefError } = await adminClient
        .from('email_preferences')
        .select('new_gameweek, results_published, news_updates')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefError && prefError.code !== 'PGRST116') {
        console.error('[syncEmailPreferences] Error fetching preferences:', prefError);
        return json(500, { error: 'Failed to fetch email preferences', details: prefError.message });
      }

      // Get user email
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);

      if (userError || !userData?.user?.email) {
        return json(404, { error: 'User not found or has no email' });
      }

      const email = userData.user.email;

      if (!preferences) {
        // No preferences set - user hasn't opted in, so unsubscribe them
        console.log(`[syncEmailPreferences] No preferences for ${email}, unsubscribing...`);
        const success = await unsubscribeSubscriber(email);
        return json(200, {
          synced: success,
          message: success ? 'Unsubscribed from MailerLite' : 'Failed to unsubscribe',
        });
      }

      // Sync preferences to MailerLite
      const success = await upsertSubscriber(email, {
        new_gameweek: preferences.new_gameweek,
        results_published: preferences.results_published,
        news_updates: preferences.news_updates,
      });

      return json(200, {
        synced: success,
        email,
        preferences: {
          new_gameweek: preferences.new_gameweek,
          results_published: preferences.results_published,
          news_updates: preferences.news_updates,
        },
      });
    }
  } catch (error: any) {
    console.error('[syncEmailPreferences] Error:', error);
    return json(500, {
      error: 'Internal server error',
      details: error.message,
    });
  }
};

