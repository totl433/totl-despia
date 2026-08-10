import { env } from '../env';
import { supabase } from '../lib/supabase';

export type LeagueRow = {
  id: string;
  name: string;
  code: string;
  created_at: string | null;
  avatar?: string | null;
};

type InviteResponse = {
  ok: true;
  league: LeagueRow;
  joined?: boolean;
  alreadyMember?: boolean;
};

async function requestInvite(codeRaw: string, method: 'GET' | 'POST'): Promise<InviteResponse> {
  const code = String(codeRaw ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) throw new Error('Enter a 5 character code.');
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error('Sign in to use this invite.');

  const baseUrl = String(env.EXPO_PUBLIC_SITE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/.netlify/functions/joinMiniLeagueByCode${method === 'GET' ? `?code=${encodeURIComponent(code)}` : ''}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify({ code }) : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as Partial<InviteResponse> & { error?: string };
  if (!response.ok || !body.ok || !body.league) {
    throw new Error(body.error || 'Could not open this mini-league invite.');
  }
  return body as InviteResponse;
}

export async function getMiniLeagueInvite(code: string): Promise<LeagueRow> {
  return (await requestInvite(code, 'GET')).league;
}

export async function joinLeagueByCode(codeRaw: string): Promise<{ ok: true; league: LeagueRow } | { ok: false; error: string }> {
  try {
    const result = await requestInvite(codeRaw, 'POST');
    return { ok: true, league: result.league };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not join this mini league.' };
  }
}

