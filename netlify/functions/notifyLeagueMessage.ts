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
    return json(200, { ok: true, message: 'No eligible recipients' });
  }

  // 4) Load push targets (Despia uses legacy OneSignal SDK - only player_id)
  const toIds = Array.from(recipients);
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('user_id, player_id, is_active, subscribed')
    .in('user_id', toIds)
    .eq('is_active', true);
  if (subErr) {
    console.error('[notifyLeagueMessage] Failed to load subscriptions:', subErr);
    return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
  }

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
      debug: `Found ${recipients.size} eligible recipients but none have registered devices. Recipients: ${Array.from(recipients).join(', ')}`
    });
  }

  console.log(`[notifyLeagueMessage] Checking subscription status for ${candidatePlayerIds.length} candidate Player IDs`);

  // 5) Verify each Player ID is actually subscribed in OneSignal and update DB
  const checks = await Promise.allSettled(
    candidatePlayerIds.map(async (playerId) => {
      const result = await isSubscribed(playerId, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);
      
      // Update DB with subscription health
      if (result.player) {
        await admin
          .from('push_subscriptions')
          .update({
            subscribed: result.subscribed,
            last_checked_at: new Date().toISOString(),
            last_active_at: result.player.last_active ? new Date(result.player.last_active * 1000).toISOString() : null,
            invalid: !!result.player.invalid_identifier,
            os_payload: result.player,
          })
          .eq('player_id', playerId)
          .then(() => {}, (err) => console.error(`[notifyLeagueMessage] Failed to update subscription health for ${playerId}:`, err));
      }
      
      return { playerId, subscribed: result.subscribed };
    })
  );

  const validPlayerIds = candidatePlayerIds.filter((playerId, i) => {
    const check = checks[i];
    if (check.status === 'fulfilled') {
      return (check as PromiseFulfilledResult<{ playerId: string; subscribed: boolean }>).value.subscribed;
    }
    return false;
  });

  const filteredCount = candidatePlayerIds.length - validPlayerIds.length;
  if (filteredCount > 0) {
    console.log(`[notifyLeagueMessage] Filtered out ${filteredCount} unsubscribed/stale Player IDs`);
  }

  if (validPlayerIds.length === 0) {
    console.log(`[notifyLeagueMessage] No subscribed devices after filtering (checked ${candidatePlayerIds.length} Player IDs)`);
    return json(200, {
      ok: true,
      message: 'No subscribed devices',
      eligibleRecipients: recipients.size,
      candidatePlayerIds: candidatePlayerIds.length,
      validPlayerIds: 0,
      filtered: filteredCount,
      debug: `Checked ${candidatePlayerIds.length} Player IDs, none are subscribed in OneSignal`
    });
  }

  console.log(`[notifyLeagueMessage] Sending to ${validPlayerIds.length} subscribed devices (filtered ${filteredCount} unsubscribed)`);

  // 6) Build message
  const title = senderName || 'New message';
  const message = String(content).slice(0, 180);

  // Build deep link URL - use relative path for web app routing
  // Include ?tab=chat to open directly to chat tab
  const leagueUrl = `/league/${leagueCode}?tab=chat`;

  // 7) Send via OneSignal (only to subscribed Player IDs)
  const payloadOS: Record<string, any> = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: validPlayerIds,
    headings: { en: title },
    contents: { en: message },
    url: leagueUrl,
    data: { type: 'league_message', leagueId, leagueCode, senderId, url: leagueUrl },
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
    if (!resp.ok) {
      console.error('[notifyLeagueMessage] OneSignal API error:', resp.status, JSON.stringify(body, null, 2));
      return json(resp.status, { error: 'OneSignal error', details: body, statusCode: resp.status });
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
        playerIdsSent: validPlayerIds,
        candidatePlayerIds: candidatePlayerIds.length,
        filtered: filteredCount,
        debug: `OneSignal returned errors: ${JSON.stringify(body.errors)}`
      });
    }

    console.log(`[notifyLeagueMessage] Successfully sent to ${validPlayerIds.length} devices`);
    return json(200, {
      ok: true,
      result: body,
      sent: validPlayerIds.length,
      recipients: recipients.size,
      candidatePlayerIds: candidatePlayerIds.length,
      validPlayerIds: validPlayerIds.length,
      filtered: filteredCount,
      debug: `Sent notification to ${validPlayerIds.length} subscribed devices (filtered ${filteredCount} unsubscribed)`
    });
  } catch (e: any) {
    return json(500, { error: 'Failed to send notification', details: e?.message || String(e) });
  }
};
