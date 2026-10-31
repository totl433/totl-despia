import React, { type PropsWithChildren } from 'react';
import { Alert, InteractionManager, Pressable, ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Screen, TotlText, useTokens } from '@totl/ui';
import type { UserStatsData } from '@totl/domain';

import { api } from '../../lib/api';
import {
  buildLiveSeasonStreakRows,
  mergeCareerAndLiveSeasonStreak,
  scoreUserPicksByGw,
  scoreUserPicksForGwFromLive,
  shortSeasonLabel,
  type GameweekStreakRow,
} from '../../lib/gameweekStreakCount';
import { getLeaderboardDisplayGwFromSnapshot } from '../../lib/gameweekState';
import { inferUserPlayedGwSequence } from '../../lib/inferUserPlayedGwSequence';
import {
  buildWeeklyParFromLeaderboardGwPoints,
  capGameweekStreakRowsAtLastCompleted,
  fetchAppGwPointsPaged,
  mergeGameweekStreakWithLeaderboardGwPoints,
  streakFallbackFromWeeklyPar,
  tagStreakRowsWithSeason,
} from '../../lib/profileStreakRows';
import { useViewerSeason } from '../../lib/useViewerSeason';
import { SEASON_2025_26_END_GW, SEASON_2025_26_LABEL, SEASON_2026_27_LABEL } from '../../lib/leaderboardMonths';

