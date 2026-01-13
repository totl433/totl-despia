/**
 * League Member Join Notification
 * 
 * Sends push notifications to league members when someone joins a mini-league.
 * Uses the unified notification dispatcher system.
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification, formatEventId } from './lib/notifications';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifyLeagueMemberJoin:baseUrl',message:'Base URL detected',data:{baseUrl,host:event.headers.host,protocol:event.headers['x-forwarded-proto'],envUrl:process.env.URL,envSiteUrl:process.env.SITE_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'test-playtotl',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Ensure baseUrl is valid
  if (!baseUrl || !baseUrl.startsWith('http')) {
    console.error(`[notifyLeagueMemberJoin] Invalid baseUrl: ${baseUrl}`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifyLeagueMemberJoin:invalidBaseUrl',message:'Invalid base URL detected',data:{baseUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'test-playtotl',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get league code and name for deep linking and notification text
    const { data: leagueData, error: leagueErr } = await admin
      .from('leagues')
      .select('code, name')
      .eq('id', leagueId)
      .single();

    if (leagueErr || !leagueData) {
      console.error('[notifyLeagueMemberJoin] Failed to load league:', leagueErr);
      return json(500, { error: 'Failed to load league', details: leagueErr?.message });
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifyLeagueMemberJoin:urlConstructed',message:'Final URL constructed for OneSignal',data:{fullUrl,baseUrl,leagueCode,isAbsolute:fullUrl.startsWith('http')},timestamp:Date.now(),sessionId:'debug-session',runId:'test-playtotl',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
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
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifyLeagueMemberJoin:result',message:'Notification dispatch result',data:{accepted:result.results.accepted,failed:result.results.failed,suppressed_preference:result.results.suppressed_preference,suppressed_unsubscribed:result.results.suppressed_unsubscribed,total_users:result.total_users,fullUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'test-playtotl',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

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

