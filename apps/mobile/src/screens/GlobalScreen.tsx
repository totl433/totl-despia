import React, { useEffect } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import { useNavigation, useRoute, useScrollToTop } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../lib/api';
import { getGameweekStateFromSnapshot, getLeaderboardDisplayGwFromSnapshot } from '../lib/gameweekState';
import { supabase } from '../lib/supabase';
import LeaderboardsTabs, { type LeaderboardsTab, type FormScope } from '../components/leaderboards/LeaderboardsTabs';
import {
  getMonthAllocations,
  getMonthForGw,
  getEffectiveCurrentMonthKey,
  isMonthAvailable,
  resolveLeaderboardSeasonKey,
  SEASON_2025_26_END_GW,
  SEASON_2025_26_LABEL,
  SEASON_2025_26_START_GW,
  type MonthAllocation,
} from '../lib/leaderboardMonths';
import { useViewerSeason } from '../lib/useViewerSeason';
import { type LeaderboardsScope } from '../components/leaderboards/LeaderboardsScopeToggle';
import LeaderboardTable, { type LeaderboardRow } from '../components/leaderboards/LeaderboardTable';
import LeaderboardPlayerPicksPopup from '../components/leaderboards/LeaderboardPlayerPicksPopup';
import CenteredSpinner from '../components/CenteredSpinner';
import AppTopHeader from '../components/AppTopHeader';
import HeaderLiveScore from '../components/HeaderLiveScore';
import { useLiveScores } from '../hooks/useLiveScores';
import { buildHeaderExpandedStats, buildHeaderScoreSummary, buildHeaderTickerEvent, formatHeaderScoreLabel } from '../lib/headerLiveScore';
import usePopupCards from '../hooks/usePopupCards';

type OverallRow = { user_id: string; name: string | null; ocp: number | null };
type GwPointsRow = { user_id: string; gw: number; points: number };

