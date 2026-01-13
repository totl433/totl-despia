/**
 * League Member Join Notification
 * 
 * Sends push notifications to league members when someone joins a mini-league.
 * Uses the unified notification dispatcher system.
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification, formatEventId } from './lib/notifications';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // Validate environment variables (match notifyLeagueMessageV2 EXACTLY)
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  console.log('[notifyLeagueMemberJoin] Env check:', {
    urlPresent: !!SUPABASE_URL,
    urlLength: SUPABASE_URL?.length,
    urlPreview: SUPABASE_URL?.substring(0, 30) + '...',
    keyPresent: !!SUPABASE_SERVICE_ROLE_KEY,
    keyLength: SUPABASE_SERVICE_ROLE_KEY?.length,
    keyPreview: SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...',
    keyEndsWith: SUPABASE_SERVICE_ROLE_KEY?.substring(SUPABASE_SERVICE_ROLE_KEY.length - 10),
  });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[notifyLeagueMemberJoin] Missing Supabase environment variables', {
      hasUrl: !!SUPABASE_URL,
      hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  // Get base URL for constructing absolute URLs (OneSignal requires http:// or https://)
  const getBaseUrl = () => {
    // Try to extract from event headers
    if (event.headers.host) {
      const protocol = event.headers['x-forwarded-proto'] || 'https';
      const url = `${protocol}://${event.headers.host}`;
      console.log(`[notifyLeagueMemberJoin] Base URL from headers: ${url} (host: ${event.headers.host}, proto: ${protocol})`);
      if (url && url.startsWith('http')) return url;
    }
    // Fallback to environment variable
    const envUrl = process.env.URL || process.env.SITE_URL || process.env.DEPLOY_PRIME_URL;
    if (envUrl && envUrl.trim()) {
      const url = envUrl.trim();
      console.log(`[notifyLeagueMemberJoin] Base URL from env: ${url}`);
      if (url.startsWith('http')) return url;
    }
    // Default fallback (shouldn't happen in production)
    const defaultUrl = 'https://playtotl.com';
    console.warn(`[notifyLeagueMemberJoin] Base URL using default fallback: ${defaultUrl}`);
    return defaultUrl;
  };
  const baseUrl = getBaseUrl();
  
  // Debug logging for URL detection (check Netlify function logs)
  console.log(`[notifyLeagueMemberJoin] URL Detection Debug:`, {
    baseUrl,
    host: event.headers.host,
    protocol: event.headers['x-forwarded-proto'],
    envUrl: process.env.URL,
    envSiteUrl: process.env.SITE_URL,
    envDeployPrimeUrl: process.env.DEPLOY_PRIME_URL,
  });
  
  // Ensure baseUrl is valid
  if (!baseUrl || !baseUrl.startsWith('http')) {
    console.error(`[notifyLeagueMemberJoin] Invalid baseUrl: ${baseUrl}`);
    return json(500, { error: 'Failed to construct base URL', baseUrl });
  }

  let body: { leagueId: string; userId: string; userName: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { leagueId, userId, userName } = body;

  if (!leagueId || !userId || !userName) {
    return json(400, { error: 'Missing required fields: leagueId, userId, userName' });
  }

  // Test Supabase client connection first
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Verify client works by testing a simple query
  console.log('[notifyLeagueMemberJoin] Testing Supabase client...');
  const { data: testData, error: testError } = await admin
    .from('leagues')
    .select('id')
    .limit(1);
  
  if (testError) {
    console.error('[notifyLeagueMemberJoin] Supabase client test failed:', {
      error: testError,
      message: testError.message,
      code: testError.code,
      details: testError.details,
      hint: testError.hint,
      url: SUPABASE_URL?.substring(0, 30) + '...',
      keyLength: SUPABASE_SERVICE_ROLE_KEY?.length,
    });
    return json(500, { error: 'Supabase client initialization failed', details: testError.message });
  }
  
  console.log('[notifyLeagueMemberJoin] Supabase client test passed, querying league...');

  try {
    // Get league code and name for deep linking and notification text
    console.log('[notifyLeagueMemberJoin] Querying league:', { leagueId, hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_SERVICE_ROLE_KEY, keyLength: SUPABASE_SERVICE_ROLE_KEY?.length });
    const { data: leagueData, error: leagueErr } = await admin
      .from('leagues')
      .select('code, name')
      .eq('id', leagueId)
      .single();

    if (leagueErr) {
      console.error('[notifyLeagueMemberJoin] Failed to load league:', {
        error: leagueErr,
        message: leagueErr?.message,
        code: leagueErr?.code,
        details: leagueErr?.details,
        hint: leagueErr?.hint,
        leagueId,
      });
      return json(500, { error: 'Failed to load league', details: leagueErr?.message || String(leagueErr) });
    }

    if (!leagueData) {
      console.error('[notifyLeagueMemberJoin] League not found:', { leagueId });
      return json(404, { error: 'League not found', leagueId });
    }

    const leagueCode = leagueData.code;
    const leagueName = leagueData.name || 'your mini-league';

    // Get all league members (excluding the person who joined)
    const { data: members, error: memErr } = await admin
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId);

    if (memErr) {
      console.error('[notifyLeagueMemberJoin] Failed to load members:', memErr);
      return json(500, { error: 'Failed to load members', details: memErr.message });
    }

    const recipients = new Set<string>((members || []).map((r: any) => r.user_id).filter(Boolean));
    const totalMembers = recipients.size;
    recipients.delete(userId); // Exclude the person who joined
    console.log(`[notifyLeagueMemberJoin] Found ${totalMembers} total members, ${recipients.size} recipients (after excluding joiner ${userId.slice(0, 8)}...)`);

    if (recipients.size === 0) {
      console.log('[notifyLeagueMemberJoin] No recipients (only the joiner in league)');
      return json(200, { ok: true, message: 'No recipients', sent: 0 });
    }

    // Format notification text: "Carl joined Jof and Carl"
    const notificationText = `${userName} joined ${leagueName}`;

    // Format event ID for deduplication
    const eventId = formatEventId('member-join', {
      league_id: leagueId,
      user_id: userId,
    });

    if (!eventId) {
      return json(500, { error: 'Failed to format event ID' });
    }

    // Construct full URL for deep linking (OneSignal requires absolute URL)
    const fullUrl = `${baseUrl}/league/${leagueCode}`;
    console.log(`[notifyLeagueMemberJoin] Constructed URL: ${fullUrl} (baseUrl: ${baseUrl}, leagueCode: ${leagueCode})`);
    
    // Safe URL parsing for debugging
    let actualDomain = 'unknown';
    try {
      actualDomain = new URL(fullUrl).hostname;
    } catch (e) {
      console.warn(`[notifyLeagueMemberJoin] Failed to parse URL for domain extraction:`, e);
    }
    
    console.log(`[notifyLeagueMemberJoin] URL Debug:`, {
      fullUrl,
      baseUrl,
      leagueCode,
      isAbsolute: fullUrl.startsWith('http'),
      expectedDomain: 'playtotl.com',
      actualDomain,
    });
    
    // Send notifications using the unified dispatcher
    // Note: dispatchNotification handles preference filtering automatically using the catalog's preference_key
    console.log(`[notifyLeagueMemberJoin] Calling dispatchNotification for ${recipients.size} recipients`);
    const result = await dispatchNotification({
      notification_key: 'member-join',
      event_id: eventId,
      user_ids: Array.from(recipients),
      title: `${userName} Joined!`,
      body: notificationText,
      data: {
        type: 'member-join',
        leagueId,
        leagueCode,
        userId,
        userName,
        leagueName,
      },
      url: fullUrl, // Deep link to specific league page (must be absolute URL for OneSignal)
      league_id: leagueId, // For mute checking
    });

    console.log(`[notifyLeagueMemberJoin] dispatchNotification result:`, {
      accepted: result.results.accepted,
      failed: result.results.failed,
      suppressed_preference: result.results.suppressed_preference,
      suppressed_unsubscribed: result.results.suppressed_unsubscribed,
      total_users: result.total_users,
      fullUrl, // Include URL in result log for debugging
    });

    // Return detailed result for debugging
    return json(200, {
      ok: true,
      sent: result.results.accepted || 0,
      recipients: recipients.size,
      breakdown: {
        accepted: result.results.accepted || 0,
        failed: result.results.failed || 0,
        suppressed_preference: result.results.suppressed_preference || 0,
        suppressed_unsubscribed: result.results.suppressed_unsubscribed || 0,
        suppressed_duplicate: result.results.suppressed_duplicate || 0,
        suppressed_cooldown: result.results.suppressed_cooldown || 0,
        suppressed_muted: result.results.suppressed_muted || 0,
        total_users: result.total_users || 0,
      },
      result,
    });
  } catch (error: any) {
    console.error('[notifyLeagueMemberJoin] Error:', error);
    return json(500, {
      error: 'Internal server error',
      details: error?.message || String(error),
    });
  }
};