/** Same fallback as Predictions if prefs/runtime have no current season id. */
const LIVE_SEASON_FALLBACK_ID = 'e0a58f84-9575-4b6b-adca-320defc04b46';
import { fetchCareerPickStats } from '../../lib/profileCareerPickStatsFetch';
import {
  fetchLeaguePickAccuracyPct,
  formatCorrectRateVsLeague,
} from '../../lib/predictionLeagueAverage';
import {
  buildPersonalWinnerPayloadFromGwPoints,
  computeMonthlyWinnerEndGwsDescending,
  type PersonalWinnerBrowsePayload,
} from '../../lib/trophyCabinetBrowse';
import { fetchSeasonChampionBundle } from '../../lib/championEligibility';
import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';
import {
  getGameweekStateFromSnapshot,
  isGwFullyCompleteForStatsRoundUp,
  type StatsGwCompletionContext,
} from '../../lib/gameweekState';
import { supabase } from '../../lib/supabase';
import StatsHeroVisual from '../../components/profileStats/StatsHeroVisual';
import StatsGameweekStreakStrip from '../../components/profileStats/StatsGameweekStreakStrip';
import StatsPreviousSeasonsCard, {
  buildSeasonArchiveStats,
} from '../../components/profileStats/StatsPreviousSeasonsCard';
import StatsParChart, { WeeklyParChartToggle } from '../../components/profileStats/StatsParChart';
import StatsTeamStatCard from '../../components/profileStats/StatsTeamStatCard';
import StatsTrophyCabinet from '../../components/profileStats/StatsTrophyCabinet';
import PlayersStatSurface from '../../components/profileStats/PlayersStatSurface';
import StatsPlayersTab from '../../components/profileStats/StatsPlayersTab';
import UnderlineTabs from '../../components/UnderlineTabs';
import { PLAYERS_FONTS } from '../../components/retroPlayers/playersTheme';
import { readSharedPlayersScores } from '../../lib/retroPlayers/scores';
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
  const {
    seasonLabel: viewerSeasonLabel,
    seasonId: viewerSeasonId,
    useSeasonStack,
    isNewSeasonFresh,
  } = useViewerSeason();
  const { openManualResultsScoreSheetThenResults, openTrophyCabinetPersonalWinners, openTrophyCabinetChampionCards } =
    usePopupCards();
  const lastAutoRefreshedGwRef = React.useRef<number | null>(null);
  const [parChartShowComplex, setParChartShowComplex] = React.useState(false);
  const [archiveSeasonLabel, setArchiveSeasonLabel] = React.useState<string | null>(null);
  const [statsTab, setStatsTab] = React.useState<'predictions' | 'players'>('predictions');

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
    staleTime: 15_000,
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
    staleTime: 2 * 60_000,
  });

  const stats = statsQ.data ?? null;
  const homeCurrentGw = homeSnapshotQ.data?.currentGw ?? null;
  /** Old BFF still returns 2025/26 GW38 while Home is already on this season's current_gw. */
  const leftoverPriorSeasonClient =
    typeof stats?.lastCompletedGw === 'number' &&
    typeof homeCurrentGw === 'number' &&
    stats.lastCompletedGw > homeCurrentGw;
  const needsLiveSeasonStreak = useSeasonStack || leftoverPriorSeasonClient;
  const liveSeasonLabel = needsLiveSeasonStreak
    ? viewerSeasonLabel && viewerSeasonLabel !== SEASON_2025_26_LABEL
      ? viewerSeasonLabel.trim()
      : SEASON_2026_27_LABEL
    : null;

  /** This-season chips only — user-scoped, so it does not wait on the heavy BFF stats payload. */
  const liveSeasonStreakQ = useQuery({
    enabled: !!userId && needsLiveSeasonStreak,
    queryKey: ['profile-stats', 'liveSeasonStreak', 'v4', userId, viewerSeasonId],
    staleTime: 60_000,
    queryFn: async () => {
      let seasonId = viewerSeasonId;
      if (!seasonId) {
        const runtime = await (supabase as any)
          .from('app_season_runtime')
          .select('current_season_id')
          .eq('id', 1)
          .maybeSingle();
        seasonId =
          (runtime.data?.current_season_id as string | null) || LIVE_SEASON_FALLBACK_ID;
      }
      const [pointsRes, submissionsRes, picksRes, resultsRes] = await Promise.all([
        (supabase as any)
          .from('app_v_season_gw_points')
          .select('gw, points')
          .eq('user_id', userId)
          .eq('season_id', seasonId),
        (supabase as any)
          .from('app_season_submissions')
          .select('gw')
          .eq('user_id', userId)
          .eq('season_id', seasonId),
        (supabase as any)
          .from('app_season_picks')
          .select('gw, fixture_index, pick')
          .eq('user_id', userId)
          .eq('season_id', seasonId),
        (supabase as any)
          .from('app_season_results')
          .select('gw, fixture_index, result')
          .eq('season_id', seasonId),
      ]);
      if (pointsRes.error) throw pointsRes.error;
      if (submissionsRes.error) throw submissionsRes.error;
      if (picksRes.error) throw picksRes.error;
      if (resultsRes.error) throw resultsRes.error;
      const computed = scoreUserPicksByGw(picksRes.data ?? [], resultsRes.data ?? []);
      const viewPoints = new Map<number, number>();
      for (const row of pointsRes.data ?? []) {
        const gw = Number(row.gw);
        if (!Number.isFinite(gw)) continue;
        viewPoints.set(gw, Number(row.points ?? 0));
      }
      const pointsByGw = computed.size > 0 ? computed : viewPoints;
      const played = new Set<number>(pointsByGw.keys());
      for (const row of submissionsRes.data ?? []) {
        const gw = Number(row.gw);
        if (Number.isFinite(gw) && gw >= 1) played.add(gw);
      }
      let lastResultGw: number | null = null;
      for (const row of resultsRes.data ?? []) {
        const gw = Number(row.gw);
        if (Number.isFinite(gw) && (lastResultGw == null || gw > lastResultGw)) lastResultGw = gw;
      }
      return {
        points: [...pointsByGw.entries()].map(([gw, points]) => ({ gw, points })),
        playedGws: [...played],
        lastResultGw,
        picks: (picksRes.data ?? []).map((row: { gw?: number; fixture_index?: number; pick?: string | null }) => ({
          gw: Number(row.gw),
          fixture_index: Number(row.fixture_index),
          pick: row.pick ?? null,
        })),
      };
    },
  });

  /** Pick rate + team cards across 25/26 and 26/27 — BFF payload is still one pile. */
  const careerPickStatsQ = useQuery({
    enabled: !!userId && needsLiveSeasonStreak,
    queryKey: ['profile-stats', 'careerPickStats', 'v4', userId, viewerSeasonId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let seasonId = viewerSeasonId;
      if (!seasonId) {
        const runtime = await (supabase as any)
          .from('app_season_runtime')
          .select('current_season_id')
          .eq('id', 1)
          .maybeSingle();
        seasonId =
          (runtime.data?.current_season_id as string | null) || LIVE_SEASON_FALLBACK_ID;
      }
      return fetchCareerPickStats({ userId: userId!, seasonId });
    },
  });

  const { data: playersScoresByUser, refetch: refetchPlayersScores } = useQuery({
    queryKey: ['players-shared-scores', userId],
    enabled: !!userId,
    queryFn: readSharedPlayersScores,
    staleTime: 60_000,
  });
  useFocusEffect(
    React.useCallback(() => {
      if (userId) void refetchPlayersScores();
    }, [refetchPlayersScores, userId])
  );
  const openPlayers = React.useCallback(() => {
    navigation.navigate('RetroTotlDailyPlayersFlow');
  }, [navigation]);

  /** Paging `app_v_gw_points` is heavy — wait until profile stats landed, then hydrate after animations. */
  const [deferLeaderboardHydration, setDeferLeaderboardHydration] = React.useState(false);
  React.useEffect(() => {
    setDeferLeaderboardHydration(false);
  }, [userId]);
  React.useEffect(() => {
    if (!statsQ.data || statsQ.error) return;
    const handle = InteractionManager.runAfterInteractions(() => setDeferLeaderboardHydration(true));
    return () => handle.cancel();
  }, [statsQ.data, statsQ.error]);

  const activeLastCompletedGw = leftoverPriorSeasonClient ? null : (stats?.lastCompletedGw ?? null);
  const heroStats = React.useMemo((): UserStatsData | null => {
    if (!stats) return null;
    const careerOverall = careerPickStatsQ.data?.overallPercentile;
    const next = leftoverPriorSeasonClient
      ? {
          ...stats,
          lastCompletedGw: null,
          highlightGw: homeCurrentGw,
          lastCompletedGwPercentile: null,
          overallPercentile: typeof careerOverall === 'number' ? careerOverall : null,
        }
      : { ...stats };
    if (typeof careerOverall === 'number') next.overallPercentile = careerOverall;
    return next;
  }, [stats, leftoverPriorSeasonClient, homeCurrentGw, careerPickStatsQ.data?.overallPercentile]);

  const statsRoundUpProbeGw = React.useMemo(() => {
    if (leftoverPriorSeasonClient && typeof homeCurrentGw === 'number' && homeCurrentGw > 0) {
      return homeCurrentGw;
    }
    const h = stats?.highlightGw;
    if (typeof h === 'number' && h > 0) return h;
    if (typeof homeCurrentGw === 'number' && homeCurrentGw > 0) return homeCurrentGw;
    return null;
  }, [stats?.highlightGw, homeCurrentGw, leftoverPriorSeasonClient]);

  /** Fixtures + live_scores for the headline GW — `lastCompletedGw` alone can be 36 while Monday’s match is still scheduled. */
  const homeRoundUpProbeQ = useQuery({
    queryKey: ['homeSnapshot', 'statsGwRoundUpProbe', statsRoundUpProbeGw],
    queryFn: () => api.getHomeSnapshot({ gw: statsRoundUpProbeGw! }),
    enabled: typeof statsRoundUpProbeGw === 'number' && statsRoundUpProbeGw > 0,
    staleTime: 15_000,
  });

  const statsGwCompletion = React.useMemo((): StatsGwCompletionContext | null => {
    const probe = homeRoundUpProbeQ.data;
    const currentGw = homeSnapshotQ.data?.currentGw ?? null;
    if (typeof statsRoundUpProbeGw !== 'number' || statsRoundUpProbeGw < 1) return null;
    return {
      currentGw,
      probeHome: probe
        ? {
            fixtures: probe.fixtures ?? [],
            liveScores: probe.liveScores ?? [],
            hasSubmittedViewingGw: !!probe.hasSubmittedViewingGw,
          }
        : null,
      probeGw: statsRoundUpProbeGw,
      probeLoading: homeRoundUpProbeQ.isLoading,
      lastCompletedGw: activeLastCompletedGw,
    };
  }, [
    homeRoundUpProbeQ.data,
    homeRoundUpProbeQ.isLoading,
    homeSnapshotQ.data?.currentGw,
    activeLastCompletedGw,
    statsRoundUpProbeGw,
  ]);

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
    staleTime: 30_000,
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
    enabled: !!userId && !!stats && deferLeaderboardHydration,
    staleTime: 3 * 60_000,
  });

  const gwLiveTableQ = useQuery({
    enabled: typeof activeLeaderboardGw === 'number' && !!userId,
    queryKey: ['leaderboards', 'gwLiveTable', activeLeaderboardGw],
    queryFn: () => api.getGlobalGwLiveTable(activeLeaderboardGw as number),
    staleTime: 15_000,
  });

  const liveGwTrophyWins = useGameweekTrophyWinsFromLeaderboardApi(userId, gwPointsQ.data, {
    substituteLiveGw: typeof activeLeaderboardGw === 'number' ? activeLeaderboardGw : null,
    substituteLiveRows: gwLiveTableQ.data?.rows ?? null,
  });

  const championTrophyQ = useQuery({
    queryKey: ['championTrophyCabinet', userId, homeSnapshotQ.data?.currentGw ?? null],
    queryFn: () => fetchSeasonChampionBundle(userId!, homeSnapshotQ.data?.currentGw ?? null),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const myLiveGwScore = React.useMemo(() => {
    if (!userId || typeof activeLeaderboardGw !== 'number') return null;
    const mine = (gwLiveTableQ.data?.rows ?? []).find((r) => String(r.user_id) === String(userId));
    return mine != null ? Number(mine.score ?? 0) : null;
  }, [activeLeaderboardGw, gwLiveTableQ.data?.rows, userId]);

  const clientLiveGwScore = React.useMemo(() => {
    const gw = typeof homeCurrentGw === 'number' && homeCurrentGw > 0 ? homeCurrentGw : null;
    const picks = liveSeasonStreakQ.data?.picks;
    const probe = homeRoundUpProbeQ.data ?? homeSnapshotQ.data;
    if (gw == null || !picks?.length || !probe) return null;
    return scoreUserPicksForGwFromLive({
      gw,
      picks,
      fixtures: probe.fixtures ?? [],
      liveScores: probe.liveScores ?? [],
    });
  }, [homeCurrentGw, homeRoundUpProbeQ.data, homeSnapshotQ.data, liveSeasonStreakQ.data?.picks]);

  /** Leftover last-season BFF live tables are pile A — prefer this season's live scores. */
  const resolvedLiveGwScore = leftoverPriorSeasonClient
    ? clientLiveGwScore ?? myLiveGwScore
    : myLiveGwScore ?? clientLiveGwScore;

  const streakRowsOverride = React.useMemo(() => {
    // Season-stack / leftover last-season BFF: don't overwrite 26/27 chips with pile-A points.
    if (useSeasonStack || leftoverPriorSeasonClient) return undefined;
    const st = statsQ.data ?? null;
    if (!st || !userId || gwPointsQ.data === undefined) return undefined;
    const liveSafe = isNewSeasonFresh
      ? { activeLeaderboardGw: null as number | null, myLiveGwScore: null as number | null }
      : { activeLeaderboardGw, myLiveGwScore };
    return mergeGameweekStreakWithLeaderboardGwPoints({
      stats: st,
      userId,
      gwPointsRows: gwPointsQ.data,
      activeLeaderboardGw: liveSafe.activeLeaderboardGw,
      myLiveGwScore: liveSafe.myLiveGwScore,
    }) ?? undefined;
  }, [
    statsQ.data,
    userId,
    gwPointsQ.data,
    activeLeaderboardGw,
    myLiveGwScore,
    isNewSeasonFresh,
    useSeasonStack,
    leftoverPriorSeasonClient,
  ]);

  const streakRowsForStrip = React.useMemo(() => {
    const st = stats;
    let rows: GameweekStreakRow[] | null = null;

    if (streakRowsOverride !== undefined && streakRowsOverride != null) rows = streakRowsOverride;
    else if (!st) return null;
    else if (st.gameweekStreak && st.gameweekStreak.length > 0) {
      rows = tagStreakRowsWithSeason(st.gameweekStreak, SEASON_2025_26_LABEL);
    } else rows = streakFallbackFromWeeklyPar(st, SEASON_2025_26_LABEL);

    const liveSeason = liveSeasonLabel;
    if (rows && liveSeason) {
      const liveData = liveSeasonStreakQ.data;
      const homeGw = typeof homeCurrentGw === 'number' && homeCurrentGw > 0 ? homeCurrentGw : null;
      const lastResultGw = liveData?.lastResultGw ?? null;
      let maxLiveGw = lastResultGw ?? (homeGw != null && homeGw > 1 ? homeGw - 1 : homeGw);
      const pointsByGw = new Map((liveData?.points ?? []).map((row) => [row.gw, row.points]));
      const played = new Set(liveData?.playedGws ?? []);
      const liveGw =
        typeof activeLeaderboardGw === 'number'
          ? activeLeaderboardGw
          : homeGw;
      if (!isNewSeasonFresh && typeof liveGw === 'number' && resolvedLiveGwScore != null) {
        pointsByGw.set(liveGw, resolvedLiveGwScore);
        played.add(liveGw);
        maxLiveGw = Math.max(maxLiveGw ?? 0, liveGw);
      } else if (homeGw != null && played.has(homeGw)) {
        maxLiveGw = Math.max(maxLiveGw ?? 0, homeGw);
      }
      const liveRows = buildLiveSeasonStreakRows({
        seasonLabel: liveSeason,
        pointsByGw,
        playedGws: played,
        maxGw: typeof maxLiveGw === 'number' && maxLiveGw > 0 ? maxLiveGw : 0,
      });
      rows = mergeCareerAndLiveSeasonStreak({
        careerRows: rows,
        liveSeasonLabel: liveSeason,
        priorSeasonLabel: SEASON_2025_26_LABEL,
        liveRows,
      });
    }
    if (
      rows &&
      liveSeason &&
      !isNewSeasonFresh &&
      resolvedLiveGwScore != null
    ) {
      const liveGw =
        typeof activeLeaderboardGw === 'number'
          ? activeLeaderboardGw
          : typeof homeCurrentGw === 'number'
            ? homeCurrentGw
            : null;
      if (typeof liveGw === 'number') {
        rows = rows.map((r) =>
          (r.seasonLabel?.trim() || '') === liveSeason && r.gw === liveGw
            ? { ...r, points: resolvedLiveGwScore }
            : r
        );
      }
    }

    return capGameweekStreakRowsAtLastCompleted(rows, activeLastCompletedGw, liveSeason);
  }, [
    stats,
    streakRowsOverride,
    useSeasonStack,
    liveSeasonLabel,
    viewerSeasonLabel,
    isNewSeasonFresh,
    activeLeaderboardGw,
    resolvedLiveGwScore,
    activeLastCompletedGw,
    liveSeasonStreakQ.data,
    homeCurrentGw,
  ]);

  /** 2025/26 closed-season OCP + rank for the archive card (light queries). */
  const closedSeasonStandingsQ = useQuery({
    enabled: !!userId,
    queryKey: ['profile-stats', 'closedSeasonStandings', userId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!userId) return null;
      const meRes = await supabase
        .from('app_v_ocp_overall')
        .select('user_id, ocp')
        .eq('user_id', userId)
        .maybeSingle();
      if (meRes.error) throw meRes.error;
      if (!meRes.data) return { ocp: null, rank: null, rankedPlayers: null, topPercent: null };

      const ocp = Math.round(Number((meRes.data as any).ocp ?? 0));
      const [betterRes, totalRes] = await Promise.all([
        supabase
          .from('app_v_ocp_overall')
          .select('user_id', { count: 'exact', head: true })
          .gt('ocp', ocp),
        supabase.from('app_v_ocp_overall').select('user_id', { count: 'exact', head: true }),
      ]);
      if (betterRes.error) throw betterRes.error;
      if (totalRes.error) throw totalRes.error;
      const better = betterRes.count ?? 0;
      const total = totalRes.count ?? 0;
      const rank = total > 0 ? better + 1 : null;
      const topPercent =
        rank != null && total > 0 ? Math.max(1, Math.min(99, Math.ceil((rank / total) * 100))) : null;
      return { ocp, rank, rankedPlayers: total || null, topPercent };
    },
  });

  const seasonArchiveRows = React.useMemo(
    () =>
      buildSeasonArchiveStats({
        closed2526: closedSeasonStandingsQ.data ?? null,
      }),
    [closedSeasonStandingsQ.data]
  );

  const selectedArchiveLabel = archiveSeasonLabel ?? seasonArchiveRows[0]?.seasonLabel ?? '2025/26';

  /** Same pool as monthly/global leaderboard — not BFF `weeklyParData` (can truncate). */
  const weeklyParFromLeaderboard = React.useMemo(() => {
    if (useSeasonStack) return null;
    if (!userId || !gwPointsQ.data?.length) return null;
    const playedSet = new Set(inferUserPlayedGwSequence(gwPointsQ.data, userId));
    const useLive = !isNewSeasonFresh && typeof activeLeaderboardGw === 'number' && myLiveGwScore != null;
    if (useLive) {
      playedSet.add(activeLeaderboardGw);
    }
    const gwSequence = [...playedSet].sort((a, b) => a - b);
    if (!gwSequence.length) return null;
    return buildWeeklyParFromLeaderboardGwPoints({
      gwPointsRows: gwPointsQ.data,
      userId,
      gwSequence,
      activeLeaderboardGw: useLive ? activeLeaderboardGw : null,
      myLiveGwScore: useLive ? myLiveGwScore : null,
    });
  }, [userId, gwPointsQ.data, activeLeaderboardGw, myLiveGwScore, isNewSeasonFresh, useSeasonStack]);

  const refreshing =
    homeSnapshotQ.isRefetching ||
    homeRoundUpProbeQ.isRefetching ||
    statsQ.isRefetching ||
    gwPointsQ.isRefetching ||
    ranksQ.isRefetching ||
    gwLiveTableQ.isRefetching ||
    championTrophyQ.isRefetching ||
    closedSeasonStandingsQ.isRefetching ||
    liveSeasonStreakQ.isRefetching ||
    careerPickStatsQ.isRefetching;
  const onRefresh = React.useCallback(() => {
    void Promise.all([
      homeSnapshotQ.refetch(),
      homeRoundUpProbeQ.refetch(),
      statsQ.refetch(),
      gwPointsQ.refetch(),
      ranksQ.refetch(),
      gwLiveTableQ.refetch(),
      leaguePickAvgQ.refetch(),
      closedSeasonStandingsQ.refetch(),
      liveSeasonStreakQ.refetch(),
      careerPickStatsQ.refetch(),
      refetchPlayersScores(),
      queryClient.invalidateQueries({ queryKey: ['leaderboards', 'gwLiveTable'] }),
      queryClient.invalidateQueries({ queryKey: ['championTrophyCabinet'] }),
    ]);
  }, [
    closedSeasonStandingsQ,
    gwLiveTableQ,
    gwPointsQ,
    homeRoundUpProbeQ,
    homeSnapshotQ,
    leaguePickAvgQ,
    liveSeasonStreakQ,
    careerPickStatsQ,
    queryClient,
    ranksQ,
    refetchPlayersScores,
    statsQ,
  ]);

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

  /** Latest completed week only — not every old GW on the streak. */
  const openHeroRoundUp = React.useCallback(() => {
    const st = statsQ.data as UserStatsData | null;
    const gw = activeLastCompletedGw;
    if (typeof gw !== 'number') return;
    openManualResultsScoreSheetThenResults(gw, useSeasonStack ? undefined : { dataSource: 'legacy' });
  }, [openManualResultsScoreSheetThenResults, activeLastCompletedGw, useSeasonStack]);

  /** Main tab Global — pile-B users see 2026/27 chrome; still opens standings. */
  const openLeaderboards2526 = React.useCallback(() => {
    navigation.navigate('Tabs', { screen: 'Global', params: { resetKey: Date.now() } });
  }, [navigation]);

  const heroLiveScore = React.useMemo(() => {
    if (resolvedLiveGwScore != null) return resolvedLiveGwScore;
    const gw =
      typeof activeLeaderboardGw === 'number'
        ? activeLeaderboardGw
        : typeof homeCurrentGw === 'number'
          ? homeCurrentGw
          : null;
    if (gw == null || !streakRowsForStrip?.length) return null;
    const liveSeason = liveSeasonLabel?.trim() || '';
    const row = streakRowsForStrip.find(
      (r) => r.gw === gw && (!liveSeason || (r.seasonLabel?.trim() || '') === liveSeason)
    );
    return typeof row?.points === 'number' ? row.points : null;
  }, [resolvedLiveGwScore, activeLeaderboardGw, homeCurrentGw, streakRowsForStrip, liveSeasonLabel]);

  const heroOverallLabel =
    typeof careerPickStatsQ.data?.overallPercentile === 'number'
      ? 'Overall'
      : needsLiveSeasonStreak
        ? `Overall · ${liveSeasonLabel || '2026/27'}`
        : 'Overall';
  const heroLeaderboardsLabel = needsLiveSeasonStreak
    ? `Leaderboards · ${liveSeasonLabel || '2026/27'}`
    : 'View Leaderboards';
  const heroLeaderboardsA11y = needsLiveSeasonStreak
    ? `View leaderboards for ${liveSeasonLabel || '2026/27'}`
    : 'View leaderboards, 2025/26 season';
  const weeklyPar = React.useMemo(
    () =>
      careerPickStatsQ.data?.weeklyPar?.length
        ? careerPickStatsQ.data.weeklyPar
        : weeklyParFromLeaderboard ??
          (Array.isArray(stats?.weeklyParData) ? stats!.weeklyParData! : []),
    [careerPickStatsQ.data?.weeklyPar, weeklyParFromLeaderboard, stats]
  );

  /** Career chart is already both seasons. Single-season fallback still hides the live week. */
  const weeklyParChartRows = React.useMemo(() => {
    if (careerPickStatsQ.data?.weeklyPar?.length) return careerPickStatsQ.data.weeklyPar;
    if (!weeklyPar.length) return weeklyPar;

    const lastCompleted =
      typeof activeLastCompletedGw === 'number' && activeLastCompletedGw > 0 ? activeLastCompletedGw : null;

    /**
     * Active-season weekly par from the BFF (pile B when on the season stack).
     * Cap at last completed so the in-progress week is hidden until it is final.
     */
    if (useSeasonStack || isNewSeasonFresh) {
      if (lastCompleted != null) return weeklyPar.filter((r) => r.gw <= lastCompleted);
      return [];
    }

    // Same-season (legacy): omit the in-progress meta gameweek until fixtures are finished.
    const c = statsGwCompletion;
    if (c && typeof c.currentGw === 'number' && c.currentGw >= 1) {
      const currentGw = c.currentGw;
      return weeklyPar.filter(
        (r) =>
          r.gw < currentGw ||
          isGwFullyCompleteForStatsRoundUp({
            gw: r.gw,
            currentGw,
            probeHome: c.probeHome,
            probeGw: c.probeGw,
            lastCompletedGw: c.lastCompletedGw,
            probeLoading: c.probeLoading,
          })
      );
    }
    if (lastCompleted != null) {
      return weeklyPar.filter((r) => r.gw <= lastCompleted);
    }
    return [];
  }, [
    weeklyPar,
    statsGwCompletion,
    activeLastCompletedGw,
    useSeasonStack,
    isNewSeasonFresh,
    careerPickStatsQ.data?.weeklyPar,
  ]);

  const weeklyParChartLatestGw =
    weeklyParChartRows.length > 0 ? weeklyParChartRows[weeklyParChartRows.length - 1]!.gw : null;

  /** GW where your margin above the pool average was largest (same rows as the weekly chart). */
  const bestVsAvgWeek = React.useMemo(() => {
    if (weeklyParChartRows.length === 0) return null;
    let best = weeklyParChartRows[0]!;
    let bestMargin = best.userPoints - best.averagePoints;
    for (let i = 1; i < weeklyParChartRows.length; i++) {
      const d = weeklyParChartRows[i]!;
      const margin = d.userPoints - d.averagePoints;
      if (margin > bestMargin) {
        bestMargin = margin;
        best = d;
      }
    }
    return {
      gw: best.gw,
      margin: bestMargin,
      seasonLabel: 'seasonLabel' in best ? (best as { seasonLabel?: string }).seasonLabel : undefined,
    };
  }, [weeklyParChartRows]);

  const careerPickStats = careerPickStatsQ.data ?? null;
  const correctPredictionRate =
    careerPickStats?.correctPredictionRate ?? stats?.correctPredictionRate ?? null;
  const mostCorrectTeam = careerPickStats?.mostCorrectTeam ?? stats?.mostCorrectTeam ?? null;
  const mostIncorrectTeam = careerPickStats?.mostIncorrectTeam ?? stats?.mostIncorrectTeam ?? null;

  const resolvedFieldAvgPct =
    careerPickStats?.fieldAveragePct ?? fieldAvgFromApi ?? leaguePickAvgQ.data ?? null;
  const chaosIndex = careerPickStats?.chaosIndex ?? stats?.chaosIndex ?? null;
  const chaosCorrectCount = careerPickStats?.chaosCorrectCount ?? stats?.chaosCorrectCount ?? null;
  const chaosTotalCount = careerPickStats?.chaosTotalCount ?? stats?.chaosTotalCount ?? null;
  const bestSingleGw = careerPickStats?.bestSingleGw ?? stats?.bestSingleGw ?? null;
  const lowestSingleGw = careerPickStats?.lowestSingleGw ?? stats?.lowestSingleGw ?? null;

  const correctPredictionContextLine =
    typeof correctPredictionRate === 'number' &&
    resolvedFieldAvgPct != null &&
    Number.isFinite(resolvedFieldAvgPct)
      ? formatCorrectRateVsLeague(correctPredictionRate, resolvedFieldAvgPct)
      : null;

  const needsLeagueAvgFetch =
    typeof correctPredictionRate === 'number' &&
    fieldAvgFromApi == null &&
    careerPickStats?.fieldAveragePct == null;

  const gameweekTrophyCount = React.useMemo(() => {
    const server = stats?.trophyCabinet?.gameweekPodiums ?? 0;
    if (liveGwTrophyWins.pending) return server;
    // Season stack: BFF count is this season; client rows are 2025/26 — add, don't max.
    if (useSeasonStack) return server + liveGwTrophyWins.wins;
    if (leftoverPriorSeasonClient) {
      const seasonWins = careerPickStatsQ.data?.seasonGwWins ?? 0;
      return (liveGwTrophyWins.pending ? server : liveGwTrophyWins.wins) + seasonWins;
    }
    return Math.max(server, liveGwTrophyWins.wins);
  }, [
    liveGwTrophyWins.pending,
    liveGwTrophyWins.wins,
    stats?.trophyCabinet?.gameweekPodiums,
    useSeasonStack,
    leftoverPriorSeasonClient,
    careerPickStatsQ.data?.seasonGwWins,
  ]);
  const monthlyTrophyCount = stats?.trophyCabinet?.monthlyPodiums ?? 0;
  const seasonTrophyCount = championTrophyQ.data?.count ?? 0;

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
      lastCompletedGw: useSeasonStack ? SEASON_2025_26_END_GW : statsLcResolved,
      seasonKey: '2025/26',
    });
  }, [gwPointsQ.data, statsLcResolved, userId, useSeasonStack]);

  const handleGameweekTrophyPress = React.useCallback(() => {
    if (liveGwTrophyWins.pending) {
      Alert.alert('Loading', 'Still syncing gameweek trophies. Try again in a moment.');
      return;
    }
    if (!liveGwTrophyWins.winningGwsDescending.length) {
      Alert.alert('Not available', 'Could not resolve gameweek wins yet. Pull down to refresh.');
      return;
    }
    const payloadsByGw: Record<number, PersonalWinnerBrowsePayload> = {};
    if (userId) {
      for (const gw of liveGwTrophyWins.winningGwsDescending) {
        const payload = buildPersonalWinnerPayloadFromGwPoints({
          gwPointsRows: gwPointsQ.data,
          userId,
          gw,
          victoryType: 'gameweek',
          liveSubstitutionGw: typeof activeLeaderboardGw === 'number' ? activeLeaderboardGw : null,
          liveTableRows: gwLiveTableQ.data?.rows ?? null,
        });
        if (payload) payloadsByGw[gw] = payload;
      }
    }
    openTrophyCabinetPersonalWinners('gameweek', liveGwTrophyWins.winningGwsDescending, { payloadsByGw });
  }, [
    activeLeaderboardGw,
    gwLiveTableQ.data?.rows,
    gwPointsQ.data,
    liveGwTrophyWins.pending,
    liveGwTrophyWins.winningGwsDescending,
    openTrophyCabinetPersonalWinners,
    userId,
  ]);

  const handleMonthlyTrophyPress = React.useCallback(() => {
    if (!monthlyWinnerEndGwsDesc.length) {
      Alert.alert('Not available', 'Could not resolve monthly trophy periods yet. Pull down to refresh.');
      return;
    }
    const payloadsByGw: Record<number, PersonalWinnerBrowsePayload> = {};
    if (userId) {
      for (const gw of monthlyWinnerEndGwsDesc) {
        const payload = buildPersonalWinnerPayloadFromGwPoints({
          gwPointsRows: gwPointsQ.data,
          userId,
          gw,
          victoryType: 'monthly',
          seasonKey: '2025/26',
        });
        if (payload) payloadsByGw[gw] = payload;
      }
    }
    openTrophyCabinetPersonalWinners('monthly', monthlyWinnerEndGwsDesc, {
      seasonScope: SEASON_2025_26_LABEL,
      payloadsByGw,
    });
  }, [gwPointsQ.data, monthlyWinnerEndGwsDesc, openTrophyCabinetPersonalWinners, userId]);

  const handleSeasonTrophyPress = React.useCallback(() => {
    void openTrophyCabinetChampionCards();
  }, [openTrophyCabinetChampionCards]);

  const showInitialSpinner =
    authUserLoading || (!!userId && statsQ.isLoading && !statsQ.data && !statsQ.error);
  if (showInitialSpinner) {
    return (
      <Screen fullBleed>
        <PageHeader title="Stats" leftAction={backAction} />
        <CenteredSpinner loading label="Crunching the numbers…" />
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      <PageHeader title="Stats" leftAction={backAction} />
      <View style={{ paddingHorizontal: t.space[4] }}>
        <UnderlineTabs
          items={[
            { key: 'predictions', label: 'Predictions' },
            { key: 'players', label: 'THE PLAYERS', fontFamily: PLAYERS_FONTS.display },
          ]}
          value={statsTab}
          onChange={setStatsTab}
        />
      </View>

      <View style={{ flex: 1 }}>
        {statsTab === 'players' ? <PlayersStatSurface /> : null}
        <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[3],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {statsTab === 'players' ? (
          <StatsPlayersTab scoresByUser={playersScoresByUser} userId={userId} onPressPlay={openPlayers} />
        ) : (
          <>
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
                lastCompletedGw={activeLastCompletedGw}
                statsGwCompletion={statsGwCompletion}
                liveSeasonLabel={liveSeasonLabel}
                nestInsideStatCard
              />
            </StatCard>
            <View style={{ height: 16 }} />
          </>
        ) : null}

        <StatsHeroVisual
          stats={heroStats}
          statsGwCompletion={statsGwCompletion}
          liveScore={heroLiveScore}
          onPressViewRoundUp={activeLastCompletedGw ? openHeroRoundUp : undefined}
          onPressViewLeaderboards={openLeaderboards2526}
          overallLabel={heroOverallLabel}
          leaderboardsLinkLabel={heroLeaderboardsLabel}
          leaderboardsA11yLabel={heroLeaderboardsA11y}
        />

        <View style={{ height: 16 }} />
        <StatCard style={{ marginBottom: 16 }}>
          <TotlText variant="muted" style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
            Correct prediction rate
          </TotlText>
          <TotlText style={{ marginTop: 14, fontSize: 44, lineHeight: 48, fontWeight: '900', color: t.color.text }}>
            {typeof correctPredictionRate === 'number' ? `${correctPredictionRate.toFixed(2)}%` : '—'}
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

        {mostCorrectTeam ? (
          <StatCard style={{ marginBottom: 16 }}>
            <StatsTeamStatCard
              eyebrow="Most correctly predicted team"
              teamCode={mostCorrectTeam.code}
              teamName={mostCorrectTeam.name}
              percentage={mostCorrectTeam.percentage}
              valueTone="success"
            />
          </StatCard>
        ) : null}

        {mostIncorrectTeam ? (
          <StatCard style={{ marginBottom: 16 }}>
            <StatsTeamStatCard
              eyebrow="Most incorrectly predicted team"
              teamCode={mostIncorrectTeam.code}
              teamName={mostIncorrectTeam.name}
              percentage={mostIncorrectTeam.percentage}
              valueTone="danger"
            />
          </StatCard>
        ) : null}

        {weeklyParChartRows.length > 0 ? (
          <>
            <StatCard style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <TotlText style={{ flex: 1, fontSize: 14, fontWeight: '600', color: t.color.text, paddingRight: 10 }}>
                  Weekly Performance vs Average
                </TotlText>
                <WeeklyParChartToggle complex={parChartShowComplex} onChange={setParChartShowComplex} />
              </View>
              <StatsParChart
                weeklyData={weeklyParChartRows}
                latestGw={weeklyParChartLatestGw}
                showInfo={parChartShowComplex}
                nestInsideStatCard
              />
              {(() => {
                const above = weeklyParChartRows.filter((d) => d.userPoints > d.averagePoints).length;
                const pct = weeklyParChartRows.length ? Math.round((above / weeklyParChartRows.length) * 100) : 0;
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
              const totalSwing = weeklyParChartRows.reduce((sum, d) => sum + (d.userPoints - d.averagePoints), 0);
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
                    {`on ${
                      bestVsAvgWeek.seasonLabel
                        ? `${shortSeasonLabel(bestVsAvgWeek.seasonLabel) ?? bestVsAvgWeek.seasonLabel} GW${bestVsAvgWeek.gw}`
                        : `GW${bestVsAvgWeek.gw}`
                    }`}
                  </TotlText>
                </View>
              </StatCard>
            ) : null}
          </>
        ) : null}

        {chaosIndex != null ? (
          <StatCard style={{ marginBottom: 16, padding: 24 }}>
            <WebStatMetricStack
              label="Chaos Index"
              value={`${Number(chaosIndex).toFixed(2)}%`}
              subcopy="How often you backed the underdog — 25% or fewer of everyone who picked that game agreed with you"
            />
          </StatCard>
        ) : null}

        {typeof chaosTotalCount === 'number' &&
        chaosTotalCount > 0 &&
        chaosCorrectCount != null ? (
          <StatCard style={{ marginBottom: 16, padding: 24 }}>
            <WebStatMetricStack
              label="Chaos Index Success Rate"
              value={`${((chaosCorrectCount / chaosTotalCount) * 100).toFixed(2)}%`}
              subcopy={`${chaosCorrectCount} of ${chaosTotalCount} underdog picks were correct`}
            />
          </StatCard>
        ) : null}

        <StatCard style={{ marginBottom: 16 }}>
          <StatsTrophyCabinet
            gameweekWins={gameweekTrophyCount}
            monthlyWins={monthlyTrophyCount}
            seasonWins={seasonTrophyCount}
            onPressGameweek={gameweekTrophyCount > 0 ? handleGameweekTrophyPress : undefined}
            onPressMonthly={monthlyTrophyCount > 0 ? handleMonthlyTrophyPress : undefined}
            onPressSeason={seasonTrophyCount > 0 ? handleSeasonTrophyPress : undefined}
          />
        </StatCard>

        {bestSingleGw ? (
          <StatCard style={{ marginBottom: 16, padding: 24 }}>
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
                {String(bestSingleGw.points)}
              </TotlText>
              <TotlText style={{ fontSize: 14, fontWeight: '400', color: '#475569', marginLeft: 8, lineHeight: 20 }}>
                {`on ${
                  'seasonLabel' in bestSingleGw && bestSingleGw.seasonLabel
                    ? `${shortSeasonLabel(bestSingleGw.seasonLabel) ?? bestSingleGw.seasonLabel} GW${bestSingleGw.gw}`
                    : `GW${bestSingleGw.gw}`
                }`}
              </TotlText>
            </View>
          </StatCard>
        ) : null}

        {lowestSingleGw ? (
          <StatCard style={{ marginBottom: 16, padding: 24 }}>
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
                {String(lowestSingleGw.points)}
              </TotlText>
              <TotlText style={{ fontSize: 14, fontWeight: '400', color: '#475569', marginLeft: 8, lineHeight: 20 }}>
                {`on ${
                  'seasonLabel' in lowestSingleGw && lowestSingleGw.seasonLabel
                    ? `${shortSeasonLabel(lowestSingleGw.seasonLabel) ?? lowestSingleGw.seasonLabel} GW${lowestSingleGw.gw}`
                    : `GW${lowestSingleGw.gw}`
                }`}
              </TotlText>
            </View>
          </StatCard>
        ) : null}

        {seasonArchiveRows.length > 0 ? (
          <View style={{ marginBottom: 8 }}>
            <StatsPreviousSeasonsCard
              seasons={seasonArchiveRows}
              selectedLabel={selectedArchiveLabel}
              onSelectLabel={setArchiveSeasonLabel}
            />
          </View>
        ) : null}
          </>
        )}
      </ScrollView>
      </View>
    </Screen>
  );
}
