import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireUser } from './auth.js';
import type { Env } from './env.js';
import {
  LEAGUE_INVITES_PREF_KEY,
  LEAGUE_INVITES_SENT_PREF_KEY,
  collectLeagueInvitees,
  matchesSentInvite,
  normalizeUsername,
  pendingInvites,
  readSentInvites,
  readStoredInvites,
  setInviteStatus,
  upsertPendingInvite,
  upsertSentInvite,
  type LeagueInvite,
  type SentLeagueInvite,
} from './leagueInvites.js';
import { createSupabaseAdminClient, createSupabaseClient } from './supabase.js';

const InviteBodySchema = z.object({
  username: z.string().trim().min(3).max(18),
});

const InviteIdParamsSchema = z.object({
  inviteId: z.string().min(1),
});

const LeagueIdParamsSchema = z.object({
  leagueId: z.string().uuid(),
});

export function registerLeagueInviteRoutes(app: FastifyInstance, env: Env) {
  app.get('/v1/users/search', async (req) => {
    await requireUser(req, createSupabaseClient(env));
    const query = normalizeUsername(String((req as any).query?.q ?? ''));
    if (query.length < 3) return { users: [] as Array<{ id: string; name: string; avatarUrl: string | null }> };
    const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
    const admin = createSupabaseAdminClient(env);
    const { data, error } = await admin
      .from('users')
      .select('id, name, avatar_url')
      .ilike('name', `${escaped}%`)
      .order('name', { ascending: true })
      .limit(5);
    if (error) throw error;
    return {
      users: (data ?? [])
        .filter((row: { name?: string | null }) => normalizeUsername(String(row.name ?? '')).length > 0)
        .map((row: { id: string; name?: string | null; avatar_url?: string | null }) => ({
          id: String(row.id),
          name: String(row.name ?? ''),
          avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
        })),
    };
  });

  app.get('/v1/league-invites', async (req) => {
    await requireUser(req, createSupabaseClient(env));
    const userId = (req as any).userId as string;
    const invites = pendingInvites(await loadInvites(env, userId));
    return { invites };
  });

  app.get('/v1/leagues/:leagueId/invites', async (req) => {
    await requireUser(req, createSupabaseClient(env));
    const userId = (req as any).userId as string;
    const { leagueId } = LeagueIdParamsSchema.parse((req as any).params);
    const admin = createSupabaseAdminClient(env);

    const { data: membership } = await admin
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) {
      throw Object.assign(new Error('You can only see invites for a mini league you are in.'), { statusCode: 403 });
    }

    const { data: members } = await admin.from('league_members').select('user_id').eq('league_id', leagueId);
    const memberIds = (members ?? []).map((row: { user_id: string }) => String(row.user_id));

    const contained = await admin
      .from('user_notification_preferences')
      .select('user_id, preferences')
      .contains('preferences', { [LEAGUE_INVITES_PREF_KEY]: [{ leagueId }] });
    const inboundRows = contained.error ? [] : (contained.data ?? []);

    const { data: memberPrefs } = await admin
      .from('user_notification_preferences')
      .select('user_id, preferences')
      .in('user_id', memberIds.length ? memberIds : [userId]);
    const sent = (memberPrefs ?? []).flatMap((row: { preferences?: unknown }) =>
      readSentInvites(row.preferences).filter((invite) => invite.leagueId === leagueId)
    );

    const inbound = inboundRows.map((row: { user_id: string; preferences?: unknown }) => ({
      userId: String(row.user_id),
      invites: readStoredInvites(row.preferences),
    }));
    const missingIds = sent
      .map((row) => row.inviteeId)
      .filter((id) => !inbound.some((row) => row.userId === id));
    if (missingIds.length > 0) {
      const extra = await admin
        .from('user_notification_preferences')
        .select('user_id, preferences')
        .in('user_id', missingIds);
      for (const row of extra.data ?? []) {
        inbound.push({ userId: String(row.user_id), invites: readStoredInvites(row.preferences) });
      }
    }

    const userIds = [...new Set([...inbound.map((row) => row.userId), ...sent.map((row) => row.inviteeId)])];
    const { data: users } = userIds.length
      ? await admin.from('users').select('id, name, avatar_url').in('id', userIds)
      : { data: [] as Array<{ id: string; name?: string | null; avatar_url?: string | null }> };

    return {
      invitees: collectLeagueInvitees({
        leagueId,
        inbound,
        sent,
        members: memberIds,
        profiles: (users ?? []).map((row: { id: string; name?: string | null; avatar_url?: string | null }) => ({
          id: String(row.id),
          name: String(row.name ?? ''),
          avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
        })),
      }),
    };
  });

  app.post('/v1/leagues/:leagueId/invites', async (req) => {
    await requireUser(req, createSupabaseClient(env));
    const inviterId = (req as any).userId as string;
    const { leagueId } = LeagueIdParamsSchema.parse((req as any).params);
    const { username } = InviteBodySchema.parse((req as any).body ?? {});
    const admin = createSupabaseAdminClient(env);
    const name = normalizeUsername(username);

    const { data: membership } = await admin
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId)
      .eq('user_id', inviterId)
      .maybeSingle();
    if (!membership) {
      throw Object.assign(new Error('You can only invite people to a mini league you are in.'), { statusCode: 403 });
    }

    const { data: league } = await admin
      .from('leagues')
      .select('id, name, code, avatar')
      .eq('id', leagueId)
      .maybeSingle();
    if (!league?.id) throw Object.assign(new Error('This mini league is no longer available.'), { statusCode: 404 });

    const { data: members } = await admin.from('league_members').select('user_id').eq('league_id', leagueId);
    if ((members?.length ?? 0) >= 8) {
      throw Object.assign(new Error('This mini league is full.'), { statusCode: 409 });
    }

    const { data: matches } = await admin.from('users').select('id, name').ilike('name', name).limit(2);
    const invitee = (matches ?? []).find((row: { name?: string | null }) => normalizeUsername(String(row.name ?? '')) === name);
    if (!invitee?.id) throw Object.assign(new Error('No player has that username.'), { statusCode: 404 });
    if (String(invitee.id) === inviterId) {
      throw Object.assign(new Error('You are already in this mini league.'), { statusCode: 409 });
    }
    if ((members ?? []).some((row: { user_id: string }) => String(row.user_id) === String(invitee.id))) {
      throw Object.assign(new Error(`${name} is already in this mini league.`), { statusCode: 409 });
    }

    const { data: inviter } = await admin.from('users').select('name').eq('id', inviterId).maybeSingle();
    const invites = await loadInvites(env, String(invitee.id));
    const alreadyPending = invites.some((row) => row.leagueId === leagueId && row.status === 'pending');
    if (alreadyPending) {
      throw Object.assign(new Error(`${name} already has an invite to this mini league.`), { statusCode: 409 });
    }

    const next = upsertPendingInvite(invites, {
      leagueId,
      leagueName: String(league.name ?? 'Mini league'),
      leagueCode: String(league.code ?? ''),
      leagueAvatar: typeof league.avatar === 'string' ? league.avatar : null,
      invitedById: inviterId,
      invitedByName: typeof inviter?.name === 'string' && inviter.name.trim() ? inviter.name.trim() : 'A player',
    });
    await saveInvites(env, String(invitee.id), next);
    const sentInvite: SentLeagueInvite = {
      id: next.find((row) => row.leagueId === leagueId && row.status === 'pending')?.id ?? randomUUID(),
      leagueId,
      inviteeId: String(invitee.id),
      inviteeName: name,
      createdAt: new Date().toISOString(),
    };
    await saveSentInvites(env, inviterId, upsertSentInvite(await loadSentInvites(env, inviterId), sentInvite));
    return { ok: true };
  });

  app.post('/v1/league-invites/:inviteId/accept', async (req) => {
    await requireUser(req, createSupabaseClient(env));
    const userId = (req as any).userId as string;
    const { inviteId } = InviteIdParamsSchema.parse((req as any).params);
    const admin = createSupabaseAdminClient(env);
    const invites = await loadInvites(env, userId);
    const invite = invites.find((row) => row.id === inviteId && row.status === 'pending');
    if (!invite) throw Object.assign(new Error('This invite is no longer available.'), { statusCode: 404 });

    // The invitee's row is writable by the invitee, so check the inviter sent it and is still in the league.
    const { data: inviterMembership } = await admin
      .from('league_members')
      .select('user_id')
      .eq('league_id', invite.leagueId)
      .eq('user_id', invite.invitedById)
      .maybeSingle();
    if (!inviterMembership || !matchesSentInvite(invite, await loadSentInvites(env, invite.invitedById), userId)) {
      throw Object.assign(new Error('This invite is no longer available.'), { statusCode: 404 });
    }

    const joined = await joinLeague(admin, userId, invite);
    await saveInvites(env, userId, setInviteStatus(invites, inviteId, 'accepted'));
    return { ok: true, league: joined };
  });

  app.post('/v1/league-invites/:inviteId/dismiss', async (req) => {
    await requireUser(req, createSupabaseClient(env));
    const userId = (req as any).userId as string;
    const { inviteId } = InviteIdParamsSchema.parse((req as any).params);
    const invites = await loadInvites(env, userId);
    if (!invites.some((row) => row.id === inviteId)) {
      throw Object.assign(new Error('This invite is no longer available.'), { statusCode: 404 });
    }
    await saveInvites(env, userId, setInviteStatus(invites, inviteId, 'dismissed'));
    return { ok: true };
  });
}

