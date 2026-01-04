import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed, loadUserNotificationPreferences } from './utils/notificationHelpers';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  console.log('[notifyLeagueMessage] Function invoked');
  
  if (event.httpMethod !== 'POST') {
    console.log('[notifyLeagueMessage] Method not allowed:', event.httpMethod);
    return json(405, { error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[notifyLeagueMessage] Missing Supabase env vars');
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('[notifyLeagueMessage] Missing OneSignal env vars');
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  // Optional debug
  if (event.queryStringParameters?.debug === '1') {
    return json(200, {
      appId: ONESIGNAL_APP_ID.slice(0, 8) + '…',
      authHeader: 'Basic ' + ONESIGNAL_REST_API_KEY.slice(0, 4) + '…',
    });
  }

  // Parse payload
  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
    console.log('[notifyLeagueMessage] Payload parsed:', { 
      leagueId: payload?.leagueId, 
      senderId: payload?.senderId, 
      hasContent: !!payload?.content 
    });
  } catch (e) {
    console.error('[notifyLeagueMessage] Failed to parse JSON:', e);
    return json(400, { error: 'Invalid JSON body' });
  }

  const { leagueId, senderId, senderName, content, activeUserIds } = payload || {};
  if (!leagueId || !senderId || !content) {
    console.log('[notifyLeagueMessage] Missing required fields:', { leagueId: !!leagueId, senderId: !!senderId, content: !!content });
    return json(400, { error: 'Missing leagueId, senderId, or content' });
  }

  // Optional auth check with JWT
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : undefined;
  if (token) {
    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data, error } = await supaUser.auth.getUser();
    if (error || data.user?.id !== senderId) return json(401, { error: 'Unauthorized' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 0) Get league code for deep linking
  const { data: leagueData, error: leagueErr } = await admin
    .from('leagues')
    .select('code')
    .eq('id', leagueId)
    .single();
  
  if (leagueErr) {
    console.error('[notifyLeagueMessage] Failed to load league:', leagueErr);
    return json(500, { error: 'Failed to load league', details: leagueErr.message });
  }
  
  const leagueCode = leagueData?.code;
  if (!leagueCode) {
    console.error('[notifyLeagueMessage] League code not found for league:', leagueId);
    return json(500, { error: 'League code not found' });
  }

  // 1) Resolve members (exclude sender)
  console.log(`[notifyLeagueMessage] Loading members for league: ${leagueId}`);
  const { data: members, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);
  if (memErr) {
    console.error('[notifyLeagueMessage] Failed to load members:', memErr);
    return json(500, { error: 'Failed to load members', details: memErr.message });
  }

  const recipients = new Set<string>((members || []).map((r: any) => r.user_id).filter(Boolean));
  const totalMembers = recipients.size;
  recipients.delete(senderId);
  console.log(`[notifyLeagueMessage] Found ${totalMembers} total members, ${recipients.size} recipients (after excluding sender)`);

  // 2) Remove muted (per-league settings)
  const { data: mutes, error: muteErr } = await admin
    .from('league_notification_settings')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('muted', true);
  if (muteErr) return json(500, { error: 'Failed to load mutes', details: muteErr.message });
  for (const row of (mutes || [])) recipients.delete(row.user_id);

  // 2b) Remove users who have disabled chat notifications globally
  const userPrefsMap = await loadUserNotificationPreferences(Array.from(recipients));
  for (const userId of Array.from(recipients)) {
    const prefs = userPrefsMap.get(userId);
    // If user has explicitly disabled chat-messages, remove them
    if (prefs && prefs['chat-messages'] === false) {
      recipients.delete(userId);
    }
  }

  // 3) Remove currently active (optional)
  if (Array.isArray(activeUserIds)) {
    console.log(`[notifyLeagueMessage] Removing ${activeUserIds.length} active users from recipients`);
    for (const uid of activeUserIds) recipients.delete(uid);
  }

  if (recipients.size === 0) {
    console.log('[notifyLeagueMessage] No eligible recipients after filtering');
    return json(200, { 
      ok: true, 
      message: 'No eligible recipients',
      debug: {
        totalMembers,
        afterExcludingSender: recipients.size,
        muted: (mutes || []).length,
        disabledPreferences: 0,
        activeUsers: activeUserIds?.length || 0,
      }
    });
  }

  // 4) Load push targets (Despia uses legacy OneSignal SDK - only player_id)
  const toIds = Array.from(recipients);
  console.log(`[notifyLeagueMessage] Loading subscriptions for ${toIds.length} recipient user IDs`);
  
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('user_id, player_id, is_active, subscribed, last_checked_at')
    .in('user_id', toIds)
    .eq('is_active', true);
  if (subErr) {
    console.error('[notifyLeagueMessage] Failed to load subscriptions:', subErr);
    return json(500, { 
      error: 'Failed to load subscriptions', 
      details: subErr.message,
      debug: { recipientUserIds: toIds }
    });
  }

  console.log(`[notifyLeagueMessage] Found ${subs?.length || 0} active subscriptions in database`);
  
  const candidatePlayerIds = Array.from(
    new Set((subs || []).map((s: any) => s.player_id).filter(Boolean))
  );

  if (candidatePlayerIds.length === 0) {
    console.log(`[notifyLeagueMessage] No registered devices for ${recipients.size} recipients (league: ${leagueId})`);
    return json(200, { 
      ok: true, 
      message: 'No devices', 
      eligibleRecipients: recipients.size,
      recipientUserIds: Array.from(recipients),
      debug: {
        totalMembers,
        recipientsAfterFiltering: recipients.size,
        subscriptionsInDb: subs?.length || 0,
        subscriptionsWithPlayerId: candidatePlayerIds.length,
        recipientUserIds: Array.from(recipients),
        subscriptionDetails: (subs || []).map((s: any) => ({
          user_id: s.user_id?.slice(0, 8) + '...',
          has_player_id: !!s.player_id,
          is_active: s.is_active,
          subscribed: s.subscribed,
        })),
      }
    });
  }

  // 5) Use all candidate player IDs - let OneSignal handle subscription validation
  // Pre-checking subscriptions can be too strict and filter out valid devices
  // OneSignal will reject unsubscribed devices, but we'll still send to valid ones
  const validPlayerIds = candidatePlayerIds;
  
  console.log(`[notifyLeagueMessage] Sending to ${validPlayerIds.length} player IDs (OneSignal will filter unsubscribed)`);
  console.log(`[notifyLeagueMessage] Player IDs: ${validPlayerIds.map(id => id.slice(0, 12) + '...').join(', ')}`);

  // 6) Build message
  const title = senderName || 'New message';
  const message = String(content).slice(0, 180);

  // Build deep link URL - use relative path for web app routing
  // Include ?tab=chat to open directly to chat tab
  // Also include leagueCode as query param as fallback for iOS native
  const leagueUrl = `/league/${leagueCode}?tab=chat&leagueCode=${leagueCode}`;
  
  // For iOS native, also try using web_url field (some OneSignal configs prefer this)
  // The web_url is used when the app is opened from a notification

  // 7) Send via OneSignal (only to subscribed Player IDs)
  // For iOS native, we need both 'url' and 'web_url' fields
  // Also put leagueCode prominently in data for easy access
  const payloadOS: Record<string, any> = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: validPlayerIds,
    headings: { en: title },
    contents: { en: message },
    url: leagueUrl, // For web/Android
    web_url: leagueUrl, // For iOS native - some configs prefer this
    data: { 
      type: 'league_message', 
      leagueId, 
      leagueCode, // Make this easy to find
      senderId, 
      url: leagueUrl,
      // Also add as top-level for easier access
      leagueCode: leagueCode,
      navigateTo: leagueUrl
    },
  };

  try {
    const resp = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payloadOS),
    });

    const body = await resp.json().catch(() => ({}));
    
    // Log full response for debugging
    console.log(`[notifyLeagueMessage] OneSignal response status: ${resp.status}`);
    console.log(`[notifyLeagueMessage] OneSignal response body:`, JSON.stringify(body, null, 2));
    
    if (!resp.ok) {
      console.error('[notifyLeagueMessage] OneSignal API error:', resp.status, JSON.stringify(body, null, 2));
      return json(resp.status, { 
        error: 'OneSignal error', 
        details: body, 
        statusCode: resp.status,
        debug: {
          playerIdsSent: validPlayerIds.length,
          playerIds: validPlayerIds.map(id => id.slice(0, 12) + '...'),
          payload: {
            app_id: ONESIGNAL_APP_ID.slice(0, 8) + '...',
            include_player_ids_count: validPlayerIds.length,
            has_url: !!leagueUrl,
            has_web_url: !!leagueUrl,
            has_data: true,
          }
        }
      });
    }

    // Even if resp.ok is true, check for errors in the response body
    if (body.errors && Array.isArray(body.errors) && body.errors.length > 0) {
      console.error('[notifyLeagueMessage] OneSignal returned errors:', JSON.stringify(body.errors, null, 2));
      console.error('[notifyLeagueMessage] Full OneSignal response:', JSON.stringify(body, null, 2));
      return json(200, {
        ok: false,
        error: 'OneSignal rejected the request',
        oneSignalErrors: body.errors,
        fullResponse: body,
        debug: {
          playerIdsSent: validPlayerIds.length,
          playerIds: validPlayerIds.map(id => id.slice(0, 12) + '...'),
          recipients: recipients.size,
          eligibleRecipients: recipients.size,
          oneSignalResponse: {
            id: body.id,
            recipients: body.recipients,
            errors: body.errors,
          },
          payload: {
            app_id: ONESIGNAL_APP_ID.slice(0, 8) + '...',
            include_player_ids_count: validPlayerIds.length,
            url: leagueUrl,
            web_url: leagueUrl,
          }
        }
      });
    }

    const deliveredCount = body.recipients || 0;
    console.log(`[notifyLeagueMessage] Successfully sent to ${validPlayerIds.length} player IDs, OneSignal delivered to ${deliveredCount} recipients`);
    
    return json(200, {
      ok: true,
      result: body,
      sent: deliveredCount,
      recipients: recipients.size,
      debug: {
        eligibleRecipients: recipients.size,
        playerIdsSent: validPlayerIds.length,
        oneSignalRecipients: deliveredCount,
        oneSignalNotificationId: body.id,
        playerIds: validPlayerIds.map(id => id.slice(0, 12) + '...'),
        payload: {
          app_id: ONESIGNAL_APP_ID.slice(0, 8) + '...',
          include_player_ids_count: validPlayerIds.length,
          url: leagueUrl,
          web_url: leagueUrl,
        }
      }
    });
  } catch (e: any) {
    return json(500, { error: 'Failed to send notification', details: e?.message || String(e) });
  }
};
