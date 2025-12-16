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

  // 5) Build deep link URL
  const leagueUrl = `/league/${leagueCode}`;

  // 6) Dispatch via unified system
  const result = await dispatchNotification({
    notification_key: 'chat-message',
    event_id: eventId,
    user_ids: Array.from(recipientIds),
    title: senderName || 'New message',
    body: String(content).slice(0, 180),
    data: {
      type: 'league_message',
      leagueId,
      leagueCode,
      senderId,
      url: leagueUrl,
    },
    url: leagueUrl,
    grouping_params: {
      league_id: leagueId,
    },
    league_id: leagueId, // For mute checking
  });

  console.log('[notifyLeagueMessageV2] Dispatch result:', {
    accepted: result.results.accepted,
    failed: result.results.failed,
    suppressed_duplicate: result.results.suppressed_duplicate,
    suppressed_preference: result.results.suppressed_preference,
    suppressed_muted: result.results.suppressed_muted,
    suppressed_cooldown: result.results.suppressed_cooldown,
  });

  return json(200, {
    ok: true,
    sent: result.results.accepted,
    recipients: recipientIds.size,
    results: result.results,
    event_id: eventId,
  });
};

