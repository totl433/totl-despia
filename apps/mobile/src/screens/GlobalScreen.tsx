import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import LeaderboardsTabs, { type LeaderboardsTab } from '../components/leaderboards/LeaderboardsTabs';
import LeaderboardsScopeToggle, { type LeaderboardsScope } from '../components/leaderboards/LeaderboardsScopeToggle';
import LeaderboardTable, { type LeaderboardRow } from '../components/leaderboards/LeaderboardTable';
import PageHeader from '../components/PageHeader';
import CenteredSpinner from '../components/CenteredSpinner';

type OverallRow = { user_id: string; name: string | null; ocp: number | null };
type GwPointsRow = { user_id: string; gw: number; points: number };

function byValueThenName(a: LeaderboardRow, b: LeaderboardRow) {
  if (b.value !== a.value) return b.value - a.value;
  return a.name.localeCompare(b.name);
}

export default function GlobalScreen() {
  const t = useTokens();

  const [tab, setTab] = React.useState<LeaderboardsTab>('gw');
  const [scope, setScope] = React.useState<LeaderboardsScope>('all');

  const { data: userData } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
  const userId = userData?.id ?? null;

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

  const refreshing = overallRefetching || gwPointsRefetching || ranksRefetching || friendIdsRefetching;
  const onRefresh = React.useCallback(() => {
    void Promise.all([
      refetchRanks(),
      refetchOverall(),
      refetchGwPoints(),
      scope === 'friends' ? refetchFriendIds() : Promise.resolve(),
    ]);
  }, [refetchFriendIds, refetchGwPoints, refetchOverall, refetchRanks, scope]);

  return (
    <Screen fullBleed>
      {/* No extra bottom padding here; the table handles its own scroll padding.
          This lets the leaderboard container run off-screen at the bottom (more obvious scroll affordance). */}
      <View style={{ flex: 1 }}>
        <PageHeader title="Performance" />

        <View style={{ flex: 1, paddingHorizontal: t.space[4], paddingBottom: 0 }}>

        <View style={{ marginTop: 10 }}>
          <LeaderboardsScopeToggle value={scope} onChange={setScope} />
        </View>

        <View style={{ marginTop: 12 }}>
          <LeaderboardsTabs value={tab} onChange={setTab} />
        </View>

        <View style={{ marginTop: 14, marginBottom: 10, alignItems: 'center' }}>
          <TotlText variant="sectionSubtitle">{subtitle}</TotlText>
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
    </Screen>
  );
}

