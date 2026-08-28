/**
 * Supabase webhook handler for admin growth alerts:
 * - New user got a display name (users INSERT / first-time name UPDATE)
 * - New mini league created (leagues INSERT)
 *
 * Sends push to ADMIN_GROWTH_NOTIFY_USER_IDS (defaults to Jof and Carl).
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  formatNewLeagueNotification,
  formatNewUserNotification,
  getAdminGrowthNotifyUserIds,
  isFirstTimeUserName,
  parseSupabaseWebhookPayload,
} from './lib/adminGrowthNotifications';
import { dispatchNotification, formatEventId } from './lib/notifications';
import { buildLeaguePublicUrl } from './lib/notifications/publicLinks';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const SKIPPED_LEAGUE_NAMES = new Set(['api test']);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[notifyAdminGrowth] Missing Supabase env vars');
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  const payload = parseSupabaseWebhookPayload(event.body || '{}');
  const table = payload.table;
  const record = payload.record;

  if (!table || !record) {
    return json(400, { error: 'Invalid webhook payload' });
  }

  const adminUserIds = getAdminGrowthNotifyUserIds();
  if (adminUserIds.length === 0) {
    return json(200, { ok: true, skipped: true, reason: 'No admin recipients configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (table === 'users') {
      if (!isFirstTimeUserName(payload)) {
        return json(200, { ok: true, skipped: true, reason: 'Not a first-time display name' });
      }

      const userId = String(record.id || '');
      const name = String(record.name || '').trim();
      if (!userId || !name) {
        return json(200, { ok: true, skipped: true, reason: 'Missing user id or name' });
      }

      const copy = formatNewUserNotification(name);
      const eventId =
        formatEventId('admin-new-user', { user_id: userId }) || `admin_new_user:${userId}`;

      const result = await dispatchNotification({
        notification_key: 'admin-new-user',
        event_id: eventId,
        user_ids: adminUserIds,
        title: copy.title,
        body: copy.body,
        url: 'https://playtotl.com/admin/gw-stats',
        data: { type: 'admin-new-user', user_id: userId, user_name: name },
        skip_preference_check: true,
        skip_cooldown_check: true,
      });

      return json(200, { ok: true, kind: 'new-user', userId, name, result });
    }

    if (table === 'leagues') {
      if (payload.type !== 'INSERT') {
        return json(200, { ok: true, skipped: true, reason: 'Not a league insert' });
      }

      const leagueId = String(record.id || '');
      const leagueName = String(record.name || '').trim();
      const leagueCode = String(record.code || '').trim();
      if (!leagueId || !leagueName) {
        return json(200, { ok: true, skipped: true, reason: 'Missing league id or name' });
      }

      if (SKIPPED_LEAGUE_NAMES.has(leagueName.toLowerCase())) {
        return json(200, { ok: true, skipped: true, reason: 'Skipped test league' });
      }

      let creatorName: string | null = null;
      const { data: members, error: membersError } = await supabase
        .from('league_members')
        .select('user_id, users(name)')
        .eq('league_id', leagueId)
        .limit(1);

      if (membersError) {
        console.warn('[notifyAdminGrowth] Could not load league creator:', membersError.message);
      } else if (members && members.length > 0) {
        const member = members[0] as { users?: { name?: string } | { name?: string }[] | null };
        const usersField = member.users;
        if (Array.isArray(usersField)) {
          creatorName = usersField[0]?.name?.trim() || null;
        } else {
          creatorName = usersField?.name?.trim() || null;
        }
      }

      const copy = formatNewLeagueNotification(leagueName, creatorName);
      const eventId =
        formatEventId('admin-new-league', { league_id: leagueId }) ||
        `admin_new_league:${leagueId}`;
      const leagueUrl = leagueCode ? buildLeaguePublicUrl(leagueCode) : 'https://playtotl.com/tables';

      const result = await dispatchNotification({
        notification_key: 'admin-new-league',
        event_id: eventId,
        user_ids: adminUserIds,
        title: copy.title,
        body: copy.body,
        url: leagueUrl,
        data: {
          type: 'admin-new-league',
          league_id: leagueId,
          league_name: leagueName,
          league_code: leagueCode || undefined,
        },
        league_id: leagueId,
        skip_preference_check: true,
        skip_cooldown_check: true,
        grouping_params: { league_id: leagueId },
      });

      return json(200, { ok: true, kind: 'new-league', leagueId, leagueName, result });
    }

    return json(200, { ok: true, skipped: true, reason: `Unhandled table: ${table}` });
  } catch (error) {
    console.error('[notifyAdminGrowth] Error:', error);
    return json(500, {
      error: 'Failed to send admin growth notification',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
