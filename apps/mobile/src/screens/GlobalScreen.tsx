import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import SectionTitle from '../components/home/SectionTitle';
import LeaderboardsTabs, { type LeaderboardsTab } from '../components/leaderboards/LeaderboardsTabs';
import LeaderboardsScopeToggle, { type LeaderboardsScope } from '../components/leaderboards/LeaderboardsScopeToggle';
import LeaderboardTable, { type LeaderboardRow } from '../components/leaderboards/LeaderboardTable';

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

  const { data: ranks } = useQuery({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });
  const latestGw = ranks?.latestGw ?? null;

  const { data: overall, isLoading: overallLoading, error: overallError } = useQuery({
    queryKey: ['leaderboards', 'overallView'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_v_ocp_overall').select('user_id, name, ocp');
      if (error) throw error;
      return (data ?? []) as OverallRow[];
    },
  });

  const { data: gwPoints, isLoading: gwPointsLoading, error: gwPointsError } = useQuery({
    queryKey: ['leaderboards', 'gwPointsView'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_v_gw_points').select('user_id, gw, points').order('gw', { ascending: true });
      if (error) throw error;
      return (data ?? []) as GwPointsRow[];
    },
  });

  const { data: friendIds } = useQuery({
    queryKey: ['leaderboards', 'miniLeagueFriendIds'],
    enabled: scope === 'friends',
    queryFn: async () => {
      const { leagues } = await api.listLeagues();
      const ids = new Set<string>();
      if (userId) ids.add(userId);
      const details = await Promise.all(leagues.map((l) => api.getLeague(String(l.id))));
      details.forEach((d) => d.members.forEach((m) => ids.add(String(m.id))));
      return ids;
    },
  });

  const nameByUserId = React.useMemo(() => {
    const m = new Map<string, string>();
    (overall ?? []).forEach((o) => m.set(o.user_id, o.name ?? 'User'));
    return m;
  }, [overall]);

  const filterScope = React.useCallback(
    (rows: LeaderboardRow[]) => {
      if (scope !== 'friends') return rows;
      const set = friendIds ?? new Set<string>();
      if (!set.size) return rows;
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

  const rows: LeaderboardRow[] = React.useMemo(() => {
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

  const subtitle = React.useMemo(() => {
    const who = scope === 'friends' ? 'Mini League Friends' : 'All Players';
    if (tab === 'overall') return `${who} since the start of the season`;
    if (tab === 'form5') return latestGw && latestGw >= 5 ? `${who} who completed the last 5 Gameweeks` : `${who} (need 5 completed GWs)`;
    if (tab === 'form10') return latestGw && latestGw >= 10 ? `${who} who completed the last 10 Gameweeks` : `${who} (need 10 completed GWs)`;
    return latestGw ? `${who} who submitted for GW${latestGw}` : `${who} who submitted for the last GW`;
  }, [latestGw, scope, tab]);

  const valueLabel = tab === 'overall' ? 'OCP' : tab === 'gw' && latestGw ? `GW${latestGw}` : tab === 'form5' ? '5WK' : tab === 'form10' ? '10WK' : '—';

  const loading = overallLoading || gwPointsLoading;
  const error = (overallError as any) ?? (gwPointsError as any);

  return (
    <Screen fullBleed>
      <View style={{ flex: 1, padding: t.space[4], paddingBottom: t.space[8] }}>
        <SectionTitle>Leaderboard</SectionTitle>

        <View style={{ marginTop: 10 }}>
          <LeaderboardsTabs value={tab} onChange={setTab} />
        </View>

        <View style={{ marginTop: 16 }}>
          <LeaderboardsScopeToggle value={scope} onChange={setScope} />
        </View>

        <View style={{ marginTop: 14, marginBottom: 10, alignItems: 'center' }}>
          <TotlText variant="sectionSubtitle">{subtitle}</TotlText>
        </View>

        {loading ? <TotlText variant="muted">Loading…</TotlText> : null}

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
          <LeaderboardTable rows={rows} valueLabel={valueLabel} highlightUserId={userId} style={{ flex: 1 }} />
        ) : null}
      </View>
    </Screen>
  );
}

