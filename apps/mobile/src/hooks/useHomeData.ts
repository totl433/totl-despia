import React from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { Fixture, GwResultRow, GwResults, HomeRanks, HomeSnapshot, LiveScore, LiveStatus, Pick } from '@totl/domain';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useLiveScores } from './useLiveScores';

type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('refresh-timeout')), timeoutMs);
    promise.then(
      (value) => { clearTimeout(id); resolve(value); },
      (error) => { clearTimeout(id); reject(error); }
    );
  });
}

function deadlineCountdown(
  fixtures: Fixture[],
  nowMs: number
): { text: string; expired: boolean } | null {
  const firstKickoff = fixtures
    .map((f) => (f.kickoff_time ? new Date(f.kickoff_time).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];
  if (typeof firstKickoff !== 'number') return null;

  const DEADLINE_BUFFER_MINUTES = 75;
  const deadline = firstKickoff - DEADLINE_BUFFER_MINUTES * 60 * 1000;
  const diffMs = deadline - nowMs;
  if (diffMs <= 0) return { text: '0d 0h 0m', expired: true };

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { text: `${days}d ${hours}h ${minutes}m`, expired: false };
}

export function useHomeData() {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [hasAccessToken, setHasAccessToken] = React.useState<boolean | null>(null);
  const [pullRefreshing, setPullRefreshing] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setHasAccessToken(Boolean(data.session?.access_token));
      } catch {
        if (cancelled) return;
        setHasAccessToken(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const {
    data: home,
    isLoading: homeLoading,
    error: homeError,
    refetch: refetchHome,
    isRefetching: homeRefetching,
  } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });

  const {
    data: leagues,
    error: leaguesError,
    refetch: refetchLeagues,
    isRefetching: leaguesRefetching,
  } = useQuery<LeaguesResponse>({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const { data: profileSummary } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  const { data: authUser } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 60_000,
  });

  const userId = authUser?.id ? String(authUser.id) : null;

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

  const profileAvatar = profileSummary && typeof profileSummary === 'object' && 'avatar_url' in profileSummary
    ? (profileSummary as { avatar_url?: unknown }).avatar_url
    : undefined;
  const avatarUrl =
    (typeof profileAvatar === 'string' ? profileAvatar : null) ??
    (typeof avatarRow?.avatar_url === 'string' ? avatarRow.avatar_url : null);

  const { data: ranks, refetch: refetchRanks, isRefetching: ranksRefetching } = useQuery<HomeRanks>({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });

  const latestCompletedGw = ranks?.latestGw ?? null;
  const shouldFetchLatestGwResults =
    typeof latestCompletedGw === 'number' &&
    (typeof ranks?.gwRank?.score !== 'number' || typeof ranks?.gwRank?.totalFixtures !== 'number');
  const { data: latestGwResults } = useQuery<GwResults>({
    enabled: shouldFetchLatestGwResults,
    queryKey: ['gwResults', latestCompletedGw],
    queryFn: () => api.getGwResults(latestCompletedGw as number),
  });

  const fixtures: Fixture[] = home?.fixtures ?? [];
  const userPicks: Record<string, Pick> = home?.userPicks ?? {};

  const liveScoresGw =
    typeof home?.viewingGw === 'number' ? home.viewingGw : typeof home?.currentGw === 'number' ? home.currentGw : null;
  const { liveByFixtureIndex: liveByFixtureIndexRealtime } = useLiveScores(liveScoresGw, {
    initial: home?.liveScores ?? [],
  });

  const firstKickoffTimeMs = React.useMemo(() => {
    const first = fixtures
      .map((f) => (f.kickoff_time ? new Date(f.kickoff_time).getTime() : NaN))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];
    return typeof first === 'number' && Number.isFinite(first) ? first : null;
  }, [fixtures]);

  React.useEffect(() => {
    if (typeof firstKickoffTimeMs !== 'number') return;
    const n = Date.now();
    const delayMs = Math.max(0, Math.min(2_147_483_647, firstKickoffTimeMs - n + 25));
    const id = setTimeout(() => setNowMs(Date.now()), delayMs);
    return () => clearTimeout(id);
  }, [firstKickoffTimeMs]);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNowMs(Date.now());
    });
    return () => sub.remove();
  }, []);

  const resultByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, Pick>();
    (home?.gwResults ?? []).forEach((r: GwResultRow) => m.set(r.fixture_index, r.result));
    return m;
  }, [home?.gwResults]);

  const liveByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, LiveScore>();
    if (!home) return m;
    if (liveByFixtureIndexRealtime.size > 0) return liveByFixtureIndexRealtime;
    const apiMatchIdToFixtureIndex = new Map<number, number>();
    home.fixtures.forEach((f: Fixture) => {
      if (typeof f.api_match_id === 'number') apiMatchIdToFixtureIndex.set(f.api_match_id, f.fixture_index);
    });
    (home.liveScores ?? []).forEach((ls: LiveScore) => {
      const idx =
        typeof ls.fixture_index === 'number'
          ? ls.fixture_index
          : typeof ls.api_match_id === 'number'
            ? apiMatchIdToFixtureIndex.get(ls.api_match_id)
            : undefined;
      if (typeof idx !== 'number') return;
      m.set(idx, ls);
    });
    return m;
  }, [home, liveByFixtureIndexRealtime]);

  const viewingGw = home?.viewingGw ?? null;
  const currentGw = home?.currentGw ?? null;

  const { data: predictionsMeta } = useQuery({
    enabled: typeof viewingGw === 'number',
    queryKey: ['home-predictions-meta', viewingGw],
    queryFn: () => api.getPredictions({ gw: viewingGw as number }),
    staleTime: 60_000,
  });

  const viewingGwForPickPercentages = typeof home?.viewingGw === 'number' ? home.viewingGw : null;
  const deadline = React.useMemo(() => deadlineCountdown(fixtures, nowMs), [fixtures, nowMs]);
  const deadlineExpired = deadline?.expired ?? false;

  const { data: pickPercentageRows } = useQuery<Array<{ fixture_index: number; pick: Pick }>>({
    enabled: deadlineExpired && typeof viewingGwForPickPercentages === 'number',
    queryKey: ['home-pick-percentages', viewingGwForPickPercentages],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_picks')
        .select('fixture_index, pick')
        .eq('gw', viewingGwForPickPercentages as number);
      if (error) {
        console.warn('[HomeScreen] Failed to load pick percentages', error.message);
        return [];
      }
      const rows = (data ?? []) as Array<{ fixture_index: unknown; pick: unknown }>;
      return rows
        .filter(
          (row): row is { fixture_index: number; pick: Pick } =>
            typeof row.fixture_index === 'number' && (row.pick === 'H' || row.pick === 'D' || row.pick === 'A')
        )
        .map((row) => ({ fixture_index: row.fixture_index, pick: row.pick }));
    },
    staleTime: 30_000,
  });

  const pickPercentagesByFixture = React.useMemo(() => {
    const out = new Map<number, Partial<Record<Pick, number>>>();
    const countsByFixture = new Map<number, { H: number; D: number; A: number; total: number }>();
    (pickPercentageRows ?? []).forEach((row) => {
      const current = countsByFixture.get(row.fixture_index) ?? { H: 0, D: 0, A: 0, total: 0 };
      current[row.pick] += 1;
      current.total += 1;
      countsByFixture.set(row.fixture_index, current);
    });

    countsByFixture.forEach((counts, fixtureIndex) => {
      if (counts.total <= 0) return;
      out.set(fixtureIndex, {
        H: Math.round((counts.H / counts.total) * 100),
        D: Math.round((counts.D / counts.total) * 100),
        A: Math.round((counts.A / counts.total) * 100),
      });
    });
    return out;
  }, [pickPercentageRows]);

  const refreshing = pullRefreshing;
  const onRefresh = React.useCallback(async () => {
    if (pullRefreshing) return;
    setPullRefreshing(true);
    try {
      await Promise.allSettled([
        withTimeout(refetchHome(), 8000),
        withTimeout(refetchLeagues(), 8000),
        withTimeout(refetchRanks(), 8000),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [pullRefreshing, refetchHome, refetchLeagues, refetchRanks]);

  return {
    nowMs,
    hasAccessToken,
    home,
    homeLoading: Boolean(homeLoading),
    homeError,
    homeRefetching,
    refetchHome,
    refetchLeagues,
    refetchRanks,
    leagues,
    leaguesError,
    leaguesRefetching,
    profileSummary,
    avatarUrl,
    ranks,
    latestGwResults,
    fixtures,
    userPicks,
    liveByFixtureIndex,
    resultByFixtureIndex,
    predictionsMeta,
    pickPercentagesByFixture,
    viewingGw,
    currentGw,
    deadline,
    deadlineExpired,
    refreshing,
    onRefresh,
  };
}
