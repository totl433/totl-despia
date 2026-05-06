import React, { type PropsWithChildren } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Screen, TotlText, useTokens } from '@totl/ui';
import type { UserStatsData } from '@totl/domain';

import { api } from '../../lib/api';
import type { GameweekStreakRow } from '../../lib/gameweekStreakCount';
import { getLeaderboardDisplayGwFromSnapshot } from '../../lib/gameweekState';
import { inferUserPlayedGwSequence } from '../../lib/inferUserPlayedGwSequence';
import {
  buildWeeklyParFromLeaderboardGwPoints,
  capGameweekStreakRowsAtLastCompleted,
  fetchAppGwPointsPaged,
  mergeGameweekStreakWithLeaderboardGwPoints,
  streakFallbackFromWeeklyPar,
} from '../../lib/profileStreakRows';
import {
  fetchLeaguePickAccuracyPct,
  formatCorrectRateVsLeague,
} from '../../lib/predictionLeagueAverage';
import { computeMonthlyWinnerEndGwsDescending } from '../../lib/trophyCabinetBrowse';
import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';
import { getGameweekStateFromSnapshot } from '../../lib/gameweekState';
import StatsHeroVisual from '../../components/profileStats/StatsHeroVisual';
import StatsGameweekStreakStrip from '../../components/profileStats/StatsGameweekStreakStrip';
import StatsParChart, { WeeklyParChartToggle } from '../../components/profileStats/StatsParChart';
import StatsTeamStatCard from '../../components/profileStats/StatsTeamStatCard';
import StatsTrophyCabinet from '../../components/profileStats/StatsTrophyCabinet';
import { useGameweekTrophyWinsFromLeaderboardApi } from '../../hooks/useGameweekTrophyWinsFromLeaderboardApi';
import usePopupCards from '../../hooks/usePopupCards';

/** Web-style stat card: white surface, soft shadow, minimal chrome. */
function StatCard({ children, style }: PropsWithChildren<{ style?: object }>) {
  const t = useTokens();
  return (
    <View
      style={[
        {
          borderRadius: 16,
          backgroundColor: t.color.surface,
          padding: 20,
          shadowColor: '#0F172A',
          shadowOpacity: 0.07,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        },
        style,
      ]}
    >
      {children as any}
    </View>
  );
}

/** Same stack as web `StatCard` metric rows (slate palette). */
function WebStatMetricStack({
  label,
  value,
  subcopy,
  labelColor = '#545C6C',
  subcopyColor = '#717C91',
}: {
  label: string;
  value: string;
  subcopy: string;
  labelColor?: string;
  subcopyColor?: string;
}) {
  return (
    <>
      <TotlText style={{ fontSize: 14, fontWeight: '600', color: labelColor, marginBottom: 8, lineHeight: 20 }}>
        {label}
      </TotlText>
      <TotlText
        style={{
          fontSize: 24,
          fontWeight: '700',
          color: '#222B3C',
          lineHeight: 34,
          paddingTop: 2,
          paddingBottom: 2,
          marginBottom: 4,
        }}
      >
        {value}
      </TotlText>
      <TotlText style={{ fontSize: 14, fontWeight: '400', color: subcopyColor, lineHeight: 22, marginTop: 8 }}>
        {subcopy}
      </TotlText>
    </>
  );
}

