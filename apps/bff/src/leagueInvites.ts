import { randomUUID } from 'node:crypto';

export const LEAGUE_INVITES_PREF_KEY = '__league_invites';
export const LEAGUE_INVITES_SENT_PREF_KEY = '__league_invites_sent';

const PROTECTED_PREF_KEYS = [LEAGUE_INVITES_PREF_KEY, LEAGUE_INVITES_SENT_PREF_KEY] as const;

export type LeagueInviteStatus = 'pending' | 'accepted' | 'dismissed';
export type LeagueInviteeStatus = 'waiting' | 'joined' | 'declined';

export type LeagueInvite = {
  id: string;
  leagueId: string;
  leagueName: string;
  leagueCode: string;
  leagueAvatar: string | null;
  invitedById: string;
  invitedByName: string;
  createdAt: string;
  status: LeagueInviteStatus;
};

export type SentLeagueInvite = {
  id: string;
  leagueId: string;
  inviteeId: string;
  inviteeName: string;
  createdAt: string;
};

export type LeagueInvitee = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: LeagueInviteeStatus;
  invitedAt: string;
};

export function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function readStoredInvites(preferences: unknown): LeagueInvite[] {
  if (!preferences || typeof preferences !== 'object') return [];
  const raw = (preferences as Record<string, unknown>)[LEAGUE_INVITES_PREF_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isInvite);
}

export function readSentInvites(preferences: unknown): SentLeagueInvite[] {
  if (!preferences || typeof preferences !== 'object') return [];
  const raw = (preferences as Record<string, unknown>)[LEAGUE_INVITES_SENT_PREF_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSentInvite);
}

export function publicPreferences(preferences: unknown): Record<string, unknown> {
  if (!preferences || typeof preferences !== 'object') return {};
  const next = { ...(preferences as Record<string, unknown>) };
  for (const key of PROTECTED_PREF_KEYS) delete next[key];
  return next;
}

export function mergeProtectedPreferences(
  existing: unknown,
  incoming: Record<string, unknown> | undefined
): Record<string, unknown> {
  const current = existing && typeof existing === 'object' ? { ...(existing as Record<string, unknown>) } : {};
  const next = { ...incoming };
  for (const key of PROTECTED_PREF_KEYS) delete next[key];
  return {
    ...current,
    ...next,
    [LEAGUE_INVITES_PREF_KEY]: current[LEAGUE_INVITES_PREF_KEY],
    [LEAGUE_INVITES_SENT_PREF_KEY]: current[LEAGUE_INVITES_SENT_PREF_KEY],
  };
}