async function loadInvites(env: Env, userId: string): Promise<LeagueInvite[]> {
  const admin = createSupabaseAdminClient(env);
  const { data, error } = await admin
    .from('user_notification_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return readStoredInvites(data?.preferences);
}

async function saveInvites(env: Env, userId: string, invites: LeagueInvite[]): Promise<void> {
  await savePreferenceKey(env, userId, LEAGUE_INVITES_PREF_KEY, invites);
}

async function loadSentInvites(env: Env, userId: string): Promise<SentLeagueInvite[]> {
  const admin = createSupabaseAdminClient(env);
  const { data, error } = await admin
    .from('user_notification_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return readSentInvites(data?.preferences);
}

async function saveSentInvites(env: Env, userId: string, sent: SentLeagueInvite[]): Promise<void> {
  await savePreferenceKey(env, userId, LEAGUE_INVITES_SENT_PREF_KEY, sent);
}

async function savePreferenceKey(env: Env, userId: string, key: string, value: unknown): Promise<void> {
  const admin = createSupabaseAdminClient(env);
  const { data, error } = await admin
    .from('user_notification_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const preferences = {
    ...(data?.preferences && typeof data.preferences === 'object' ? data.preferences : {}),
    [key]: value,
  };
  const { error: upsertError } = await admin.from('user_notification_preferences').upsert(
    { user_id: userId, preferences },
    { onConflict: 'user_id' }
  );
  if (upsertError) throw upsertError;
}

async function joinLeague(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  invite: LeagueInvite
): Promise<{ id: string; name: string; code: string }> {
  const { data: userMemberships, error: userMembershipsError } = await admin
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId);
  if (userMembershipsError) throw userMembershipsError;
  if ((userMemberships ?? []).some((row: { league_id: string }) => String(row.league_id) === invite.leagueId)) {
    return { id: invite.leagueId, name: invite.leagueName, code: invite.leagueCode };
  }
  if ((userMemberships?.length ?? 0) >= 20) {
    throw Object.assign(new Error("You're already in 20 mini leagues. Leave one before joining another."), {
      statusCode: 409,
    });
  }

  const { data: members, error: membersError } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', invite.leagueId);
  if (membersError) throw membersError;
  if ((members?.length ?? 0) >= 8) {
    throw Object.assign(new Error('This mini league is full.'), { statusCode: 409 });
  }

  const { error: joinError } = await admin
    .from('league_members')
    .upsert({ league_id: invite.leagueId, user_id: userId }, { onConflict: 'league_id,user_id' });
  if (joinError) throw Object.assign(new Error('Could not join this mini league.'), { statusCode: 500 });

  const { data: league } = await admin.from('leagues').select('name, code').eq('id', invite.leagueId).maybeSingle();
  return { id: invite.leagueId, name: String(league?.name ?? invite.leagueName), code: String(league?.code ?? invite.leagueCode) };
}
