import React from 'react';
import { AppState, Animated, Image, Pressable, Share, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Polygon, Stop } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';
import { Ionicons } from '@expo/vector-icons';
import Carousel from 'react-native-reanimated-carousel';
import type { ICarouselInstance } from 'react-native-reanimated-carousel';
import Reanimated, { Extrapolation, FadeIn, FadeOut, LinearTransition, interpolate, useSharedValue } from 'react-native-reanimated';
import type { Fixture, GwResultRow, GwResults, HomeRanks, HomeSnapshot, LiveScore, LiveStatus, Pick } from '@totl/domain';
import { api } from '../lib/api';
import { TotlRefreshControl } from '../lib/refreshControl';
import { supabase } from '../lib/supabase';
import { env } from '../env';
import GameweekAdvanceTransition from '../components/transitions/GameweekAdvanceTransition';
import { useGameweekAdvanceTransition } from '../hooks/useGameweekAdvanceTransition';
import FixtureCard from '../components/FixtureCard';
import { MiniLeaguesDefaultBatchCard } from '../components/MiniLeaguesDefaultList';
import { getGameweekStateFromSnapshot, type GameweekState } from '../lib/gameweekState';
import PickPill from '../components/home/PickPill';
import SectionHeaderRow from '../components/home/SectionHeaderRow';
import CarouselDots from '../components/home/CarouselDots';
import CarouselWithPagination from '../components/home/CarouselWithPagination';
import CarouselFocusShell from '../components/home/CarouselFocusShell';
import SectionTitle from '../components/home/SectionTitle';
import { LeaderboardCardResultsCta } from '../components/home/LeaderboardCards';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import CenteredSpinner from '../components/CenteredSpinner';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import { sortLeaguesByUnread } from '../lib/sortLeaguesByUnread';
import GameweekCountdownItem from '../components/home/GameweekCountdownItem';
import MiniLeagueLiveCard from '../components/home/MiniLeagueLiveCard';
import { useLiveScores } from '../hooks/useLiveScores';
import TopStatusBanner from '../components/home/TopStatusBanner';
import AppTopHeader from '../components/AppTopHeader';
import WinnerShimmer from '../components/WinnerShimmer';
import { TEAM_BADGES } from '../lib/teamBadges';
import { getTeamColor, normalizeTeamCode } from '../lib/teamColors';
import { getMediumName } from '../../../../src/lib/teamNames';

type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
type LeagueSummary = LeaguesResponse['leagues'][number];

function getErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function formatMinute(status: LiveStatus, minute: number | null | undefined) {
  if (status === 'FINISHED') return 'FT';
  if (status === 'PAUSED') return 'HT';
  if (status === 'IN_PLAY') return typeof minute === 'number' ? `${minute}'` : 'LIVE';
  return '';
}


function deadlineCountdown(
  fixtures: Fixture[],
  nowMs: number
): {
  text: string;
  expired: boolean;
} | null {
  const firstKickoff = fixtures
    .map((f) => (f.kickoff_time ? new Date(f.kickoff_time) : null))
    .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (!firstKickoff) return null;

  const DEADLINE_BUFFER_MINUTES = 75;
  const deadline = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
  const diffMs = deadline.getTime() - nowMs;
  if (diffMs <= 0) return { text: '0d 0h 0m', expired: true };

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { text: `${days}d ${hours}h ${minutes}m`, expired: false };
}

function fixtureDateLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'No date';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fixtureDateTimeLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'No date';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'No date';
  const datePart = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
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

