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
  const { data: avatarRow } = useQuery<{ avatar_url: string | null } | null>({
    enabled: !!userId,
    queryKey: ['profile-avatar-url', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('avatar_url').eq('id', userId).maybeSingle();
      if (error && (error as any).code !== 'PGRST116') throw error;
      if (!data) return null;
      return { avatar_url: typeof (data as any).avatar_url === 'string' ? (data as any).avatar_url : null };
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

    if (tab === 'overall') {
      const r = overall
        .map((o) => ({ user_id: o.user_id, name: o.name ?? 'User', value: Math.round(Number(o.ocp ?? 0)) }))
        .sort(byValueThenName);
      return filterScope(r);
    }

    if (tab === 'form5') return filterScope(computeFormRows(5));
    if (tab === 'form10') return filterScope(computeFormRows(10));

    // GW tab: last completed gameweek
    if (!gw) return [];
    const pts = gwPoints
      .filter((p) => p.gw === gw)
      .map((p) => ({ user_id: p.user_id, name: nameByUserId.get(p.user_id) ?? 'User', value: Number(p.points ?? 0) }))
      .sort(byValueThenName);
    return filterScope(pts);
  }, [computeFormRows, filterScope, gwPoints, latestGw, nameByUserId, overall, tab]);

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

  const valueLabel = tab === 'overall' ? 'OCP' : tab === 'gw' && latestGw ? `GW${latestGw}` : tab === 'form5' ? '5WK' : tab === 'form10' ? '10WK' : '—';
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
        scope === 'friends' ? withTimeout(refetchFriendIds(), 8000) : Promise.resolve(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [pullRefreshing, refetchFriendIds, refetchGwPoints, refetchOverall, refetchRanks, scope]);

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
          leftAction={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setScope((prev) => (prev === 'all' ? 'friends' : 'all'))}
                accessibilityRole="button"
                accessibilityLabel={scope === 'friends' ? 'Filter active: Mini League Friends' : 'Filter active: All Players'}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  borderWidth: scope === 'friends' ? 2 : 1.5,
                  borderColor: scope === 'friends' ? '#1C8376' : t.color.border,
                  backgroundColor: scope === 'friends' ? 'rgba(28,131,118,0.10)' : '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.86 : 1,
                })}
              >
                <Ionicons name="funnel" size={16} color={scope === 'friends' ? '#1C8376' : t.color.muted} />
              </Pressable>
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
            </View>
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

