import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { supabase } from '../lib/supabase';

type InviteLeague = {
  id: string;
  name: string;
  code: string;
};

async function inviteRequest(code: string, method: 'GET' | 'POST'): Promise<InviteLeague> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sign in to use this invite.');

  const url = `/.netlify/functions/joinMiniLeagueByCode${method === 'GET' ? `?code=${encodeURIComponent(code)}` : ''}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify({ code }) : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; league?: InviteLeague; error?: string };
  if (!response.ok || !body.ok || !body.league) {
    throw new Error(body.error || 'Could not open this mini-league invite.');
  }
  return body.league;
}

export default function JoinMiniLeaguePage() {
  const { code: rawCode = '' } = useParams();
  const code = rawCode.trim().toUpperCase();
  const navigate = useNavigate();
  const [league, setLeague] = useState<InviteLeague | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    inviteRequest(code, 'GET')
      .then((result) => {
        if (!cancelled) setLeague(result);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Invite unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    setError(null);
    try {
      const joinedLeague = await inviteRequest(code, 'POST');
      navigate(`/league/${joinedLeague.code}`, { replace: true });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Could not join this mini league.');
      setJoining(false);
    }
  };

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-slate-500">MINI LEAGUE INVITE</p>
        <h1 className="mb-3 text-3xl font-bold text-slate-900">
          {loading ? 'Opening invite…' : league?.name ?? 'Invite unavailable'}
        </h1>
        <p className="mb-7 text-slate-600">
          {loading
            ? 'Checking the invite.'
            : league
              ? `You've been invited to join ${league.name} on TOTL.`
              : error}
        </p>

        {league ? (
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={joining}
            className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {joining ? 'Joining…' : 'Join mini league'}
          </button>
        ) : null}
        {error && league ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </section>
    </main>
  );
}
