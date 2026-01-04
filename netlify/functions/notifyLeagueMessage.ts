import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  console.log('[notifyLeagueMessage] Function called');
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

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

  // Try to get league code for deep linking (optional - don't fail if it doesn't work)
  let leagueCode: string | undefined;
  let leagueUrl: string | undefined;
  try {
    const { data: leagueData } = await admin
      .from('leagues')
      .select('code')
      .eq('id', leagueId)
      .single();
    if (leagueData?.code) {
      leagueCode = leagueData.code;
      leagueUrl = `/league/${leagueCode}?tab=chat&leagueCode=${leagueCode}`;
    }
  } catch {
    // Ignore - deep linking is optional
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

  if (recipientIds.size === 0) return json(200, { ok: true, message: 'No eligible recipients' });

  // Resolve player IDs
  const toIds = Array.from(recipientIds);
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('player_id, user_id')
    .in('user_id', toIds)
    .eq('is_active', true);

  if (subErr) return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
  const playerIds = Array.from(new Set((subs ?? []).map((s: any) => s.player_id).filter(Boolean)));
  console.log(`[notifyLeagueMessage] Found ${playerIds.length} player IDs to send to`);
  if (playerIds.length === 0) return json(200, { ok: true, message: 'No devices' });

  // Build message: title = sender, body = content (trim to reasonable length)
  const title = senderName || 'New message';
  const message = String(content).slice(0, 180);

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
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': auth },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: playerIds,
          headings: { en: title },
          contents: { en: message },
          data: {
            type: 'league_message',
            leagueId,
            senderId,
            ...(leagueCode && { leagueCode }),
            ...(leagueUrl && { url: leagueUrl }),
          },
        }),
      });
      const body = await resp.json().catch(() => ({}));
      lastResp = { endpoint, auth, status: resp.status, body };
      
      if (resp.ok) {
        console.log(`[notifyLeagueMessage] Success! Sent to ${playerIds.length} devices, OneSignal recipients: ${body.recipients || 0}`);
        return json(200, { ok: true, result: body, sent: playerIds.length });
      }
      if (![401, 403].includes(resp.status)) break;
    }
  }
  
  console.error('[notifyLeagueMessage] All attempts failed:', lastResp);
  return json(200, { ok: false, error: 'OneSignal error', details: lastResp });
};
