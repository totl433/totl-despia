/**
 * The Players Shootout push.
 *
 * Called by the BFF after a Shootout move, with the player's own token and
 * { challengeId, event }. Checks the caller is in the challenge and that the
 * challenge's current state backs up the event, then pushes the other player.
 * Catalogued as `players-shootout`.
 */

import type { Handler } from '@netlify/functions';
import { dispatchNotification, formatEventId } from './lib/notifications';
import { getSupabase } from './lib/notifications/targeting';
import {
  buildShootoutPublicUrl,
  buildShootoutPush,
  type ShootoutPushEvent,
  type ShootoutPushRow,
} from './lib/notifications/playersShootout';

const EVENTS: ShootoutPushEvent[] = ['invite', 'accepted', 'your-turn', 'finished'];

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return json(401, { error: 'Missing token' });

  let body: { challengeId?: unknown; event?: unknown };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
  const pushEvent = EVENTS.find((e) => e === body.event);
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !pushEvent) return json(400, { error: 'Bad request' });

  try {
    const supabase = getSupabase();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json(401, { error: 'Invalid token' });
    const actorId = userData.user.id;

    const { data: row, error: rowError } = await supabase
      .from('players_shootout_challenges')
      .select('id,challenger_id,opponent_id,status,turn_user_id,winner_id,version,state')
      .eq('id', challengeId)
      .maybeSingle();
    if (rowError) throw rowError;
    if (!row) return json(404, { error: 'Not found' });

    const { data: actor } = await supabase.from('users').select('name').eq('id', actorId).maybeSingle();
    const push = buildShootoutPush(row as ShootoutPushRow, pushEvent, actorId, String(actor?.name ?? ''));
    if (!push) return json(200, { ok: true, sent: 0, reason: 'not backed by challenge state' });

    const eventId = formatEventId('players-shootout', {
      challenge_id: challengeId,
      event: pushEvent,
      version: Number((row as ShootoutPushRow).version) || 0,
    });
    if (!eventId) return json(500, { error: 'Failed to format event ID' });

    const url = buildShootoutPublicUrl(challengeId);
    const result = await dispatchNotification({
      notification_key: 'players-shootout',
      event_id: eventId,
      user_ids: [push.recipientId],
      title: push.title,
      body: push.body,
      data: { type: 'players-shootout', challengeId, event: pushEvent, url, navigateTo: url },
      url,
      grouping_params: { challenge_id: challengeId },
    });

    return json(200, { ok: true, sent: result.results.accepted || 0, result: result.results });
  } catch (error: any) {
    console.error('[notifyPlayersShootout] Error:', error);
    return json(500, { error: 'Internal server error', details: error?.message || String(error) });
  }
};
