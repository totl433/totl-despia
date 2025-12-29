/**
 * League Member Join Notification
 * 
 * Sends push notifications to league members when someone joins a mini-league.
 * Uses the unified notification dispatcher system.
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification, formatEventId } from './lib/notifications';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body: { leagueId: string; userId: string; userName: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { leagueId, userId, userName } = body;

  if (!leagueId || !userId || !userName) {
    return json(400, { error: 'Missing required fields: leagueId, userId, userName' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get league code and name for deep linking and notification text
    const { data: leagueData, error: leagueErr } = await admin
      .from('leagues')
      .select('code, name')
      .eq('id', leagueId)
      .single();

    if (leagueErr || !leagueData) {
      console.error('[notifyLeagueMemberJoin] Failed to load league:', leagueErr);
      return json(500, { error: 'Failed to load league', details: leagueErr?.message });
    }

    const leagueCode = leagueData.code;
    const leagueName = leagueData.name || 'your mini-league';

    // Get all league members (excluding the person who joined)
    const { data: members, error: memErr } = await admin
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId);

    if (memErr) {
      console.error('[notifyLeagueMemberJoin] Failed to load members:', memErr);
      return json(500, { error: 'Failed to load members', details: memErr.message });
    }

    const recipients = new Set<string>((members || []).map((r: any) => r.user_id).filter(Boolean));
    recipients.delete(userId); // Exclude the person who joined

    if (recipients.size === 0) {
      console.log('[notifyLeagueMemberJoin] No recipients (only the joiner in league)');
      return json(200, { ok: true, message: 'No recipients', sent: 0 });
    }

    // Load user notification preferences
    const { data: prefsData } = await admin
      .from('user_notification_preferences')
      .select('user_id, preferences')
      .in('user_id', Array.from(recipients));

    const prefsMap = new Map<string, Record<string, boolean>>();
    (prefsData || []).forEach((p: any) => {
      prefsMap.set(p.user_id, p.preferences || {});
    });

    // Filter out users who have disabled member-joins notifications
    for (const userId of Array.from(recipients)) {
      const prefs = prefsMap.get(userId);
      if (prefs && prefs['member-joins'] === false) {
        recipients.delete(userId);
      }
    }

    if (recipients.size === 0) {
      console.log('[notifyLeagueMemberJoin] No recipients after preference filtering');
      return json(200, { ok: true, message: 'No eligible recipients', sent: 0 });
    }

    // Format notification text: "Carl joined Jof and Carl"
    const notificationText = `${userName} joined ${leagueName}`;

    // Format event ID for deduplication
    const eventId = formatEventId('member-join', {
      league_id: leagueId,
      user_id: userId,
    });

    if (!eventId) {
      return json(500, { error: 'Failed to format event ID' });
    }

    // Send notifications using the unified dispatcher
    const result = await dispatchNotification({
      notification_key: 'member-join',
      event_id: eventId,
      user_ids: Array.from(recipients),
      title: 'New Member Joined',
      body: notificationText,
      data: {
        type: 'member-join',
        leagueId,
        leagueCode,
        userId,
        userName,
        leagueName,
      },
      url: `/league/${leagueCode}`, // Deep link to specific league page
      league_id: leagueId, // For mute checking
    });

    return json(200, {
      ok: true,
      sent: result.results.accepted || 0,
      recipients: recipients.size,
      result,
    });
  } catch (error: any) {
    console.error('[notifyLeagueMemberJoin] Error:', error);
    return json(500, {
      error: 'Internal server error',
      details: error?.message || String(error),
    });
  }
};

