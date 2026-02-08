import React from 'react';
import { AppState, Animated, type ImageSourcePropType, Image, Pressable, Share, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Carousel from 'react-native-reanimated-carousel';
import type { ICarouselInstance } from 'react-native-reanimated-carousel';
import { Extrapolation, interpolate, useSharedValue } from 'react-native-reanimated';
import type { Fixture, GwResultRow, GwResults, HomeRanks, HomeSnapshot, LiveScore, LiveStatus, Pick, RankBadge } from '@totl/domain';
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
import RoundIconButton from '../components/home/RoundIconButton';
import SectionHeaderRow from '../components/home/SectionHeaderRow';
import CarouselDots from '../components/home/CarouselDots';
import CarouselWithPagination from '../components/home/CarouselWithPagination';
import CarouselFocusShell from '../components/home/CarouselFocusShell';
import SectionTitle from '../components/home/SectionTitle';
import { LeaderboardCardLastGw, LeaderboardCardResultsCta, LeaderboardCardSimple } from '../components/home/LeaderboardCards';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import CenteredSpinner from '../components/CenteredSpinner';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import { sortLeaguesByUnread } from '../lib/sortLeaguesByUnread';
import GameweekCountdownItem from '../components/home/GameweekCountdownItem';
import MiniLeagueLiveCard from '../components/home/MiniLeagueLiveCard';
import { useLiveScores } from '../hooks/useLiveScores';

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

export default function HomeScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const scrollRef = React.useRef<any>(null);
  useScrollToTop(scrollRef);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = useWindowDimensions();
  const advanceTransition = useGameweekAdvanceTransition({ totalMs: 1050 });
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [hasAccessToken, setHasAccessToken] = React.useState<boolean | null>(null);
  const { unreadByLeagueId } = useLeagueUnreadCounts();
  const [dismissedCountdownGw, setDismissedCountdownGw] = React.useState<number | null>(null);

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

  const refreshing = homeRefetching || leaguesRefetching || ranksRefetching;
  const onRefresh = () => {
    void Promise.all([refetchHome(), refetchLeagues(), refetchRanks()]);
  };
  const [activeLeagueIndex, setActiveLeagueIndex] = React.useState<number>(0);
  const mlAbsoluteProgress = useSharedValue(0);
  const mlCarouselItemWidthSV = useSharedValue(0);
  const mlSidePeekSV = useSharedValue(0);
  const mlFirstItemOffsetSV = useSharedValue(0);

  // SectionTitle/RoundIconButton/PickPill/SectionHeaderRow/LeaderboardCards are extracted into `src/components/home/*`.

  const LB_BADGE_5 = require('../../../../dist/assets/5-week-form-badge.png');
  const LB_BADGE_10 = require('../../../../dist/assets/10-week-form-badge.png');
  const LB_BADGE_SEASON = require('../../../../dist/assets/season-rank-badge.png');

  function leaderboardBadgeFor(title: string): ImageSourcePropType | null {
    const t = title.toUpperCase();
    if (t.includes('5')) return LB_BADGE_5;
    if (t.includes('10')) return LB_BADGE_10;
    if (t.includes('SEASON')) return LB_BADGE_SEASON;
    return null;
  }

  function leaderboardIconText(title: string): string {
    const t = title.toUpperCase();
    if (t.includes('GW')) return 'GW';
    if (t.includes('5')) return '5';
    if (t.includes('10')) return '10';
    if (t.includes('SEASON')) return 'S';
    return '—';
  }

  // Leaderboard cards and pills are now shared components.

  const FixtureCardRow = ({ f }: { f: Fixture }) => (
    <FixtureCard
      fixture={f}
      liveScore={liveByFixtureIndex.get(f.fixture_index) ?? null}
      pick={userPicks[String(f.fixture_index)]}
      result={resultByFixtureIndex.get(Number(f.fixture_index)) ?? null}
      showPickButtons={!!home?.hasSubmittedViewingGw}
      variant="grouped"
    />
  );

  const handleShare = async () => {
    try {
      const gw = home?.viewingGw ?? home?.currentGw ?? null;
      const line1 = gw ? `TOTL — Gameweek ${gw}` : 'TOTL';
      const line2 =
        home && scoreSummary && home.hasSubmittedViewingGw
          ? `My score: ${scoreSummary.correct}/${scoreSummary.total}`
          : 'Join me on TOTL.';
      await Share.share({ message: `${line1}\n${line2}` });
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

  const gwIsLive = (scoreSummary?.live ?? 0) > 0;
  const viewingGw = home?.viewingGw ?? null;
  const currentGw = home?.currentGw ?? null;
  const showReadyToMoveOn =
    typeof currentGw === 'number' && typeof viewingGw === 'number' ? viewingGw < currentGw : false;
  const hasMovedOn = typeof currentGw === 'number' && typeof viewingGw === 'number' ? viewingGw >= currentGw : true;
  const deadline = React.useMemo(() => deadlineCountdown(fixtures, nowMs), [fixtures, nowMs]);
  const deadlineExpired = deadline?.expired ?? false;

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

  const totlLogoUri = React.useMemo(() => {
    const isLightMode = t.color.background.toLowerCase() === '#f8fafc';
    return Asset.fromModule(
      isLightMode
        ? require('../../../../public/assets/badges/totl-logo1-black.svg')
        : require('../../../../public/assets/badges/totl-logo1.svg')
    ).uri;
  }, [t.color.background]);

  const gwState: GameweekState | null = React.useMemo(() => {
    if (!home) return null;
    return getGameweekStateFromSnapshot({
      fixtures: home.fixtures ?? [],
      liveScores: home.liveScores ?? [],
      hasSubmittedViewingGw: !!home.hasSubmittedViewingGw,
      now: new Date(nowMs),
    });
  }, [home, nowMs]);

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

  const showMiniLeaguesLiveCards = gwState === 'LIVE' && typeof viewingGw === 'number';

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
        {/* Floating menu buttons (stay visible while scrolling) */}
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: t.space[2],
            right: t.space[4],
            zIndex: 50,
            opacity: scrollY.interpolate({
              inputRange: [0, 60],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                scale: scrollY.interpolate({
                  inputRange: [0, 60],
                  outputRange: [1, 0.72],
                  extrapolate: 'clamp',
                }),
              },
            ],
          }}
        >
          <View style={{ flexDirection: 'row' }}>
            <RoundIconButton
              onPress={() => navigation.navigate('Profile')}
              icon={require('../../../../public/assets/Icons/Person--Streamline-Outlined-Material-Pro_white.png')}
              imageUri={avatarUrl}
            />
          </View>
        </Animated.View>

        <Animated.ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          contentContainerStyle={{
            paddingHorizontal: t.space[4],
            paddingTop: 0,
            // Ensure the last fixture isn't hidden behind the floating bottom tab bar.
            paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
          }}
          refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
        {/* Header (scrolls with content) */}
        <View style={{ marginBottom: 0, paddingTop: 16, paddingBottom: 0, alignItems: 'center' }}>
          {/* Real TOTL logo (from web assets), simple + static */}
          <View>
            <SvgUri uri={totlLogoUri} width={165} height={77} />
          </View>
        </View>

        {__DEV__ ? (
          <View style={{ marginBottom: 10 }}>
            <TotlText variant="muted">Dev: BFF {String(env.EXPO_PUBLIC_BFF_URL)}</TotlText>
            <TotlText variant="muted">
              Dev: Auth token {hasAccessToken === null ? 'unknown' : hasAccessToken ? 'present' : 'missing'}
            </TotlText>
          </View>
        ) : null}

        {isHomeLoading && <TotlText variant="muted">Loading…</TotlText>}

        {/* GW Transition banner (RESULTS_PRE_GW but next GW published) */}
        {showReadyToMoveOn ? (
          <View
            style={{
              backgroundColor: '#e9f0ef',
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 12,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
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
                <Ionicons name="flash" size={12} color="#FFFFFF" />
              </View>
              <TotlText style={{ fontFamily: 'Gramatika-Bold', fontWeight: '700', fontSize: 16, lineHeight: 18 }}>
                Ready to move on?
              </TotlText>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Move to next gameweek"
              disabled={advanceTransition.isAnimating}
              onPress={() => {
                if (typeof currentGw !== 'number') return;
                advanceTransition.start({
                  nextGameweekLabel: `GAMEWEEK ${currentGw}`,
                  onAdvance: async () => {
                    await api.updateNotificationPrefs({ current_viewing_gw: currentGw });
                    await Promise.all([refetchHome(), refetchLeagues(), refetchRanks()]);
                  },
                });
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: t.radius.pill,
                backgroundColor: '#1C8376',
                opacity: advanceTransition.isAnimating ? 0.7 : pressed ? 0.9 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                transform: [{ scale: pressed ? 0.99 : 1 }],
              })}
            >
              <TotlText
                style={{
                  color: '#FFFFFF',
                  fontFamily: 'Gramatika-Medium',
                  fontWeight: '500',
                  fontSize: 14,
                  lineHeight: 14,
                }}
              >
                {typeof currentGw === 'number' ? `Gameweek ${currentGw}` : 'Gameweek'}
              </TotlText>
              <View style={{ width: 6 }} />
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
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
              navigation.navigate('Predictions');
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

        {/* Leaderboards row (match web card structure) */}
        <View style={{ marginTop: SECTION_GAP_Y }}>
          <SectionHeaderRow title="Performance" />
        </View>

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

        {/* Full-bleed horizontal row (remove side margins from the page padding) */}
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -t.space[4], marginBottom: SECTION_GAP_Y }}
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

            const showResultsCta =
              gwState === 'RESULTS_PRE_GW' && !!home?.hasSubmittedViewingGw && typeof home?.viewingGw === 'number';
            const resultsGw = typeof home?.viewingGw === 'number' ? home.viewingGw : ranks?.latestGw ?? null;

            if (showResultsCta && resultsGw) {
              cards.push({
                key: 'gw-results',
                node: (
                  <LeaderboardCardResultsCta
                    gw={resultsGw}
                    badge={LB_BADGE_5}
                    onPress={() => navigation.navigate('GameweekResults', { gw: resultsGw })}
                  />
                ),
              });
            }

            cards.push({
              key: 'last-gw',
              node: (
                <LeaderboardCardLastGw
                  gw={gw}
                  score={score}
                  totalFixtures={total}
                  displayText={lastGwDisplay}
                  onPress={() => navigation.navigate('Global')}
                />
              ),
            });

            const add = (b: RankBadge | null | undefined, badge: ImageSourcePropType | null, title: string) => {
              if (!b) return;
              cards.push({
                key: title,
                node: (
                  <LeaderboardCardSimple
                    title={title}
                    badge={badge}
                    displayText={String(b.percentileLabel ?? 'Top —')}
                    onPress={() => navigation.navigate('Global')}
                  />
                ),
              });
            };

            add(ranks?.fiveWeekForm, LB_BADGE_5, '5-WEEK FORM');
            add(ranks?.tenWeekForm, LB_BADGE_10, '10-WEEK FORM');
            add(ranks?.seasonRank, LB_BADGE_SEASON, 'SEASON RANK');

            return cards.map((c, idx) => (
              <View key={c.key} style={{ marginRight: idx === cards.length - 1 ? 0 : 10 }}>
                {c.node}
              </View>
            ));
          })()}
        </Animated.ScrollView>

        {/* Mini leagues (match web order: before gameweek section) */}
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

        {/* Predictions section */}
        <View style={{ marginTop: 0 }}>
          <SectionHeaderRow
            title="Predictions"
            titleRight={`${scorePill.score}/${scorePill.total}`}
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
          fixturesByDate.map((g, groupIdx) => (
            <View
              key={`${g.date}-${groupIdx}`}
              style={{ marginBottom: groupIdx === fixturesByDate.length - 1 ? 0 : 12 }}
            >
              <Card
                style={{
                  padding: 0,
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 0,
                }}
              >
                <View style={{ borderRadius: 14, overflow: 'hidden' }}>
                  {/* Card header: date + Share (spec) */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      paddingTop: 14,
                      paddingBottom: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(15,23,42,0.06)',
                    }}
                  >
                    <TotlText
                      style={{
                        color: t.color.text,
                        fontFamily: 'Gramatika-Medium',
                        fontSize: 14,
                        lineHeight: 14,
                        letterSpacing: 0.6,
                      }}
                      numberOfLines={1}
                    >
                      {String(g.date ?? '').toUpperCase()}
                    </TotlText>

                    {/* Only show once when there are multiple date groups to avoid repetition */}
                    {(!showFixtureDateSections || groupIdx === 0) && (
                      <Pressable
                        onPress={handleShare}
                        accessibilityRole="button"
                        accessibilityLabel="Share"
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: '#DFEBE9',
                          backgroundColor: 'transparent',
                          opacity: pressed ? 0.85 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <Ionicons name="share-outline" size={12} color="#000000" />
                        <View style={{ width: 6 }} />
                        <TotlText
                          style={{
                            color: '#000000',
                            fontFamily: 'Gramatika-Regular',
                            fontWeight: '400',
                            fontSize: 12,
                            lineHeight: 12,
                          }}
                        >
                          Share
                        </TotlText>
                      </Pressable>
                    )}
                  </View>

                  {g.fixtures.map((f: Fixture, idx: number) => (
                    <View key={f.id} style={{ position: 'relative' }}>
                      {idx < g.fixtures.length - 1 ? (
                        <View
                          style={{
                            position: 'absolute',
                            left: 16,
                            right: 16,
                            bottom: 0,
                            height: 1,
                            backgroundColor: 'rgba(148,163,184,0.18)',
                            zIndex: 2,
                          }}
                        />
                      ) : null}
                      <FixtureCardRow f={f} />
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          ))
        )}
        </Animated.ScrollView>
      </Screen>
    </GameweekAdvanceTransition>
  );
}

