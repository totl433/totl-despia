import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import { useNavigation, useRoute, useScrollToTop } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import LeaderboardsTabs, { type LeaderboardsTab } from '../components/leaderboards/LeaderboardsTabs';
import { type LeaderboardsScope } from '../components/leaderboards/LeaderboardsScopeToggle';
import LeaderboardTable, { type LeaderboardRow } from '../components/leaderboards/LeaderboardTable';
import LeaderboardPlayerPicksSheet from '../components/leaderboards/LeaderboardPlayerPicksSheet';
import CenteredSpinner from '../components/CenteredSpinner';
import AppTopHeader from '../components/AppTopHeader';

type OverallRow = { user_id: string; name: string | null; ocp: number | null };
type GwPointsRow = { user_id: string; gw: number; points: number };

function byValueThenName(a: LeaderboardRow, b: LeaderboardRow) {
  if (b.value !== a.value) return b.value - a.value;
  return a.name.localeCompare(b.name);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('refresh-timeout')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      }
    );
  });
}

export default function GlobalScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const listRef = React.useRef<any>(null);
  useScrollToTop(listRef);

  const initialTabParam = (route.params as any)?.initialTab as LeaderboardsTab | undefined;
  const initialScopeParam = (route.params as any)?.initialScope as LeaderboardsScope | undefined;

  const [tab, setTab] = React.useState<LeaderboardsTab>(initialTabParam ?? 'gw');
  const [scope, setScope] = React.useState<LeaderboardsScope>(initialScopeParam ?? 'all');
  const [pullRefreshing, setPullRefreshing] = React.useState(false);
  const [playerPicksOpen, setPlayerPicksOpen] = React.useState(false);
  const [playerPicksUserId, setPlayerPicksUserId] = React.useState<string | null>(null);
  const [playerPicksUserName, setPlayerPicksUserName] = React.useState<string | null>(null);

  // Allow other screens (e.g. Home performance cards) to deep-link into a specific leaderboard section.
  // We consume the param once and then clear it so manual tab changes won't be overridden.
  React.useEffect(() => {
    if (!initialTabParam && !initialScopeParam) return;
    if (initialTabParam && initialTabParam !== tab) setTab(initialTabParam);
    if (initialScopeParam && initialScopeParam !== scope) setScope(initialScopeParam);
    requestAnimationFrame(() => {
      navigation.setParams?.({ initialTab: undefined, initialScope: undefined });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTabParam, initialScopeParam]);

  const { data: userData } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
  const userId = userData?.id ?? null;
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
  const avatarUrl = typeof avatarRow?.avatar_url === 'string' ? String(avatarRow.avatar_url) : null;

  const { data: ranks, refetch: refetchRanks, isRefetching: ranksRefetching } = useQuery({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });
  const latestGw = ranks?.latestGw ?? null;

  const {
    data: overall,
    isLoading: overallLoading,
    error: overallError,
    refetch: refetchOverall,
    isRefetching: overallRefetching,
  } = useQuery({
    queryKey: ['leaderboards', 'overallView'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_v_ocp_overall').select('user_id, name, ocp');
      if (error) throw error;
      return (data ?? []) as OverallRow[];
    },
  });

  const {
    data: gwPoints,
    isLoading: gwPointsLoading,
    error: gwPointsError,
    refetch: refetchGwPoints,
    isRefetching: gwPointsRefetching,
  } = useQuery({
    queryKey: ['leaderboards', 'gwPointsView'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_v_gw_points').select('user_id, gw, points').order('gw', { ascending: true });
      if (error) throw error;
      return (data ?? []) as GwPointsRow[];
    },
  });

  const { data: gwLiveTable, refetch: refetchGwLiveTable } = useQuery({
    enabled: typeof latestGw === 'number',
    queryKey: ['leaderboards', 'gwLiveTable', latestGw],
    queryFn: () => api.getGlobalGwLiveTable(latestGw as number),
    refetchInterval: tab === 'gw' ? 10_000 : false,
  });
  const { data: gwLiveFallbackScores, refetch: refetchGwLiveFallbackScores } = useQuery<{
    scores: Record<string, number>;
    hasActiveLiveGames: boolean;
  }>({
    enabled: typeof latestGw === 'number',
    queryKey: ['leaderboards', 'gwLiveFallbackScores', latestGw],
    queryFn: async () => {
      const gw = latestGw as number;
      const [submissionsRes, picksRes, liveScoresRes, resultsRes, fixturesRes] = await Promise.all([
        supabase.from('app_gw_submissions').select('user_id').eq('gw', gw),
        supabase.from('app_picks').select('user_id, fixture_index, pick').eq('gw', gw),
        supabase.from('live_scores').select('api_match_id, fixture_index, home_score, away_score, status').eq('gw', gw),
        supabase.from('app_gw_results').select('fixture_index, result').eq('gw', gw),
        supabase.from('app_fixtures').select('fixture_index, api_match_id').eq('gw', gw),
      ]);
      if (submissionsRes.error) throw submissionsRes.error;
      if (picksRes.error) throw picksRes.error;
      if (liveScoresRes.error) throw liveScoresRes.error;
      if (resultsRes.error) throw resultsRes.error;
      if (fixturesRes.error) throw fixturesRes.error;

      const picks = (picksRes.data ?? []).filter((p: any) => p.pick === 'H' || p.pick === 'D' || p.pick === 'A');
      const submittedIds = new Set<string>([
        ...((submissionsRes.data ?? []) as any[]).map((s: any) => String(s.user_id)),
        ...picks.map((p: any) => String(p.user_id)),
      ]);
      const outcomeByFixtureIndex = new Map<number, 'H' | 'D' | 'A'>();
      (resultsRes.data ?? []).forEach((r: any) => {
        if (r?.result === 'H' || r?.result === 'D' || r?.result === 'A') outcomeByFixtureIndex.set(Number(r.fixture_index), r.result);
      });
      const apiMatchIdToFixture = new Map<number, number>();
      (fixturesRes.data ?? []).forEach((f: any) => {
        if (typeof f?.api_match_id === 'number' && typeof f?.fixture_index === 'number') apiMatchIdToFixture.set(f.api_match_id, f.fixture_index);
      });
      let hasActiveLiveGames = false;
      (liveScoresRes.data ?? []).forEach((ls: any) => {
        const status = ls?.status;
        const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
        if (status === 'IN_PLAY' || status === 'PAUSED') hasActiveLiveGames = true;
        if (!started) return;
        const fixtureIndex =
          typeof ls?.fixture_index === 'number'
            ? ls.fixture_index
            : typeof ls?.api_match_id === 'number'
              ? apiMatchIdToFixture.get(ls.api_match_id)
              : undefined;
        if (typeof fixtureIndex !== 'number') return;
        const hs = Number(ls?.home_score ?? 0);
        const as = Number(ls?.away_score ?? 0);
        outcomeByFixtureIndex.set(fixtureIndex, hs > as ? 'H' : hs < as ? 'A' : 'D');
      });

      const scores: Record<string, number> = {};
      submittedIds.forEach((uid) => {
        scores[uid] = 0;
      });
      const picksByFixture = new Map<number, Array<{ user_id: string; pick: 'H' | 'D' | 'A' }>>();
      picks.forEach((p: any) => {
        const uid = String(p.user_id);
        if (!submittedIds.has(uid)) return;
        const arr = picksByFixture.get(Number(p.fixture_index)) ?? [];
        arr.push({ user_id: uid, pick: p.pick });
        picksByFixture.set(Number(p.fixture_index), arr);
      });
      outcomeByFixtureIndex.forEach((outcome, fixtureIndex) => {
        const thesePicks = picksByFixture.get(fixtureIndex) ?? [];
        thesePicks.forEach((p) => {
          if (p.pick === outcome) scores[p.user_id] = (scores[p.user_id] ?? 0) + 1;
        });
      });
      return { scores, hasActiveLiveGames };
    },
    refetchInterval: tab === 'gw' || tab === 'overall' ? 10_000 : false,
  });

  const {
    data: friendIds,
    isLoading: friendsLoading,
    refetch: refetchFriendIds,
    isRefetching: friendIdsRefetching,
  } = useQuery({
    queryKey: ['leaderboards', 'miniLeagueFriendIds'],
    enabled: scope === 'friends' && !!userId,
    queryFn: async () => {
      const { leagues } = await api.listLeagues();
      const ids = new Set<string>();
      if (userId) ids.add(userId);
      const details = await Promise.all(leagues.map((l) => api.getLeague(String(l.id))));
      details.forEach((d) => d.members.forEach((m) => ids.add(String(m.id))));
      return ids;
    },
    staleTime: 5 * 60 * 1000,
  });

  const nameByUserId = React.useMemo(() => {
    const m = new Map<string, string>();
    (overall ?? []).forEach((o) => m.set(o.user_id, o.name ?? 'User'));
    return m;
  }, [overall]);

  const filterScope = React.useCallback(
    (rows: LeaderboardRow[]) => {
      if (scope !== 'friends') return rows;
      // Avoid swapping from "all" -> "friends" mid-scroll while ids are still loading.
      if (!friendIds) return [];
      const set = friendIds;
      if (!set.size) return [];
      return rows.filter((r) => set.has(r.user_id));
    },
    [friendIds, scope]
  );

  const computeFormRows = React.useCallback(
    (weeks: number): LeaderboardRow[] => {
      const gw = latestGw ?? null;
      const pts = gwPoints ?? [];
      if (!gw || gw < weeks) return [];
      const start = gw - weeks + 1;
      const byUser = new Map<string, { name: string; sum: number; played: Set<number> }>();

      // Initialize from overall list so names are stable.
      (overall ?? []).forEach((o) => {
        byUser.set(o.user_id, { name: o.name ?? 'User', sum: 0, played: new Set() });
      });

      pts.forEach((p) => {
        if (p.gw < start || p.gw > gw) return;
        const existing = byUser.get(p.user_id) ?? { name: nameByUserId.get(p.user_id) ?? 'User', sum: 0, played: new Set<number>() };
        existing.sum += Number(p.points ?? 0);
        existing.played.add(p.gw);
        byUser.set(p.user_id, existing);
      });

      const rows: LeaderboardRow[] = [];
      byUser.forEach((v, id) => {
        if (v.played.size === weeks) rows.push({ user_id: id, name: v.name, value: v.sum });
      });
      return rows.sort(byValueThenName);
    },
    [gwPoints, latestGw, nameByUserId, overall]
  );

  const rowsBase: LeaderboardRow[] = React.useMemo(() => {
    const gw = latestGw ?? null;
    if (!overall || !gwPoints) return [];
    const gwPointsByUser = new Map<string, number>();
    const gwLiveByUser = new Map<string, number>();
    const liveRows = gwLiveTable?.rows ?? [];
    if (liveRows.length > 0) {
      liveRows.forEach((r) => {
        gwLiveByUser.set(String(r.user_id), Number(r.score ?? 0));
      });
    } else {
      Object.entries(gwLiveFallbackScores?.scores ?? {}).forEach(([uid, score]) => {
        gwLiveByUser.set(String(uid), Number(score ?? 0));
      });
    }
    const hasLiveGwScores = gwLiveByUser.size > 0;
    const hasActiveLiveGames = gwLiveFallbackScores?.hasActiveLiveGames === true;
    if (gw) {
      gwPoints
        .filter((p) => p.gw === gw)
        .forEach((p) => {
          gwPointsByUser.set(p.user_id, Number(p.points ?? 0));
        });
    }

    if (tab === 'overall') {
      const r = overall
        .map((o) => ({
          user_id: o.user_id,
          name: o.name ?? 'User',
          value:
            hasActiveLiveGames && hasLiveGwScores
              ? Math.round(Number(o.ocp ?? 0)) + (gwLiveByUser.get(o.user_id) ?? 0)
              : Math.round(Number(o.ocp ?? 0)),
          secondaryValue:
            gw
              ? hasLiveGwScores
                ? (gwLiveByUser.get(o.user_id) ?? 0)
                : (gwPointsByUser.get(o.user_id) ?? 0)
              : undefined,
        }))
        .sort(byValueThenName);
      return filterScope(r);
    }

    if (tab === 'form5') return filterScope(computeFormRows(5));
    if (tab === 'form10') return filterScope(computeFormRows(10));

    // GW tab: last completed gameweek
    if (!gw) return [];
    if (hasLiveGwScores) {
      const r = Array.from(gwLiveByUser.entries())
        .map(([uid, score]) => ({
          user_id: uid,
          name: nameByUserId.get(uid) ?? 'User',
          value: Number(score ?? 0),
        }))
        .sort(byValueThenName);
      return filterScope(r);
    }
    const pts = gwPoints
      .filter((p) => p.gw === gw)
      .map((p) => ({
        user_id: p.user_id,
        name: nameByUserId.get(p.user_id) ?? 'User',
        value: Number(p.points ?? 0),
      }))
      .sort(byValueThenName);
    return filterScope(pts);
  }, [computeFormRows, filterScope, gwLiveFallbackScores, gwLiveTable?.rows, gwPoints, latestGw, nameByUserId, overall, tab]);

  const visibleUserIds = React.useMemo(() => {
    const ids = Array.from(new Set(rowsBase.map((r) => r.user_id))).filter(Boolean);
    // Keep it bounded (leaderboard UI only needs the top list).
    return ids.slice(0, 400);
  }, [rowsBase]);

  const { data: avatarByUserId } = useQuery<Record<string, string | null>>({
    enabled: visibleUserIds.length > 0,
    queryKey: ['leaderboards', 'avatarMap', scope, tab, latestGw, visibleUserIds.length],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, avatar_url').in('id', visibleUserIds);
      if (error) throw error;
      const out: Record<string, string | null> = {};
      (data ?? []).forEach((u: any) => {
        out[String(u.id)] = typeof u.avatar_url === 'string' ? u.avatar_url : null;
      });
      return out;
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows: LeaderboardRow[] = React.useMemo(() => {
    const m = avatarByUserId ?? {};
    return rowsBase.map((r) => ({
      ...r,
      avatar_url: m[r.user_id] ?? null,
    }));
  }, [avatarByUserId, rowsBase]);

  const subtitle = React.useMemo(() => {
    const who = scope === 'friends' ? 'Mini League Friends' : 'All Players';
    if (tab === 'overall') return `${who} since the start of the season`;
    if (tab === 'form5') return latestGw && latestGw >= 5 ? `${who} who completed the last 5 Gameweeks` : `${who} (need 5 completed GWs)`;
    if (tab === 'form10') return latestGw && latestGw >= 10 ? `${who} who completed the last 10 Gameweeks` : `${who} (need 10 completed GWs)`;
    return latestGw ? `${who} who submitted for GW${latestGw}` : `${who} who submitted for the last GW`;
  }, [latestGw, scope, tab]);

  const valueLabel = tab === 'overall' ? 'OCP' : tab === 'gw' && latestGw ? `GW${latestGw}` : tab === 'form5' ? 'PTS' : tab === 'form10' ? 'PTS' : '—';
  const secondaryValueLabel = tab === 'overall' && latestGw ? `GW${latestGw}` : undefined;
  const loading = overallLoading || gwPointsLoading || friendsLoading;
  const error = (overallError as any) ?? (gwPointsError as any);
  const showInitialSpinner = loading && !error && rows.length === 0;

  const refreshing = pullRefreshing;
  const onRefresh = React.useCallback(async () => {
    if (pullRefreshing) return;
    setPullRefreshing(true);
    try {
      await Promise.allSettled([
        withTimeout(refetchRanks(), 8000),
        withTimeout(refetchOverall(), 8000),
        withTimeout(refetchGwPoints(), 8000),
        typeof latestGw === 'number' ? withTimeout(refetchGwLiveTable(), 8000) : Promise.resolve(),
        typeof latestGw === 'number' ? withTimeout(refetchGwLiveFallbackScores(), 8000) : Promise.resolve(),
        scope === 'friends' ? withTimeout(refetchFriendIds(), 8000) : Promise.resolve(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [latestGw, pullRefreshing, refetchFriendIds, refetchGwLiveFallbackScores, refetchGwLiveTable, refetchGwPoints, refetchOverall, refetchRanks, scope]);

  return (
    <Screen fullBleed>
      {/* No extra bottom padding here; the table handles its own scroll padding.
          This lets the leaderboard container run off-screen at the bottom (more obvious scroll affordance). */}
      <View style={{ flex: 1 }}>
        <AppTopHeader
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => navigation.navigate('Profile')}
          avatarUrl={avatarUrl}
          title="Leaderboards"
          rightAction={
            <Pressable
              onPress={() => navigation.navigate('Profile' as any, { screen: 'ProfileStats' } as any)}
              accessibilityRole="button"
              accessibilityLabel="Open stats"
              style={({ pressed }) => ({
                width: 30,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.86 : 1,
              })}
            >
              <Ionicons name="analytics-outline" size={24} color={t.color.muted} />
            </Pressable>
          }
        />

        <View style={{ flex: 1, paddingHorizontal: t.space[4], paddingBottom: 0 }}>
        <View style={{ marginTop: 12 }}>
          <LeaderboardsTabs value={tab} onChange={setTab} />
        </View>

        <View style={{ marginTop: 14, marginBottom: 10, alignItems: 'center' }}>
          <TotlText variant="sectionSubtitle" style={{ fontSize: 13, lineHeight: 18 }}>
            {subtitle}
          </TotlText>
        </View>

        {showInitialSpinner ? <CenteredSpinner loading /> : null}

        {error ? (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Couldn’t load leaderboard
            </TotlText>
            <TotlText variant="muted">{String((error as any)?.message ?? 'Unknown error')}</TotlText>
          </Card>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <Card>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              No leaderboard data yet
            </TotlText>
            <TotlText variant="muted">Pull to refresh.</TotlText>
          </Card>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <LeaderboardTable
            rows={rows}
            valueLabel={valueLabel}
            secondaryValueLabel={secondaryValueLabel}
            highlightUserId={userId}
            refreshing={refreshing}
            onRefresh={onRefresh}
            listRef={listRef}
            onPressRow={(row) => {
              setPlayerPicksUserId(String(row.user_id));
              setPlayerPicksUserName(String(row.name ?? 'Player'));
              setPlayerPicksOpen(true);
            }}
            style={{
              flex: 1,
              // Remove bottom rounding so it can visually run off-screen.
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              // Pull the table down slightly so the bottom edge isn't visible.
              marginBottom: -24,
            }}
          />
        ) : null}
        </View>
      </View>

      <LeaderboardPlayerPicksSheet
        open={playerPicksOpen}
        onClose={() => setPlayerPicksOpen(false)}
        gw={latestGw}
        userId={playerPicksUserId}
        userName={playerPicksUserName}
      />
    </Screen>
  );
}

