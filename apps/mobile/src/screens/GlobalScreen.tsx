import React, { useEffect } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import { useNavigation, useRoute, useScrollToTop } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../lib/api';
import { getGameweekStateFromSnapshot } from '../lib/gameweekState';
import { supabase } from '../lib/supabase';
import LeaderboardsTabs, { type LeaderboardsTab, type FormScope } from '../components/leaderboards/LeaderboardsTabs';
import { getMonthAllocations, getMonthForGw, getEffectiveCurrentMonthKey, isMonthAvailable, type MonthAllocation } from '../lib/leaderboardMonths';
import { type LeaderboardsScope } from '../components/leaderboards/LeaderboardsScopeToggle';
import LeaderboardTable, { type LeaderboardRow } from '../components/leaderboards/LeaderboardTable';
import LeaderboardPlayerPicksSheet from '../components/leaderboards/LeaderboardPlayerPicksSheet';
import CenteredSpinner from '../components/CenteredSpinner';
import AppTopHeader from '../components/AppTopHeader';
import HeaderLiveScore from '../components/HeaderLiveScore';
import { useLiveScores } from '../hooks/useLiveScores';
import { buildHeaderScoreSummary, buildHeaderTickerEvent, formatHeaderScoreLabel } from '../lib/headerLiveScore';

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
      duration: 600,
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
  const [filterMenuOpen, setFilterMenuOpen] = React.useState(false);
  const [filterMenuPosition, setFilterMenuPosition] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [calendarMenuOpen, setCalendarMenuOpen] = React.useState(false);
  const [calendarMenuPosition, setCalendarMenuPosition] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [monthMenuOpen, setMonthMenuOpen] = React.useState(false);
  const [monthMenuPosition, setMonthMenuPosition] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
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
  const liveScoresGw =
    typeof homeSnapshot?.viewingGw === 'number'
      ? homeSnapshot.viewingGw
      : typeof homeSnapshot?.currentGw === 'number'
        ? homeSnapshot.currentGw
        : null;
  const { liveByFixtureIndex: liveByFixtureIndexRealtime } = useLiveScores(liveScoresGw, {
    initial: homeSnapshot?.liveScores ?? [],
  });

  const { data: ranks, refetch: refetchRanks, isRefetching: ranksRefetching } = useQuery({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });
  const latestGw = ranks?.latestGw ?? null;
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
    isCurrentGwComplete: boolean;
    currentGwCompleteFraction: number;
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
      const fixtures = (fixturesRes.data ?? []) as { fixture_index?: number }[];
      const allFixturesHaveOutcomes = fixtures.length > 0 && fixtures.every((f) => typeof f?.fixture_index === 'number' && outcomeByFixtureIndex.has(f.fixture_index));
      const isCurrentGwComplete = !hasActiveLiveGames && allFixturesHaveOutcomes;
      const outcomesCount = fixtures.filter((f) => typeof f?.fixture_index === 'number' && outcomeByFixtureIndex.has(f.fixture_index)).length;
      const currentGwCompleteFraction = fixtures.length > 0 ? outcomesCount / fixtures.length : 0;
      return { scores, hasActiveLiveGames, isCurrentGwComplete, currentGwCompleteFraction };
    },
    refetchInterval: tab === 'gw' || tab === 'overall' || tab === 'monthly' ? 10_000 : false,
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

  const computeMonthlyRows = React.useCallback(
    (month: MonthAllocation): LeaderboardRow[] => {
      const pts = gwPoints ?? [];
      const byUser = new Map<string, { name: string; sum: number }>();

      (overall ?? []).forEach((o) => {
        byUser.set(o.user_id, { name: o.name ?? 'User', sum: 0 });
      });

      pts.forEach((p) => {
        if (p.gw < month.startGw || p.gw > month.endGw) return;
        const existing = byUser.get(p.user_id) ?? { name: nameByUserId.get(p.user_id) ?? 'User', sum: 0 };
        existing.sum += Number(p.points ?? 0);
        byUser.set(p.user_id, existing);
      });

      return Array.from(byUser.entries())
        .filter(([, v]) => v.sum > 0)
        .map(([id, v]) => ({ user_id: id, name: v.name, value: v.sum }))
        .sort(byValueThenName);
    },
    [gwPoints, nameByUserId, overall]
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

    // Form scope (from calendar menu) overrides GW and overall when set.
    const endGw = hasActiveLiveGames && gw ? Math.max(1, gw - 1) : gw;
    if (tab === 'overall' && formScope === 'last5') {
      return filterScope(computeFormRows(5, endGw));
    }
    if (tab === 'overall' && formScope === 'last10') {
      return filterScope(computeFormRows(10, endGw));
    }
    if (tab === 'overall' && formScope === 'sinceStarted' && firstSubmissionGw != null) {
      return filterScope(computeSinceStartedRows(firstSubmissionGw, endGw));
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

    // Monthly tab
    if (tab === 'monthly') {
      const monthKey = selectedMonthKey ?? getEffectiveCurrentMonthKey(gw, gwLiveFallbackScores);
      const month = getMonthAllocations().find((m) => m.monthKey === monthKey);
      if (month) return filterScope(computeMonthlyRows(month));
      return [];
    }

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
  }, [
    computeFormRows,
    computeSinceStartedRows,
    computeMonthlyRows,
    filterScope,
    firstSubmissionGw,
    formScope,
    gwLiveFallbackScores,
    gwLiveTable?.rows,
    gwPoints,
    latestGw,
    nameByUserId,
    overall,
    selectedMonthKey,
    tab,
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

  const subtitle = React.useMemo(() => {
    const who = scope === 'friends' ? 'Mini League Friends' : 'All Players';
    if (tab === 'overall' && formScope === 'none') return `${who} since the start of the season`;
    if (formScope === 'last5') return latestGw && latestGw >= 5 ? `${who} • Last 5 GWs` : `${who} (need 5 GWs)`;
    if (formScope === 'last10') return latestGw && latestGw >= 10 ? `${who} • Last 10 GWs` : `${who} (need 10 GWs)`;
    if (formScope === 'sinceStarted')
      return firstSubmissionGw != null ? `${who} since GW${firstSubmissionGw}` : `${who} (submit to see)`;
    if (tab === 'monthly') {
      const monthKey = selectedMonthKey ?? getEffectiveCurrentMonthKey(latestGw ?? null, gwLiveFallbackScores);
      const month = getMonthAllocations().find((m) => m.monthKey === monthKey);
      if (month) return `GW${month.startGw}–${month.endGw}`;
      return `${who} for this month`;
    }
    return latestGw ? `${who} who submitted for GW${latestGw}` : `${who} who submitted for the last GW`;
  }, [firstSubmissionGw, formScope, gwLiveFallbackScores, latestGw, scope, selectedMonthKey, tab]);

  const valueLabel = React.useMemo(() => {
    if (formScope === 'last5' || formScope === 'last10' || formScope === 'sinceStarted') return 'PTS';
    if (tab === 'overall') return 'OCP';
    if (tab === 'monthly') return 'PTS';
    return latestGw ? `GW${latestGw}` : '—';
  }, [formScope, latestGw, tab]);
  const secondaryValueLabel = tab === 'overall' && formScope === 'none' && latestGw ? `GW${latestGw}` : undefined;
  const currentMonthLabel = React.useMemo(() => {
    const monthKey = tab === 'monthly' && selectedMonthKey
      ? selectedMonthKey
      : getEffectiveCurrentMonthKey(latestGw ?? null, gwLiveFallbackScores);
    const month = monthKey ? getMonthAllocations().find((m) => m.monthKey === monthKey) : null;
    return month ? month.label.split(' ')[0] : null;
  }, [tab, selectedMonthKey, latestGw, gwLiveFallbackScores]);
  const { monthlyWinnerUserIds } = React.useMemo(() => {
    if (tab !== 'monthly' || !rows.length || latestGw == null) return { monthlyWinnerUserIds: [] as string[] };
    const monthKey = selectedMonthKey ?? getEffectiveCurrentMonthKey(latestGw, gwLiveFallbackScores);
    const month = monthKey ? getMonthAllocations().find((m) => m.monthKey === monthKey) : null;
    if (!month) return { monthlyWinnerUserIds: [] as string[] };
    const monthComplete = latestGw > month.endGw || (latestGw === month.endGw && gwLiveFallbackScores?.isCurrentGwComplete === true);
    if (!monthComplete) return { monthlyWinnerUserIds: [] as string[] };
    const topValue = rows[0]!.value;
    const winnerRows = rows.filter((r) => r.value === topValue);
    const userIds = winnerRows.map((r) => r.user_id);
    return { monthlyWinnerUserIds: userIds };
  }, [tab, rows, latestGw, selectedMonthKey, gwLiveFallbackScores]);

  const selectableMonths = React.useMemo(() => {
    if (tab !== 'monthly') return [] as MonthAllocation[];
    const months = getMonthAllocations();
    const selectable = latestGw != null ? months.filter((m) => isMonthAvailable(m, latestGw, gwLiveFallbackScores)) : months;
    return [...selectable].reverse();
  }, [tab, latestGw, gwLiveFallbackScores]);

  const monthProgressDetail = React.useMemo(() => {
    if (tab !== 'monthly' || latestGw == null) return null;
    const monthKey = selectedMonthKey ?? getEffectiveCurrentMonthKey(latestGw, gwLiveFallbackScores);
    const month = monthKey ? getMonthAllocations().find((m) => m.monthKey === monthKey) : null;
    if (!month) return null;
    const total = month.endGw - month.startGw + 1;
    const isCurrentGwComplete = gwLiveFallbackScores?.isCurrentGwComplete === true;
    const isViewingCurrentMonth = latestGw >= month.startGw && latestGw <= month.endGw;
    const currentGwCompleteFraction = gwLiveFallbackScores?.currentGwCompleteFraction ?? 0;
    let completed: number;
    let lastSegmentFraction: number | null = null;
    if (latestGw < month.startGw) completed = 0;
    else if (latestGw > month.endGw) completed = total;
    else if (isViewingCurrentMonth && !isCurrentGwComplete) {
      completed = latestGw - month.startGw;
      lastSegmentFraction = currentGwCompleteFraction;
    } else completed = latestGw - month.startGw + 1;
    const progress = completed / total + (lastSegmentFraction != null ? lastSegmentFraction / total : 0);
    return { progress, completed, total, month, lastSegmentFraction };
  }, [tab, selectedMonthKey, latestGw, gwLiveFallbackScores?.isCurrentGwComplete, gwLiveFallbackScores?.currentGwCompleteFraction]);
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
          title={showLiveHeaderScore ? undefined : 'Leaderboards'}
          centerContent={
            showLiveHeaderScore && headerScoreLabel ? (
              <HeaderLiveScore
                scoreLabel={headerScoreLabel}
                fill
                tickerEvent={headerTickerEvent ?? undefined}
                tickerEventKey={headerTickerEventKey}
              />
            ) : undefined
          }
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
          hasLiveGames={currentGwIsLive}
          showLeftLiveBadge={!showLiveHeaderScore}
        />

        <View style={{ flex: 1, minHeight: 0, paddingHorizontal: t.space[4], paddingBottom: 0 }}>
        <View style={{ marginTop: 12 }}>
          <LeaderboardsTabs
            value={tab}
            onChange={setTab}
            currentGw={latestGw}
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
            secondaryValueLabel={secondaryValueLabel}
            highlightUserId={userId}
            winnerUserIds={tab === 'monthly' ? monthlyWinnerUserIds : undefined}
            listRef={listRef}
            onPressRow={(row) => {
              setPlayerPicksUserId(String(row.user_id));
              setPlayerPicksUserName(String(row.name ?? 'Player'));
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

      <LeaderboardPlayerPicksSheet
        open={playerPicksOpen}
        onClose={() => setPlayerPicksOpen(false)}
        gw={latestGw}
        userId={playerPicksUserId}
        userName={playerPicksUserName}
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
                  setFormScope('none');
                  setCalendarMenuOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : formScope === 'none' ? 'rgba(28,131,118,0.08)' : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: t.color.border,
                })}
              >
                <TotlText style={{ fontFamily: t.font.medium, fontSize: 15, color: formScope === 'none' ? t.color.brand : t.color.text }}>
                  This season
                </TotlText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFormScope('last5');
                  setCalendarMenuOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : formScope === 'last5' ? 'rgba(28,131,118,0.08)' : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: t.color.border,
                })}
              >
                <TotlText style={{ fontFamily: t.font.medium, fontSize: 15, color: formScope === 'last5' ? t.color.brand : t.color.text }}>
                  Last 5 weeks
                </TotlText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFormScope('last10');
                  setCalendarMenuOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : formScope === 'last10' ? 'rgba(28,131,118,0.08)' : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: t.color.border,
                })}
              >
                <TotlText style={{ fontFamily: t.font.medium, fontSize: 15, color: formScope === 'last10' ? t.color.brand : t.color.text }}>
                  Last 10 weeks
                </TotlText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFormScope('sinceStarted');
                  setCalendarMenuOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : formScope === 'sinceStarted' ? 'rgba(28,131,118,0.08)' : 'transparent',
                })}
              >
                <TotlText style={{ fontFamily: t.font.medium, fontSize: 15, color: formScope === 'sinceStarted' ? t.color.brand : t.color.text }}>
                  Since Joined
                </TotlText>
              </Pressable>
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
                const isSelected = (selectedMonthKey ?? getEffectiveCurrentMonthKey(latestGw ?? null, gwLiveFallbackScores)) === month.monthKey;
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

