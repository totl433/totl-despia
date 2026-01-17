import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/cache';

export type LeagueMetaLeague = {
  id: string;
  name: string;
  code: string;
  created_at?: string;
  created_by?: string;
  avatar?: string | null;
};

export type LeagueMetaMember = { id: string; name: string };

interface UseLeagueMetaProps {
  code: string;
  userId?: string | null;
}

interface UseLeagueMetaReturn {
  league: LeagueMetaLeague | null;
  members: LeagueMetaMember[];
  firstMember: LeagueMetaMember | null;
  isMember: boolean;
  isAdmin: boolean;
  loading: boolean;
  setLeague: React.Dispatch<React.SetStateAction<LeagueMetaLeague | null>>;
  setMembers: React.Dispatch<React.SetStateAction<LeagueMetaMember[]>>;
}

/**
 * Cache-first league + members loader.
 * Mirrors the existing League.tsx behavior, but isolates it for reuse/testability.
 */
export function useLeagueMeta({ code, userId }: UseLeagueMetaProps): UseLeagueMetaReturn {
  const [league, setLeague] = useState<LeagueMetaLeague | null>(() => {
    if (!code) return null;
    try {
      const cachedLeagues =
        getCached<Array<{ id: string; name: string; code: string; avatar?: string | null }>>(
          `leagues:${userId || ''}`
        );
      const found = cachedLeagues?.find((l) => l.code.toUpperCase() === code.toUpperCase());
      return (found as LeagueMetaLeague) ?? null;
    } catch {
      return null;
    }
  });

  const [members, setMembers] = useState<LeagueMetaMember[]>(() => {
    if (!league?.id) return [];
    try {
      const cachedMembers = getCached<Array<[string, string]>>(`league:members:${league.id}`);
      if (cachedMembers?.length) {
        return cachedMembers.map(([id, name]) => ({ id, name: name || '(no name)' }));
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [loading, setLoading] = useState(() => !league);
  const [firstMember, setFirstMember] = useState<LeagueMetaMember | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!code) {
        if (!alive) return;
        setLeague(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      let currentLeague = league;
      if (!currentLeague) {
        const { data } = await supabase
          .from('leagues')
          .select('id,name,code,created_at,avatar')
          .eq('code', code)
          .maybeSingle();

        if (!alive) return;
        if (!data) {
          setLeague(null);
          setMembers([]);
          setLoading(false);
          return;
        }
        currentLeague = data as LeagueMetaLeague;
        setLeague(currentLeague);
      }

      if (currentLeague?.id && members.length === 0) {
        const { data: mm } = await supabase
          .from('league_members')
          .select('users(id,name),created_at')
          .eq('league_id', currentLeague.id)
          .order('created_at', { ascending: true });

        const fetchedMembers =
          (mm as any[])?.map((r) => ({
            id: r.users.id as string,
            name: (r.users.name as string) ?? '(no name)',
          })) ?? [];

        const memSorted = [...fetchedMembers].sort((a, b) => a.name.localeCompare(b.name));

        if (!alive) return;
        setMembers(memSorted);
        setCached(
          `league:members:${currentLeague.id}`,
          memSorted.map((m) => [m.id, m.name]),
          60 * 5
        );
      }

      if (!alive) return;
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    setFirstMember(members.length ? members[0] : null);
  }, [members]);

  const isMember = useMemo(() => !!userId && members.some((m) => m.id === userId), [userId, members]);
  const isAdmin = useMemo(() => !!userId && !!firstMember && firstMember.id === userId, [userId, firstMember]);

  return { league, members, firstMember, isMember, isAdmin, loading, setLeague, setMembers };
}

