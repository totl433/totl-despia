import { supabase } from './supabase';

export const LEAGUE_INVITES_PREF_KEY = '__league_invites';

export type LocalLeagueInvite = {
  id: string;
  leagueId: string;
  leagueName: string;
  leagueCode: string;
  leagueAvatar: string | null;
  invitedById: string;
  invitedByName: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'dismissed';
};

function isInvite(value: unknown): value is LocalLeagueInvite {
  if (!value || typeof value !== 'object') return false;
  const row = value as LocalLeagueInvite;
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

function readInvites(preferences: unknown): LocalLeagueInvite[] {
  if (!preferences || typeof preferences !== 'object') return [];
  const raw = (preferences as Record<string, unknown>)[LEAGUE_INVITES_PREF_KEY];
  return Array.isArray(raw) ? raw.filter(isInvite) : [];
}

async function loadMyPrefs(): Promise<{ userId: string; preferences: Record<string, unknown> }> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sign in to see invites.');
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const preferences =
    data?.preferences && typeof data.preferences === 'object' ? { ...(data.preferences as Record<string, unknown>) } : {};
  return { userId, preferences };
}

async function saveMyInvites(userId: string, preferences: Record<string, unknown>, invites: LocalLeagueInvite[]): Promise<void> {
  const { error } = await supabase.from('user_notification_preferences').upsert(
    { user_id: userId, preferences: { ...preferences, [LEAGUE_INVITES_PREF_KEY]: invites } },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function listMyLeagueInvitesLocal(): Promise<{ invites: LocalLeagueInvite[] }> {
  const { preferences } = await loadMyPrefs();
  return {
    invites: readInvites(preferences)
      .filter((row) => row.status === 'pending')
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
  };
}

export async function dismissMyLeagueInviteLocal(inviteId: string): Promise<{ ok: true }> {
  const { userId, preferences } = await loadMyPrefs();
  const invites = readInvites(preferences).map((row) => (row.id === inviteId ? { ...row, status: 'dismissed' as const } : row));
  await saveMyInvites(userId, preferences, invites);
  return { ok: true };
}

export async function acceptMyLeagueInviteLocal(
  inviteId: string
): Promise<{ ok: true; league: { id: string; name: string; code: string } }> {
  const { userId, preferences } = await loadMyPrefs();
  const invite = readInvites(preferences).find((row) => row.id === inviteId && row.status === 'pending');
  if (!invite) throw new Error('This invite is no longer available.');

  const { data: existing } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('league_id', invite.leagueId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!existing) {
    const { count } = await supabase.from('league_members').select('league_id', { count: 'exact', head: true }).eq('user_id', userId);
    if ((count ?? 0) >= 20) {
      throw new Error("You're already in 20 mini leagues. Leave one before joining another.");
    }
    const { error: joinError } = await supabase
      .from('league_members')
      .upsert({ league_id: invite.leagueId, user_id: userId }, { onConflict: 'league_id,user_id' });
    if (joinError) throw new Error('Could not join this mini league.');
  }

  const invites = readInvites(preferences).map((row) => (row.id === inviteId ? { ...row, status: 'accepted' as const } : row));
  await saveMyInvites(userId, preferences, invites);
  return { ok: true, league: { id: invite.leagueId, name: invite.leagueName, code: invite.leagueCode } };
}
