import type { Handler } from '@netlify/functions';

import { getCatalogEntry, isNotificationEnabled } from './lib/notifications/catalog';
import { claimIdempotencyLock, updateSendLog } from './lib/notifications/idempotency';
import { buildPayload, sendNotification } from './lib/notifications/onesignal';
import { canonicalizePublicAppUrl } from './lib/notifications/publicLinks';
import { getSupabase } from './lib/notifications/targeting';
import {
  PLAYERS_DAILY_BODY,
  PLAYERS_DAILY_KEY,
  PLAYERS_DAILY_PATH,
  PLAYERS_DAILY_TITLE,
  chunk,
  isPlayersReminderTime,
  playersDailyEventId,
  playersDayKey,
  wantsPlayersDaily,
} from './lib/notifications/playersDaily';

/**
 * The Players daily reminder, sent once a day at 9:30am London time to everyone who
 * hasn't switched it off. Scheduled in netlify.toml for 08:30 and 09:30 UTC; only the run
 * that lands at 9:30 in London sends.
 *
 * One push for everyone, so it sends in bulk: a single daily lock in notification_send_log
 * (user_id null), then OneSignal batches of subscription ids. The per-user dispatcher
 * checks every device with OneSignal first, which would run past the 30s scheduled limit.
 */

const PAGE = 1000;
/** OneSignal accepts up to 20,000 subscription ids per request; stay well under it. */
const BATCH = 2000;

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function readAll<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export const handler: Handler = async () => {
  const now = new Date();
  if (!isPlayersReminderTime(now)) {
    return json(200, { ok: true, skipped: 'not 9:30 in London' });
  }

  const entry = getCatalogEntry(PLAYERS_DAILY_KEY);
  if (!entry || !isNotificationEnabled(PLAYERS_DAILY_KEY)) {
    return json(200, { ok: true, skipped: 'players-daily is disabled' });
  }

  const day = playersDayKey(now);
  const eventId = playersDailyEventId(day);
  const lock = await claimIdempotencyLock(PLAYERS_DAILY_KEY, eventId, null);
  if (!lock.claimed) {
    return json(200, { ok: true, skipped: 'already sent today', event_id: eventId });
  }
  const logId = lock.log_id!;

  try {
    const supabase = getSupabase();
    const [devices, prefRows] = await Promise.all([
      readAll<{ user_id: string; player_id: string | null; subscribed: boolean | null; invalid: boolean | null }>(
        (from, to) =>
          supabase
            .from('push_subscriptions')
            .select('user_id, player_id, subscribed, invalid')
            .eq('is_active', true)
            .order('id', { ascending: true })
            .range(from, to),
      ),
      readAll<{ user_id: string; preferences: Record<string, unknown> | null }>((from, to) =>
        supabase
          .from('user_notification_preferences')
          .select('user_id, preferences')
          .order('user_id', { ascending: true })
          .range(from, to),
      ),
    ]);

    const prefsByUser = new Map(prefRows.map((row) => [row.user_id, row.preferences]));
    const optedOut = new Set<string>();
    const playerIds = new Set<string>();
    const userIds = new Set<string>();
    devices.forEach((device) => {
      if (!device.player_id || device.subscribed === false || device.invalid === true) return;
      if (!wantsPlayersDaily(prefsByUser.get(device.user_id))) {
        optedOut.add(device.user_id);
        return;
      }
      playerIds.add(device.player_id);
      userIds.add(device.user_id);
    });

    const batches = chunk([...playerIds], BATCH);
    const sent: Array<{ notification_id?: string; recipients?: number }> = [];
    const errors: unknown[] = [];
    for (const ids of batches) {
      const payload = buildPayload(entry, {
        title: PLAYERS_DAILY_TITLE,
        body: PLAYERS_DAILY_BODY,
        playerIds: ids,
        data: { type: PLAYERS_DAILY_KEY, screen: 'players', day },
        url: canonicalizePublicAppUrl(PLAYERS_DAILY_PATH),
        groupingParams: { day },
      });
      const result = await sendNotification(payload);
      if (result.success) sent.push({ notification_id: result.notification_id, recipients: result.recipients });
      else errors.push(result.error ?? 'send failed');
    }

    const recipients = sent.reduce((sum, batch) => sum + (batch.recipients ?? 0), 0);
    await updateSendLog(logId, {
      result: sent.length > 0 ? 'accepted' : batches.length === 0 ? 'suppressed_unsubscribed' : 'failed',
      onesignal_notification_id: sent[0]?.notification_id ?? null,
      target_type: 'player_ids',
      targeting_summary: {
        users: userIds.size,
        devices: playerIds.size,
        opted_out_users: optedOut.size,
        batches: batches.length,
        recipients,
        notification_ids: sent.map((batch) => batch.notification_id),
      },
      payload_summary: { title: PLAYERS_DAILY_TITLE, body: PLAYERS_DAILY_BODY, url: PLAYERS_DAILY_PATH, day },
      error: errors.length ? { errors } : null,
    });

    console.log(
      `[sendPlayersDailyReminder] ${day}: ${userIds.size} users, ${playerIds.size} devices, ${recipients} recipients, ${optedOut.size} opted out, ${errors.length} failed batches`,
    );
    return json(errors.length && !sent.length ? 500 : 200, {
      ok: errors.length === 0,
      event_id: eventId,
      users: userIds.size,
      devices: playerIds.size,
      recipients,
      failed_batches: errors.length,
    });
  } catch (error: any) {
    console.error('[sendPlayersDailyReminder] failed:', error);
    await updateSendLog(logId, { result: 'failed', error: { message: error?.message ?? String(error) } }).catch(() => {});
    return json(500, { error: error?.message ?? 'Unknown error' });
  }
};
