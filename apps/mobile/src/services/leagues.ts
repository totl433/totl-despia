import { env } from '../env';
import { supabase } from '../lib/supabase';
import { resolveLeagueStartGw } from '../lib/leagueStart';

type LeagueRow = {
  id: string;
  name: string;
  code: string;
  created_at: string | null;
  avatar?: string | null;
};

export async function joinLeagueByCode(codeRaw: string): Promise<{ ok: true; league: LeagueRow } | { ok: false; error: string }> {
  const code = String(codeRaw ?? '').trim().toUpperCase();
  if (!code || code.length !== 5) return { ok: false, error: 'Enter a 5 character code.' };

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id ? String(userRes.user.id) : null;
  if (!userId) return { ok: false, error: 'Not logged in.' };

  const { data: league, error: leagueErr } = await (supabase as any)
    .from('leagues')
    .select('id, name, code, created_at, avatar')
    .eq('code', code)
    .maybeSingle();
  if (leagueErr) return { ok: false, error: leagueErr.message ?? 'Failed to find league.' };
  if (!league?.id) return { ok: false, error: 'League code not found.' };

  const leagueRow: LeagueRow = {
    id: String(league.id),
    name: String(league.name ?? ''),
    code: String(league.code ?? code),
    created_at: typeof league.created_at === 'string' ? league.created_at : null,
    avatar: typeof league.avatar === 'string' ? league.avatar : null,
  };

  // Max 20 leagues per user (parity with web).
  const { data: userLeagueRows, error: userLeaguesErr } = await (supabase as any)
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId);
  if (userLeaguesErr) return { ok: false, error: userLeaguesErr.message ?? 'Failed to check your leagues.' };
  if ((userLeagueRows?.length ?? 0) >= 20) {
    return {
      ok: false,
      error: "You're already in 20 mini-leagues, which is the maximum. Leave a league before joining another.",
    };
  }

  // Join lock after 4+ gameweeks (parity with web).
  const { data: meta } = await (supabase as any).from('app_meta').select('current_gw').eq('id', 1).maybeSingle();
  const currentGw: number | null = typeof meta?.current_gw === 'number' ? meta.current_gw : null;
  if (currentGw !== null) {
    const startGw = await resolveLeagueStartGw({ id: leagueRow.id, name: leagueRow.name, created_at: leagueRow.created_at ?? undefined }, currentGw);
    if (currentGw - startGw >= 4) {
      return {
        ok: false,
        error: 'This league has been running for more than 4 gameweeks. New members can only be added during the first 4 gameweeks.',
      };
    }
  }

  // Max 8 members (parity with web).
  const { data: memberRows, error: memberErr } = await (supabase as any).from('league_members').select('user_id').eq('league_id', leagueRow.id);
  if (memberErr) return { ok: false, error: memberErr.message ?? 'Failed to check league members.' };
  if ((memberRows?.length ?? 0) >= 8) return { ok: false, error: 'League is full (max 8 members).' };

  // Determine whether this is a new join.
  const { data: existingMember } = await (supabase as any)
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueRow.id)
    .eq('user_id', userId)
    .maybeSingle();
  const isNewMember = !existingMember;

  const { error: upsertErr } = await (supabase as any).from('league_members').upsert({ league_id: leagueRow.id, user_id: userId }, { onConflict: 'league_id,user_id' });
  if (upsertErr) return { ok: false, error: upsertErr.message ?? 'Failed to join league.' };

  // Best-effort: notify other members (same Netlify function as web) if we have a site URL.
  if (isNewMember) {
    try {
      const { data: userRow } = await (supabase as any).from('users').select('name, email').eq('id', userId).maybeSingle();
      const userName = String(userRow?.name ?? userRow?.email ?? 'Someone');
      const base = String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
      if (base) {
        fetch(`${base}/.netlify/functions/notifyLeagueMemberJoin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leagueId: leagueRow.id, userId, userName }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  return { ok: true, league: leagueRow };
}

