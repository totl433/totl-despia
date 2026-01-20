import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Screen, TotlText, useTokens } from '@totl/ui';
import type { Fixture, GwResultRow, HomeSnapshot, LiveScore, LiveStatus } from '@totl/domain';

import { api } from '../lib/api';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';
import LeagueHeader from '../components/league/LeagueHeader';
import LeagueTabBar, { type LeagueTabKey } from '../components/league/LeagueTabBar';
import LeagueGwTable, { type LeagueGwTableRow } from '../components/league/LeagueGwTable';
import LeagueWinnerBanner from '../components/league/LeagueWinnerBanner';
import LeagueGwControlsRow from '../components/league/LeagueGwControlsRow';
import LeagueRulesSheet from '../components/league/LeagueRulesSheet';

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

