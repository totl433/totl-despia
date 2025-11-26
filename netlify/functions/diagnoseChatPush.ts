import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// GET ?leagueId=xxx&senderId=yyy
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  const params = new URL(event.rawUrl).searchParams;
  const leagueId = params.get('leagueId');
  const senderId = params.get('senderId');

  if (!leagueId || !senderId) {
    return json(400, { error: 'Missing leagueId or senderId query params' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1) Get all members
  const { data: members, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);
  if (memErr) return json(500, { error: 'Failed to load members', details: memErr.message });

  const allMemberIds = (members || []).map((r: any) => r.user_id).filter(Boolean);
  const recipientIds = allMemberIds.filter((id: string) => id !== senderId);

  // 2) Check muted
  const { data: mutes, error: muteErr } = await admin
    .from('league_notification_settings')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('muted', true);
  if (muteErr) return json(500, { error: 'Failed to load mutes', details: muteErr.message });

  const mutedIds = (mutes || []).map((r: any) => r.user_id);
  const eligibleIds = recipientIds.filter((id: string) => !mutedIds.includes(id));

  // 3) Check registered devices
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('user_id, player_id, is_active')
    .in('user_id', eligibleIds)
    .eq('is_active', true);
  if (subErr) return json(500, { error: 'Failed to load subscriptions', details: subErr.message });

  const playerIds = (subs || []).map((s: any) => s.player_id).filter(Boolean);

  return json(200, {
    leagueId,
    senderId,
    allMembers: allMemberIds.length,
    eligibleRecipients: eligibleIds.length,
    registeredDevices: playerIds.length,
    recipientUserIds: eligibleIds,
    playerIds,
    mutedUserIds: mutedIds,
    registeredUsers: (subs || []).map((s: any) => ({ userId: s.user_id, playerId: s.player_id })),
    envCheck: {
      hasAppId: !!ONESIGNAL_APP_ID,
      hasRestKey: !!ONESIGNAL_REST_API_KEY,
      appIdPreview: ONESIGNAL_APP_ID.slice(0, 8) + '…',
    },
  });
};

