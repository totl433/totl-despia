/**
 * League Chat Message Notification (V2 - using unified dispatcher)
 * 
 * Migrated from notifyLeagueMessage.ts to use the new notification system.
 * 
 * Changes:
 * - Uses dispatchNotification() instead of direct OneSignal API calls
 * - Deterministic event_id based on league_id + message content hash
 * - Idempotency via notification_send_log
 * - Cooldown enforcement via catalog config
 * - collapse_id/thread_id/android_group set automatically
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification, formatEventId } from './lib/notifications';

/**
 * Calculate total unread message count across all leagues for a user
 * and determine the appropriate deep link URL
 */
async function calculateUnreadCountAndUrl(
  userId: string,
  currentLeagueId: string,
  currentLeagueCode: string,
  admin: ReturnType<typeof createClient>
): Promise<{ badgeCount: number; url: string }> {
  try {
    // Get all leagues the user is in
    const { data: userLeagues } = await admin
      .from('league_members')
      .select('league_id')
      .eq('user_id', userId);
    
    if (!userLeagues || userLeagues.length === 0) {
      return { badgeCount: 1, url: `/league/${currentLeagueCode}` };
    }
    
    const leagueIds = userLeagues.map((l: any) => l.league_id);
    
    // Get last read times for all leagues
    const { data: readsData } = await admin
      .from('league_message_reads')
      .select('league_id, last_read_at')
      .eq('user_id', userId)
      .in('league_id', leagueIds);
    
    const lastRead = new Map<string, string>();
    (readsData || []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));
    
    // Find earliest last_read_at
    const defaultTime = '1970-01-01T00:00:00Z';
    let earliestTime = defaultTime;
    leagueIds.forEach(id => {
      const time = lastRead.get(id) ?? defaultTime;
      if (time < earliestTime || earliestTime === defaultTime) {
        earliestTime = time;
      }
    });
    
    // Fetch all unread messages (exclude Volley messages and own messages)
    const VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';
    const { data: messagesData } = await admin
      .from('league_messages')
      .select('league_id, created_at, user_id')
      .in('league_id', leagueIds)
      .gte('created_at', earliestTime)
      .neq('user_id', userId) // Exclude own messages
      .neq('user_id', VOLLEY_USER_ID) // Exclude Volley messages from badge count
      .limit(10000);
    
    // Safety check: filter out any Volley messages that slipped through
    const filteredMessages = (messagesData || []).filter((msg: any) => msg.user_id !== VOLLEY_USER_ID);
    
    // Count unread per league
    const unreadByLeague: Record<string, number> = {};
    leagueIds.forEach(id => { unreadByLeague[id] = 0; });
    
    filteredMessages.forEach((msg: any) => {
      const leagueLastRead = lastRead.get(msg.league_id) ?? defaultTime;
      if (msg.created_at >= leagueLastRead) {
        unreadByLeague[msg.league_id] = (unreadByLeague[msg.league_id] || 0) + 1;
      }
    });
    
    // Calculate total badge count
    const badgeCount = Object.values(unreadByLeague).reduce((sum, count) => sum + count, 0);
    
    // Determine URL: if only current league has unread, link to it. Otherwise link to leagues list.
    const leaguesWithUnread = Object.entries(unreadByLeague)
      .filter(([_, count]) => count > 0)
      .map(([id]) => id);
    
    // If only current league has unread, link directly to chat tab
    // Otherwise link to leagues list
    const url = leaguesWithUnread.length === 1 && leaguesWithUnread[0] === currentLeagueId
      ? `/league/${currentLeagueCode}?tab=chat`
      : '/leagues';
    
    return { badgeCount, url };
  } catch (error) {
    console.error('[notifyLeagueMessageV2] Error calculating unread count:', error);
    // Fallback: just use current league with chat tab
    return { badgeCount: 1, url: `/league/${currentLeagueCode}?tab=chat` };
  }
}

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Simple hash function for creating deterministic message IDs
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export const handler: Handler = async (event) => {
  console.log('[notifyLeagueMessageV2] Function invoked');
  
  if (event.httpMethod !== 'POST') {
    console.log('[notifyLeagueMessageV2] Method not allowed:', event.httpMethod);
    return json(405, { error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[notifyLeagueMessageV2] Missing Supabase env vars');
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  // Parse payload
  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
    console.log('[notifyLeagueMessageV2] Payload parsed:', { 
      leagueId: payload?.leagueId, 
      senderId: payload?.senderId, 
      hasContent: !!payload?.content 
    });
  } catch (e) {
    console.error('[notifyLeagueMessageV2] Failed to parse JSON:', e);
    return json(400, { error: 'Invalid JSON body' });
  }

  const { leagueId, senderId, senderName, content, activeUserIds, messageId } = payload || {};
  if (!leagueId || !senderId || !content) {
    console.log('[notifyLeagueMessageV2] Missing required fields');
    return json(400, { error: 'Missing leagueId, senderId, or content' });
  }

  // Skip notifications for Volley messages (bot messages shouldn't trigger notifications or badges)
  const VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';
  if (senderId === VOLLEY_USER_ID) {
    console.log('[notifyLeagueMessageV2] Skipping notification for Volley message');
    return json(200, { ok: true, message: 'Volley messages do not trigger notifications', skipped: true });
  }

  // Optional auth check with JWT
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : undefined;
  
  if (token) {
    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { 
      global: { headers: { Authorization: `Bearer ${token}` } } 
    });
    const { data, error } = await supaUser.auth.getUser();
    if (error || data.user?.id !== senderId) {
      return json(401, { error: 'Unauthorized' });
    }
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1) Get league info
  const { data: leagueData, error: leagueErr } = await admin
    .from('leagues')
    .select('code, name')
    .eq('id', leagueId)
    .single();
  
  if (leagueErr || !leagueData?.code) {
    console.error('[notifyLeagueMessageV2] Failed to load league:', leagueErr);
    return json(500, { error: 'Failed to load league' });
  }
  
  const leagueCode = leagueData.code;

  // 2) Get league members (exclude sender)
  const { data: members, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);
  
  if (memErr) {
    console.error('[notifyLeagueMessageV2] Failed to load members:', memErr);
    return json(500, { error: 'Failed to load members' });
  }

  const recipientIds = new Set<string>(
    (members || []).map((r: any) => r.user_id).filter(Boolean)
  );
  recipientIds.delete(senderId);

  // 3) Remove currently active users (optional)
  if (Array.isArray(activeUserIds)) {
    for (const uid of activeUserIds) {
      recipientIds.delete(uid);
    }
  }

  if (recipientIds.size === 0) {
    console.log('[notifyLeagueMessageV2] No eligible recipients');
    return json(200, { ok: true, message: 'No eligible recipients' });
  }

  // 4) Create deterministic event_id
  // Format: chat:{league_id}:{message_hash}
  // If messageId is provided, use it; otherwise hash the content + timestamp
  const msgHash = messageId || hashString(`${senderId}:${content}:${Date.now()}`);
  const eventId = `chat:${leagueId}:${msgHash}`;

  // 5) Calculate unread counts and determine deep link URL for each recipient
  // Group recipients by their badge count and URL to minimize dispatch calls
  const recipientGroups = new Map<string, string[]>(); // key: "{badgeCount}|{url}", value: user_ids
  
  for (const userId of recipientIds) {
    const { badgeCount, url } = await calculateUnreadCountAndUrl(userId, leagueId, leagueCode, admin);
    const groupKey = `${badgeCount}|${url}`;
    if (!recipientGroups.has(groupKey)) {
      recipientGroups.set(groupKey, []);
    }
    recipientGroups.get(groupKey)!.push(userId);
  }

  // 6) Dispatch notifications for each group
  let totalAccepted = 0;
  const results: any[] = [];
  
  for (const [groupKey, userIds] of recipientGroups) {
    const [badgeCountStr, url] = groupKey.split('|');
    const badgeCount = parseInt(badgeCountStr, 10) || 1;
    
    const result = await dispatchNotification({
      notification_key: 'chat-message',
      event_id: eventId,
      user_ids: userIds,
      title: senderName || 'New message',
      body: String(content).slice(0, 180),
      data: {
        type: 'league_message',
        leagueId,
        leagueCode,
        senderId,
        url, // Include URL in data for badge clicks
      },
      url, // Also set top-level URL for notification clicks
      grouping_params: {
        league_id: leagueId,
      },
      league_id: leagueId, // For mute checking
      badge_count: badgeCount,
    });
    
    totalAccepted += result.results.accepted;
    results.push(result);
  }

  const combinedResults = {
    accepted: totalAccepted,
    failed: results.reduce((sum, r) => sum + r.results.failed, 0),
    suppressed_duplicate: results.reduce((sum, r) => sum + r.results.suppressed_duplicate, 0),
    suppressed_preference: results.reduce((sum, r) => sum + r.results.suppressed_preference, 0),
    suppressed_muted: results.reduce((sum, r) => sum + r.results.suppressed_muted, 0),
    suppressed_cooldown: results.reduce((sum, r) => sum + r.results.suppressed_cooldown, 0),
  };

  console.log('[notifyLeagueMessageV2] Dispatch result:', combinedResults);

  return json(200, {
    ok: true,
    sent: totalAccepted,
    recipients: recipientIds.size,
    results: combinedResults,
    event_id: eventId,
    groups: recipientGroups.size,
  });
};