export default function ProfileStatsScreen() {
  const t = useTokens();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const { openManualResultsScoreSheetThenResults, openTrophyCabinetPersonalWinners } = usePopupCards();
  const lastAutoRefreshedGwRef = React.useRef<number | null>(null);
  const [parChartShowComplex, setParChartShowComplex] = React.useState(false);

  const backAction = (
    <Pressable
      onPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
          return;
        }
        navigation.navigate('Tabs', { screen: 'Global' });
      }}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Ionicons name="chevron-back" size={20} color={t.color.muted} />
    </Pressable>
  );

  const homeSnapshotQ = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });

  const { data: userData, isLoading: authUserLoading } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
  const userId = userData?.id ?? null;

  const statsQ = useQuery({
    queryKey: ['profile-stats', userId ?? 'pending'],
    queryFn: () => api.getProfileStats(),
    enabled: !!userId,
  });

  const stats = statsQ.data ?? null;
  const fieldAvgFromApi =
    typeof stats?.correctPredictionFieldAvgPct === 'number' ? stats.correctPredictionFieldAvgPct : null;

  const leaguePickAvgQ = useQuery({
    queryKey: ['predictionLeaguePickAvg', 'v1'],
    queryFn: fetchLeaguePickAccuracyPct,
    enabled:
      stats != null && typeof stats.correctPredictionRate === 'number' && fieldAvgFromApi == null,
    staleTime: 10 * 60_000,
  });

  const ranksQ = useQuery({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });

  const activeLeaderboardGw = React.useMemo(() => {
    const snap = homeSnapshotQ.data;
    if (!snap) return null;
    return getLeaderboardDisplayGwFromSnapshot({
      viewingGw: snap.viewingGw ?? null,
      currentGw: snap.currentGw ?? null,
      latestCompletedGw: ranksQ.data?.latestGw ?? null,
      fixtures: snap.fixtures ?? [],
      liveScores: snap.liveScores ?? [],
    });
  }, [homeSnapshotQ.data, ranksQ.data?.latestGw]);

  const gwPointsQ = useQuery({
    queryKey: ['leaderboards', 'gwPointsView', 'paged-v2'],
    queryFn: fetchAppGwPointsPaged,
  });

  const liveGwTrophyWins = useGameweekTrophyWinsFromLeaderboardApi(userId, gwPointsQ.data);

  const gwLiveTableQ = useQuery({
    enabled: typeof activeLeaderboardGw === 'number' && !!userId,
    queryKey: ['leaderboards', 'gwLiveTable', activeLeaderboardGw],
    queryFn: () => api.getGlobalGwLiveTable(activeLeaderboardGw as number),
  });

  const myLiveGwScore = React.useMemo(() => {
    if (!userId || typeof activeLeaderboardGw !== 'number') return null;
    const mine = (gwLiveTableQ.data?.rows ?? []).find((r) => String(r.user_id) === String(userId));
    return mine != null ? Number(mine.score ?? 0) : null;
  }, [activeLeaderboardGw, gwLiveTableQ.data?.rows, userId]);

  const streakRowsOverride = React.useMemo(() => {
    const st = statsQ.data ?? null;
    if (!st || !userId || gwPointsQ.data === undefined) return undefined;
    return mergeGameweekStreakWithLeaderboardGwPoints({
      stats: st,
      userId,
      gwPointsRows: gwPointsQ.data,
      activeLeaderboardGw,
      myLiveGwScore,
    }) ?? undefined;
  }, [statsQ.data, userId, gwPointsQ.data, activeLeaderboardGw, myLiveGwScore]);

  const streakRowsForStrip = React.useMemo(() => {
    const st = stats;
    let rows: GameweekStreakRow[] | null = null;

    if (streakRowsOverride !== undefined && streakRowsOverride != null) rows = streakRowsOverride;
    else if (!st) return null;
    else if (st.gameweekStreak && st.gameweekStreak.length > 0) rows = st.gameweekStreak;
    else rows = streakFallbackFromWeeklyPar(st);

    return capGameweekStreakRowsAtLastCompleted(rows, st.lastCompletedGw);
  }, [stats, streakRowsOverride]);

  /** Same pool as monthly/global leaderboard — not BFF `weeklyParData` (can truncate). */
  const weeklyParFromLeaderboard = React.useMemo(() => {
    if (!userId || !gwPointsQ.data?.length) return null;
    const playedSet = new Set(inferUserPlayedGwSequence(gwPointsQ.data, userId));
    if (
      typeof activeLeaderboardGw === 'number' &&
      myLiveGwScore != null &&
      Number.isFinite(myLiveGwScore)
    ) {
      playedSet.add(activeLeaderboardGw);
    }
    const gwSequence = [...playedSet].sort((a, b) => a - b);
    if (!gwSequence.length) return null;
    return buildWeeklyParFromLeaderboardGwPoints({
      gwPointsRows: gwPointsQ.data,
      userId,
      gwSequence,
      activeLeaderboardGw,
      myLiveGwScore,
    });
  }, [userId, gwPointsQ.data, activeLeaderboardGw, myLiveGwScore]);

  const refreshing =
    homeSnapshotQ.isRefetching ||
    statsQ.isRefetching ||
    gwPointsQ.isRefetching ||
    ranksQ.isRefetching ||
    gwLiveTableQ.isRefetching;
  const onRefresh = React.useCallback(() => {
    void Promise.all([
      homeSnapshotQ.refetch(),
      statsQ.refetch(),
      gwPointsQ.refetch(),
      ranksQ.refetch(),
      gwLiveTableQ.refetch(),
      leaguePickAvgQ.refetch(),
      queryClient.invalidateQueries({ queryKey: ['leaderboards', 'gwLiveTable'] }),
    ]);
  }, [gwLiveTableQ, gwPointsQ, homeSnapshotQ, leaguePickAvgQ, queryClient, ranksQ, statsQ]);

  React.useEffect(() => {
    const snap = homeSnapshotQ.data ?? null;
    const stats = statsQ.data ?? null;
    if (!snap || !stats) return;

    const state = getGameweekStateFromSnapshot({
      fixtures: snap.fixtures ?? [],
      liveScores: snap.liveScores ?? [],
      hasSubmittedViewingGw: !!snap.hasSubmittedViewingGw,
    });

    if (state === 'LIVE') return;
    if (state !== 'RESULTS_PRE_GW') return;

    const lastCompleted = stats.lastCompletedGw ?? null;
    if (!lastCompleted) return;

    if (lastAutoRefreshedGwRef.current === lastCompleted) return;
    lastAutoRefreshedGwRef.current = lastCompleted;
    void statsQ.refetch();
  }, [homeSnapshotQ.data, statsQ]);

  /** Gameweek hero — same flow as streak strip (“View Round Up”). */
  const openHeroRoundUp = React.useCallback(() => {
    const st = statsQ.data as UserStatsData | null;
    const gw = st?.lastCompletedGw;
    if (typeof gw !== 'number') return;
    openManualResultsScoreSheetThenResults(gw);
  }, [openManualResultsScoreSheetThenResults, statsQ.data]);

  /** Main tab Global screen (shell title “2025/26”) — matches tab bar behaviour */
  const openLeaderboards2526 = React.useCallback(() => {
    navigation.navigate('Tabs', { screen: 'Global', params: { resetKey: Date.now() } });
  }, [navigation]);

  const weeklyPar = React.useMemo(
    () =>
      weeklyParFromLeaderboard ??
      (Array.isArray(stats?.weeklyParData) ? stats!.weeklyParData! : []),
    [weeklyParFromLeaderboard, stats]
  );

  /** GW where your margin above the pool average was largest (same rows as the weekly chart). */
  const bestVsAvgWeek = React.useMemo(() => {
    if (weeklyPar.length === 0) return null;
    let bestGw = weeklyPar[0]!.gw;
    let bestMargin = weeklyPar[0]!.userPoints - weeklyPar[0]!.averagePoints;
    for (let i = 1; i < weeklyPar.length; i++) {
      const d = weeklyPar[i]!;
      const margin = d.userPoints - d.averagePoints;
      if (margin > bestMargin) {
        bestMargin = margin;
        bestGw = d.gw;
      }
    }
    return { gw: bestGw, margin: bestMargin };
  }, [weeklyPar]);

  const resolvedFieldAvgPct = fieldAvgFromApi ?? leaguePickAvgQ.data ?? null;

  const correctPredictionContextLine =
    stats != null &&
    typeof stats.correctPredictionRate === 'number' &&
    resolvedFieldAvgPct != null &&
    Number.isFinite(resolvedFieldAvgPct)
      ? formatCorrectRateVsLeague(stats.correctPredictionRate, resolvedFieldAvgPct)
      : null;

  const needsLeagueAvgFetch =
    stats != null && typeof stats.correctPredictionRate === 'number' && fieldAvgFromApi == null;

  const gameweekTrophyCount = React.useMemo(() => {
    const server = stats?.trophyCabinet?.gameweekPodiums ?? 0;
    if (liveGwTrophyWins.pending) return server;
    return Math.max(server, liveGwTrophyWins.wins);
  }, [liveGwTrophyWins.pending, liveGwTrophyWins.wins, stats?.trophyCabinet?.gameweekPodiums]);
  const monthlyTrophyCount = stats?.trophyCabinet?.monthlyPodiums ?? 0;

  /** Align month completion cutoff with stats + home ranks (highlightGw can edge ahead of lastCompletedGw). */
  const statsLcResolved = React.useMemo(() => {
    const candidates = [stats?.lastCompletedGw, stats?.highlightGw, ranksQ.data?.latestGw].filter(
      (n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 1
    );
    return candidates.length ? Math.max(...candidates) : null;
  }, [stats?.highlightGw, stats?.lastCompletedGw, ranksQ.data?.latestGw]);

  const monthlyWinnerEndGwsDesc = React.useMemo(() => {
    if (!userId || !gwPointsQ.data?.length || statsLcResolved == null) return [];
    return computeMonthlyWinnerEndGwsDescending({
      gwPointsRows: gwPointsQ.data,
      userId,
      lastCompletedGw: statsLcResolved,
    });
  }, [gwPointsQ.data, statsLcResolved, userId]);

  const handleGameweekTrophyPress = React.useCallback(() => {
    if (liveGwTrophyWins.pending) {
      Alert.alert('Loading', 'Still syncing gameweek trophies. Try again in a moment.');
      return;
    }
    if (!liveGwTrophyWins.winningGwsDescending.length) {
      Alert.alert('Not available', 'Could not resolve gameweek wins yet. Pull down to refresh.');
      return;
    }
    openTrophyCabinetPersonalWinners('gameweek', liveGwTrophyWins.winningGwsDescending);
  }, [liveGwTrophyWins.pending, liveGwTrophyWins.winningGwsDescending, openTrophyCabinetPersonalWinners]);

  const handleMonthlyTrophyPress = React.useCallback(() => {
    if (!monthlyWinnerEndGwsDesc.length) {
      Alert.alert('Not available', 'Could not resolve monthly trophy periods yet. Pull down to refresh.');
      return;
    }
    openTrophyCabinetPersonalWinners('monthly', monthlyWinnerEndGwsDesc);
  }, [monthlyWinnerEndGwsDesc, openTrophyCabinetPersonalWinners]);

  const showInitialSpinner =
    authUserLoading || (!!userId && statsQ.isLoading && !statsQ.data && !statsQ.error);
  if (showInitialSpinner) {
    return (
      <Screen fullBleed>
        <PageHeader title="Stats" leftAction={backAction} />
        <CenteredSpinner loading />
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      <PageHeader title="Stats" leftAction={backAction} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[3],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {statsQ.error ? (
          <StatCard style={{ marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)' }}>
            <TotlText style={{ fontWeight: '900', fontSize: 18, marginBottom: 6 }}>Couldn&apos;t load stats</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 14 }}>
              {String((statsQ.error as any)?.message ?? 'Unknown error')}
            </TotlText>
            <Button title="Retry" onPress={() => onRefresh()} loading={refreshing} />
          </StatCard>
        ) : null}

        {streakRowsForStrip && streakRowsForStrip.length > 0 ? (
          <>
            <StatCard style={{ marginBottom: 0 }}>
              <StatsGameweekStreakStrip
                rows={streakRowsForStrip}
                nestInsideStatCard
                onViewScoresheet={openManualResultsScoreSheetThenResults}
              />
            </StatCard>
            <View style={{ height: 16 }} />
          </>
        ) : null}

        <StatsHeroVisual
          stats={stats}
          onPressViewRoundUp={stats?.lastCompletedGw ? openHeroRoundUp : undefined}
          onPressViewLeaderboards={openLeaderboards2526}
        />

        <View style={{ height: 16 }} />
        <StatCard style={{ marginBottom: 16 }}>
          <TotlText variant="muted" style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
            Correct prediction rate
          </TotlText>
          <TotlText style={{ marginTop: 14, fontSize: 44, lineHeight: 48, fontWeight: '900', color: t.color.text }}>
            {typeof stats?.correctPredictionRate === 'number' ? `${stats.correctPredictionRate.toFixed(0)}%` : '—'}
          </TotlText>
          {correctPredictionContextLine ? (
            <TotlText variant="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
              {correctPredictionContextLine}
            </TotlText>
          ) : needsLeagueAvgFetch && leaguePickAvgQ.isFetching ? (
            <TotlText variant="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
              Comparing to overall average…
            </TotlText>
          ) : null}
        </StatCard>

        {stats?.mostCorrectTeam ? (
          <StatCard style={{ marginBottom: 16 }}>
            <StatsTeamStatCard
              eyebrow="Most correctly predicted team"
              teamCode={stats.mostCorrectTeam.code}
              teamName={stats.mostCorrectTeam.name}
              percentage={stats.mostCorrectTeam.percentage}
              valueTone="success"
            />
          </StatCard>
        ) : null}

        {stats?.mostIncorrectTeam ? (
          <StatCard style={{ marginBottom: 16 }}>
            <StatsTeamStatCard
              eyebrow="Most incorrectly picked team"
              teamCode={stats.mostIncorrectTeam.code}
              teamName={stats.mostIncorrectTeam.name}
              percentage={stats.mostIncorrectTeam.percentage}
              valueTone="danger"
            />
          </StatCard>
        ) : null}

        {weeklyPar.length > 0 ? (
          <>
            <StatCard style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <TotlText style={{ flex: 1, fontSize: 14, fontWeight: '600', color: t.color.text, paddingRight: 10 }}>
                  Weekly Performance vs Average
                </TotlText>
                <WeeklyParChartToggle complex={parChartShowComplex} onChange={setParChartShowComplex} />
              </View>
              <StatsParChart
                weeklyData={weeklyPar}
                latestGw={stats?.lastCompletedGw ?? null}
                showInfo={parChartShowComplex}
                nestInsideStatCard
              />
              {(() => {
                const above = weeklyPar.filter((d) => d.userPoints > d.averagePoints).length;
                const pct = weeklyPar.length ? Math.round((above / weeklyPar.length) * 100) : 0;
                return (
                  <View style={{ marginTop: 10 }}>
                    <TotlText style={{ fontSize: 14, fontWeight: '700', color: t.color.text }}>
                      You perform above average {pct}% of the time.
                    </TotlText>
                  </View>
                );
              })()}
            </StatCard>
            {(() => {
              const totalSwing = weeklyPar.reduce((sum, d) => sum + (d.userPoints - d.averagePoints), 0);
              const swingText =
                totalSwing >= 0 ? `+${totalSwing.toFixed(1)}` : `${totalSwing.toFixed(1)}`;
              if (swingText === '0.0') return null;
              return (
                <StatCard style={{ marginBottom: 16, padding: 24 }}>
                  <WebStatMetricStack
                    label="Total Swing"
                    value={swingText}
                    subcopy="Your total points difference from the average across all gameweeks"
                    labelColor="#475569"
                    subcopyColor="#64748B"
                  />
                </StatCard>
              );
            })()}
            {bestVsAvgWeek ? (
              <StatCard style={{ marginBottom: 16, padding: 24 }}>
                <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
                  Best vs average week
                </TotlText>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <TotlText
                    style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: '#1E293B',
                      lineHeight: 32,
                      paddingTop: 2,
                      paddingBottom: 2,
                    }}
                  >
                    {bestVsAvgWeek.margin >= 0
                      ? `+${bestVsAvgWeek.margin.toFixed(1)}`
                      : `${bestVsAvgWeek.margin.toFixed(1)}`}
                  </TotlText>
                  <TotlText style={{ fontSize: 14, fontWeight: '400', color: '#475569', marginLeft: 8, lineHeight: 20 }}>
                    {`on GW${bestVsAvgWeek.gw}`}
                  </TotlText>
                </View>
              </StatCard>
            ) : null}
          </>
        ) : null}

        {stats != null && stats.chaosIndex != null ? (
          <StatCard style={{ marginBottom: 16, padding: 24 }}>
            <WebStatMetricStack
              label="Chaos Index"
              value={`${Number(stats.chaosIndex).toFixed(2)}%`}
              subcopy="How often you pick an outcome that 25% or fewer players picked"
            />
          </StatCard>
        ) : null}

        {stats != null &&
        typeof stats.chaosTotalCount === 'number' &&
        stats.chaosTotalCount > 0 &&
        stats.chaosCorrectCount != null ? (
          <StatCard style={{ marginBottom: 16, padding: 24 }}>
            <WebStatMetricStack
              label="Chaos Index Success Rate"
              value={`${((stats.chaosCorrectCount / stats.chaosTotalCount) * 100).toFixed(2)}%`}
              subcopy="How often you're right when you pick an outcome that 25% or fewer players picked"
            />
          </StatCard>
        ) : null}

        <StatCard style={{ marginBottom: 16 }}>
          <StatsTrophyCabinet
            gameweekWins={gameweekTrophyCount}
            monthlyWins={monthlyTrophyCount}
            onPressGameweek={gameweekTrophyCount > 0 ? handleGameweekTrophyPress : undefined}
            onPressMonthly={monthlyTrophyCount > 0 ? handleMonthlyTrophyPress : undefined}
          />
        </StatCard>

        {stats?.bestSingleGw ? (
          <StatCard style={{ marginBottom: stats?.lowestSingleGw ? 16 : 24, padding: 24 }}>
            <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
              Best single Gameweek
            </TotlText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <TotlText
                style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: '#1E293B',
                  lineHeight: 32,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                {String(stats.bestSingleGw.points)}
              </TotlText>
              <TotlText style={{ fontSize: 14, fontWeight: '400', color: '#475569', marginLeft: 8, lineHeight: 20 }}>
                {`on GW${stats.bestSingleGw.gw}`}
              </TotlText>
            </View>
          </StatCard>
        ) : null}

        {stats?.lowestSingleGw ? (
          <StatCard style={{ marginBottom: 24, padding: 24 }}>
            <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
              Lowest single Gameweek
            </TotlText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <TotlText
                style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: '#1E293B',
                  lineHeight: 32,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                {String(stats.lowestSingleGw.points)}
              </TotlText>
              <TotlText style={{ fontSize: 14, fontWeight: '400', color: '#475569', marginLeft: 8, lineHeight: 20 }}>
                {`on GW${stats.lowestSingleGw.gw}`}
              </TotlText>
            </View>
          </StatCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