export default function HomeScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const scrollRef = React.useRef<any>(null);
  useScrollToTop(scrollRef);
  const { width: screenWidth } = useWindowDimensions();
  const advanceTransition = useGameweekAdvanceTransition({ totalMs: 1050 });
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [hasAccessToken, setHasAccessToken] = React.useState<boolean | null>(null);
  const { unreadByLeagueId } = useLeagueUnreadCounts();
  const [dismissedCountdownGw, setDismissedCountdownGw] = React.useState<number | null>(null);
  const [pullRefreshing, setPullRefreshing] = React.useState(false);

  React.useEffect(() => {
    // Keep countdowns fresh without being noisy.
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setHasAccessToken(Boolean(data.session?.access_token));
      } catch {
        if (cancelled) return;
        setHasAccessToken(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: home,
    isLoading: homeLoading,
    error: homeError,
    refetch: refetchHome,
    isRefetching: homeRefetching,
  } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });

  const isHomeLoading = Boolean(homeLoading);

  const {
    data: leagues,
    error: leaguesError,
    refetch: refetchLeagues,
    isRefetching: leaguesRefetching,
  } = useQuery<LeaguesResponse>({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const { data: profileSummary } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  const { data: authUser } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 60_000,
  });

  const userId = authUser?.id ? String(authUser.id) : null;

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

  const avatarUrl =
    (typeof (profileSummary as any)?.avatar_url === 'string' ? String((profileSummary as any).avatar_url) : null) ??
    (typeof avatarRow?.avatar_url === 'string' ? String(avatarRow.avatar_url) : null);

  const { data: ranks, refetch: refetchRanks, isRefetching: ranksRefetching } = useQuery<HomeRanks>({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });

  const latestCompletedGw = ranks?.latestGw ?? null;
  const shouldFetchLatestGwResults =
    typeof latestCompletedGw === 'number' &&
    (typeof ranks?.gwRank?.score !== 'number' || typeof ranks?.gwRank?.totalFixtures !== 'number');
  const { data: latestGwResults } = useQuery<GwResults>({
    enabled: shouldFetchLatestGwResults,
    queryKey: ['gwResults', latestCompletedGw],
    queryFn: () => api.getGwResults(latestCompletedGw as number),
  });

  const fixtures: Fixture[] = home?.fixtures ?? [];
  const userPicks: Record<string, Pick> = home?.userPicks ?? {};

  const liveScoresGw =
    typeof home?.viewingGw === 'number' ? home.viewingGw : typeof home?.currentGw === 'number' ? home.currentGw : null;
  const { liveByFixtureIndex: liveByFixtureIndexRealtime } = useLiveScores(liveScoresGw, {
    initial: home?.liveScores ?? [],
  });

  const firstKickoffTimeMs = React.useMemo(() => {
    const first = fixtures
      .map((f) => (f.kickoff_time ? new Date(f.kickoff_time).getTime() : NaN))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];
    return typeof first === 'number' && Number.isFinite(first) ? first : null;
  }, [fixtures]);

  React.useEffect(() => {
    if (typeof firstKickoffTimeMs !== 'number') return;

    // Ensure we re-render exactly at kickoff (otherwise the 30s tick can lag the UI).
    const n = Date.now();
    const delayMs = Math.max(0, Math.min(2_147_483_647, firstKickoffTimeMs - n + 25));
    const id = setTimeout(() => setNowMs(Date.now()), delayMs);
    return () => clearTimeout(id);
  }, [firstKickoffTimeMs]);

  React.useEffect(() => {
    // If the user backgrounded the app around kickoff, force a time refresh on resume.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNowMs(Date.now());
    });
    return () => sub.remove();
  }, []);

  const resultByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, Pick>();
    (home?.gwResults ?? []).forEach((r: GwResultRow) => m.set(r.fixture_index, r.result));
    return m;
  }, [home?.gwResults]);

  const liveByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, LiveScore>();
    if (!home) return m;
    if (liveByFixtureIndexRealtime.size > 0) return liveByFixtureIndexRealtime;
    const apiMatchIdToFixtureIndex = new Map<number, number>();
    home.fixtures.forEach((f: Fixture) => {
      if (typeof f.api_match_id === 'number') apiMatchIdToFixtureIndex.set(f.api_match_id, f.fixture_index);
    });
    (home.liveScores ?? []).forEach((ls: LiveScore) => {
      const idx =
        typeof ls.fixture_index === 'number'
          ? ls.fixture_index
          : typeof ls.api_match_id === 'number'
            ? apiMatchIdToFixtureIndex.get(ls.api_match_id)
            : undefined;
      if (typeof idx !== 'number') return;
      m.set(idx, ls);
    });
    return m;
  }, [home, liveByFixtureIndexRealtime]);

  const fixturesByDate = React.useMemo(() => {
    const groups = new Map<string, Fixture[]>();
    fixtures.forEach((f: Fixture) => {
      const key = fixtureDateLabel(f.kickoff_time ?? null);
      const arr = groups.get(key) ?? [];
      arr.push(f);
      groups.set(key, arr);
    });

    // Sort fixtures within each group by fixture_index (matches web’s stable ordering)
    groups.forEach((arr, key) => {
      groups.set(
        key,
        [...arr].sort((a, b) => Number(a?.fixture_index ?? 0) - Number(b?.fixture_index ?? 0))
      );
    });

    // Sort chronologically when possible (like web)
    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (a === 'No date') return 1;
      if (b === 'No date') return -1;
      const a0 = groups.get(a)?.[0]?.kickoff_time;
      const b0 = groups.get(b)?.[0]?.kickoff_time;
      const da = a0 ? new Date(a0).getTime() : Number.POSITIVE_INFINITY;
      const db = b0 ? new Date(b0).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });

    return keys.map((k) => ({ date: k, fixtures: groups.get(k) ?? [] }));
  }, [fixtures]);

  // Match web: only show per-date section headers when there are multiple dates in the GW.
  // Otherwise it duplicates the date already shown under the GW header.
  const showFixtureDateSections = fixturesByDate.length > 1;

  const scoreSummary = React.useMemo(() => {
    if (!fixtures.length) return null;

    let started = 0;
    let live = 0;
    let correct = 0;
    for (const f of fixtures) {
      const fixtureIndex = f.fixture_index;
      const pick = userPicks[String(fixtureIndex)];

      const ls = liveByFixtureIndex.get(fixtureIndex);
      const st: LiveStatus = ls?.status ?? 'SCHEDULED';
      // IMPORTANT: `live_scores` can be missing/pruned after a GW finishes. Final outcomes live in `app_gw_results`.
      const resultFromDb = resultByFixtureIndex.get(fixtureIndex);
      const hasFinalResult = resultFromDb === 'H' || resultFromDb === 'D' || resultFromDb === 'A';
      const isStartedFromLive = st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED';
      const isStarted = hasFinalResult || isStartedFromLive;
      if (!isStarted) continue;
      started += 1;
      if (st === 'IN_PLAY' || st === 'PAUSED') live += 1;

      if (!pick) continue;

      const outcome: Pick | null = hasFinalResult
        ? resultFromDb
        : typeof ls?.home_score === 'number' && typeof ls?.away_score === 'number'
          ? ls.home_score > ls.away_score
            ? 'H'
            : ls.home_score < ls.away_score
              ? 'A'
              : 'D'
          : null;
      if (!outcome) continue;

      if (outcome === pick) correct += 1;
    }

    return { started, live, correct, total: fixtures.length };
  }, [fixtures, liveByFixtureIndex, resultByFixtureIndex, userPicks]);

  const refreshing = pullRefreshing;
  const onRefresh = React.useCallback(async () => {
    if (pullRefreshing) return;
    setPullRefreshing(true);
    try {
      await Promise.allSettled([
        withTimeout(refetchHome(), 8000),
        withTimeout(refetchLeagues(), 8000),
        withTimeout(refetchRanks(), 8000),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [pullRefreshing, refetchHome, refetchLeagues, refetchRanks]);
  const [activeLeagueIndex, setActiveLeagueIndex] = React.useState<number>(0);
  const mlAbsoluteProgress = useSharedValue(0);
  const mlCarouselItemWidthSV = useSharedValue(0);
  const mlSidePeekSV = useSharedValue(0);
  const mlFirstItemOffsetSV = useSharedValue(0);

  // SectionTitle/RoundIconButton/PickPill/SectionHeaderRow/LeaderboardCards are extracted into `src/components/home/*`.

  const LB_BADGE_5 = require('../../../../dist/assets/5-week-form-badge.png');

  // Leaderboard cards and pills are now shared components.

  const FixtureCardRow = ({ f }: { f: Fixture }) => (
    <FixtureCard
      fixture={f}
      liveScore={liveByFixtureIndex.get(f.fixture_index) ?? null}
      pick={userPicks[String(f.fixture_index)]}
      result={resultByFixtureIndex.get(Number(f.fixture_index)) ?? null}
      pickPercentages={pickPercentagesByFixture.get(Number(f.fixture_index)) ?? null}
      showPickButtons={!!home?.hasSubmittedViewingGw}
      pickedAvatarUri={avatarUrl}
      variant="grouped"
    />
  );
  const FixtureCardDetailsRow = ({ f }: { f: Fixture }) => (
    <FixtureCard
      {...({
        fixture: f,
        liveScore: liveByFixtureIndex.get(f.fixture_index) ?? null,
        pick: userPicks[String(f.fixture_index)],
        result: resultByFixtureIndex.get(Number(f.fixture_index)) ?? null,
        pickPercentages: pickPercentagesByFixture.get(Number(f.fixture_index)) ?? null,
        showPickButtons: !!home?.hasSubmittedViewingGw,
        pickedAvatarUri: avatarUrl,
        variant: 'grouped',
        detailsOnly: true,
        inverted: false,
      } as any)}
    />
  );
  const [expandedFixtureId, setExpandedFixtureId] = React.useState<string | null>(null);
  const [showAllExpanded, setShowAllExpanded] = React.useState(false);
  const [popFixtureId, setPopFixtureId] = React.useState<string | null>(null);
  const popScale = React.useRef(new Animated.Value(1)).current;
  const [cardHeightsById, setCardHeightsById] = React.useState<Record<string, number>>({});
  const scoreCardId = '__gw_score_card__';
  const [scrollSpreadPx, setScrollSpreadPx] = React.useState(0);
  const scrollSpreadRef = React.useRef(0);
  const hasUserScrolledRef = React.useRef(false);
  const introBreathValue = React.useRef(new Animated.Value(0)).current;
  const stackFixtures = React.useMemo(
    () => [...fixtures].sort((a, b) => Number(a?.fixture_index ?? 0) - Number(b?.fixture_index ?? 0)),
    [fixtures]
  );
  const renderedStackFixtures = React.useMemo(() => {
    return stackFixtures;
  }, [stackFixtures]);
  const anyFixtureExpanded = showAllExpanded || !!expandedFixtureId;
  const expandedFixtureIndex = React.useMemo(
    () => (expandedFixtureId ? stackFixtures.findIndex((f) => String(f.id) === expandedFixtureId) : -1),
    [expandedFixtureId, stackFixtures]
  );
  const collapsedStackStep = 62;
  const referenceFixtureCardHeight = React.useMemo(() => {
    const firstFixture = renderedStackFixtures[0];
    if (!firstFixture) return 320;
    return cardHeightsById[String(firstFixture.id)] ?? 320;
  }, [cardHeightsById, renderedStackFixtures]);
  const stackCardCount = renderedStackFixtures.length + 1;
  const collapsedStackTailHeight = React.useMemo(() => {
    return cardHeightsById[scoreCardId] ?? referenceFixtureCardHeight;
  }, [cardHeightsById, referenceFixtureCardHeight, scoreCardId]);
  const collapsedStackHeight = React.useMemo(() => {
    const count = stackCardCount;
    if (count <= 0) return 0;
    return (count - 1) * collapsedStackStep + collapsedStackTailHeight;
  }, [collapsedStackStep, collapsedStackTailHeight, stackCardCount]);
  const expandedCardHeight = React.useMemo(() => {
    if (!expandedFixtureId) return 320;
    return cardHeightsById[expandedFixtureId] ?? 320;
  }, [cardHeightsById, expandedFixtureId]);
  const expandedStackPush = React.useMemo(() => {
    if (expandedFixtureIndex < 0) return 0;
    const revealedGapPx = 12;
    // Keep a fixed gap between bottom of revealed card and top of next stacked card.
    return Math.max(0, expandedCardHeight - collapsedStackStep + revealedGapPx);
  }, [collapsedStackStep, expandedCardHeight, expandedFixtureIndex]);
  const stackSpreadHeight = React.useMemo(
    () => Math.max(0, stackCardCount - 1) * scrollSpreadPx,
    [stackCardCount, scrollSpreadPx]
  );
  const stackContainerHeight = React.useMemo(() => {
    if (showAllExpanded) return 0;
    if (!anyFixtureExpanded || expandedFixtureIndex < 0) return collapsedStackHeight + stackSpreadHeight;
    const expandedTop = expandedFixtureIndex * collapsedStackStep;
    const expandedBottom = expandedTop + expandedCardHeight + 12;
    const shiftedStackBottom = collapsedStackHeight + expandedStackPush;
    return Math.max(expandedBottom, shiftedStackBottom) + stackSpreadHeight;
  }, [
    showAllExpanded,
    anyFixtureExpanded,
    collapsedStackHeight,
    collapsedStackStep,
    expandedCardHeight,
    expandedFixtureIndex,
    expandedStackPush,
    stackSpreadHeight,
  ]);

  const handleMainScroll = React.useCallback((e: any) => {
    if (!hasUserScrolledRef.current) {
      hasUserScrolledRef.current = true;
      introBreathValue.stopAnimation();
    }
    const y = Number(e?.nativeEvent?.contentOffset?.y ?? 0);
    const pull = Math.max(0, -y);
    const down = Math.max(0, y);
    // Subtle "breathing" spread: stronger on pull-to-refresh, lighter on normal scroll.
    const nextSpread = Math.min(14, pull * 0.16 + Math.min(6, down * 0.03));
    if (Math.abs(nextSpread - scrollSpreadRef.current) < 0.25) return;
    scrollSpreadRef.current = nextSpread;
    setScrollSpreadPx(nextSpread);
  }, [introBreathValue]);

  React.useEffect(() => {
    const id = introBreathValue.addListener(({ value }) => {
      if (hasUserScrolledRef.current) return;
      scrollSpreadRef.current = value;
      setScrollSpreadPx(value);
    });

    const startId = setTimeout(() => {
      if (hasUserScrolledRef.current) return;
      Animated.sequence([
        Animated.timing(introBreathValue, {
          toValue: 6,
          duration: 240,
          useNativeDriver: false,
        }),
        Animated.timing(introBreathValue, {
          toValue: 0,
          duration: 320,
          useNativeDriver: false,
        }),
      ]).start();
    }, 120);

    return () => {
      clearTimeout(startId);
      introBreathValue.stopAnimation();
      introBreathValue.removeListener(id);
    };
  }, [introBreathValue]);

  const triggerRevealPop = React.useCallback((fixtureId: string) => {
    setPopFixtureId(fixtureId);
    popScale.stopAnimation();
    popScale.setValue(1);
    Animated.sequence([
      Animated.spring(popScale, {
        toValue: 1.032,
        friction: 7,
        tension: 145,
        useNativeDriver: true,
      }),
      Animated.spring(popScale, {
        toValue: 0.994,
        friction: 8,
        tension: 135,
        useNativeDriver: true,
      }),
      Animated.spring(popScale, {
        toValue: 1,
        friction: 9,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setPopFixtureId((current) => (current === fixtureId ? null : current));
      }
    });
  }, [popScale]);

  const handleToggleFixture = React.useCallback((fixtureId: string) => {
    if (showAllExpanded) {
      setShowAllExpanded(false);
    }
    if (expandedFixtureId === fixtureId) {
      setExpandedFixtureId(null);
      setPopFixtureId(null);
      popScale.stopAnimation();
      popScale.setValue(1);
      return;
    }

    setExpandedFixtureId(fixtureId);
    triggerRevealPop(fixtureId);
  }, [expandedFixtureId, popScale, showAllExpanded, triggerRevealPop]);

  const handleShowAll = React.useCallback(() => {
    if (showAllExpanded) {
      setShowAllExpanded(false);
      return;
    }
    setShowAllExpanded(true);
    setExpandedFixtureId(null);
    setPopFixtureId(null);
    popScale.stopAnimation();
    popScale.setValue(1);
  }, [popScale, showAllExpanded]);

  React.useEffect(() => {
    if (!expandedFixtureId) return;
    const exists = stackFixtures.some((f) => String(f.id) === expandedFixtureId);
    if (!exists) setExpandedFixtureId(null);
  }, [expandedFixtureId, stackFixtures]);

  React.useEffect(() => {
    return () => {
      popScale.stopAnimation();
    };
  }, [popScale]);

  const handleShare = async () => {
    try {
      const gw = home?.viewingGw ?? home?.currentGw ?? null;
      if (typeof gw === 'number') {
        navigation.navigate('GameweekResults', { gw, mode: 'fixturesShare' });
        return;
      }
      await Share.share({ message: 'Join me on TOTL.' });
    } catch {
      // ignore
    }
  };

  const viewingGwLabel = home?.viewingGw ? `Gameweek ${home.viewingGw}` : 'Gameweek';
  const viewingGwSubtitle = React.useMemo(() => {
    // If we are already rendering date section headers, don't duplicate the date under the GW title.
    if (showFixtureDateSections) return undefined;
    // Match the web’s “Sat 17 Jan” feel when possible.
    const first = fixtures.find((f) => f.kickoff_time)?.kickoff_time;
    if (!first) return undefined;
    const d = new Date(first);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }, [fixtures, showFixtureDateSections]);

  const scorePill = React.useMemo(() => {
    if (!scoreSummary) {
      return { label: 'Score', score: '--', total: '--', bg: t.color.surface2, border: t.color.border, dot: false };
    }
    const label = scoreSummary.live > 0 ? 'Live' : 'Score';
    const score = home?.hasSubmittedViewingGw ? String(scoreSummary.correct) : '--';
    const total = String(scoreSummary.total);
    if (label === 'Live') return { label, score, total, bg: '#DC2626', border: 'transparent', dot: true };
    return { label, score, total, bg: t.color.surface2, border: t.color.border, dot: false };
  }, [home?.hasSubmittedViewingGw, scoreSummary, t.color.border, t.color.surface2]);
  const shareScoreLabel = `${scorePill.score}/${scorePill.total}`;
  const gwState: GameweekState | null = React.useMemo(() => {
    if (!home) return null;
    return getGameweekStateFromSnapshot({
      fixtures: home.fixtures ?? [],
      liveScores: home.liveScores ?? [],
      hasSubmittedViewingGw: !!home.hasSubmittedViewingGw,
      now: new Date(nowMs),
    });
  }, [home, nowMs]);

  const gwIsLive = (scoreSummary?.live ?? 0) > 0;
  const viewingGw = home?.viewingGw ?? null;
  const currentGw = home?.currentGw ?? null;
  const hasActiveLiveGames = React.useMemo(() => {
    const liveScores = home?.liveScores ?? [];
    return liveScores.some((ls) => ls?.status === 'IN_PLAY' || ls?.status === 'PAUSED');
  }, [home?.liveScores]);
  const hasAnyGwResults = (home?.gwResults?.length ?? 0) > 0;
  const inferredResultsPreGw = !hasActiveLiveGames && hasAnyGwResults;
  const isResultsPreGw = gwState === 'RESULTS_PRE_GW' || inferredResultsPreGw;
  const showReadyToMoveOn =
    typeof currentGw === 'number' && typeof viewingGw === 'number' ? viewingGw < currentGw : false;
  const showComingSoonBanner =
    isResultsPreGw &&
    typeof currentGw === 'number' &&
    typeof viewingGw === 'number' &&
    viewingGw >= currentGw;
  const performanceRailTopMargin = 16;
  const hasMovedOn = typeof currentGw === 'number' && typeof viewingGw === 'number' ? viewingGw >= currentGw : true;
  const deadline = React.useMemo(() => deadlineCountdown(fixtures, nowMs), [fixtures, nowMs]);
  const deadlineExpired = deadline?.expired ?? false;
  const viewingGwForPickPercentages = typeof home?.viewingGw === 'number' ? home.viewingGw : null;

  const { data: pickPercentageRows } = useQuery<Array<{ fixture_index: number; pick: Pick }>>({
    enabled: deadlineExpired && typeof viewingGwForPickPercentages === 'number',
    queryKey: ['home-pick-percentages', viewingGwForPickPercentages],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_picks')
        .select('fixture_index, pick')
        .eq('gw', viewingGwForPickPercentages as number);
      if (error) {
        console.warn('[HomeScreen] Failed to load pick percentages', error.message);
        return [];
      }
      const rows = (data ?? []) as Array<{ fixture_index: unknown; pick: unknown }>;
      return rows
        .filter(
          (row): row is { fixture_index: number; pick: Pick } =>
            typeof row.fixture_index === 'number' && (row.pick === 'H' || row.pick === 'D' || row.pick === 'A')
        )
        .map((row) => ({ fixture_index: row.fixture_index, pick: row.pick }));
    },
    staleTime: 30_000,
  });

  const pickPercentagesByFixture = React.useMemo(() => {
    const out = new Map<number, Partial<Record<Pick, number>>>();
    const countsByFixture = new Map<number, { H: number; D: number; A: number; total: number }>();
    (pickPercentageRows ?? []).forEach((row) => {
      const current = countsByFixture.get(row.fixture_index) ?? { H: 0, D: 0, A: 0, total: 0 };
      current[row.pick] += 1;
      current.total += 1;
      countsByFixture.set(row.fixture_index, current);
    });

    countsByFixture.forEach((counts, fixtureIndex) => {
      if (counts.total <= 0) return;
      out.set(fixtureIndex, {
        H: Math.round((counts.H / counts.total) * 100),
        D: Math.round((counts.D / counts.total) * 100),
        A: Math.round((counts.A / counts.total) * 100),
      });
    });
    return out;
  }, [pickPercentageRows]);

  const contentWidth = Math.max(280, screenWidth - t.space[4] * 2);
  /**
   * Mini Leagues carousel sizing:
   * - Center the active card so (when not at the edges) you can see both left + right neighbors.
   * - Keep a 12px gap between cards.
   */
  const mlCardGap = 12;
  // Carousel viewport should be full width (cancel the ScrollView padding around it).
  const mlCarouselViewportWidth = screenWidth;
  const mlCarouselOuterGutter = t.space[4];
  // Card width: 83% of the viewport with a tablet cap, so we always get a “next card” peek.
  const ML_CARD_WIDTH_RATIO = 0.83;
  const ML_CARD_MAX_WIDTH = 400;
  const mlCardWidth = Math.round(Math.min(mlCarouselViewportWidth * ML_CARD_WIDTH_RATIO, ML_CARD_MAX_WIDTH));
  // Step distance between cards (card width + gap).
  const mlCarouselItemWidth = mlCardWidth + mlCardGap;
  // Where the active card's LEFT edge should be when centered (index 1+).
  const mlSidePeek = Math.max(0, (mlCarouselViewportWidth - mlCardWidth) / 2);
  // IMPORTANT: `react-native-reanimated-carousel` defaults height to "100%" if you don't pass it,
  // which can create a huge blank block inside a vertical ScrollView (looks like a blank screen).
  const mlCarouselHeight = 352;
  const mlDefaultCarouselRef = React.useRef<ICarouselInstance>(null);

  React.useEffect(() => {
    mlCarouselItemWidthSV.value = mlCarouselItemWidth;
    mlSidePeekSV.value = mlSidePeek;
    // Index 0: align the card with the page gutter.
    mlFirstItemOffsetSV.value = mlCarouselOuterGutter;
  }, [mlCarouselItemWidth, mlSidePeek, mlCarouselOuterGutter, mlCarouselItemWidthSV, mlSidePeekSV, mlFirstItemOffsetSV]);

  const showMakePicksBanner =
    hasMovedOn &&
    (gwState === 'GW_OPEN' || gwState === 'DEADLINE_PASSED') &&
    home?.hasSubmittedViewingGw === false;

  const defaultLeagueBatches = React.useMemo(() => {
    const leagueList: LeagueSummary[] = sortLeaguesByUnread(leagues?.leagues ?? [], unreadByLeagueId);
    const out: Array<Array<LeagueSummary>> = [];
    const batchSize = 3;
    for (let i = 0; i < leagueList.length; i += batchSize) out.push(leagueList.slice(i, i + batchSize));
    return out;
  }, [leagues?.leagues, unreadByLeagueId]);

  const liveLeagueList = React.useMemo(() => {
    return sortLeaguesByUnread(leagues?.leagues ?? [], unreadByLeagueId);
  }, [leagues?.leagues, unreadByLeagueId]);

  // Keep Mini Leagues in live-table mode during LIVE and RESULTS_PRE_GW.
  // This includes the period before/after next GW publish, until user moves on.
  const showMiniLeaguesLiveCards = typeof viewingGw === 'number' && (gwState === 'LIVE' || isResultsPreGw);

  const miniLeaguesPageCount = showMiniLeaguesLiveCards ? liveLeagueList.length : defaultLeagueBatches.length;

  React.useEffect(() => {
    // Keep dots index stable when leagues change.
    if (!miniLeaguesPageCount) {
      if (activeLeagueIndex !== 0) setActiveLeagueIndex(0);
      return;
    }
    if (activeLeagueIndex < 0) setActiveLeagueIndex(0);
    if (activeLeagueIndex >= miniLeaguesPageCount) setActiveLeagueIndex(miniLeaguesPageCount - 1);
  }, [activeLeagueIndex, miniLeaguesPageCount]);
//VERTICAL SPACING CONTROL HERE
  const errorMessage = homeError ? getErrorMessage(homeError) : leaguesError ? getErrorMessage(leaguesError) : null;
  const SECTION_GAP_Y = 40; // visual rhythm between major sections (spec)
  const MINI_TO_GW_GAP_Y = -20; // slightly tighter to balance the heavier mini leagues block

  // Mini Leagues block spacing controls.
  // - Gap between carousel cards and the pagination dots (per view).
  const ML_DEFAULT_DOTS_GAP_Y = -40;
  const ML_LIVE_DOTS_GAP_Y = 0;
  // - Gap between the carousel section (viewport+dots) and the content below it (per view).
  const ML_DEFAULT_SECTION_BOTTOM_PADDING = MINI_TO_GW_GAP_Y +80;

  // Each view keeps its own viewport height so dots stay visually attached to the bottom of that view.
  const ML_DEFAULT_HEIGHT = 350;

  // Initial/empty load: avoid rendering empty/broken home sections while waiting on BFF/Railway.
  if (homeLoading && !home && !homeError) {
    return (
      <GameweekAdvanceTransition controller={advanceTransition}>
        <Screen fullBleed>
          <CenteredSpinner loading />
        </Screen>
      </GameweekAdvanceTransition>
    );
  }

  return (
    <GameweekAdvanceTransition controller={advanceTransition}>
      <Screen fullBleed>
        <AppTopHeader
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => navigation.navigate('Profile')}
          avatarUrl={avatarUrl}
        />

        <Animated.ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          onScroll={handleMainScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: t.space[4],
            paddingTop: 8,
            // Ensure the last fixture isn't hidden behind the floating bottom tab bar.
            paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
          }}
          refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
        {isHomeLoading && <TotlText variant="muted">Loading…</TotlText>}

        {/* Coming soon state is now represented as a carousel card. */}

        {/* GW Transition banner (RESULTS_PRE_GW but next GW published) */}
        {showReadyToMoveOn ? (
          <TopStatusBanner
            title="Ready to move on?"
            icon="flash"
            actionLabel={typeof currentGw === 'number' ? `Gameweek ${currentGw}` : 'Gameweek'}
            actionAccessibilityLabel="Move to next gameweek"
            actionDisabled={advanceTransition.isAnimating}
            onActionPress={() => {
              if (typeof currentGw !== 'number') return;
              advanceTransition.start({
                nextGameweekLabel: `GAMEWEEK ${currentGw}`,
                onAdvance: async () => {
                  await api.updateNotificationPrefs({ current_viewing_gw: currentGw });
                  await Promise.all([refetchHome(), refetchLeagues(), refetchRanks()]);
                },
              });
            }}
          />
        ) : null}

        {/* Predictions banner (after move-on, user hasn't submitted for current GW) */}
        {showMakePicksBanner && typeof viewingGw === 'number' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to predictions"
            disabled={advanceTransition.isAnimating || deadlineExpired}
            onPress={() => {
              if (advanceTransition.isAnimating) return;
              if (deadlineExpired) return;
              navigation.navigate('PredictionsFlow');
            }}
            style={({ pressed }) => ({
              backgroundColor: '#e9f0ef',
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 12,
              marginBottom: 10,
              opacity: deadlineExpired ? 0.6 : pressed ? 0.92 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexShrink: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#1C8376',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}
                  >
                    <TotlText style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 10 }}>!</TotlText>
                  </View>
                  <TotlText style={{ fontFamily: 'Gramatika-Bold', fontWeight: '700', fontSize: 16, lineHeight: 18 }}>
                    Gameweek {viewingGw} Predictions
                  </TotlText>
                </View>
                <TotlText variant="muted" style={{ marginLeft: 30 }}>
                  Deadline{' '}
                  {deadline?.text ? (
                    <TotlText style={{ color: deadlineExpired ? '#64748B' : '#1C8376', fontWeight: '700' }}>
                      {deadline.text}
                    </TotlText>
                  ) : (
                    '—'
                  )}
                </TotlText>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: t.radius.pill,
                    backgroundColor: deadlineExpired ? '#94A3B8' : '#1C8376',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Medium', fontWeight: '500' }}>Go</TotlText>
                  <View style={{ width: 6 }} />
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </Pressable>
        ) : null}

        {(homeError || leaguesError) && (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="heading" style={{ marginBottom: 8 }}>
              Couldn’t load everything
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {errorMessage ?? 'Unknown error'}
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 2 }}>
              BFF: {String(env.EXPO_PUBLIC_BFF_URL)}
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              Auth token: {hasAccessToken === null ? 'unknown' : hasAccessToken ? 'present' : 'missing'}
            </TotlText>
            <Button title="Retry" onPress={onRefresh} loading={refreshing} />
          </Card>
        )}

        {/*
          GW kickoff countdown banner (disabled for now).
          Keeping the implementation here for easy re-enable later.
        */}
        {/*
        {(() => {
          const wallNowMs = Date.now();
          const firstFixture = fixtures
            .filter((f) => {
              const k = f?.kickoff_time ? new Date(f.kickoff_time).getTime() : NaN;
              return Number.isFinite(k);
            })
            .map((f) => ({ f, k: new Date(f.kickoff_time as string).getTime() }))
            .sort((a, b) => a.k - b.k)[0]?.f;

          const firstFixtureKickoffTimeMs = firstFixture?.kickoff_time ? new Date(firstFixture.kickoff_time).getTime() : null;
          const predictionsLocked = Boolean(home?.hasSubmittedViewingGw) || deadlineExpired;
          const viewingGwForCountdown =
            typeof home?.viewingGw === 'number' ? home.viewingGw : typeof home?.currentGw === 'number' ? home.currentGw : null;

          const countdownVisible =
            predictionsLocked === true &&
            typeof viewingGwForCountdown === 'number' &&
            typeof firstFixtureKickoffTimeMs === 'number' &&
            Number.isFinite(firstFixtureKickoffTimeMs) &&
            wallNowMs < firstFixtureKickoffTimeMs &&
            dismissedCountdownGw !== viewingGwForCountdown;

          if (!countdownVisible || !firstFixtureKickoffTimeMs || !firstFixture) return null;

          return (
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <GameweekCountdownItem
                variant="banner"
                gw={viewingGwForCountdown}
                kickoffTimeMs={firstFixtureKickoffTimeMs}
                homeCode={String(firstFixture?.home_code ?? '').toUpperCase() || null}
                awayCode={String(firstFixture?.away_code ?? '').toUpperCase() || null}
                onKickedOff={() => setDismissedCountdownGw(viewingGwForCountdown)}
              />
            </View>
          );
        })()}
        */}

        {/* Full-bleed horizontal row (remove side margins from the page padding) */}
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -t.space[4], marginTop: performanceRailTopMargin, marginBottom: SECTION_GAP_Y }}
          contentContainerStyle={{ paddingHorizontal: t.space[4], paddingBottom: 12 }}
        >
          {(() => {
            const gw = ranks?.latestGw ?? home?.viewingGw ?? null;
            const scoreFromRanks = ranks?.gwRank?.score;
            const totalFromRanks = ranks?.gwRank?.totalFixtures;

            const fallbackScore =
              typeof latestGwResults?.score === 'number' && Number.isFinite(latestGwResults.score)
                ? String(latestGwResults.score)
                : '--';
            const fallbackTotal =
              typeof latestGwResults?.totalFixtures === 'number' && Number.isFinite(latestGwResults.totalFixtures)
                ? String(latestGwResults.totalFixtures)
                : '--';

            const score = typeof scoreFromRanks === 'number' ? String(scoreFromRanks) : fallbackScore;
            const total = typeof totalFromRanks === 'number' ? String(totalFromRanks) : fallbackTotal;

            const lastGwDisplay =
              ranks?.gwRank?.percentileLabel ??
              (latestGwResults?.gwRank && latestGwResults?.gwRankTotal
                ? `Top ${Math.max(1, Math.min(100, Math.round((latestGwResults.gwRank / latestGwResults.gwRankTotal) * 100)))}%`
                : 'Top —');

            const cards: Array<{ key: string; node: React.JSX.Element }> = [];

            const showReadyToPredictCta = showMakePicksBanner && typeof home?.viewingGw === 'number' && !deadlineExpired;
            const showResultsCta =
              gwState === 'RESULTS_PRE_GW' && !!home?.hasSubmittedViewingGw && typeof home?.viewingGw === 'number';
            const resultsGw = typeof home?.viewingGw === 'number' ? home.viewingGw : ranks?.latestGw ?? null;

            if (showReadyToPredictCta && resultsGw) {
              cards.push({
                key: 'gw-ready-to-predict',
                node: (
                  <LeaderboardCardResultsCta
                    gw={resultsGw}
                    badge={LB_BADGE_5}
                    label="Ready to predict (swipe)"
                    onPress={() => navigation.navigate('PredictionsFlow')}
                  />
                ),
              });
            } else if (showResultsCta && resultsGw) {
              cards.push({
                key: 'gw-results',
                node: (
                  <LeaderboardCardResultsCta
                    gw={resultsGw}
                    badge={LB_BADGE_5}
                    score={score}
                    totalFixtures={total}
                    onPress={() => navigation.navigate('GameweekResults', { gw: resultsGw })}
                  />
                ),
              });
            }

            if (showComingSoonBanner) {
              const upcomingGw = typeof currentGw === 'number' ? currentGw + 1 : null;
              cards.push({
                key: 'gw-coming-soon',
                node: (
                  <LeaderboardCardResultsCta
                    topLabel={upcomingGw ? `Gameweek ${upcomingGw}` : 'Gameweek'}
                    leftNode={<Ionicons name="time-outline" size={24} color="#FFFFFF" />}
                    badge={null}
                    label="Coming Soon!"
                    gradientColors={['#73B6AC', '#5FA39A']}
                    showSheen={false}
                  />
                ),
              });
            }

            cards.push({
              key: 'performance-summary-cta',
              node: (
                <LeaderboardCardResultsCta
                  topLabel="OVERALL"
                  badge={LB_BADGE_5}
                  gradientColors={['#73B6AC', '#5FA39A']}
                  showSheen={false}
                  label="Your Performance"
                  onPress={() => navigation.navigate('Global', { initialTab: 'overall' })}
                />
              ),
            });

            return cards.map((c, idx) => (
              <View key={c.key} style={{ marginRight: idx === cards.length - 1 ? 0 : 10 }}>
                {c.node}
              </View>
            ));
          })()}
        </Animated.ScrollView>

        {/* Mini leagues list removed from merged Predictions hub (moved to Mini Leagues page top rail). */}
        {false ? (
        <>
        <View style={{ marginTop: 0 }}>
          <SectionHeaderRow
            title="Mini leagues"
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  onPress={() => navigation.navigate('Leagues')}
                  accessibilityRole="button"
                  accessibilityLabel="See all mini leagues"
                  style={({ pressed }) => ({
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <TotlText
                    style={{
                      fontFamily: 'Gramatika-Regular',
                      fontWeight: '400',
                      fontSize: 14,
                      lineHeight: 14,
                      color: '#1C8376',
                      textAlign: 'right',
                    }}
                  >
                    See all
                  </TotlText>
                </Pressable>
              </View>
            }
          />
        </View>
        {leagues?.leagues?.length ? (
          showMiniLeaguesLiveCards ? (
            <CarouselWithPagination
              carouselRef={mlDefaultCarouselRef}
              width={mlCarouselViewportWidth}
              height={mlCarouselHeight}
              data={liveLeagueList}
              progress={mlAbsoluteProgress}
              currentIndex={activeLeagueIndex}
              onIndexChange={(idx) => setActiveLeagueIndex(idx)}
              dotsGap={ML_LIVE_DOTS_GAP_Y}
              sectionBottomPadding={ML_DEFAULT_SECTION_BOTTOM_PADDING}
              dotsName="Mini leagues"
              customAnimation={(value) => {
                'worklet';
                const step = mlCarouselItemWidthSV.value;
                const sidePeek = mlSidePeekSV.value;
                const firstOffset = mlFirstItemOffsetSV.value;
                const translate = value * step;
                const offset = interpolate(mlAbsoluteProgress.value, [0, 1], [firstOffset, sidePeek], Extrapolation.CLAMP);
                const z = Math.max(0, 100 - Math.round(Math.abs(value) * 10));
                return { transform: [{ translateX: offset + translate }], zIndex: z, elevation: z };
              }}
              style={{
                width: mlCarouselViewportWidth,
                height: mlCarouselHeight,
                marginHorizontal: -mlCarouselOuterGutter,
              }}
              containerStyle={{ paddingBottom: 0 }}
              renderItem={({ item: league, animationValue }) => {
                const leagueId = String(league.id);
                const enabled =
                  leagueId === String(liveLeagueList[activeLeagueIndex]?.id ?? '') ||
                  leagueId === String(liveLeagueList[activeLeagueIndex - 1]?.id ?? '') ||
                  leagueId === String(liveLeagueList[activeLeagueIndex + 1]?.id ?? '');

                return (
                  <CarouselFocusShell animationValue={animationValue} width={mlCardWidth}>
                    <MiniLeagueLiveCard
                      leagueId={leagueId}
                      leagueName={String(league.name ?? '')}
                      leagueAvatar={typeof league.avatar === 'string' ? league.avatar : null}
                      gw={viewingGw as number}
                      width={mlCardWidth}
                      enabled={enabled}
                      onPress={() =>
                        navigation.navigate('LeagueDetail', { leagueId, name: String(league.name ?? '') })
                      }
                    />
                  </CarouselFocusShell>
                );
              }}
            />
          ) : (
            <CarouselWithPagination
              carouselRef={mlDefaultCarouselRef}
              width={mlCarouselViewportWidth}
              height={ML_DEFAULT_HEIGHT}
              data={defaultLeagueBatches}
              progress={mlAbsoluteProgress}
              currentIndex={activeLeagueIndex}
              onIndexChange={(idx) => setActiveLeagueIndex(idx)}
              dotsGap={ML_DEFAULT_DOTS_GAP_Y}
              sectionBottomPadding={ML_DEFAULT_SECTION_BOTTOM_PADDING}
              dotsName="Mini leagues"
              customAnimation={(value) => {
                'worklet';
                const step = mlCarouselItemWidthSV.value;
                const sidePeek = mlSidePeekSV.value;
                const firstOffset = mlFirstItemOffsetSV.value;
                const translate = value * step;
                const offset = interpolate(mlAbsoluteProgress.value, [0, 1], [firstOffset, sidePeek], Extrapolation.CLAMP);
                const z = Math.max(0, 100 - Math.round(Math.abs(value) * 10));
                return { transform: [{ translateX: offset + translate }], zIndex: z, elevation: z };
              }}
              style={{
                width: mlCarouselViewportWidth,
                height: ML_DEFAULT_HEIGHT,
                marginHorizontal: -mlCarouselOuterGutter,
              }}
              containerStyle={{ paddingBottom: 0 }}
              renderItem={({ item: batch, animationValue }) => (
                <CarouselFocusShell animationValue={animationValue} width={mlCardWidth}>
                  <MiniLeaguesDefaultBatchCard
                    width={mlCardWidth}
                    batch={batch.map((l) => ({
                      id: String(l.id),
                      name: String(l.name ?? ''),
                      avatarUri: resolveLeagueAvatarUri(typeof l.avatar === 'string' ? l.avatar : null),
                    }))}
                    onLeaguePress={(leagueId, name) =>
                      navigation.navigate('LeagueDetail', { leagueId, name })
                    }
                  />
                </CarouselFocusShell>
              )}
            />
          )
        ) : (
          <Card style={{ marginBottom: MINI_TO_GW_GAP_Y }}>
            <TotlText variant="muted">No leagues yet.</TotlText>
          </Card>
        )}
        </>
        ) : null}

        {/* Predictions section */}
        <View style={{ marginTop: 0 }}>
          <SectionHeaderRow
            title={typeof home?.viewingGw === 'number' ? `Gameweek ${home.viewingGw}` : 'Gameweek'}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  onPress={handleShowAll}
                  accessibilityRole="button"
                  accessibilityLabel={showAllExpanded ? 'Return to stack view' : 'Show all fixtures'}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 40,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: 'rgba(15,23,42,0.14)',
                    backgroundColor: '#FFFFFF',
                    marginRight: 8,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <TotlText
                    style={{
                      color: '#334155',
                      fontFamily: 'Gramatika-Medium',
                      fontWeight: '700',
                      fontSize: 13,
                      lineHeight: 14,
                    }}
                  >
                      {showAllExpanded ? 'Stack view' : 'Show all'}
                  </TotlText>
                </Pressable>
                <Pressable
                  onPress={handleShare}
                  accessibilityRole="button"
                  accessibilityLabel={`Share score ${shareScoreLabel}`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 40,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: 'rgba(15,23,42,0.14)',
                    backgroundColor: '#FFFFFF',
                    opacity: fixtures.length === 0 ? 0.45 : pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                  disabled={fixtures.length === 0}
                >
                  <TotlText
                    style={{
                      color: '#1C8376',
                      fontFamily: 'Gramatika-Medium',
                      fontWeight: '900',
                      fontSize: 15,
                      lineHeight: 16,
                    }}
                  >
                    {shareScoreLabel}
                  </TotlText>
                  <View style={{ width: 7 }} />
                  <Ionicons name="share-outline" size={18} color="#334155" />
                </Pressable>
              </View>
            }
          />
        </View>

        {fixtures.length === 0 && !homeLoading ? (
          <Card
            style={{
              marginBottom: 12,
              padding: 0,
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
            }}
          >
            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <TotlText variant="muted">No fixtures yet. Pull to refresh.</TotlText>
            </View>
          </Card>
        ) : (
          <View style={showAllExpanded ? undefined : { position: 'relative', height: stackContainerHeight }}>
          {renderedStackFixtures.map((f: Fixture, idx: number) => {
            const fixtureId = String(f.id);
            const isExpanded = expandedFixtureId === fixtureId;
            const isExpandedVisual = showAllExpanded || isExpanded;
            const baseTop = idx * collapsedStackStep;
            const spread = scrollSpreadPx * idx;
            const top = anyFixtureExpanded && idx > expandedFixtureIndex
              ? baseTop + expandedStackPush + spread
              : baseTop + spread;
            const ls = liveByFixtureIndex.get(f.fixture_index) ?? null;
            const st: LiveStatus = (ls?.status as LiveStatus) ?? 'SCHEDULED';
            const hasScore =
              typeof ls?.home_score === 'number' &&
              typeof ls?.away_score === 'number' &&
              (st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED');
            const headerPrimary = hasScore
              ? `${ls?.home_score ?? 0} - ${ls?.away_score ?? 0}`
              : fixtureDateLabel(f.kickoff_time ?? null);
            const headerSecondary = hasScore ? formatMinute(st, ls?.minute) : '';
            const homeCode = normalizeTeamCode(f.home_code);
            const awayCode = normalizeTeamCode(f.away_code);
            const homeBadge = TEAM_BADGES[homeCode] ?? null;
            const awayBadge = TEAM_BADGES[awayCode] ?? null;
            const headerHome = getMediumName(String(f.home_name ?? f.home_team ?? homeCode ?? 'Home'));
            const headerAway = getMediumName(String(f.away_name ?? f.away_team ?? awayCode ?? 'Away'));
            const pick = userPicks[String(f.fixture_index)];
            const resultFromDb = resultByFixtureIndex.get(Number(f.fixture_index)) ?? null;
            const hasFinalResult = resultFromDb === 'H' || resultFromDb === 'D' || resultFromDb === 'A';
            const derivedOutcome: Pick | null =
              hasFinalResult
                ? resultFromDb
                : typeof ls?.home_score === 'number' && typeof ls?.away_score === 'number'
                  ? ls.home_score > ls.away_score
                    ? 'H'
                    : ls.home_score < ls.away_score
                      ? 'A'
                      : 'D'
                  : null;
            const isCorrectPick =
              !!pick &&
              !!derivedOutcome &&
              pick === derivedOutcome &&
              (hasFinalResult || st === 'FINISHED');
            const isIncorrectPick =
              !!pick &&
              !!derivedOutcome &&
              pick !== derivedOutcome &&
              (hasFinalResult || st === 'FINISHED');
            const homeGradientColor = getTeamColor(homeCode, headerHome);
            const awayGradientColor = getTeamColor(awayCode, headerAway);
            const gradientBorderWidth = 5;

            return (
              <Reanimated.View
                key={fixtureId}
                layout={LinearTransition.springify().damping(20).stiffness(220).mass(0.95)}
                entering={FadeIn.duration(90)}
                exiting={FadeOut.duration(90)}
                onLayout={(event) => {
                  const measured = event.nativeEvent.layout.height;
                  if (!Number.isFinite(measured) || measured <= 0) return;
                  setCardHeightsById((prev) => {
                    const existing = prev[fixtureId];
                    if (typeof existing === 'number' && Math.abs(existing - measured) <= 1) return prev;
                    return { ...prev, [fixtureId]: measured };
                  });
                }}
                style={{
                  ...(showAllExpanded
                    ? {
                        position: 'relative',
                        left: undefined,
                        right: undefined,
                        top: undefined,
                        zIndex: undefined,
                        marginTop: idx === 0 ? 0 : 8,
                      }
                    : {
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top,
                        zIndex: idx + 1,
                      }),
                  shadowColor: '#0F172A',
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 0,
                }}
              >
                <Animated.View
                  style={{
                    transform: [{ scale: popFixtureId === fixtureId ? popScale : 1 }],
                  }}
                >
                <View
                  style={{
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    overflow: 'hidden',
                  }}
                >
                  <LinearGradient
                    colors={[homeGradientColor, awayGradientColor]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.22)']}
                    locations={[0, 0.45, 1]}
                    start={{ x: 0.04, y: 0 }}
                    end={{ x: 0.98, y: 1 }}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                  />
                  <LinearGradient
                    colors={['rgba(248,250,252,0.16)', 'rgba(241,245,249,0.12)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                  />
                  {isCorrectPick ? <WinnerShimmer durationMs={1900} delayMs={0} opacity={0.12} tint="white" /> : null}
                  <Card
                    style={{
                      marginLeft: gradientBorderWidth,
                      marginRight: gradientBorderWidth,
                      marginTop: gradientBorderWidth,
                      marginBottom: gradientBorderWidth,
                      padding: 0,
                      backgroundColor: '#FFFFFF',
                      borderColor: 'transparent',
                      borderWidth: 0,
                      borderTopLeftRadius: 14,
                      borderTopRightRadius: 14,
                      borderBottomLeftRadius: 14,
                      borderBottomRightRadius: 14,
                      shadowOpacity: 0,
                      shadowRadius: 0,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 0,
                    }}
                  >
                  <View style={{ borderRadius: 14, overflow: 'hidden' }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${headerHome} versus ${headerAway}`}
                      onPress={() => handleToggleFixture(fixtureId)}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.96 : 1,
                      })}
                    >
                        <View style={{ paddingHorizontal: 16, paddingTop: 17, paddingBottom: 2, backgroundColor: '#FFFFFF' }}>
                        {isCorrectPick ? (
                          <View
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: 40,
                              height: 40,
                              zIndex: 3,
                            }}
                          >
                            <Svg width={40} height={40} viewBox="0 0 40 40">
                              <Defs>
                                <SvgLinearGradient id={`winner-corner-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                  <Stop offset="0%" stopColor="#FACC15" />
                                  <Stop offset="35%" stopColor="#F97316" />
                                  <Stop offset="68%" stopColor="#EC4899" />
                                  <Stop offset="100%" stopColor="#9333EA" />
                                </SvgLinearGradient>
                              </Defs>
                              <Polygon points="0,0 40,0 0,40" fill={`url(#winner-corner-${idx})`} />
                            </Svg>
                            <View style={{ position: 'absolute', left: 7, top: 4 }}>
                              <Ionicons name="checkmark-sharp" size={15} color="#FFFFFF" />
                            </View>
                          </View>
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <TotlText numberOfLines={1} style={{ fontWeight: '800', color: '#0F172A', flexShrink: 1, textAlign: 'right' }}>
                              {headerHome}
                            </TotlText>
                          </View>

                          <View style={{ minWidth: 98, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                              {homeBadge ? <Image source={homeBadge} style={{ width: 26, height: 26, marginRight: 4 }} /> : null}
                              <TotlText style={{ fontWeight: '900', color: '#0F172A' }}>{headerPrimary}</TotlText>
                              {awayBadge ? <Image source={awayBadge} style={{ width: 26, height: 26, marginLeft: 4 }} /> : null}
                            </View>
                          </View>

                          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                            <TotlText numberOfLines={1} style={{ fontWeight: '800', color: '#0F172A', flexShrink: 1, textAlign: 'left' }}>
                              {headerAway}
                            </TotlText>
                          </View>
                        </View>

                        {headerSecondary ? (
                          <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                            <TotlText variant="microMuted" style={{ color: '#334155' }}>{headerSecondary}</TotlText>
                          </View>
                        ) : null}
                        </View>
                    </Pressable>

                    <View>
                      <FixtureCardDetailsRow f={f} />
                      <View
                        style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingTop: 4,
                          paddingBottom: 12,
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <TotlText
                          style={{
                            color: '#334155',
                            fontFamily: 'Gramatika-Medium',
                            fontSize: 13,
                            lineHeight: 14,
                            letterSpacing: 0.4,
                          }}
                          numberOfLines={1}
                        >
                          {fixtureDateTimeLabel(f.kickoff_time ?? null)}
                        </TotlText>
                      </View>
                    </View>
                  </View>
                  </Card>
                </View>
                </Animated.View>
              </Reanimated.View>
            );
          })}
          {(() => {
            const idx = renderedStackFixtures.length;
            const baseTop = idx * collapsedStackStep;
            const spread = scrollSpreadPx * idx;
            const top = anyFixtureExpanded && idx > expandedFixtureIndex
              ? baseTop + expandedStackPush + spread
              : baseTop + spread;
            const scoreTitle = typeof home?.viewingGw === 'number' ? `Gameweek ${home.viewingGw} Score` : 'Gameweek Score';
            return (
              <Reanimated.View
                key={scoreCardId}
                layout={LinearTransition.springify().damping(20).stiffness(220).mass(0.95)}
                entering={FadeIn.duration(90)}
                exiting={FadeOut.duration(90)}
                onLayout={(event) => {
                  const measured = event.nativeEvent.layout.height;
                  if (!Number.isFinite(measured) || measured <= 0) return;
                  setCardHeightsById((prev) => {
                    const existing = prev[scoreCardId];
                    if (typeof existing === 'number' && Math.abs(existing - measured) <= 1) return prev;
                    return { ...prev, [scoreCardId]: measured };
                  });
                }}
                style={{
                  ...(showAllExpanded
                    ? {
                        position: 'relative',
                        left: undefined,
                        right: undefined,
                        top: undefined,
                        zIndex: undefined,
                        marginTop: 8,
                      }
                    : {
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top,
                        zIndex: idx + 1,
                      }),
                }}
              >
                <View
                  style={{
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    overflow: 'hidden',
                    minHeight: referenceFixtureCardHeight,
                  }}
                >
                  <LinearGradient
                    colors={['#34D399', '#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                  >
                    <WinnerShimmer durationMs={2000} delayMs={0} opacity={0.14} tint="white" />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Share ${scoreTitle}`}
                      onPress={handleShare}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingHorizontal: 16,
                        paddingVertical: 16,
                        opacity: pressed ? 0.96 : 1,
                      })}
                    >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          <TotlText style={{ fontSize: 32, fontWeight: '300', color: '#FFFFFF', lineHeight: 38 }}>
                            {scorePill.score}
                          </TotlText>
                          <TotlText
                            variant="caption"
                            style={{ color: 'rgba(255,255,255,0.92)', fontSize: 16, lineHeight: 20, fontWeight: '700' }}
                          >
                            {' '}
                            /{scorePill.total}
                          </TotlText>
                        </View>
                        <Ionicons name="share-outline" size={24} color="rgba(255,255,255,0.95)" />
                      </View>
                      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <TotlText
                          variant="caption"
                          style={{
                            color: 'rgba(255,255,255,0.8)',
                            marginBottom: 8,
                            fontWeight: '700',
                            letterSpacing: 0.8,
                            fontSize: 14,
                            lineHeight: 18,
                            textTransform: 'uppercase',
                          }}
                        >
                          {typeof home?.viewingGw === 'number' ? `Gameweek ${home.viewingGw}` : scoreTitle}
                        </TotlText>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                          <TotlText numberOfLines={1} style={{ fontSize: 14, lineHeight: 18, fontWeight: '900', color: '#FFFFFF', flex: 1 }}>
                            Your results
                          </TotlText>
                        </View>
                      </View>
                    </View>
                    </Pressable>
                  </LinearGradient>
                </View>
              </Reanimated.View>
            );
          })()}
          </View>
        )}
        {__DEV__ ? (
          <View style={{ marginTop: 12 }}>
            <TotlText variant="muted">Dev: BFF {String(env.EXPO_PUBLIC_BFF_URL)}</TotlText>
            <TotlText variant="muted">
              Dev: Auth token {hasAccessToken === null ? 'unknown' : hasAccessToken ? 'present' : 'missing'}
            </TotlText>
          </View>
        ) : null}
        </Animated.ScrollView>
      </Screen>
    </GameweekAdvanceTransition>
  );
}

