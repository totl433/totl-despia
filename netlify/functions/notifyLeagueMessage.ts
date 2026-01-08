import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();
  
  // Get base URL for constructing full deep link URLs (OneSignal requires full URLs)
  // Try to get from event headers, fallback to environment variable or default
  const getBaseUrl = () => {
    // Try to extract from event headers
    if (event.headers.host) {
      const protocol = event.headers['x-forwarded-proto'] || 'https';
      const url = `${protocol}://${event.headers.host}`;
      console.log(`[notifyLeagueMessage] Base URL from headers: ${url} (host: ${event.headers.host}, proto: ${protocol})`);
      return url;
    }
    // Fallback to environment variable
    if (process.env.URL || process.env.SITE_URL) {
      const url = (process.env.URL || process.env.SITE_URL || '').trim();
      console.log(`[notifyLeagueMessage] Base URL from env: ${url}`);
      return url;
    }
    // Default fallback (shouldn't happen in production)
    const defaultUrl = 'https://totl-staging.netlify.app';
    console.warn(`[notifyLeagueMessage] Base URL using default fallback: ${defaultUrl}`);
    return defaultUrl;
  };
  const baseUrl = getBaseUrl();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }
  
  const { leagueId, senderId, senderName, content, activeUserIds } = payload || {};
  if (!leagueId || !senderId || !content) {
    return json(400, { error: 'Missing leagueId, senderId, or content' });
  }

  // Optional auth: if Authorization Bearer provided, must match senderId
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : undefined;
  if (token) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || data.user?.id !== senderId) return json(401, { error: 'Unauthorized' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get league code for deep linking (REQUIRED for notifications to work)
  let leagueCode: string | undefined;
  let leagueUrl: string | undefined;
  let leagueCodeError: any = null;
  try {
    const { data: leagueData, error: leagueErr } = await admin
      .from('leagues')
      .select('code')
      .eq('id', leagueId)
      .single();
    
    if (leagueErr) {
      leagueCodeError = leagueErr;
      console.error('[notifyLeagueMessage] Failed to load league code:', leagueErr);
      // Don't fail the notification, but log the error
    } else if (leagueData?.code) {
      leagueCode = leagueData.code;
      // Construct full URL (OneSignal requires http:// or https://)
      leagueUrl = `${baseUrl}/league/${leagueCode}?tab=chat`;
      console.log(`[notifyLeagueMessage] League code loaded: ${leagueCode}, URL: ${leagueUrl}`);
    } else {
      console.warn(`[notifyLeagueMessage] League code not found for leagueId: ${leagueId} (data: ${JSON.stringify(leagueData)})`);
    }
  } catch (e) {
    leagueCodeError = e;
    console.error('[notifyLeagueMessage] Error getting league code:', e);
  }

  // Get current league members
  const { data: members, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);

  if (memErr) {
    return json(500, { error: 'Failed to load members', details: memErr.message });
  }
  const totalMembers = (members ?? []).length;
  console.log(`[notifyLeagueMessage] Total league members: ${totalMembers}`);
  
  let recipientIds = new Set<string>((members ?? []).map((r: any) => r.user_id).filter(Boolean));

  // Exclude sender
  recipientIds.delete(senderId);

  // Exclude muted
  const { data: mutes, error: muteErr } = await admin
    .from('league_notification_settings')
    .select('user_id, muted')
    .eq('league_id', leagueId)
    .eq('muted', true);

  if (muteErr) {
    console.error('[notifyLeagueMessage] Failed to load mutes:', muteErr);
    return json(500, { error: 'Failed to load mutes', details: muteErr.message });
  }
  
  for (const row of (mutes ?? [])) recipientIds.delete(row.user_id);

  // Optional: exclude currently active chat users (if provided)
  if (Array.isArray(activeUserIds)) {
    for (const uid of activeUserIds) recipientIds.delete(uid);
  }

  // Exclude users who are actively viewing the chat (presence check)
  // Query for users with recent presence (< 60 seconds ago)
  const { data: activePresence, error: presenceErr } = await admin
    .from('chat_presence')
    .select('user_id')
    .eq('league_id', leagueId)
    .gt('last_seen', new Date(Date.now() - 60000).toISOString()); // Last 60 seconds

  if (presenceErr) {
    console.error('[notifyLeagueMessage] Failed to load chat presence (non-critical):', presenceErr);
    // Don't fail - continue without presence filtering if query fails
  } else if (activePresence && activePresence.length > 0) {
    const activeUserIdsFromPresence = new Set(activePresence.map((p: any) => p.user_id));
    for (const uid of activeUserIdsFromPresence) {
      recipientIds.delete(uid);
    }
    console.log(`[notifyLeagueMessage] Excluded ${activeUserIdsFromPresence.size} active chat viewers from notifications`);
  }

  if (recipientIds.size === 0) {
    console.log('[notifyLeagueMessage] No eligible recipients (all excluded: sender, muted, active, or viewing chat)');
    return json(200, { ok: true, message: 'No eligible recipients' });
  }

  // Resolve player IDs
  const toIds = Array.from(recipientIds);
  
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('player_id, user_id')
    .in('user_id', toIds)
    .eq('is_active', true);

  if (subErr) {
    console.error('[notifyLeagueMessage] Failed to load subscriptions:', subErr);
    return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
  }
  
  const playerIds = Array.from(new Set((subs ?? []).map((s: any) => s.player_id).filter(Boolean)));

  if (playerIds.length === 0) {
    console.log('[notifyLeagueMessage] No registered devices found for recipients');
    return json(200, { ok: true, message: 'No devices' });
  }
  
  // Note: Having player IDs in database doesn't guarantee devices are subscribed in OneSignal
  // OneSignal may accept notifications but not deliver them if devices aren't subscribed
  // Check OneSignal dashboard or use Message History API to verify actual delivery

  // Build message: title = sender, body = content (trim to reasonable length)
  const title = senderName || 'New message';
  const message = String(content).slice(0, 180);

  // Build OneSignal payload with deep link URL
  // iOS requires url and web_url at top level for deep linking
  const oneSignalPayload: Record<string, any> = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: playerIds,
    headings: { en: title },
    contents: { en: message },
    data: {
      type: 'league_message',
      leagueId,
      senderId,
      ...(leagueCode && { leagueCode }),
    },
  };
  
  // Add URL for deep linking (iOS needs web_url, NOT url - they conflict)
  let finalDeepLinkUrl: string | undefined;
  if (leagueUrl) {
    oneSignalPayload.web_url = leagueUrl;
    finalDeepLinkUrl = leagueUrl;
    console.log(`[notifyLeagueMessage] Deep link URL set from leagueUrl: ${leagueUrl}`);
  } else if (leagueCode) {
    // Fallback: construct full URL from code if leagueUrl wasn't set
    const fallbackUrl = `${baseUrl}/league/${leagueCode}?tab=chat`;
    oneSignalPayload.web_url = fallbackUrl;
    finalDeepLinkUrl = fallbackUrl;
    console.log(`[notifyLeagueMessage] Deep link URL set from fallback: ${fallbackUrl}`);
  } else {
    console.warn(`[notifyLeagueMessage] No deep link URL set - missing both leagueUrl and leagueCode`);
  }
  
  console.log(`[notifyLeagueMessage] Final OneSignal payload web_url:`, oneSignalPayload.web_url);
  console.log(`[notifyLeagueMessage] OneSignal payload data:`, JSON.stringify(oneSignalPayload.data, null, 2));
  
  // Single endpoint and auth - simplified per Phase 4
  const endpoint = 'https://onesignal.com/api/v1/notifications';
  const auth = `Basic ${ONESIGNAL_REST_API_KEY}`;

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify(oneSignalPayload),
    });
    
    const body = await resp.json().catch(() => ({}));
    
    if (!resp.ok) {
      console.error('[notifyLeagueMessage] OneSignal API error:', resp.status, body);
      return json(200, { ok: false, error: 'OneSignal API error', details: { status: resp.status, body }, sent: 0 });
    }
    
    // Check for errors in response body
    if (body.errors && body.errors.length > 0) {
      console.error('[notifyLeagueMessage] OneSignal returned errors:', body.errors);
      return json(200, { ok: false, error: 'OneSignal errors', details: body.errors, sent: 0 });
    }
    
    const recipients = body.recipients ?? body.result?.recipients ?? 0;
    const notificationId = body.id;
    
    if (notificationId) {
      console.log(`[notifyLeagueMessage] Success! Notification ID: ${notificationId}, recipients: ${recipients}`);
      return json(200, { ok: true, result: body, sent: playerIds.length, recipients, notificationId });
    }
    
    return json(200, { ok: false, error: 'Unexpected response format', details: body, sent: 0 });
  } catch (err: any) {
    console.error('[notifyLeagueMessage] OneSignal request failed:', err);
    return json(200, { ok: false, error: 'Request failed', details: err.message, sent: 0 });
  }
};