export function pendingInvites(invites: LeagueInvite[]): LeagueInvite[] {
  return invites
    .filter((invite) => invite.status === 'pending')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function upsertPendingInvite(invites: LeagueInvite[], invite: Omit<LeagueInvite, 'status' | 'createdAt' | 'id'> & { id?: string }): LeagueInvite[] {
  const now = new Date().toISOString();
  const existing = invites.find(
    (row) => row.leagueId === invite.leagueId && (row.status === 'pending' || row.status === 'dismissed')
  );
  if (existing?.status === 'pending') return invites;
  if (existing) {
    return invites.map((row) =>
      row.id === existing.id ? { ...row, ...invite, status: 'pending', createdAt: now } : row
    );
  }
  return [
    ...invites,
    {
      ...invite,
      id: invite.id ?? randomUUID(),
      createdAt: now,
      status: 'pending',
    },
  ];
}

export function setInviteStatus(invites: LeagueInvite[], inviteId: string, status: LeagueInviteStatus): LeagueInvite[] {
  return invites.map((row) => (row.id === inviteId ? { ...row, status } : row));
}

export function upsertSentInvite(sent: SentLeagueInvite[], invite: SentLeagueInvite): SentLeagueInvite[] {
  const existing = sent.find((row) => row.leagueId === invite.leagueId && row.inviteeId === invite.inviteeId);
  if (existing) {
    return sent.map((row) => (row === existing ? { ...row, ...invite, id: existing.id } : row));
  }
  return [...sent, invite];
}

/**
 * True when the inviter's own sent list holds this invite. Players can write their own
 * preferences row directly (its RLS allows it), so an invite in the invitee's row alone
 * is not proof that anyone sent it.
 */
export function matchesSentInvite(invite: LeagueInvite, sent: SentLeagueInvite[], inviteeId: string): boolean {
  return sent.some((row) => row.id === invite.id && row.leagueId === invite.leagueId && row.inviteeId === inviteeId);
}

export function pickInviteForLeague(invites: LeagueInvite[], leagueId: string): LeagueInvite | undefined {
  const forLeague = invites.filter((row) => row.leagueId === leagueId);
  return (
    forLeague.find((row) => row.status === 'pending') ??
    forLeague.find((row) => row.status === 'accepted') ??
    forLeague.find((row) => row.status === 'dismissed')
  );
}

export function inviteeStatusFor(invite: LeagueInvite | undefined, isMember: boolean): LeagueInviteeStatus {
  if (isMember) return 'joined';
  if (invite?.status === 'dismissed') return 'declined';
  if (invite?.status === 'accepted') return 'joined';
  return 'waiting';
}

export function collectLeagueInvitees({
  leagueId,
  inbound,
  sent,
  members,
  profiles,
}: {
  leagueId: string;
  inbound: Array<{ userId: string; invites: LeagueInvite[] }>;
  sent: SentLeagueInvite[];
  members: string[];
  profiles: Array<{ id: string; name: string; avatarUrl: string | null }>;
}): LeagueInvitee[] {
  const memberSet = new Set(members);
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const byId = new Map<string, LeagueInvitee>();

  for (const row of inbound) {
    const invite = pickInviteForLeague(row.invites, leagueId);
    if (!invite) continue;
    const profile = profileById.get(row.userId);
    byId.set(row.userId, {
      userId: row.userId,
      name: profile?.name || 'Player',
      avatarUrl: profile?.avatarUrl ?? null,
      status: inviteeStatusFor(invite, memberSet.has(row.userId)),
      invitedAt: invite.createdAt,
    });
  }

  for (const row of sent) {
    if (row.leagueId !== leagueId || byId.has(row.inviteeId)) continue;
    const profile = profileById.get(row.inviteeId);
    byId.set(row.inviteeId, {
      userId: row.inviteeId,
      name: profile?.name || row.inviteeName || 'Player',
      avatarUrl: profile?.avatarUrl ?? null,
      status: inviteeStatusFor(undefined, memberSet.has(row.inviteeId)),
      invitedAt: row.createdAt,
    });
  }

  const rank: Record<LeagueInviteeStatus, number> = { waiting: 0, declined: 1, joined: 2 };
  return [...byId.values()].sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));
}

function isSentInvite(value: unknown): value is SentLeagueInvite {
  if (!value || typeof value !== 'object') return false;
  const row = value as SentLeagueInvite;
  return (
    typeof row.id === 'string' &&
    typeof row.leagueId === 'string' &&
    typeof row.inviteeId === 'string' &&
    typeof row.inviteeName === 'string' &&
    typeof row.createdAt === 'string'
  );
}

function isInvite(value: unknown): value is LeagueInvite {
  if (!value || typeof value !== 'object') return false;
  const row = value as LeagueInvite;
  return (
    typeof row.id === 'string' &&
    typeof row.leagueId === 'string' &&
    typeof row.leagueName === 'string' &&
    typeof row.leagueCode === 'string' &&
    typeof row.invitedById === 'string' &&
    typeof row.invitedByName === 'string' &&
    typeof row.createdAt === 'string' &&
    (row.status === 'pending' || row.status === 'accepted' || row.status === 'dismissed')
  );
}
