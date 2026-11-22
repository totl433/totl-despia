import { randomInt, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { requireUser, type AuthedRequest } from './auth.js';
import type { Env } from './env.js';
import {
  SHOOTOUT_MAX_OPEN,
  ShootoutError,
  answerShootoutCard,
  cancelShootout,
  leaveShootout,
  emptyShootoutState,
  newShootoutChallenge,
  respondToShootout,
  revealShootoutCard,
  settleShootout,
  shootoutViewFor,
  type ShootoutChallenge,
  type ShootoutPerson,
  type ShootoutState,
  dealShootoutCard,
} from '@totl/domain';
import { loadShootoutCatalog } from './playersShootoutCatalog.js';
import { createSupabaseAdminClient, createSupabaseClient } from './supabase.js';

/**
 * The Players Shootout: head-to-head challenges.
 * All reads and writes go through here: the table holds the answers, so the app
 * never reads it directly. Rules live in playersShootout.ts.
 */

const TABLE = 'players_shootout_challenges';
const DEFAULT_SITE_URL = 'https://playtotl.com';

const IdParams = z.object({ id: z.string().uuid() });
const CreateBody = z.object({ opponentId: z.string().uuid() });
const RespondBody = z.object({ accept: z.boolean() });
/** `pick: null`: the clock ran out on the phone. */
const AnswerBody = z.object({ cardId: z.string().min(1).max(200), pick: z.string().min(1).max(20).nullable() });

type Row = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: ShootoutChallenge['status'];
  turn_user_id: string | null;
  turn_deadline: string | null;
  winner_id: string | null;
  state: ShootoutState | null;
  version: number;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id,challenger_id,opponent_id,status,turn_user_id,turn_deadline,winner_id,state,version,created_at,updated_at';

function fromRow(row: Row): ShootoutChallenge {
  return {
    id: row.id,
    challengerId: row.challenger_id,
    opponentId: row.opponent_id,
    status: row.status,
    turnUserId: row.turn_user_id,
    turnDeadline: row.turn_deadline,
    winnerId: row.winner_id,
    state: row.state && row.state.v === 1 ? row.state : emptyShootoutState(),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toColumns(c: ShootoutChallenge) {
  return {
    status: c.status,
    turn_user_id: c.turnUserId,
    turn_deadline: c.turnDeadline,
    winner_id: c.winnerId,
    state: c.state,
    updated_at: c.updatedAt,
  };
}

/** Saves only if nobody else has written since it was read. */
async function save(admin: SupabaseClient, c: ShootoutChallenge): Promise<void> {
  const { data, error } = await admin
    .from(TABLE)
    .update({ ...toColumns(c), version: c.version + 1 })
    .eq('id', c.id)
    .eq('version', c.version)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new ShootoutError('Something changed. Pull to refresh and try again.', 409);
  c.version += 1;
}

async function loadOne(admin: SupabaseClient, id: string, userId: string): Promise<ShootoutChallenge> {
  const { data, error } = await admin.from(TABLE).select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  const c = data ? fromRow(data as Row) : null;
  if (!c || (c.challengerId !== userId && c.opponentId !== userId)) {
    throw new ShootoutError('Challenge not found.', 404);
  }
  return c;
}

async function loadPeople(admin: SupabaseClient, ids: string[]): Promise<Map<string, ShootoutPerson>> {
  const unique = Array.from(new Set(ids));
  const people = new Map<string, ShootoutPerson>();
  if (!unique.length) return people;
  const { data, error } = await admin.from('users').select('id,name,avatar_url').in('id', unique);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null }>) {
    people.set(String(row.id), {
      id: String(row.id),
      name: String(row.name ?? '').trim() || 'A player',
      avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    });
  }
  return people;
}

type NotifyEvent = 'invite' | 'accepted' | 'your-turn' | 'finished';

/**
 * Push to the other player through the Netlify notifier, which checks the
 * challenge itself before sending. Never holds up or fails the request.
 */
function notify(env: Env, req: AuthedRequest, challengeId: string, event: NotifyEvent) {
  const url = `${(env.SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '')}/.netlify/functions/notifyPlayersShootout`;
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.accessToken}` },
    body: JSON.stringify({ challengeId, event }),
  })
    .then(async (res) => {
      if (!res.ok) req.log.warn({ status: res.status, body: await res.text().catch(() => '') }, 'shootout push failed');
    })
    .catch((error) => req.log.warn({ err: error }, 'shootout push failed'));
}

/** Which push the move that just happened deserves, if any. */
function pushAfterMove(before: { status: string; turnUserId: string | null }, c: ShootoutChallenge, actor: string): NotifyEvent | null {
  if (c.status === 'finished' && before.status !== 'finished') return 'finished';
  if (c.status === 'active' && c.turnUserId && c.turnUserId !== actor && before.turnUserId !== c.turnUserId) {
    return 'your-turn';
  }
  return null;
}

function sendError(reply: any, error: unknown) {
  if (error instanceof ShootoutError) {
    const challengeId = (error as ShootoutError & { challengeId?: string }).challengeId;
    return reply
      .code(error.statusCode)
      .send({ message: error.message, error: error.message, ...(challengeId ? { challengeId } : {}) });
  }
  throw error;
}

export function registerPlayersShootoutRoutes(app: FastifyInstance, env: Env) {
  const authed = async (req: any) => {
    await requireUser(req, createSupabaseClient(env));
    return req as AuthedRequest;
  };

  async function view(admin: SupabaseClient, c: ShootoutChallenge, userId: string) {
    const people = await loadPeople(admin, [c.challengerId, c.opponentId]);
    return shootoutViewFor(c, userId, people, Date.now());
  }

  app.get('/v1/players/shootouts', async (req) => {
    const { userId } = await authed(req);
    const admin = createSupabaseAdminClient(env);
    const { data, error } = await admin
      .from(TABLE)
      .select(COLUMNS)
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .limit(40);
    if (error) throw error;
    const now = Date.now();
    const challenges = ((data ?? []) as Row[]).map(fromRow);
    // Anything past its deadline is settled here, so lists never show a stale turn.
    await Promise.all(
      challenges.map(async (c) => {
        if (!settleShootout(c, now)) return;
        await save(admin, c).catch(() => undefined);
      })
    );
    const people = await loadPeople(
      admin,
      challenges.flatMap((c) => [c.challengerId, c.opponentId])
    );
    return { challenges: challenges.map((c) => shootoutViewFor(c, userId, people, now)) };
  });

  app.get('/v1/players/shootouts/:id', async (req, reply) => {
    const { userId } = await authed(req);
    try {
      const { id } = IdParams.parse((req as any).params);
      const admin = createSupabaseAdminClient(env);
      const c = await loadOne(admin, id, userId);
      if (settleShootout(c, Date.now())) await save(admin, c);
      return { challenge: await view(admin, c, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/v1/players/shootouts', async (req, reply) => {
    const authedReq = await authed(req);
    const { userId } = authedReq;
    try {
      const { opponentId } = CreateBody.parse((req as any).body ?? {});
      if (opponentId === userId) throw new ShootoutError("You can't challenge yourself.", 400);
      const admin = createSupabaseAdminClient(env);

      const { data: opponent } = await admin.from('users').select('id').eq('id', opponentId).maybeSingle();
      if (!opponent) throw new ShootoutError('Player not found.', 404);

      const { data: open, error: openError } = await admin
        .from(TABLE)
        .select('id,challenger_id,opponent_id')
        .in('status', ['pending', 'active'])
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`);
      if (openError) throw openError;
      const openRows = (open ?? []) as Array<{ id: string; challenger_id: string; opponent_id: string }>;
      const existing = openRows.find((r) => r.challenger_id === opponentId || r.opponent_id === opponentId);
      if (existing) {
        throw Object.assign(new ShootoutError('You already have a Shootout going with this player.', 409), {
          challengeId: existing.id,
        });
      }
      if (openRows.length >= SHOOTOUT_MAX_OPEN) {
        throw new ShootoutError(`You can have up to ${SHOOTOUT_MAX_OPEN} Shootouts going at once.`, 409);
      }

      const c = newShootoutChallenge({ id: randomUUID(), challengerId: userId, opponentId, now: Date.now() });
      const { error } = await admin.from(TABLE).insert({
        id: c.id,
        challenger_id: c.challengerId,
        opponent_id: c.opponentId,
        ...toColumns(c),
        version: 0,
        created_at: c.createdAt,
      });
      if (error) throw error;
      notify(env, authedReq, c.id, 'invite');
      return { challenge: await view(admin, c, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/v1/players/shootouts/:id/respond', async (req, reply) => {
    const authedReq = await authed(req);
    const { userId } = authedReq;
    try {
      const { id } = IdParams.parse((req as any).params);
      const { accept } = RespondBody.parse((req as any).body ?? {});
      const admin = createSupabaseAdminClient(env);
      const c = await loadOne(admin, id, userId);
      respondToShootout(c, userId, accept, Date.now(), randomInt(1, 2 ** 31));
      await save(admin, c);
      if (accept) notify(env, authedReq, c.id, 'accepted');
      return { challenge: await view(admin, c, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/v1/players/shootouts/:id/cancel', async (req, reply) => {
    const { userId } = await authed(req);
    try {
      const { id } = IdParams.parse((req as any).params);
      const admin = createSupabaseAdminClient(env);
      const c = await loadOne(admin, id, userId);
      cancelShootout(c, userId, Date.now());
      await save(admin, c);
      return { challenge: await view(admin, c, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** The X: quit. In play, the other player wins; not yet accepted, it's cancelled or declined. */
  app.post('/v1/players/shootouts/:id/leave', async (req, reply) => {
    const authedReq = await authed(req);
    const { userId } = authedReq;
    try {
      const { id } = IdParams.parse((req as any).params);
      const admin = createSupabaseAdminClient(env);
      const c = await loadOne(admin, id, userId);
      const wasActive = c.status === 'active';
      leaveShootout(c, userId, Date.now());
      await save(admin, c);
      if (wasActive && c.status === 'finished') notify(env, authedReq, c.id, 'finished');
      return { challenge: await view(admin, c, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** Shows the player their card and starts their 10 seconds. */
  app.post('/v1/players/shootouts/:id/reveal', async (req, reply) => {
    const authedReq = await authed(req);
    const { userId } = authedReq;
    try {
      const { id } = IdParams.parse((req as any).params);
      const admin = createSupabaseAdminClient(env);
      const rows = await loadShootoutCatalog(admin);
      const c = await loadOne(admin, id, userId);
      const before = { status: c.status, turnUserId: c.turnUserId };
      revealShootoutCard(c, userId, Date.now(), (input) => dealShootoutCard(rows, input));
      await save(admin, c);
      // Opening the card can settle an earlier timeout or forfeit.
      const event = pushAfterMove(before, c, userId);
      if (event) notify(env, authedReq, c.id, event);
      return { challenge: await view(admin, c, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/v1/players/shootouts/:id/answer', async (req, reply) => {
    const authedReq = await authed(req);
    const { userId } = authedReq;
    try {
      const { id } = IdParams.parse((req as any).params);
      const body = AnswerBody.parse((req as any).body ?? {});
      const admin = createSupabaseAdminClient(env);
      const c = await loadOne(admin, id, userId);
      const before = { status: c.status, turnUserId: userId };
      const outcome = answerShootoutCard(c, userId, body, Date.now());
      await save(admin, c);
      const event = pushAfterMove(before, c, userId);
      if (event) notify(env, authedReq, c.id, event);
      return { ...outcome, challenge: await view(admin, c, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}

