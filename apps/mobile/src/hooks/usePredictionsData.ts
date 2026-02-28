import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import type { Fixture, Pick } from '@totl/domain';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { normalizeTeamCode } from '../lib/teamColors';

const DRAFT_KEY_PREFIX = 'totl.predictionsDraft';

function draftKey(userId: string, gw: number) {
  return `${DRAFT_KEY_PREFIX}:${userId}:${gw}`;
}

function deadlineCountdown(
  fixtures: Fixture[],
  nowMs: number
): { text: string; expired: boolean; deadlineMs: number } | null {
  const firstKickoff = fixtures
    .map((f) => (f.kickoff_time ? new Date(f.kickoff_time).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];
  if (typeof firstKickoff !== 'number') return null;

  const DEADLINE_BUFFER_MINUTES = 75;
  const deadline = firstKickoff - DEADLINE_BUFFER_MINUTES * 60 * 1000;
  const diffMs = deadline - nowMs;
  if (diffMs <= 0) return { text: '0d 0h 0m', expired: true, deadlineMs: deadline };

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { text: `${days}d ${hours}h ${minutes}m`, expired: false, deadlineMs: deadline };
}

function isPick(v: unknown): v is Pick {
  return v === 'H' || v === 'D' || v === 'A';
}

function fixtureDateLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'No date';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function normalizeTeamForms(input: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(input ?? {}).forEach(([rawCode, rawForm]) => {
    const code = normalizeTeamCode(rawCode);
    const form = typeof rawForm === 'string' ? rawForm.trim().toUpperCase() : '';
    if (code && form) out[code] = form;
  });
  return out;
}

export interface UsePredictionsDataOptions {
  isTestMode: boolean;
}

export function usePredictionsData({ isTestMode }: UsePredictionsDataOptions) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [userId, setUserId] = React.useState<string | null>(null);
  const [draftPicks, setDraftPicks] = React.useState<Record<number, Pick>>({});
  const loadedDraftForRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      if (!alive) return;
      setUserId(id ?? null);
    })().catch(() => {});
    return () => { alive = false; };
  }, []);

  type UserAvatarRow = { avatar_url: string | null };
  const { data: avatarRow } = useQuery<UserAvatarRow | null>({
    enabled: !!userId,
    queryKey: ['profile-avatar-url', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('avatar_url').eq('id', userId).maybeSingle();
      const err = error as { code?: string } | null;
      if (error && err?.code !== 'PGRST116') throw error;
      if (!data) return null;
      const row = data as { avatar_url?: unknown };
      return { avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null };
    },
    staleTime: 60_000,
  });
  const avatarUrl = typeof avatarRow?.avatar_url === 'string' ? avatarRow.avatar_url : null;

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['predictions', isTestMode ? 'test' : 'live'],
    enabled: !isTestMode,
    queryFn: () => api.getPredictions(),
  });
  const { data: testModePredictions } = useQuery({
    queryKey: ['predictions-test-forms'],
    enabled: isTestMode,
    queryFn: () => api.getPredictions(),
    staleTime: 30_000,
  });

  const fakeFixtures = React.useMemo(() => {
    const now = Date.now();
    const teams: Array<[string, string, string, string]> = [
      ['NEW', 'Newcastle', 'BOU', 'Bournemouth'],
      ['LIV', 'Liverpool', 'TOT', 'Tottenham'],
      ['MCI', 'Man City', 'MUN', 'Man Utd'],
      ['ARS', 'Arsenal', 'CHE', 'Chelsea'],
      ['BHA', 'Brighton', 'WHU', 'West Ham'],
      ['BRE', 'Brentford', 'AVL', 'Aston Villa'],
      ['CRY', 'Crystal Palace', 'EVE', 'Everton'],
      ['LEE', 'Leeds', 'WOL', 'Wolves'],
      ['FUL', 'Fulham', 'NFO', 'Nottingham Forest'],
      ['SUN', 'Sunderland', 'BUR', 'Burnley'],
    ];
    return teams.map(([homeCode, homeName, awayCode, awayName], idx) => {
      const kickoff = new Date(now + (idx + 1) * 3 * 60 * 60 * 1000);
      return {
        id: `test-fixture-${idx + 1}`,
        gw: 99,
        fixture_index: idx,
        kickoff_time: kickoff.toISOString(),
        api_match_id: null,
        home_team: homeName,
        away_team: awayName,
        home_name: homeName,
        away_name: awayName,
        home_code: homeCode,
        away_code: awayCode,
        home_crest: null,
        away_crest: null,
      } as Fixture;
    });
  }, []);

  const effectiveData = React.useMemo(() => {
    if (!isTestMode) return data;
    return {
      gw: 99,
      fixtures: fakeFixtures,
      picks: [],
      submitted: false,
      teamForms: {},
    };
  }, [data, fakeFixtures, isTestMode]);

  const fixtures = React.useMemo(() => {
    const fx = (effectiveData?.fixtures ?? []) as Fixture[];
    return [...fx].sort((a, b) => (a.fixture_index ?? 0) - (b.fixture_index ?? 0));
  }, [effectiveData?.fixtures]);

  const fixturesByDate = React.useMemo(() => {
    const groups = new Map<string, Fixture[]>();
    fixtures.forEach((f) => {
      const key = fixtureDateLabel(f.kickoff_time ?? null);
      const arr = groups.get(key) ?? [];
      arr.push(f);
      groups.set(key, arr);
    });
    groups.forEach((arr, key) => {
      groups.set(key, [...arr].sort((a, b) => Number(a?.fixture_index ?? 0) - Number(b?.fixture_index ?? 0)));
    });
    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (a === 'No date') return 1;
      if (b === 'No date') return -1;
      const a0 = groups.get(a)?.[0]?.kickoff_time;
      const b0 = groups.get(b)?.[0]?.kickoff_time;
      const da = a0 ? new Date(a0).getTime() : Number.POSITIVE_INFINITY;
      const db = b0 ? new Date(b0).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });
    return keys.map((k) => ({ date: k, fixtures: groups.get(k) ?? [] }));
  }, [fixtures]);

  const gw = effectiveData?.gw ?? null;
  const submitted = effectiveData?.submitted ?? false;

  const teamFormsFromApi = React.useMemo(
    () => normalizeTeamForms((effectiveData?.teamForms ?? {}) as Record<string, string>),
    [effectiveData?.teamForms]
  );
  const testModeTeamForms = React.useMemo(
    () => normalizeTeamForms((testModePredictions?.teamForms ?? {}) as Record<string, string>),
    [testModePredictions?.teamForms]
  );
  const teamForms = React.useMemo(() => {
    if (isTestMode && Object.keys(testModeTeamForms).length > 0) return testModeTeamForms;
    return teamFormsFromApi;
  }, [isTestMode, teamFormsFromApi, testModeTeamForms]);

  const formsByFixtureIndex = React.useMemo(() => {
    const out = new Map<number, { home: string | null; away: string | null }>();
    fixtures.forEach((f) => {
      const homeCode = normalizeTeamCode(f.home_code);
      const awayCode = normalizeTeamCode(f.away_code);
      out.set(f.fixture_index, {
        home: homeCode ? (teamForms[homeCode] ?? null) : null,
        away: awayCode ? (teamForms[awayCode] ?? null) : null,
      });
    });
    return out;
  }, [fixtures, teamForms]);

  const serverPicks = React.useMemo(() => {
    const out: Record<number, Pick> = {};
    (effectiveData?.picks ?? []).forEach((p: { fixture_index?: unknown; pick?: unknown }) => {
      const idx = Number(p?.fixture_index);
      const pick = p?.pick;
      if (Number.isFinite(idx) && isPick(pick)) out[idx] = pick;
    });
    return out;
  }, [effectiveData?.picks]);

  const picks: Record<number, Pick> = React.useMemo(() => {
    if (submitted) return serverPicks;
    return { ...serverPicks, ...draftPicks };
  }, [draftPicks, serverPicks, submitted]);

  const deadline = React.useMemo(() => deadlineCountdown(fixtures, nowMs), [fixtures, nowMs]);
  const deadlineExpired = deadline?.expired ?? false;
  const allPicksMade = React.useMemo(() => {
    if (!fixtures.length) return false;
    return fixtures.every((f) => isPick(picks[f.fixture_index]));
  }, [fixtures, picks]);

  React.useEffect(() => {
    if (isTestMode || !userId || typeof gw !== 'number') return;
    const k = draftKey(userId, gw);
    if (loadedDraftForRef.current === k) return;
    loadedDraftForRef.current = k;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(k);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const next: Record<number, Pick> = {};
        Object.entries(parsed ?? {}).forEach(([key, val]) => {
          const idx = Number(key);
          if (!Number.isFinite(idx)) return;
          if (!isPick(val)) return;
          next[idx] = val;
        });
        setDraftPicks(next);
      } catch {
        // ignore
      }
    })();
  }, [gw, isTestMode, userId]);

  React.useEffect(() => {
    if (isTestMode || !userId || typeof gw !== 'number') return;
    const k = draftKey(userId, gw);
    void AsyncStorage.setItem(k, JSON.stringify(draftPicks)).catch(() => {});
  }, [draftPicks, gw, isTestMode, userId]);

  React.useEffect(() => {
    if (isTestMode || !userId || typeof gw !== 'number' || !submitted) return;
    void AsyncStorage.removeItem(draftKey(userId, gw)).catch(() => {});
  }, [gw, isTestMode, submitted, userId]);

  const setPickLocal = React.useCallback(
    (fixture_index: number, pick: Pick) => {
      if (submitted || deadlineExpired) return;
      setDraftPicks((prev) => ({ ...prev, [fixture_index]: pick }));
    },
    [deadlineExpired, submitted]
  );

  return {
    userId,
    avatarUrl,
    fixtures,
    fixturesByDate,
    gw,
    submitted,
    teamForms,
    formsByFixtureIndex,
    serverPicks,
    draftPicks,
    picks,
    setPickLocal,
    deadline,
    deadlineExpired,
    allPicksMade,
    effectiveData,
    isLoading,
    error,
    refetch,
    isRefetching,
  };
}