async function fetchAllSupabaseRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function byValueThenName(a: LeaderboardRow, b: LeaderboardRow) {
  const aNull = a.value == null;
  const bNull = b.value == null;
  if (aNull && bNull) return a.name.localeCompare(b.name);
  if (aNull) return 1; // non-submitters last
  if (bNull) return -1;
  if (b.value !== a.value) return (b.value as number) - (a.value as number);
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

function MonthProgressBar({
  detail,
  t,
}: {
  detail: { progress: number; completed: number; total: number; month: MonthAllocation; lastSegmentFraction: number | null };
  t: ReturnType<typeof useTokens>;
}) {
  const progressSV = useSharedValue(0);
  useEffect(() => {
    progressSV.value = withTiming(detail.progress, {
      duration: 1100,
      easing: Easing.out(Easing.cubic),
    });
  }, [detail.progress, progressSV]);
  const gradientStyle = useAnimatedStyle(() => ({
    width: `${progressSV.value * 100}%`,
  }));
  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 4,
          overflow: 'hidden',
          height: 24,
          backgroundColor: t.color.border,
          position: 'relative',
        }}
      >
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' }, gradientStyle]}>
          <LinearGradient
            colors={['#2D9D8B', t.color.brand, '#157A6E']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
        </Animated.View>
        {Array.from({ length: detail.total }, (_, i) => {
          const gw = detail.month.startGw + i;
          const isComplete = i < detail.completed;
          const isLastSegment = i === detail.completed;
          const partialFraction = isLastSegment ? detail.lastSegmentFraction : null;
          const hasFill = isComplete || (partialFraction != null && partialFraction > 0);
          return (
            <View
              key={gw}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TotlText
                variant="caption"
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: hasFill ? '#fff' : t.color.muted,
                }}
              >
                GW{gw}
              </TotlText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function GlobalScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const listRef = React.useRef<any>(null);
  useScrollToTop(listRef);
  const { seasonLabel, isNewSeasonFresh, useSeasonStack, seasonId } = useViewerSeason();
  const seasonKey = resolveLeaderboardSeasonKey({ seasonLabel, isNewSeasonFresh, useSeasonStack });
  const monthAvailOpts = React.useMemo(
    () => ({ allowPreKickoffOpeningMonth: isNewSeasonFresh }),
    [isNewSeasonFresh]
  );

  const initialTabParam = (route.params as any)?.initialTab as string | undefined;
  const initialScopeParam = (route.params as any)?.initialScope as LeaderboardsScope | undefined;

  const [tab, setTab] = React.useState<LeaderboardsTab>(() => {
    if (initialTabParam === 'monthly' || initialTabParam === 'overall') return initialTabParam;
    if (initialTabParam === 'form5' || initialTabParam === 'form10') return 'overall';
    return (initialTabParam as LeaderboardsTab) ?? 'gw';
  });
  const [formScope, setFormScope] = React.useState<FormScope>(() => {
    if (initialTabParam === 'form5') return 'last5';
    if (initialTabParam === 'form10') return 'last10';
    return 'none';
  });
  const [selectedMonthKey, setSelectedMonthKey] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<LeaderboardsScope>(initialScopeParam ?? 'all');
  const [pullRefreshing, setPullRefreshing] = React.useState(false);
  const [playerPicksOpen, setPlayerPicksOpen] = React.useState(false);
  const [playerPicksUserId, setPlayerPicksUserId] = React.useState<string | null>(null);
  const [playerPicksUserName, setPlayerPicksUserName] = React.useState<string | null>(null);
  const [playerPicksOpponentAvatarUrl, setPlayerPicksOpponentAvatarUrl] = React.useState<string | null>(null);
  const [playerPicksOpponentOcp, setPlayerPicksOpponentOcp] = React.useState<number | null>(null);
  const [playerPicksOpponentOverallRank, setPlayerPicksOpponentOverallRank] = React.useState<number | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = React.useState(false);
  const [filterMenuPosition, setFilterMenuPosition] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [calendarMenuOpen, setCalendarMenuOpen] = React.useState(false);
  const [calendarMenuPosition, setCalendarMenuPosition] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [monthMenuOpen, setMonthMenuOpen] = React.useState(false);
  const [monthMenuPosition, setMonthMenuPosition] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const { openManualResultsScoreSheetShare } = usePopupCards();
  const filterIconRef = React.useRef<View>(null);
  const calendarIconRef = React.useRef<View>(null);
  const monthMenuRef = React.useRef<View>(null);

  React.useEffect(() => {
    if (tab === 'monthly' || tab === 'gw') setFormScope('none');
    if (tab === 'monthly') setScope('all');
  }, [tab]);

  // Reset to defaults when 2025/26 tab is pressed (from bottom nav).
  const resetKey = (route.params as any)?.resetKey as number | undefined;
  React.useEffect(() => {
    if (resetKey == null) return;
    setTab('gw');
    setFormScope('none');
    setScope('all');
    setSelectedMonthKey(null);
    requestAnimationFrame(() => navigation.setParams?.({ resetKey: undefined }));
  }, [resetKey, navigation]);

  // Allow other screens (e.g. Home performance cards) to deep-link into a specific leaderboard section.
  React.useEffect(() => {
    if (!initialTabParam && !initialScopeParam) return;
    if (initialTabParam === 'form5') {
      setTab('overall');
      setFormScope('last5');
    } else if (initialTabParam === 'form10') {
      setTab('overall');
      setFormScope('last10');
    } else if (initialTabParam === 'monthly' || initialTabParam === 'overall') {
      setTab(initialTabParam);
    } else if (initialTabParam === 'gw') {
      setTab('gw');
      setFormScope('none');
      setSelectedMonthKey(null);
    }
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
  const { data: homeSnapshot } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
    staleTime: 60_000,
  });
  const snapshotLeaderboardGw = getLeaderboardDisplayGwFromSnapshot({
    viewingGw: homeSnapshot?.viewingGw ?? null,
    currentGw: homeSnapshot?.currentGw ?? null,
    fixtures: homeSnapshot?.fixtures ?? [],
    liveScores: homeSnapshot?.liveScores ?? [],
  });
  const { liveByFixtureIndex: liveByFixtureIndexRealtime } = useLiveScores(snapshotLeaderboardGw, {
    initial: homeSnapshot?.liveScores ?? [],
  });

  const { data: ranks, refetch: refetchRanks, isRefetching: ranksRefetching } = useQuery({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });
  const latestGw = ranks?.latestGw ?? null;
  const activeLeaderboardGw = getLeaderboardDisplayGwFromSnapshot({
    viewingGw: homeSnapshot?.viewingGw ?? null,
    currentGw: homeSnapshot?.currentGw ?? null,
    // Don't feed last season's completed GW (38) into 2026/27 display math.
    latestCompletedGw: isNewSeasonFresh || useSeasonStack ? null : latestGw,
    fixtures: homeSnapshot?.fixtures ?? [],
    liveScores: homeSnapshot?.liveScores ?? [],
  });
  // Monthly calendar follows season-stack GW (e.g. 1), not pile-A latestGw (still 38).
  const monthAnchorGw = React.useMemo(() => {
    if (isNewSeasonFresh || useSeasonStack) {
      return (
        (typeof homeSnapshot?.currentGw === 'number' ? homeSnapshot.currentGw : null) ??
        (typeof homeSnapshot?.viewingGw === 'number' ? homeSnapshot.viewingGw : null) ??
        (typeof activeLeaderboardGw === 'number' ? activeLeaderboardGw : null) ??
        1
      );
    }
    return latestGw ?? activeLeaderboardGw ?? null;
  }, [
    activeLeaderboardGw,
    homeSnapshot?.currentGw,
    homeSnapshot?.viewingGw,
    isNewSeasonFresh,
    latestGw,
    useSeasonStack,
  ]);

  // Drop a selected month if it doesn't exist on the active season calendar.
  React.useEffect(() => {
    if (!selectedMonthKey) return;
    const exists = getMonthAllocations(seasonKey).some((m) => m.monthKey === selectedMonthKey);
    if (!exists) setSelectedMonthKey(null);
  }, [seasonKey, selectedMonthKey]);
  const headerLiveByFixtureIndex = React.useMemo(() => {
    if (!homeSnapshot) return new Map<number, any>();
    if (liveByFixtureIndexRealtime.size > 0) return liveByFixtureIndexRealtime;

    const apiMatchIdToFixtureIndex = new Map<number, number>();
    (homeSnapshot.fixtures ?? []).forEach((fixture) => {
      if (typeof fixture.api_match_id === 'number') apiMatchIdToFixtureIndex.set(fixture.api_match_id, fixture.fixture_index);
    });

    return (homeSnapshot.liveScores ?? []).reduce((map, liveScore) => {
      const fixtureIndex =
        typeof liveScore.fixture_index === 'number'
          ? liveScore.fixture_index
          : typeof liveScore.api_match_id === 'number'
            ? apiMatchIdToFixtureIndex.get(liveScore.api_match_id)
            : undefined;
      if (typeof fixtureIndex === 'number') map.set(fixtureIndex, liveScore);
      return map;
    }, new Map<number, any>());
  }, [homeSnapshot, liveByFixtureIndexRealtime]);
  const headerScoreSummary = React.useMemo(() => {
    if (!homeSnapshot) return null;
    const resultByFixtureIndex = new Map<number, 'H' | 'D' | 'A'>();
    (homeSnapshot.gwResults ?? []).forEach((result) => {
      resultByFixtureIndex.set(result.fixture_index, result.result);
    });
    return buildHeaderScoreSummary({
      fixtures: homeSnapshot.fixtures ?? [],
      userPicks: homeSnapshot.userPicks ?? {},
      liveByFixtureIndex: headerLiveByFixtureIndex,
      resultByFixtureIndex,
    });
  }, [headerLiveByFixtureIndex, homeSnapshot]);
  const { tickerEvent: headerTickerEvent, tickerEventKey: headerTickerEventKey } = React.useMemo(() => {
    if (!homeSnapshot) return { tickerEvent: null, tickerEventKey: null };
    return buildHeaderTickerEvent({
      fixtures: homeSnapshot.fixtures ?? [],
      liveByFixtureIndex: headerLiveByFixtureIndex,
    });
  }, [headerLiveByFixtureIndex, homeSnapshot]);
  const {
    data: overall,
    isLoading: overallLoading,
    error: overallError,
    refetch: refetchOverall,
    isRefetching: overallRefetching,
  } = useQuery({
    queryKey: ['leaderboards', 'overallView', 'paged-v2'],
    queryFn: async () => {
      return fetchAllSupabaseRows<OverallRow>((from, to) =>
        supabase.from('app_v_ocp_overall').select('user_id, name, ocp').order('user_id', { ascending: true }).range(from, to)
      );
    },
  });

  // Pile A materialization (`app_v_gw_points`). Used for 25/26 tables + archive scopes.
  // Never apply these rows as 2026/27 GW scores (handled in rowsBase / live reconstruction).
  const {
    data: gwPoints,
    isLoading: gwPointsLoading,
    error: gwPointsError,
    refetch: refetchGwPoints,
    isRefetching: gwPointsRefetching,
  } = useQuery({
    queryKey: ['leaderboards', 'gwPointsView', 'paged-v2'],
    queryFn: async () => {
      return fetchAllSupabaseRows<GwPointsRow>((from, to) =>
        supabase
          .from('app_v_gw_points')
          .select('user_id, gw, points')
          .order('gw', { ascending: true })
          .order('user_id', { ascending: true })
          .range(from, to)
      );
    },
  });

  // Legacy BFF live table is pile-A only (app_picks / app_v_gw_points). Never for season-stack testers.
  const { data: gwLiveTable, refetch: refetchGwLiveTable } = useQuery({
    enabled: typeof activeLeaderboardGw === 'number' && !useSeasonStack,
    queryKey: ['leaderboards', 'gwLiveTable', activeLeaderboardGw, 'pileA'],
    queryFn: () => api.getGlobalGwLiveTable(activeLeaderboardGw as number),
    refetchInterval: tab === 'gw' || tab === 'overall' ? 10_000 : false,
  });
  const { data: gwLiveFallbackScores, refetch: refetchGwLiveFallbackScores } = useQuery<{
    scores: Record<string, number>;
    hasActiveLiveGames: boolean;
    isCurrentGwComplete: boolean;
    currentGwCompleteFraction: number;
    /** True if any fixture in this GW has kicked off (live / finished / or kickoff time in the past). */
    hasGwKickoffStarted: boolean;
  }>({
    enabled: typeof activeLeaderboardGw === 'number' && (!useSeasonStack || !!seasonId),
    queryKey: [
      'leaderboards',
      'gwLiveFallbackScores',
      activeLeaderboardGw,
      useSeasonStack ? 'pileB' : 'pileA',
      seasonId ?? 'none',
      'paged-v3',
    ],
    queryFn: async () => {
      const gw = activeLeaderboardGw as number;
      const pileB = useSeasonStack && !!seasonId;

      // Pile B: season tables only. Pile A: legacy unfoldered tables.
      const submissionsP = pileB
        ? fetchAllSupabaseRows<{ user_id: string }>((from, to) =>
            (supabase as any)
              .from('app_season_submissions')
              .select('user_id')
              .eq('gw', gw)
              .eq('season_id', seasonId)
              .order('user_id', { ascending: true })
              .range(from, to)
          )
        : fetchAllSupabaseRows<{ user_id: string }>((from, to) =>
            supabase.from('app_gw_submissions').select('user_id').eq('gw', gw).order('user_id', { ascending: true }).range(from, to)
          );
      const picksP = pileB
        ? fetchAllSupabaseRows<{ user_id: string; fixture_index: number; pick: string | null }>((from, to) =>
            (supabase as any)
              .from('app_season_picks')
              .select('user_id, fixture_index, pick')
              .eq('gw', gw)
              .eq('season_id', seasonId)
              .order('fixture_index', { ascending: true })
              .order('user_id', { ascending: true })
              .range(from, to)
          )
        : fetchAllSupabaseRows<{ user_id: string; fixture_index: number; pick: string | null }>((from, to) =>
            supabase
              .from('app_picks')
              .select('user_id, fixture_index, pick')
              .eq('gw', gw)
              .order('fixture_index', { ascending: true })
              .order('user_id', { ascending: true })
              .range(from, to)
          );
      const fixturesP = pileB
        ? (supabase as any)
            .from('app_season_fixtures')
            .select('fixture_index, api_match_id, kickoff_time')
            .eq('gw', gw)
            .eq('season_id', seasonId)
        : supabase.from('app_fixtures').select('fixture_index, api_match_id, kickoff_time').eq('gw', gw);
      const resultsP = pileB
        ? (supabase as any)
            .from('app_season_results')
            .select('fixture_index, result')
            .eq('gw', gw)
            .eq('season_id', seasonId)
        : supabase.from('app_gw_results').select('fixture_index, result').eq('gw', gw);

      const [submissions, allPicks, liveScoresRes, resultsRes, fixturesRes] = await Promise.all([
        submissionsP,
        picksP,
        // live_scores is global by match; for pile B we only apply rows that map to this season's fixtures
        supabase.from('live_scores').select('api_match_id, fixture_index, home_score, away_score, status').eq('gw', gw),
        resultsP,
        fixturesP,
      ]);
      if (liveScoresRes.error) throw liveScoresRes.error;
      if (resultsRes.error) throw resultsRes.error;
      if (fixturesRes.error) throw fixturesRes.error;

      const picks = allPicks.filter((p: any) => p.pick === 'H' || p.pick === 'D' || p.pick === 'A');
      // Pile B: only formal submissions count (do not invent submitters from loose picks alone).
      const submittedIds = new Set<string>(
        pileB
          ? submissions.map((s: any) => String(s.user_id))
          : [...submissions.map((s: any) => String(s.user_id)), ...picks.map((p: any) => String(p.user_id))]
      );
      const outcomeByFixtureIndex = new Map<number, 'H' | 'D' | 'A'>();
      (resultsRes.data ?? []).forEach((r: any) => {
        if (r?.result === 'H' || r?.result === 'D' || r?.result === 'A') outcomeByFixtureIndex.set(Number(r.fixture_index), r.result);
      });
      const apiMatchIdToFixture = new Map<number, number>();
      const seasonFixtureIndexes = new Set<number>();
      (fixturesRes.data ?? []).forEach((f: any) => {
        if (typeof f?.fixture_index === 'number') seasonFixtureIndexes.add(f.fixture_index);
        if (typeof f?.api_match_id === 'number' && typeof f?.fixture_index === 'number') {
          apiMatchIdToFixture.set(f.api_match_id, f.fixture_index);
        }
      });
      let hasActiveLiveGames = false;
      let hasGwKickoffStarted = false;
      (liveScoresRes.data ?? []).forEach((ls: any) => {
        const status = ls?.status;
        const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
        // For pile B: only scores that map to this season's fixtures via api_match_id
        // (never trust fixture_index alone — GW1 indexes collide across seasons).
        let fixtureIndex: number | undefined;
        if (pileB) {
          if (typeof ls?.api_match_id === 'number') fixtureIndex = apiMatchIdToFixture.get(ls.api_match_id);
          if (fixtureIndex == null) return;
        } else {
          if (started) hasGwKickoffStarted = true;
          if (status === 'IN_PLAY' || status === 'PAUSED') hasActiveLiveGames = true;
          if (!started) return;
          fixtureIndex =
            typeof ls?.fixture_index === 'number'
              ? ls.fixture_index
              : typeof ls?.api_match_id === 'number'
                ? apiMatchIdToFixture.get(ls.api_match_id)
                : undefined;
        }
        if (typeof fixtureIndex !== 'number') return;
        if (pileB && !seasonFixtureIndexes.has(fixtureIndex)) return;
        if (pileB) {
          if (started) hasGwKickoffStarted = true;
          if (status === 'IN_PLAY' || status === 'PAUSED') hasActiveLiveGames = true;
          if (!started) return;
        }
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
      const fixtures = (fixturesRes.data ?? []) as { fixture_index?: number }[];
      const allFixturesHaveOutcomes = fixtures.length > 0 && fixtures.every((f) => typeof f?.fixture_index === 'number' && outcomeByFixtureIndex.has(f.fixture_index));
      const isCurrentGwComplete = !hasActiveLiveGames && allFixturesHaveOutcomes;
      const outcomesCount = fixtures.filter((f) => typeof f?.fixture_index === 'number' && outcomeByFixtureIndex.has(f.fixture_index)).length;
      const currentGwCompleteFraction = fixtures.length > 0 ? outcomesCount / fixtures.length : 0;
      if (!hasGwKickoffStarted) {
        const nowMs = Date.now();
        (fixturesRes.data ?? []).forEach((f: any) => {
          if (typeof f?.kickoff_time !== 'string') return;
          const t = new Date(f.kickoff_time).getTime();
          if (!Number.isNaN(t) && t <= nowMs) hasGwKickoffStarted = true;
        });
      }
      // Pile B pre-season / no submissions: empty scores (callers show — not pile-A zeros).
      return { scores, hasActiveLiveGames, isCurrentGwComplete, currentGwCompleteFraction, hasGwKickoffStarted };
    },
    refetchInterval: tab === 'gw' || tab === 'overall' || tab === 'monthly' ? 10_000 : false,
  });
  const currentGwIsLive = React.useMemo(() => {
    if (homeSnapshot) {
      return (
        getGameweekStateFromSnapshot({
          fixtures: homeSnapshot.fixtures ?? [],
          liveScores:
            headerLiveByFixtureIndex.size > 0
              ? Array.from(headerLiveByFixtureIndex.values())
              : homeSnapshot.liveScores ?? [],
          hasSubmittedViewingGw: !!homeSnapshot.hasSubmittedViewingGw,
        }) === 'LIVE'
      );
    }
    return gwLiveFallbackScores?.hasActiveLiveGames === true;
  }, [headerLiveByFixtureIndex, homeSnapshot, gwLiveFallbackScores?.hasActiveLiveGames]);
  const showLiveHeaderScore = currentGwIsLive && !!headerScoreSummary;
  const headerScoreLabel = headerScoreSummary ? formatHeaderScoreLabel(headerScoreSummary, true) : null;
  const liveGwScores = React.useMemo(() => {
    // Season-stack testers: only client reconstruction from app_season_* (never pile-A BFF table).
    if (useSeasonStack) {
      return Object.entries(gwLiveFallbackScores?.scores ?? {}).map(([user_id, score]) => ({
        user_id,
        score: Number(score ?? 0),
      }));
    }
    const tableScores = (gwLiveTable?.rows ?? []).map((row) => ({
      user_id: String(row.user_id),
      score: Number(row.score ?? 0),
    }));
    const fallbackScores = Object.entries(gwLiveFallbackScores?.scores ?? {}).map(([user_id, score]) => ({
      user_id,
      score: Number(score ?? 0),
    }));

    // Keep the global leaderboard aligned with the BFF live-table source used elsewhere
    // (e.g. mini-league live cards). Fall back to local reconstruction only if that API
    // returns nothing.
    return tableScores.length > 0 ? tableScores : fallbackScores;
  }, [gwLiveFallbackScores?.scores, gwLiveTable?.rows, useSeasonStack]);
  const liveGwByUser = React.useMemo(
    () => new Map(liveGwScores.map((row) => [row.user_id, row.score])),
    [liveGwScores]
  );
  const liveGwRank = React.useMemo(() => {
    if (!userId || !currentGwIsLive) return null;
    const mine = liveGwByUser.get(String(userId));
    if (mine == null) return null;
    const higher = Array.from(liveGwByUser.values()).filter((score) => score > mine).length;
    return higher + 1;
  }, [currentGwIsLive, liveGwByUser, userId]);
  const headerExpandedStats = React.useMemo(
    () =>
      buildHeaderExpandedStats({
        gwRank: showLiveHeaderScore ? liveGwRank : ranks?.gwRank?.rank ?? null,
        gwTotal: showLiveHeaderScore ? liveGwByUser.size : ranks?.gwRank?.total ?? null,
      }),
    [liveGwByUser.size, liveGwRank, ranks?.gwRank?.rank, ranks?.gwRank?.total, showLiveHeaderScore]
  );
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

  // Who locked picks for the GW tab / secondary column (season-aware for pile B).
  const { data: gwSubmittedIds } = useQuery<Set<string>>({
    enabled: typeof activeLeaderboardGw === 'number',
    queryKey: [
      'leaderboards',
      'gwSubmittedIds',
      activeLeaderboardGw,
      useSeasonStack,
      seasonId,
    ],
    queryFn: async () => {
      const gw = activeLeaderboardGw as number;
      if (useSeasonStack && seasonId) {
        const rows = await fetchAllSupabaseRows<{ user_id: string }>((from, to) =>
          (supabase as any)
            .from('app_season_submissions')
            .select('user_id')
            .eq('gw', gw)
            .eq('season_id', seasonId)
            .order('user_id', { ascending: true })
            .range(from, to)
        );
        return new Set(rows.map((r) => String(r.user_id)));
      }
      const rows = await fetchAllSupabaseRows<{ user_id: string }>((from, to) =>
        supabase
          .from('app_gw_submissions')
          .select('user_id')
          .eq('gw', gw)
          .order('user_id', { ascending: true })
          .range(from, to)
      );
      return new Set(rows.map((r) => String(r.user_id)));
    },
    staleTime: 30_000,
  });

  const { data: firstSubmissionGw } = useQuery<number | null>({
    enabled: !!userId && (tab === 'gw' || tab === 'overall'),
    queryKey: ['leaderboards', 'firstSubmissionGw', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_gw_submissions')
        .select('gw')
        .eq('user_id', userId)
        .order('gw', { ascending: true })
        .limit(1);
      if (error) throw error;
      const first = (data ?? [])[0] as { gw?: number } | undefined;
      return first?.gw != null ? Number(first.gw) : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const nameByUserId = React.useMemo(() => {
    const m = new Map<string, string>();
    (overall ?? []).forEach((o) => m.set(o.user_id, o.name ?? 'User'));
    return m;
  }, [overall]);
  const currentUserDisplayName =
    (userId ? nameByUserId.get(userId) : null) ??
    (typeof (userData as any)?.user_metadata?.name === 'string' ? String((userData as any).user_metadata.name) : null) ??
    (typeof (userData as any)?.user_metadata?.full_name === 'string' ? String((userData as any).user_metadata.full_name) : null) ??
    null;

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
    (weeks: number, endGw: number | null): LeaderboardRow[] => {
      const gw = endGw ?? latestGw ?? null;
      const pts = gwPoints ?? [];
      if (!gw || gw < weeks) return [];
      const start = gw - weeks + 1;
      const byUser = new Map<string, { name: string; sum: number; played: Set<number> }>();

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

  const computeSinceStartedRows = React.useCallback(
    (startGw: number, endGw: number | null): LeaderboardRow[] => {
      const gw = endGw ?? latestGw ?? null;
      const pts = gwPoints ?? [];
      if (!gw || startGw > gw) return [];
      const weeks = gw - startGw + 1;
      const byUser = new Map<string, { name: string; sum: number; played: Set<number> }>();

      (overall ?? []).forEach((o) => {
        byUser.set(o.user_id, { name: o.name ?? 'User', sum: 0, played: new Set() });
      });

      pts.forEach((p) => {
        if (p.gw < startGw || p.gw > gw) return;
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

  /**
   * Sum OCP over a GW window. `endGw: null` = unlimited (all-time across seasons once multi-season exists).
   * Live in-progress GW scores are folded in only when that GW sits inside the window.
   */
  const computeOcpWindowRows = React.useCallback(
    (startGw: number, endGw: number | null, options?: { withGwSecondary?: boolean }): LeaderboardRow[] => {
      const pts = gwPoints ?? [];
      const byUser = new Map<string, { name: string; sum: number }>();
      const activeGw = typeof activeLeaderboardGw === 'number' ? activeLeaderboardGw : null;
      const liveInWindow =
        !!activeGw &&
        liveGwByUser.size > 0 &&
        activeGw >= startGw &&
        (endGw == null || activeGw <= endGw);

      (overall ?? []).forEach((o) => {
        byUser.set(o.user_id, { name: o.name ?? 'User', sum: 0 });
      });

      const pointsOnSecondaryGw = new Map<string, number>();
      pts.forEach((p) => {
        if (p.gw < startGw) return;
        if (endGw != null && p.gw > endGw) return;
        if (liveInWindow && p.gw === activeGw) return;
        const existing = byUser.get(p.user_id) ?? { name: nameByUserId.get(p.user_id) ?? 'User', sum: 0 };
        existing.sum += Number(p.points ?? 0);
        byUser.set(p.user_id, existing);
        if (options?.withGwSecondary && activeGw != null && p.gw === activeGw) {
          pointsOnSecondaryGw.set(p.user_id, Number(p.points ?? 0));
        }
      });

      if (liveInWindow) {
        liveGwByUser.forEach((score, userId) => {
          const existing = byUser.get(userId) ?? { name: nameByUserId.get(userId) ?? 'User', sum: 0 };
          existing.sum += Number(score ?? 0);
          byUser.set(userId, existing);
        });
      }

      const showSecondary =
        !!options?.withGwSecondary &&
        activeGw != null &&
        activeGw >= startGw &&
        (endGw == null || activeGw <= endGw);

      return Array.from(byUser.entries())
        .map(([id, v]) => ({
          user_id: id,
          name: v.name,
          value: Math.round(v.sum),
          secondaryValue: showSecondary
            ? liveInWindow
              ? Number(liveGwByUser.get(id) ?? 0)
              : Number(pointsOnSecondaryGw.get(id) ?? 0)
            : undefined,
        }))
        .sort(byValueThenName);
    },
    [activeLeaderboardGw, gwPoints, liveGwByUser, nameByUserId, overall]
  );

  const computeMonthlyRows = React.useCallback(
    (month: MonthAllocation): LeaderboardRow[] => {
      const pts = gwPoints ?? [];
      const byUser = new Map<string, { name: string; sum: number }>();
      const activeGwInMonth =
        typeof activeLeaderboardGw === 'number' &&
        liveGwByUser.size > 0 &&
        activeLeaderboardGw >= month.startGw &&
        activeLeaderboardGw <= month.endGw;

      (overall ?? []).forEach((o) => {
        byUser.set(o.user_id, { name: o.name ?? 'User', sum: 0 });
      });

      pts.forEach((p) => {
        if (p.gw < month.startGw || p.gw > month.endGw) return;
        if (activeGwInMonth && p.gw === activeLeaderboardGw) return;
        const existing = byUser.get(p.user_id) ?? { name: nameByUserId.get(p.user_id) ?? 'User', sum: 0 };
        existing.sum += Number(p.points ?? 0);
        byUser.set(p.user_id, existing);
      });

      if (activeGwInMonth) {
        liveGwByUser.forEach((score, userId) => {
          const existing = byUser.get(userId) ?? { name: nameByUserId.get(userId) ?? 'User', sum: 0 };
          existing.sum += Number(score ?? 0);
          byUser.set(userId, existing);
        });
      }

      const monthGws = Array.from({ length: month.endGw - month.startGw + 1 }, (_, index) => month.startGw + index);
      const compactValuesByUser = new Map<string, Array<number | null>>();
      monthGws.forEach((gw) => {
        const gwScores =
          activeGwInMonth && gw === activeLeaderboardGw
            ? liveGwByUser
            : new Map(
                pts
                  .filter((p) => p.gw === gw)
                  .map((p) => [String(p.user_id), Number(p.points ?? 0)] as const)
              );
        byUser.forEach((_value, userId) => {
          const existing = compactValuesByUser.get(userId) ?? monthGws.map(() => null);
          existing[gw - month.startGw] = gwScores.has(userId) ? Number(gwScores.get(userId) ?? 0) : null;
          compactValuesByUser.set(userId, existing);
        });
      });

      return Array.from(byUser.entries())
        .filter(([, v]) => v.sum > 0)
        .map(([id, v]) => ({
          user_id: id,
          name: v.name,
          value: v.sum,
          compactValues: compactValuesByUser.get(id) ?? monthGws.map(() => null),
        }))
        .sort(byValueThenName);
    },
    [activeLeaderboardGw, gwPoints, liveGwByUser, nameByUserId, overall]
  );

  const rowsBase: LeaderboardRow[] = React.useMemo(() => {
    const gw = activeLeaderboardGw ?? null;
    // gwPoints may be intentionally [] on fresh pile B — still render player rows.
    if (!overall || gwPoints == null) return [];
    const gwPointsByUser = new Map<string, number>();
    // Live scores only count when we have *season-correct* reconstructed scores (pile B)
    // or legacy live scores (pile A). Empty map → no one looks like they scored.
    const hasActiveGwScores = !!gw && liveGwByUser.size > 0;
    if (gw && !(useSeasonStack && isNewSeasonFresh)) {
      gwPoints
        .filter((p) => p.gw === gw)
        .forEach((p) => {
          gwPointsByUser.set(p.user_id, Number(p.points ?? 0));
        });
    }
    // Pile B: only formal season submissions. Never treat pile-A live keys as "submitted".
    const submittedSet = new Set<string>(
      useSeasonStack
        ? [...(gwSubmittedIds ? Array.from(gwSubmittedIds) : [])]
        : [
            ...(gwSubmittedIds ? Array.from(gwSubmittedIds) : []),
            ...Array.from(liveGwByUser.keys()),
          ]
    );
    const isSubmitted = (uid: string) => submittedSet.has(String(uid));
    const gwScoreFor = (uid: string): number | null => {
      if (!isSubmitted(uid)) return null;
      if (hasActiveGwScores) return liveGwByUser.get(uid) ?? 0;
      // Fresh 26/27: submitted but no outcomes yet → 0 not legacy materialization.
      if (useSeasonStack && isNewSeasonFresh) return 0;
      return gwPointsByUser.has(uid) ? (gwPointsByUser.get(uid) ?? 0) : 0;
    };

    // Form / season scope (calendar menu) — checked before 2026/27 zeroing so archive still works.
    const endGw = currentGwIsLive && gw ? Math.max(1, gw - 1) : gw;
    if (tab === 'overall' && formScope === 'archive_2025_26') {
      // Final completed 2025/26 table (GWs 1–38) — still available as lookback from 2026/27.
      return filterScope(
        computeOcpWindowRows(SEASON_2025_26_START_GW, SEASON_2025_26_END_GW, { withGwSecondary: false })
      );
    }

    // Pile B 2026/27: zero OCP; GW scores only for submitters (else dash).
    if (isNewSeasonFresh) {
      if (tab === 'gw') {
        if (!gw) return [];
        const r = overall
          .map((o) => ({
            user_id: o.user_id,
            name: o.name ?? 'User',
            value: gwScoreFor(o.user_id),
          }))
          .sort(byValueThenName);
        return filterScope(r);
      }
      const zeroRows = overall
        .map((o) => ({
          user_id: o.user_id,
          name: o.name ?? 'User',
          value: 0,
          secondaryValue:
            tab === 'overall' && formScope === 'none' && gw ? gwScoreFor(o.user_id) : undefined,
        }))
        .sort(byValueThenName);
      return filterScope(zeroRows);
    }

    if (tab === 'overall' && formScope === 'last5') {
      return filterScope(computeFormRows(5, endGw));
    }
    if (tab === 'overall' && formScope === 'last10') {
      return filterScope(computeFormRows(10, endGw));
    }
    if (tab === 'overall' && formScope === 'sinceStarted' && firstSubmissionGw != null) {
      return filterScope(computeSinceStartedRows(firstSubmissionGw, endGw));
    }
    // Fixed 2025/26 final table (GWs 1–38 only) when still on that season client.
    if (tab === 'overall' && formScope === 'none') {
      return filterScope(
        computeOcpWindowRows(SEASON_2025_26_START_GW, SEASON_2025_26_END_GW, { withGwSecondary: true })
      );
    }

    if (tab === 'overall') {
      const liveBaseOcpByUser = new Map<string, number>();
      if (hasActiveGwScores && gw) {
        gwPoints
          .filter((p) => p.gw < gw)
          .forEach((p) => {
            liveBaseOcpByUser.set(p.user_id, (liveBaseOcpByUser.get(p.user_id) ?? 0) + Number(p.points ?? 0));
          });
      }
      const r = overall
        .map((o) => ({
          user_id: o.user_id,
          name: o.name ?? 'User',
          value:
            hasActiveGwScores
              ? (liveBaseOcpByUser.get(o.user_id) ?? 0) + (liveGwByUser.get(o.user_id) ?? 0)
              : Math.round(Number(o.ocp ?? 0)),
          secondaryValue: gw ? gwScoreFor(o.user_id) : undefined,
        }))
        .sort(byValueThenName);
      return filterScope(r);
    }

    // Monthly tab
    if (tab === 'monthly') {
      const monthKey =
        selectedMonthKey ??
        getEffectiveCurrentMonthKey(monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts);
      const month = getMonthAllocations(seasonKey).find((m) => m.monthKey === monthKey);
      if (month) return filterScope(computeMonthlyRows(month));
      return [];
    }

    // GW tab: everyone in scope; score if submitted, otherwise dash
    if (!gw) return [];
    const r = overall
      .map((o) => ({
        user_id: o.user_id,
        name: o.name ?? nameByUserId.get(o.user_id) ?? 'User',
        value: gwScoreFor(o.user_id),
      }))
      .sort(byValueThenName);
    return filterScope(r);
  }, [
    computeFormRows,
    computeOcpWindowRows,
    computeSinceStartedRows,
    computeMonthlyRows,
    filterScope,
    activeLeaderboardGw,
    firstSubmissionGw,
    formScope,
    currentGwIsLive,
    gwPoints,
    gwSubmittedIds,
    liveGwByUser,
    latestGw,
    nameByUserId,
    overall,
    selectedMonthKey,
    tab,
    isNewSeasonFresh,
    monthAnchorGw,
    seasonKey,
    monthAvailOpts,
    useSeasonStack,
  ]);

  const visibleUserIds = React.useMemo(() => {
    const ids = Array.from(new Set(rowsBase.map((r) => r.user_id))).filter(Boolean);
    // Keep it bounded (leaderboard UI only needs the top list).
    return ids.slice(0, 400);
  }, [rowsBase]);

  const { data: avatarByUserId } = useQuery<Record<string, string | null>>({
    enabled: visibleUserIds.length > 0,
    queryKey: ['leaderboards', 'avatarMap', scope, tab, formScope, selectedMonthKey, latestGw, visibleUserIds.length],
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

  const ocpByUserId = React.useMemo(() => {
    const out = new Map<string, number>();
    (overall ?? []).forEach((row) => {
      out.set(String(row.user_id), Math.round(Number(row.ocp ?? 0)));
    });
    return out;
  }, [overall]);

  const overallRankByUserId = React.useMemo(() => {
    const out = new Map<string, number>();
    const gw = activeLeaderboardGw ?? null;
    if (!overall || !gwPoints) return out;

    if (isNewSeasonFresh) {
      const ranked = overall
        .map((o) => ({
          user_id: String(o.user_id),
          value: 0,
          name: o.name ?? 'User',
        }))
        .sort((a, b) =>
          byValueThenName(
            { user_id: a.user_id, name: a.name, value: a.value },
            { user_id: b.user_id, name: b.name, value: b.value }
          )
        );
      let currentRank = 1;
      ranked.forEach((row, index) => {
        const prev = ranked[index - 1];
        if (index > 0 && prev && prev.value !== row.value) currentRank = index + 1;
        out.set(row.user_id, currentRank);
      });
      return out;
    }

    const hasActiveGwScores = !!gw && liveGwByUser.size > 0;
    const liveBaseOcpByUser = new Map<string, number>();
    if (hasActiveGwScores && gw) {
      gwPoints
        .filter((p) => p.gw < gw)
        .forEach((p) => {
          liveBaseOcpByUser.set(p.user_id, (liveBaseOcpByUser.get(p.user_id) ?? 0) + Number(p.points ?? 0));
        });
    }

    const rankedOverall = overall
      .map((o) => ({
        user_id: String(o.user_id),
        value: hasActiveGwScores ? (liveBaseOcpByUser.get(o.user_id) ?? 0) + (liveGwByUser.get(o.user_id) ?? 0) : Math.round(Number(o.ocp ?? 0)),
        name: o.name ?? 'User',
      }))
      .sort((a, b) => byValueThenName({ user_id: a.user_id, name: a.name, value: a.value }, { user_id: b.user_id, name: b.name, value: b.value }));

    let currentRank = 1;
    rankedOverall.forEach((row, index) => {
      const prev = rankedOverall[index - 1];
      if (index > 0 && prev && prev.value !== row.value) currentRank = index + 1;
      out.set(row.user_id, currentRank);
    });

    return out;
  }, [activeLeaderboardGw, gwPoints, isNewSeasonFresh, liveGwByUser, overall]);

  const subtitle = React.useMemo(() => {
    const who = scope === 'friends' ? 'Mini League Friends' : 'All Players';
    if (tab === 'overall' && formScope === 'archive_2025_26') {
      return `${who} • ${SEASON_2025_26_LABEL} final rankings`;
    }
    if (tab === 'overall' && formScope === 'none') {
      if (isNewSeasonFresh) return `${who} • ${seasonLabel} (season just started)`;
      return `${who} • ${SEASON_2025_26_LABEL} final rankings`;
    }
    if (formScope === 'last5') return latestGw && latestGw >= 5 ? `${who} • Last 5 GWs` : `${who} (need 5 GWs)`;
    if (formScope === 'last10') return latestGw && latestGw >= 10 ? `${who} • Last 10 GWs` : `${who} (need 10 GWs)`;
    if (formScope === 'sinceStarted')
      return firstSubmissionGw != null ? `${who} since GW${firstSubmissionGw}` : `${who} (submit to see)`;
    if (tab === 'monthly') {
      const monthKey =
        selectedMonthKey ??
        getEffectiveCurrentMonthKey(monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts);
      const month = getMonthAllocations(seasonKey).find((m) => m.monthKey === monthKey);
      if (month) return `GW${month.startGw}–${month.endGw}`;
      return `${who} for this month`;
    }
    // GW tab
    const gw = activeLeaderboardGw;
    if (!gw) return `${who}`;
    const submittedCount = gwSubmittedIds?.size ?? 0;
    if (submittedCount === 0) return `No submissions yet for GW${gw}`;
    return `${who} · GW${gw}`;
  }, [
    activeLeaderboardGw,
    firstSubmissionGw,
    formScope,
    gwLiveFallbackScores,
    gwSubmittedIds,
    isNewSeasonFresh,
    monthAnchorGw,
    monthAvailOpts,
    seasonKey,
    seasonLabel,
    selectedMonthKey,
    tab,
    scope,
    latestGw,
  ]);

  const valueLabel = React.useMemo(() => {
    if (formScope === 'last5' || formScope === 'last10' || formScope === 'sinceStarted') return 'PTS';
    if (tab === 'overall') return 'OCP';
    if (tab === 'monthly') return 'PTS';
    return activeLeaderboardGw ? `GW${activeLeaderboardGw}` : '—';
  }, [activeLeaderboardGw, formScope, tab]);
  const secondaryValueLabel =
    tab === 'overall' &&
    formScope === 'none' &&
    activeLeaderboardGw != null &&
    (isNewSeasonFresh || activeLeaderboardGw <= SEASON_2025_26_END_GW)
      ? `GW${activeLeaderboardGw}`
      : undefined;

  const overallCalendarMenuItems = React.useMemo(() => {
    const items: Array<{ key: FormScope; label: string }> = [
      { key: 'none', label: `${seasonLabel} Season` },
    ];
    // From 2026/27, allow full lookback at last season’s final OCP table.
    if (isNewSeasonFresh || seasonKey === '2026/27') {
      items.push({ key: 'archive_2025_26', label: `${SEASON_2025_26_LABEL} Season` });
    }
    items.push(
      { key: 'last5', label: 'Last 5 weeks' },
      { key: 'last10', label: 'Last 10 weeks' },
      { key: 'sinceStarted', label: 'Since Joined' }
    );
    return items;
  }, [isNewSeasonFresh, seasonKey, seasonLabel]);

  const currentMonthLabel = React.useMemo(() => {
    const monthKey =
      tab === 'monthly' && selectedMonthKey
        ? selectedMonthKey
        : getEffectiveCurrentMonthKey(monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts);
    const month = monthKey ? getMonthAllocations(seasonKey).find((m) => m.monthKey === monthKey) : null;
    return month ? month.label.split(' ')[0] : null;
  }, [tab, selectedMonthKey, monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts]);
  const monthlyCompactValueLabels = React.useMemo(() => {
    if (tab !== 'monthly') return undefined;
    const monthKey =
      selectedMonthKey ??
      getEffectiveCurrentMonthKey(monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts);
    const month = monthKey ? getMonthAllocations(seasonKey).find((m) => m.monthKey === monthKey) : null;
    if (!month) return undefined;
    return Array.from({ length: month.endGw - month.startGw + 1 }, (_, index) => String(month.startGw + index));
  }, [monthAnchorGw, gwLiveFallbackScores, monthAvailOpts, seasonKey, selectedMonthKey, tab]);
  const monthlyLiveValueLabel = React.useMemo(() => {
    if (tab !== 'monthly' || !currentGwIsLive || typeof activeLeaderboardGw !== 'number') return undefined;
    const monthKey =
      selectedMonthKey ??
      getEffectiveCurrentMonthKey(monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts);
    const month = monthKey ? getMonthAllocations(seasonKey).find((m) => m.monthKey === monthKey) : null;
    if (!month) return undefined;
    if (activeLeaderboardGw < month.startGw || activeLeaderboardGw > month.endGw) return undefined;
    return String(activeLeaderboardGw);
  }, [activeLeaderboardGw, currentGwIsLive, gwLiveFallbackScores, monthAnchorGw, monthAvailOpts, seasonKey, selectedMonthKey, tab]);
  const { monthlyWinnerUserIds } = React.useMemo(() => {
    if (tab !== 'monthly' || !rows.length || monthAnchorGw == null) return { monthlyWinnerUserIds: [] as string[] };
    const monthKey =
      selectedMonthKey ??
      getEffectiveCurrentMonthKey(monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts);
    const month = monthKey ? getMonthAllocations(seasonKey).find((m) => m.monthKey === monthKey) : null;
    if (!month) return { monthlyWinnerUserIds: [] as string[] };
    const monthComplete =
      monthAnchorGw > month.endGw ||
      (monthAnchorGw === month.endGw && gwLiveFallbackScores?.isCurrentGwComplete === true);
    if (!monthComplete || rows[0] == null || rows[0].value == null || rows[0].value <= 0) {
      return { monthlyWinnerUserIds: [] as string[] };
    }
    const topValue = rows[0].value;
    const winnerRows = rows.filter((r) => r.value === topValue);
    const userIds = winnerRows.map((r) => r.user_id);
    return { monthlyWinnerUserIds: userIds };
  }, [tab, rows, monthAnchorGw, selectedMonthKey, gwLiveFallbackScores, seasonKey, monthAvailOpts]);

  const selectableMonths = React.useMemo(() => {
    if (tab !== 'monthly') return [] as MonthAllocation[];
    const months = getMonthAllocations(seasonKey);
    const selectable =
      monthAnchorGw != null
        ? months.filter((m) => isMonthAvailable(m, monthAnchorGw, gwLiveFallbackScores, monthAvailOpts))
        : months;
    return [...selectable].reverse();
  }, [tab, monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts]);

  const monthProgressDetail = React.useMemo(() => {
    if (tab !== 'monthly' || monthAnchorGw == null) return null;
    const monthKey =
      selectedMonthKey ??
      getEffectiveCurrentMonthKey(monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts);
    const month = monthKey ? getMonthAllocations(seasonKey).find((m) => m.monthKey === monthKey) : null;
    if (!month) return null;
    const total = month.endGw - month.startGw + 1;
    const isViewingCurrentMonth = monthAnchorGw >= month.startGw && monthAnchorGw <= month.endGw;

    // Season-stack / fresh 26–27 must not use pile-A “GW1 complete” (legacy results still mark GW1 done).
    let isCurrentGwComplete = gwLiveFallbackScores?.isCurrentGwComplete === true;
    let currentGwCompleteFraction = gwLiveFallbackScores?.currentGwCompleteFraction ?? 0;
    if (isNewSeasonFresh || useSeasonStack) {
      if (homeSnapshot) {
        const liveList =
          headerLiveByFixtureIndex.size > 0
            ? Array.from(headerLiveByFixtureIndex.values())
            : homeSnapshot.liveScores ?? [];
        const gwState = getGameweekStateFromSnapshot({
          fixtures: homeSnapshot.fixtures ?? [],
          liveScores: liveList as any,
          hasSubmittedViewingGw: !!homeSnapshot.hasSubmittedViewingGw,
        });
        isCurrentGwComplete = gwState === 'RESULTS_PRE_GW';
        const fixtures = homeSnapshot.fixtures ?? [];
        if (fixtures.length > 0) {
          const finished = liveList.filter((ls: any) => String(ls?.status ?? '') === 'FINISHED').length;
          currentGwCompleteFraction = finished / fixtures.length;
        } else {
          currentGwCompleteFraction = 0;
        }
        // Open / pre-kickoff: bar stays empty (do not count the current open GW as a filled segment).
        if (
          gwState === 'GW_OPEN' ||
          gwState === 'GW_PREDICTED' ||
          gwState === 'DEADLINE_PASSED'
        ) {
          return { progress: 0, completed: 0, total, month, lastSegmentFraction: null };
        }
      } else {
        return { progress: 0, completed: 0, total, month, lastSegmentFraction: null };
      }
    }

    let completed: number;
    let lastSegmentFraction: number | null = null;
    if (monthAnchorGw < month.startGw) completed = 0;
    else if (monthAnchorGw > month.endGw) completed = total;
    else if (isViewingCurrentMonth && !isCurrentGwComplete) {
      completed = monthAnchorGw - month.startGw;
      lastSegmentFraction = currentGwCompleteFraction > 0 ? currentGwCompleteFraction : null;
    } else completed = monthAnchorGw - month.startGw + 1;
    const progress = completed / total + (lastSegmentFraction != null ? lastSegmentFraction / total : 0);
    return { progress, completed, total, month, lastSegmentFraction };
  }, [
    tab,
    selectedMonthKey,
    monthAnchorGw,
    gwLiveFallbackScores?.isCurrentGwComplete,
    gwLiveFallbackScores?.currentGwCompleteFraction,
    seasonKey,
    monthAvailOpts,
    isNewSeasonFresh,
    useSeasonStack,
    homeSnapshot,
    headerLiveByFixtureIndex,
  ]);
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
        typeof activeLeaderboardGw === 'number' ? withTimeout(refetchGwLiveTable(), 8000) : Promise.resolve(),
        typeof activeLeaderboardGw === 'number' ? withTimeout(refetchGwLiveFallbackScores(), 8000) : Promise.resolve(),
        scope === 'friends' ? withTimeout(refetchFriendIds(), 8000) : Promise.resolve(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [activeLeaderboardGw, pullRefreshing, refetchFriendIds, refetchGwLiveFallbackScores, refetchGwLiveTable, refetchGwPoints, refetchOverall, refetchRanks, scope]);

  return (
    <Screen fullBleed>
      {/* No extra bottom padding here; the table handles its own scroll padding.
          This lets the leaderboard container run off-screen at the bottom (more obvious scroll affordance). */}
      <View style={{ flex: 1 }}>
        <AppTopHeader
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => navigation.navigate('Profile')}
          avatarUrl={avatarUrl}
          title={showLiveHeaderScore ? undefined : seasonLabel}
          centerContent={
            showLiveHeaderScore && headerScoreLabel ? (
              <HeaderLiveScore
                scoreLabel={headerScoreLabel}
                fill
                tickerEvent={headerTickerEvent ?? undefined}
                tickerEventKey={headerTickerEventKey}
                expandedStats={headerExpandedStats}
                onSharePress={typeof activeLeaderboardGw === 'number' ? () => openManualResultsScoreSheetShare(activeLeaderboardGw) : undefined}
              />
            ) : undefined
          }
          rightAction={
            // <Pressable
            //   onPress={() => navigation.navigate('Profile' as any, { screen: 'ProfileStats' } as any)}
            //   accessibilityRole="button"
            //   accessibilityLabel="Open stats"
            //   style={({ pressed }) => ({
            //     width: 30,
            //     height: 38,
            //     alignItems: 'center',
            //     justifyContent: 'center',
            //     opacity: pressed ? 0.86 : 1,
            //   })}
            // >
            //   <Ionicons name="analytics-outline" size={24} color={t.color.muted} />
            // </Pressable>
            undefined
          }
          hasLiveGames={currentGwIsLive}
          showLeftLiveBadge={!showLiveHeaderScore}
        />

        <View style={{ flex: 1, minHeight: 0, paddingHorizontal: t.space[4], paddingBottom: 0 }}>
        <View style={{ marginTop: 12 }}>
          <LeaderboardsTabs
            value={tab}
            onChange={setTab}
            currentGw={activeLeaderboardGw}
            currentMonthLabel={currentMonthLabel}
            currentGwIsLive={currentGwIsLive}
          />
        </View>

        {tab === 'monthly' ? (
          <View style={{ marginTop: 22, marginBottom: 18, position: 'relative' }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <TotlText style={{ fontWeight: '900', fontSize: 20, lineHeight: 24, color: t.color.text }}>
                Player of the Month{' '}
              </TotlText>
              <TotlText style={{ fontSize: 14, lineHeight: 20, fontFamily: t.font.medium, color: t.color.text }}>
                ({subtitle})
              </TotlText>
            </View>
            {monthProgressDetail != null && monthProgressDetail.completed < monthProgressDetail.total ? (
              <MonthProgressBar detail={monthProgressDetail} t={t} />
            ) : null}
            <View ref={monthMenuRef} collapsable={false} style={{ position: 'absolute', right: 0, top: 0 }}>
              <Pressable
                onPress={() => {
                  monthMenuRef.current?.measureInWindow((x, y, w, h) => {
                    setMonthMenuPosition({ x, y, width: w, height: h });
                    setMonthMenuOpen(true);
                  });
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  opacity: pressed ? 0.7 : 1,
                })}
                accessibilityLabel="Select month"
                accessibilityRole="button"
              >
                <Ionicons name="calendar-outline" size={20} color={t.color.muted} />
              </Pressable>
            </View>
          </View>
        ) : (
        <View style={{ marginTop: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TotlText variant="sectionSubtitle" style={{ fontSize: 13, lineHeight: 18, flex: 1 }} numberOfLines={1}>
            {subtitle}
          </TotlText>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {tab === 'overall' ? (
              <View ref={calendarIconRef} collapsable={false} style={{ padding: 8, marginLeft: 4 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Form period"
                  onPress={() => {
                    calendarIconRef.current?.measureInWindow((x, y, w, h) => {
                      setCalendarMenuPosition({ x, y, width: w, height: h });
                      setCalendarMenuOpen(true);
                    });
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="calendar-outline" size={20} color={formScope !== 'none' ? t.color.brand : t.color.muted} />
                </Pressable>
              </View>
            ) : null}
            {(tab === 'gw' || tab === 'overall') ? (
            <View ref={filterIconRef} collapsable={false} style={{ padding: 8, marginLeft: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filter"
                onPress={() => {
                  filterIconRef.current?.measureInWindow((x, y, w, h) => {
                    setFilterMenuPosition({ x, y, width: w, height: h });
                    setFilterMenuOpen(true);
                  });
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Ionicons name="funnel-outline" size={20} color={t.color.muted} />
              </Pressable>
            </View>
            ) : null}
          </View>
        </View>
        )}

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
          <>
            <LeaderboardTable
            rows={rows}
            valueLabel={valueLabel}
            compactValueLabels={monthlyCompactValueLabels}
            compactLiveValueLabel={monthlyLiveValueLabel}
            secondaryValueLabel={secondaryValueLabel}
            highlightUserId={userId}
            winnerUserIds={tab === 'monthly' ? monthlyWinnerUserIds : undefined}
            listRef={listRef}
            onPressRow={(row) => {
              setPlayerPicksUserId(String(row.user_id));
              setPlayerPicksUserName(String(row.name ?? 'Player'));
              setPlayerPicksOpponentAvatarUrl(typeof row.avatar_url === 'string' ? row.avatar_url : null);
              setPlayerPicksOpponentOcp(ocpByUserId.get(String(row.user_id)) ?? null);
              setPlayerPicksOpponentOverallRank(overallRankByUserId.get(String(row.user_id)) ?? null);
              setPlayerPicksOpen(true);
            }}
            style={{
              flex: 1,
              // Break out of parent padding so rows are full width.
              marginHorizontal: -t.space[4],
              marginBottom: -24,
            }}
          />
          </>
        ) : null}
        </View>
      </View>

      <LeaderboardPlayerPicksPopup
        open={playerPicksOpen}
        onClose={() => {
          setPlayerPicksOpen(false);
          setPlayerPicksOpponentAvatarUrl(null);
          setPlayerPicksOpponentOcp(null);
          setPlayerPicksOpponentOverallRank(null);
        }}
        gw={activeLeaderboardGw}
        opponentUserId={playerPicksUserId}
        opponentName={playerPicksUserName}
        opponentAvatarUrl={playerPicksOpponentAvatarUrl}
        opponentOcp={playerPicksOpponentOcp}
        opponentOverallRank={playerPicksOpponentOverallRank}
        currentUserId={userId}
        currentUserName={currentUserDisplayName}
        currentUserAvatarUrl={avatarUrl}
      />

      <Modal
        visible={filterMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterMenuOpen(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }}
            onPress={() => setFilterMenuOpen(false)}
          />
          {filterMenuPosition ? (
            <View
              style={{
                position: 'absolute',
                top: filterMenuPosition.y + filterMenuPosition.height + 4,
                right: Dimensions.get('window').width - (filterMenuPosition.x + filterMenuPosition.width),
                width: 200,
                backgroundColor: t.color.surface,
                borderRadius: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => {
                  setScope('all');
                  setFilterMenuOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : scope === 'all' ? 'rgba(28,131,118,0.08)' : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: t.color.border,
                })}
              >
                <TotlText style={{ fontFamily: t.font.medium, fontSize: 15, color: scope === 'all' ? t.color.brand : t.color.text }}>All Players</TotlText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setScope('friends');
                  setFilterMenuOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : scope === 'friends' ? 'rgba(28,131,118,0.08)' : 'transparent',
                })}
              >
                <TotlText style={{ fontFamily: t.font.medium, fontSize: 15, color: scope === 'friends' ? t.color.brand : t.color.text }}>Mini League Friends</TotlText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={calendarMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarMenuOpen(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }}
            onPress={() => setCalendarMenuOpen(false)}
          />
          {calendarMenuPosition ? (
            <View
              style={{
                position: 'absolute',
                top: calendarMenuPosition.y + calendarMenuPosition.height + 4,
                right: Dimensions.get('window').width - (calendarMenuPosition.x + calendarMenuPosition.width),
                width: 240,
                backgroundColor: t.color.surface,
                borderRadius: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
                overflow: 'hidden',
              }}
            >
              {overallCalendarMenuItems.map((item, index, array) => (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setFormScope(item.key);
                    setCalendarMenuOpen(false);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    backgroundColor: pressed
                      ? 'rgba(0,0,0,0.05)'
                      : formScope === item.key
                        ? 'rgba(28,131,118,0.08)'
                        : 'transparent',
                    ...(index < array.length - 1
                      ? { borderBottomWidth: 1, borderBottomColor: t.color.border }
                      : {}),
                  })}
                >
                  <TotlText
                    style={{
                      fontFamily: t.font.medium,
                      fontSize: 15,
                      color: formScope === item.key ? t.color.brand : t.color.text,
                    }}
                  >
                    {item.label}
                  </TotlText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={monthMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthMenuOpen(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }}
            onPress={() => setMonthMenuOpen(false)}
          />
          {monthMenuPosition ? (
            <View
              style={{
                position: 'absolute',
                top: monthMenuPosition.y + monthMenuPosition.height + 4,
                right: Dimensions.get('window').width - (monthMenuPosition.x + monthMenuPosition.width),
                width: 200,
                backgroundColor: t.color.surface,
                borderRadius: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
                overflow: 'hidden',
              }}
            >
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {selectableMonths.map((month, i) => {
                const isSelected =
                  (selectedMonthKey ??
                    getEffectiveCurrentMonthKey(monthAnchorGw, gwLiveFallbackScores, seasonKey, monthAvailOpts)) ===
                  month.monthKey;
                const isLast = i === selectableMonths.length - 1;
                return (
                  <Pressable
                    key={month.monthKey}
                    onPress={() => {
                      setSelectedMonthKey(month.monthKey);
                      setMonthMenuOpen(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : 'transparent',
                      ...(!isLast && { borderBottomWidth: 1, borderBottomColor: t.color.border }),
                    })}
                  >
                    <TotlText style={{ fontFamily: t.font.medium, fontSize: 15, color: isSelected ? t.color.brand : t.color.text }}>
                      {month.label}
                    </TotlText>
                  </Pressable>
                );
              })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

