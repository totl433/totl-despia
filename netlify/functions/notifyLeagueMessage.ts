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
      return `${protocol}://${event.headers.host}`;
    }
    // Fallback to environment variable
    if (process.env.URL || process.env.SITE_URL) {
      return (process.env.URL || process.env.SITE_URL || '').trim();
    }
    // Default fallback (shouldn't happen in production)
    return 'https://totl-staging.netlify.app';
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
  } catch {
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
  try {
    const { data: leagueData, error: leagueErr } = await admin
      .from('leagues')
      .select('code')
      .eq('id', leagueId)
      .single();
    
    if (leagueErr) {
      console.error('[notifyLeagueMessage] Failed to load league code:', leagueErr);
      // Don't fail the notification, but log the error
    } else if (leagueData?.code) {
      leagueCode = leagueData.code;
      // Construct full URL (OneSignal requires http:// or https://)
      leagueUrl = `${baseUrl}/league/${leagueCode}?tab=chat`;
    } else {
      console.warn('[notifyLeagueMessage] League code not found for leagueId:', leagueId);
    }
  } catch (e) {
    console.error('[notifyLeagueMessage] Error getting league code:', e);
  }

  // Get current league members
  const { data: members, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);

  if (memErr) return json(500, { error: 'Failed to load members', details: memErr.message });
  let recipientIds = new Set<string>((members ?? []).map((r: any) => r.user_id).filter(Boolean));

  // Exclude sender
  recipientIds.delete(senderId);

  // Exclude muted
  const { data: mutes, error: muteErr } = await admin
    .from('league_notification_settings')
    .select('user_id, muted')
    .eq('league_id', leagueId)
    .eq('muted', true);

  if (muteErr) return json(500, { error: 'Failed to load mutes', details: muteErr.message });
  for (const row of (mutes ?? [])) recipientIds.delete(row.user_id);

  // Optional: exclude currently active chat users (if provided)
  if (Array.isArray(activeUserIds)) {
    for (const uid of activeUserIds) recipientIds.delete(uid);
  }

  // Also exclude users who are actively viewing the chat (presence tracking)
  // Users are considered "active" if they've been seen in the last 30 seconds
  const { data: activeViewers, error: presenceErr } = await admin
    .from('chat_presence')
    .select('user_id')
    .eq('league_id', leagueId)
    .gte('last_seen', new Date(Date.now() - 30000).toISOString()); // Last 30 seconds
  
  if (!presenceErr && activeViewers) {
    for (const viewer of activeViewers) {
      recipientIds.delete(viewer.user_id);
    }
  }

  if (recipientIds.size === 0) {
    console.log('[notifyLeagueMessage] No eligible recipients (all excluded: sender, muted, or active)');
    return json(200, { ok: true, message: 'No eligible recipients' });
  }

  // Resolve player IDs
  const toIds = Array.from(recipientIds);
  console.log(`[notifyLeagueMessage] Looking up push subscriptions for ${toIds.length} recipient user IDs`);
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
  console.log(`[notifyLeagueMessage] Found ${playerIds.length} active player IDs for ${toIds.length} recipients`);
  
  if (playerIds.length === 0) {
    console.log('[notifyLeagueMessage] No registered devices found for recipients');
    return json(200, { ok: true, message: 'No devices' });
  }

  // Build message: title = sender, body = content (trim to reasonable length)
  const title = senderName || 'New message';
  const message = String(content).slice(0, 180);
  
  console.log(`[notifyLeagueMessage] Sending notification to ${playerIds.length} devices:`, {
    leagueId,
    leagueCode,
    leagueUrl,
    senderId,
    senderName: title,
    messagePreview: message.slice(0, 50),
    playerIds: playerIds.slice(0, 3) // Log first 3 for debugging
  });

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
  if (leagueUrl) {
    oneSignalPayload.web_url = leagueUrl;
  } else if (leagueCode) {
    // Fallback: construct full URL from code if leagueUrl wasn't set
    const fallbackUrl = `${baseUrl}/league/${leagueCode}?tab=chat`;
    oneSignalPayload.web_url = fallbackUrl;
  }

  // Try endpoints and headers similar to original working version
  const isV2 = ONESIGNAL_REST_API_KEY.startsWith('os_');
  const endpoints = isV2
    ? ['https://api.onesignal.com/notifications', 'https://onesignal.com/api/v1/notifications']
    : ['https://onesignal.com/api/v1/notifications', 'https://api.onesignal.com/notifications'];
  const headersList = isV2
    ? [`Bearer ${ONESIGNAL_REST_API_KEY}`, ONESIGNAL_REST_API_KEY, `Basic ${ONESIGNAL_REST_API_KEY}`]
    : [`Basic ${ONESIGNAL_REST_API_KEY}`, `Bearer ${ONESIGNAL_REST_API_KEY}`, ONESIGNAL_REST_API_KEY];

  let lastResp: any = null;
  for (const endpoint of endpoints) {
    for (const auth of headersList) {
      console.log(`[notifyLeagueMessage] Attempting OneSignal API call:`, { endpoint, authType: auth.startsWith('Bearer') ? 'Bearer' : auth.startsWith('Basic') ? 'Basic' : 'Raw' });
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': auth },
        body: JSON.stringify(oneSignalPayload),
      });
      const body = await resp.json().catch(() => ({}));
      lastResp = { endpoint, auth, status: resp.status, body };
      
      console.log(`[notifyLeagueMessage] OneSignal API response:`, {
        endpoint,
        status: resp.status,
        ok: resp.ok,
        recipients: body.recipients,
        errors: body.errors,
        id: body.id
      });
      
      // OneSignal often returns HTTP 200 even with errors in the body
      if (resp.ok) {
        // Check for errors in response body
        if (body.errors && body.errors.length > 0) {
          console.error(`[notifyLeagueMessage] OneSignal returned errors:`, body.errors);
          // If all players are not subscribed, that's a different issue
          if (body.errors.some((e: string) => e.includes('not subscribed'))) {
            console.warn(`[notifyLeagueMessage] Some/all players not subscribed in OneSignal - trying next endpoint/auth combo`);
            // Continue to next endpoint/auth combo
            continue;
          }
        }
        
        // Success - check recipients count
        const recipients = body.recipients || 0;
        if (recipients > 0 || !body.errors) {
          console.log(`[notifyLeagueMessage] Success! Sent to ${recipients} recipients`);
          return json(200, { ok: true, result: body, sent: playerIds.length, recipients });
        }
      }
      if (![401, 403].includes(resp.status)) break;
    }
  }
  
  console.error('[notifyLeagueMessage] All attempts failed:', lastResp);
  return json(200, { ok: false, error: 'OneSignal error', details: lastResp, sent: 0 });
};
