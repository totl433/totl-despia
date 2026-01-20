import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Screen, TotlText, useTokens } from '@totl/ui';
import type { Fixture, GwResultRow, HomeSnapshot, LiveScore, LiveStatus } from '@totl/domain';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';
import LeagueHeader from '../components/league/LeagueHeader';
import LeagueTabBar, { type LeagueTabKey } from '../components/league/LeagueTabBar';
import LeagueGwTable, { type LeagueGwTableRow } from '../components/league/LeagueGwTable';
import LeagueWinnerBanner from '../components/league/LeagueWinnerBanner';
import LeagueGwControlsRow from '../components/league/LeagueGwControlsRow';
import LeagueRulesSheet from '../components/league/LeagueRulesSheet';
import LeagueSeasonTable, { type LeagueSeasonRow } from '../components/league/LeagueSeasonTable';
import LeaguePointsFormToggle from '../components/league/LeaguePointsFormToggle';
import LeagueSeasonRulesSheet from '../components/league/LeagueSeasonRulesSheet';
import LeaguePillButton from '../components/league/LeaguePillButton';

export default function LeagueDetailScreen() {
  const route = useRoute<any>();
  const params = route.params as LeaguesStackParamList['LeagueDetail'];
  const t = useTokens();
  const navigation = useNavigation<any>();
  const [tab, setTab] = React.useState<LeagueTabKey>('gwTable');
  const [rulesOpen, setRulesOpen] = React.useState(false);

  type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
  type LeagueSummary = LeaguesResponse['leagues'][number];

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const leagueFromList = React.useMemo(() => {
    const list: LeagueSummary[] = leagues?.leagues ?? [];
    return list.find((l) => String(l.id) === String(params.leagueId)) ?? null;
  }, [leagues?.leagues, params.leagueId]);

  const avatarUri =
    leagueFromList && typeof leagueFromList.avatar === 'string' && leagueFromList.avatar.startsWith('http')
      ? leagueFromList.avatar
      : null;

  const { data: home } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });
  const viewingGw = home?.viewingGw ?? null;
  const currentGw = home?.currentGw ?? viewingGw ?? null;

  const [selectedGw, setSelectedGw] = React.useState<number | null>(null);
  React.useEffect(() => {
    // Keep the GW table in sync with the user’s viewing GW by default.
    // Only initialize once (don’t override manual selection).
    if (selectedGw !== null) return;
    if (typeof viewingGw === 'number') {
      setSelectedGw(viewingGw);
      return;
    }
    if (typeof currentGw === 'number') {
      setSelectedGw(currentGw);
    }
  }, [currentGw, selectedGw, viewingGw]);

  const availableGws = React.useMemo(() => {
    const maxGw = typeof currentGw === 'number' ? currentGw : typeof viewingGw === 'number' ? viewingGw : null;
    if (!maxGw || maxGw < 1) return [];
    return Array.from({ length: maxGw }, (_, i) => i + 1);
  }, [currentGw, viewingGw]);

  type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;
  const leagueId = String(params.leagueId);
  const { data: table, isLoading: tableLoading } = useQuery<LeagueTableResponse>({
    enabled: tab === 'gwTable' && typeof selectedGw === 'number',
    queryKey: ['leagueGwTable', leagueId, selectedGw],
    queryFn: () => api.getLeagueGwTable(leagueId, selectedGw as number),
  });

  type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
  const { data: leagueDetails } = useQuery<LeagueMembersResponse>({
    enabled: tab === 'season',
    queryKey: ['league', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });
  const members = leagueDetails?.members ?? [];

  const allFixturesFinished = React.useMemo(() => {
    if (tab !== 'gwTable') return false;
    if (!home) return false;
    if (typeof selectedGw !== 'number') return false;
    // If the user selects a past GW, treat it as finished (we won’t have fixtures for it in the home snapshot).
    if (typeof viewingGw === 'number' && selectedGw !== viewingGw) return true;

    const fixtures: Fixture[] = home.fixtures ?? [];
    if (!fixtures.length) return false;

    const outcomes = new Set<number>();
    (home.gwResults ?? []).forEach((r: GwResultRow) => {
      if (typeof r?.fixture_index === 'number') outcomes.add(r.fixture_index);
    });

    const liveByFixtureIndex = new Map<number, LiveScore>();
    (home.liveScores ?? []).forEach((ls: LiveScore) => {
      if (typeof ls?.fixture_index === 'number') liveByFixtureIndex.set(ls.fixture_index, ls);
    });

    const hasActiveGames = fixtures.some((f: Fixture) => {
      const ls = liveByFixtureIndex.get(f.fixture_index);
      const st: LiveStatus = ls?.status ?? 'SCHEDULED';
      return st === 'IN_PLAY' || st === 'PAUSED';
    });

    const allHaveResults = fixtures.every((f: Fixture) => outcomes.has(f.fixture_index));
    const allFinishedStatus = fixtures.every((f: Fixture) => {
      const ls = liveByFixtureIndex.get(f.fixture_index);
      return ls?.status === 'FINISHED';
    });

    return (allHaveResults || allFinishedStatus) && !hasActiveGames;
  }, [home, selectedGw, tab, viewingGw]);

  const seasonShowUnicorns = members.length >= 3;
  const [seasonShowForm, setSeasonShowForm] = React.useState(false);
  const [seasonRulesOpen, setSeasonRulesOpen] = React.useState(false);

  const seasonIsLateStartingLeague = React.useMemo(() => {
    const name = String(params.name ?? '');
    const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    return !!(name && !specialLeagues.includes(name) && !gw7StartLeagues.includes(name) && !gw8StartLeagues.includes(name));
  }, [params.name]);

  const seasonStartGw = React.useMemo(() => {
    const name = String(params.name ?? '');
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    if (gw7StartLeagues.includes(name)) return 7;
    if (gw8StartLeagues.includes(name)) return 8;
    return 1;
  }, [params.name]);

  const { data: seasonRows, isLoading: seasonLoading } = useQuery<LeagueSeasonRow[]>({
    enabled: tab === 'season' && members.length > 0 && typeof currentGw === 'number',
    queryKey: ['leagueSeasonTable', leagueId, currentGw, members.map((m: any) => String(m.id ?? '')).join(',')],
    queryFn: async () => {
      const memberIds = members.map((m: any) => String(m.id));
      const showUnicorns = memberIds.length >= 3;
      const latestGw = currentGw as number;

      const [fixturesRes, resultsRes] = await Promise.all([
        (supabase as any).from('app_fixtures').select('gw,fixture_index').gte('gw', seasonStartGw).lte('gw', latestGw),
        (supabase as any).from('app_gw_results').select('gw,fixture_index,result').gte('gw', seasonStartGw).lte('gw', latestGw),
      ]);
      if (fixturesRes.error) throw fixturesRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const fixtures: Array<{ gw: number; fixture_index: number }> = fixturesRes.data ?? [];
      const results: Array<{ gw: number; fixture_index: number; result: 'H' | 'D' | 'A' | string }> = resultsRes.data ?? [];

      const fixtureCountByGw = new Map<number, number>();
      fixtures.forEach((f) => fixtureCountByGw.set(f.gw, (fixtureCountByGw.get(f.gw) ?? 0) + 1));

      const resultCountByGw = new Map<number, number>();
      const outcomeByGwFixture = new Map<string, 'H' | 'D' | 'A'>();
      results.forEach((r) => {
        if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') return;
        resultCountByGw.set(r.gw, (resultCountByGw.get(r.gw) ?? 0) + 1);
        outcomeByGwFixture.set(`${r.gw}:${r.fixture_index}`, r.result);
      });

      const completeGws: number[] = [];
      for (let gw = seasonStartGw; gw <= latestGw; gw += 1) {
        const fixtureCount = fixtureCountByGw.get(gw) ?? 0;
        const resultCount = resultCountByGw.get(gw) ?? 0;
        if (fixtureCount > 0 && resultCount === fixtureCount) completeGws.push(gw);
      }
      if (completeGws.length === 0) return [];

      const picksRes = await (supabase as any)
        .from('app_picks')
        .select('user_id,gw,fixture_index,pick')
        .in('user_id', memberIds)
        .in('gw', completeGws);
      if (picksRes.error) throw picksRes.error;
      const picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }> =
        picksRes.data ?? [];

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      completeGws.forEach((g) => {
        const m = new Map<string, GwScore>();
        memberIds.forEach((uid) => m.set(uid, { user_id: uid, score: 0, unicorns: 0 }));
        perGw.set(g, m);
      });

      const picksByGwFixture = new Map<string, Array<{ user_id: string; pick: string }>>();
      picks.forEach((p) => {
        const key = `${p.gw}:${p.fixture_index}`;
        const arr = picksByGwFixture.get(key) ?? [];
        arr.push({ user_id: p.user_id, pick: p.pick });
        picksByGwFixture.set(key, arr);
      });

      completeGws.forEach((g) => {
        const gwMap = perGw.get(g)!;
        // Iterate fixtures for this GW using outcomes map keys for that GW
        const fixtureIdxs = fixtures.filter((f) => f.gw === g).map((f) => f.fixture_index);
        fixtureIdxs.forEach((idx) => {
          const out = outcomeByGwFixture.get(`${g}:${idx}`);
          if (!out) return;
          const these = picksByGwFixture.get(`${g}:${idx}`) ?? [];
          const correct = these.filter((p) => p.pick === out).map((p) => p.user_id);

          these.forEach((p) => {
            if (p.pick !== out) return;
            const row = gwMap.get(p.user_id);
            if (row) row.score += 1;
          });

          if (showUnicorns && correct.length === 1) {
            const uid = correct[0];
            const row = gwMap.get(uid);
            if (row) row.unicorns += 1;
          }
        });
      });

      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      const wins = new Map<string, number>();
      const draws = new Map<string, number>();
      const form = new Map<string, Array<'W' | 'D' | 'L'>>();
      memberIds.forEach((uid) => {
        mltPts.set(uid, 0);
        ocp.set(uid, 0);
        unis.set(uid, 0);
        wins.set(uid, 0);
        draws.set(uid, 0);
        form.set(uid, []);
      });

      completeGws.forEach((g) => {
        const rows = Array.from(perGw.get(g)!.values());
        rows.forEach((r) => {
          ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
          unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
        });

        rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
        if (!rows.length) return;
        const top = rows[0];
        const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);

        if (coTop.length === 1) {
          mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
          wins.set(top.user_id, (wins.get(top.user_id) ?? 0) + 1);
          form.get(top.user_id)!.push('W');
          rows.slice(1).forEach((r) => form.get(r.user_id)!.push('L'));
        } else {
          coTop.forEach((r) => {
            mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
            draws.set(r.user_id, (draws.get(r.user_id) ?? 0) + 1);
            form.get(r.user_id)!.push('D');
          });
          rows
            .filter((r) => !coTop.find((t) => t.user_id === r.user_id))
            .forEach((r) => form.get(r.user_id)!.push('L'));
        }
      });

      const nameById = new Map<string, string>();
      members.forEach((m: any) => nameById.set(String(m.id), String(m.name ?? 'User')));

      const out: LeagueSeasonRow[] = memberIds.map((uid) => ({
        user_id: uid,
        name: nameById.get(uid) ?? 'User',
        mltPts: mltPts.get(uid) ?? 0,
        ocp: ocp.get(uid) ?? 0,
        unicorns: unis.get(uid) ?? 0,
        wins: wins.get(uid) ?? 0,
        draws: draws.get(uid) ?? 0,
        form: form.get(uid) ?? [],
      }));

      out.sort((a, b) => b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name));
      return out;
    },
  });

  return (
    <Screen fullBleed>
      <LeagueHeader
        title={String(params.name ?? '')}
        subtitle={typeof selectedGw === 'number' ? `Gameweek ${selectedGw}` : viewingGw ? `Gameweek ${viewingGw}` : 'Gameweek'}
        avatarUri={avatarUri}
        onPressBack={() => navigation.goBack()}
        onPressMenu={() => {}}
      />

      <LeagueTabBar value={tab} onChange={setTab} />

      <View style={{ flex: 1, padding: t.space[4] }}>
        {tab === 'gwTable' ? (
          <>
            {table?.rows?.length && allFixturesFinished ? (
              <LeagueWinnerBanner
                winnerName={String(table.rows?.[0]?.name ?? '')}
                isDraw={
                  Number(table.rows?.[0]?.score ?? 0) === Number(table.rows?.[1]?.score ?? -1) &&
                  Number(table.rows?.[0]?.unicorns ?? 0) === Number(table.rows?.[1]?.unicorns ?? -1)
                }
              />
            ) : null}

            {tableLoading ? <TotlText variant="muted">Loading…</TotlText> : null}

            <LeagueGwTable
              rows={(table?.rows ?? []) as LeagueGwTableRow[]}
              showUnicorns={Number(table?.totalMembers ?? 0) >= 3}
              submittedCount={typeof table?.submittedCount === 'number' ? table.submittedCount : null}
              totalMembers={typeof table?.totalMembers === 'number' ? table.totalMembers : null}
            />

            <LeagueGwControlsRow
              availableGws={availableGws}
              selectedGw={selectedGw}
              onChangeGw={setSelectedGw}
              onPressRules={() => setRulesOpen(true)}
            />

            <LeagueRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
          </>
        ) : tab === 'season' ? (
          <>
            <LeagueSeasonTable
              rows={seasonRows ?? []}
              loading={seasonLoading}
              showForm={seasonShowForm}
              showUnicorns={seasonShowUnicorns}
              isLateStartingLeague={seasonIsLateStartingLeague}
            />

            <View
              style={{
                marginTop: t.space[4],
                marginBottom: t.space[2],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <LeaguePointsFormToggle showForm={seasonShowForm} onToggle={setSeasonShowForm} />
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }} />
              <LeaguePillButton label="Rules" onPress={() => setSeasonRulesOpen(true)} />
            </View>

            <LeagueSeasonRulesSheet
              open={seasonRulesOpen}
              onClose={() => setSeasonRulesOpen(false)}
              isLateStartingLeague={seasonIsLateStartingLeague}
            />
          </>
        ) : (
          <TotlText variant="muted">
            {tab === 'chat'
              ? 'Chat tab (coming next).'
              : tab === 'predictions'
                ? 'Predictions tab (coming).'
                : 'Season tab (coming).'}
          </TotlText>
        )}
      </View>
    </Screen>
  );
}

