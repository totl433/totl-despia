import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase env vars' });
  }

  const leagueId = event.queryStringParameters?.leagueId;
  if (!leagueId) {
    return json(400, { error: 'Provide ?leagueId=UUID' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get all league members
  const { data: members, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);

  if (memErr) {
    return json(500, { error: 'Failed to load members', details: memErr.message });
  }

  const memberIds = (members || []).map((r: any) => r.user_id).filter(Boolean);

  // Get registered devices for all members
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('user_id, player_id, platform, is_active')
    .in('user_id', memberIds)
    .eq('is_active', true);

  if (subErr) {
    return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
  }

  // Count devices per user
  const devicesByUser = new Map<string, number>();
  memberIds.forEach(id => devicesByUser.set(id, 0));
  (subs || []).forEach((s: any) => {
    devicesByUser.set(s.user_id, (devicesByUser.get(s.user_id) || 0) + 1);
  });

  return json(200, {
    leagueId,
    totalMembers: memberIds.length,
    membersWithDevices: Array.from(devicesByUser.values()).filter(c => c > 0).length,
    membersWithoutDevices: Array.from(devicesByUser.values()).filter(c => c === 0).length,
    totalDevices: (subs || []).length,
    breakdown: Array.from(devicesByUser.entries()).map(([userId, count]) => ({
      userId,
      deviceCount: count,
      playerIds: (subs || []).filter((s: any) => s.user_id === userId).map((s: any) => s.player_id)
    })),
    oneSignalConfigured: !!(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY)
  });
};

