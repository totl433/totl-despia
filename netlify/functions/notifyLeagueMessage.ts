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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
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
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { leagueId, senderId, senderName, content, activeUserIds } = payload || {};
  if (!leagueId || !senderId || !content) {
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

  // 1) Resolve members (exclude sender)
  const { data: members, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);
  if (memErr) return json(500, { error: 'Failed to load members', details: memErr.message });

  const recipients = new Set<string>((members || []).map((r: any) => r.user_id).filter(Boolean));
  recipients.delete(senderId);

  // 2) Remove muted
  const { data: mutes, error: muteErr } = await admin
    .from('league_notification_settings')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('muted', true);
  if (muteErr) return json(500, { error: 'Failed to load mutes', details: muteErr.message });
  for (const row of (mutes || [])) recipients.delete(row.user_id);

  // 3) Remove currently active (optional)
  if (Array.isArray(activeUserIds)) for (const uid of activeUserIds) recipients.delete(uid);

  if (recipients.size === 0) return json(200, { ok: true, message: 'No eligible recipients' });

  // 4) Load push targets (Despia uses legacy OneSignal SDK - only player_id)
  const toIds = Array.from(recipients);
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('user_id, player_id, is_active')
    .in('user_id', toIds)
    .eq('is_active', true);
  if (subErr) {
    console.error('[notifyLeagueMessage] Failed to load subscriptions:', subErr);
    return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
  }

  const playerIds = Array.from(
    new Set((subs || []).map((s: any) => s.player_id).filter(Boolean))
  );

  if (playerIds.length === 0) {
    console.log(`[notifyLeagueMessage] No registered devices for ${recipients.size} recipients (league: ${leagueId})`);
    return json(200, { ok: true, message: 'No devices', eligibleRecipients: recipients.size });
  }

  console.log(`[notifyLeagueMessage] Sending to ${playerIds.length} devices for ${recipients.size} recipients`);

  // 5) Build message
  const title = senderName || 'New message';
  const message = String(content).slice(0, 180);

  // 6) Send via OneSignal (Despia uses legacy SDK - only player_ids supported)
  const payloadOS: Record<string, any> = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: playerIds,
    headings: { en: title },
    contents: { en: message },
    data: { type: 'league_message', leagueId, senderId },
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
      console.error('[notifyLeagueMessage] OneSignal API error:', resp.status, body);
      return json(resp.status, { error: 'OneSignal error', details: body });
    }

    console.log(`[notifyLeagueMessage] Successfully sent to ${playerIds.length} devices`);
    return json(200, {
      ok: true,
      result: body,
      sent: playerIds.length,
      recipients: recipients.size,
    });
  } catch (e: any) {
    return json(500, { error: 'Failed to send notification', details: e?.message || String(e) });
  }
};
