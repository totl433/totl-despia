import React from 'react';
import { Animated, Platform, View, useWindowDimensions } from 'react-native';

import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import type { Fixture, GwResultRow, GwResults, HomeRanks, HomeSnapshot, LiveScore, LiveStatus, Pick } from '@totl/domain';
import { TotlRefreshControl } from '../lib/refreshControl';
import GameweekAdvanceTransition from '../components/transitions/GameweekAdvanceTransition';
import { useGameweekAdvanceTransition } from '../hooks/useGameweekAdvanceTransition';
import { getGameweekStateFromSnapshot, type GameweekState } from '../lib/gameweekState';
import HomeGameweekBox from '../components/home/HomeGameweekBox';
import HomeGameweekMenu from '../components/home/HomeGameweekMenu';
import PlayersHomeCard from '../components/home/PlayersHomeCard';
import { playersDayKey } from '../lib/retroPlayers/day';
import { readSharedPlayersScores } from '../lib/retroPlayers/scores';
import { playersOverallRank, playersStreak } from '../lib/retroPlayers/stats';
import CenteredSpinner from '../components/CenteredSpinner';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import { sortLeaguesByUnread } from '../lib/sortLeaguesByUnread';
import TopStatusBanner from '../components/home/TopStatusBanner';
import AppTopHeader from '../components/AppTopHeader';
import HeaderLiveScore from '../components/HeaderLiveScore';
import { TEAM_BADGES } from '../lib/teamBadges';
import { normalizeTeamCode } from '../lib/teamColors';
import { buildGoalScorerLines, countRedCardsForTeam } from '../lib/goalEvents';
import { getMediumName } from '../../../../src/lib/teamNames';

import MiniFixtureCard from '../components/home/MiniFixtureCard';
import { useHomeData } from '../hooks/useHomeData';
import { api } from '../lib/api';
import { env } from '../env';
import ExpandedFixtureCard from '../components/home/ExpandedFixtureCard';
import HomeCarouselSection from '../components/home/HomeCarouselSection';
import HomeMiniLeaguesSection from '../components/home/HomeMiniLeaguesSection';
import usePopupCards from '../hooks/usePopupCards';
import {
  buildFixturesByDate,
  fixtureDateLabel,
  fixtureKickoffTimeLabel,
  formatMinute,
  formToDotColors,
  normalizeTeamForms,
  ordinalLabel,
  sortFixturesByFixtureIndex,
} from '../lib/homeFixtureUi';
import { buildHeaderExpandedStats, buildHeaderScoreSummary, buildHeaderTickerEvent, formatHeaderScoreLabel } from '../lib/headerLiveScore';
import { fetchTeamPositionsWithFallback, normalizeTeamPositions } from '../lib/teamPositions';

type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
type LeagueSummary = LeaguesResponse['leagues'][number];

function getErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function isLightSurface(color: string): boolean {
  const value = String(color ?? '').trim();
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (!(hex.length === 6 || hex.length === 3)) return false;
  const normalized = hex.length === 3 ? hex.split('').map((char) => `${char}${char}`).join('') : hex;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return false;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.72;
}


export default function HomeScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const { openManualResultsRecall, openManualResultsScoreSheetShare, openManualRoundUpStack } = usePopupCards();
  const scrollRef = React.useRef<any>(null);
  useScrollToTop(scrollRef);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const scrollYRef = React.useRef(0);
  const fixtureNodeRefs = React.useRef<Record<string, View | null>>({});
  const advanceTransition = useGameweekAdvanceTransition({ totalMs: 1050 });
  const { unreadByLeagueId } = useLeagueUnreadCounts();
  const [dismissedCountdownGw, setDismissedCountdownGw] = React.useState<number | null>(null);
  const isLightMode = React.useMemo(() => isLightSurface(t.color.background), [t.color.background]);

  const {
    hasAccessToken,
    userId,
    home,
    homeLoading: isHomeLoading,
    homeError,
    refetchHome,
    leagues,
    leaguesError,
    refetchLeagues,
    avatarUrl,
    ranks,
    refetchRanks,
    latestGwResults,
    fixtures,
    userPicks,
    liveByFixtureIndex,
    resultByFixtureIndex,
    predictionsMeta,
    pickPercentagesByFixture,
    viewingGw,
    currentGw,
    nowMs,
    deadline,
    deadlineExpired,
    refreshing,
    onRefresh,
  } = useHomeData();

  const fixturesByDate = React.useMemo(() => buildFixturesByDate(fixtures), [fixtures]);

  const showFixtureDateSections = true;

  const scoreSummary = React.useMemo(
    () =>
      buildHeaderScoreSummary({
        fixtures,
        userPicks,
        liveByFixtureIndex,
        resultByFixtureIndex,
      }),
    [fixtures, liveByFixtureIndex, resultByFixtureIndex, userPicks]
  );

  // SectionTitle/RoundIconButton/PickPill/SectionHeaderRow/LeaderboardCards are extracted into `src/components/home/*`.

  const [expandedFixtureId, setExpandedFixtureId] = React.useState<string | null>(null);
  const [cardHeightsById, setCardHeightsById] = React.useState<Record<string, number>>({});
  const [showAllExpanded, setShowAllExpanded] = React.useState(false);
  const [viewMenuOpen, setViewMenuOpen] = React.useState(false);
  const [gwOpenLayout, setGwOpenLayout] = React.useState<'mini' | 'compact'>('mini');
  const [miniExpandedFixtureId, setMiniExpandedFixtureId] = React.useState<string | null>(null);
  const fixturesTransition = React.useRef(new Animated.Value(1)).current;
  const fixturesTransitionInFlight = React.useRef(false);
  const stackFixtures = React.useMemo(() => sortFixturesByFixtureIndex(fixtures), [fixtures]);

  const runFixtureTransition = React.useCallback(
    (applyStateChange: () => void) => {
      if (fixturesTransitionInFlight.current) {
        applyStateChange();
        return;
      }
      fixturesTransitionInFlight.current = true;
      Animated.timing(fixturesTransition, {
        toValue: 0.82,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        applyStateChange();
        requestAnimationFrame(() => {
          Animated.timing(fixturesTransition, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            fixturesTransitionInFlight.current = false;
          });
        });
      });
    },
    [fixturesTransition]
  );

  const queueScrollToFixture = React.useCallback((fixtureId: string) => {
    // Wait for layout to settle, then ensure the expanded card is fully visible in viewport.
    setTimeout(() => {
      const node = fixtureNodeRefs.current[fixtureId];
      if (!node?.measureInWindow) return;
      node.measureInWindow((x, y, width, height) => {
        const cardTop = Number(y ?? 0);
        const cardBottom = cardTop + Number(height ?? 0);
        if (!Number.isFinite(cardTop) || !Number.isFinite(cardBottom)) return;

        // Keep card clear of top header and floating bottom tab bar.
        const visibleTop = 130;
        const visibleBottom = screenHeight - 110;
        let nextScrollY = scrollYRef.current;

        if (cardBottom > visibleBottom) nextScrollY += cardBottom - visibleBottom + 12;
        if (cardTop < visibleTop) nextScrollY -= visibleTop - cardTop + 12;
        if (nextScrollY < 0) nextScrollY = 0;

        if (Math.abs(nextScrollY - scrollYRef.current) > 2) {
          scrollRef.current?.scrollTo?.({ y: nextScrollY, animated: true });
        }
      });
    }, 90);
  }, [screenHeight]);

  const handleToggleFixture = React.useCallback((fixtureId: string) => {
    runFixtureTransition(() => {
      setViewMenuOpen(false);
      if (showAllExpanded) return;
      if (expandedFixtureId === fixtureId) {
        setExpandedFixtureId(null);
        scrollRef.current?.scrollTo?.({ y: 0, animated: true });
        return;
      }
      setExpandedFixtureId(fixtureId);
      queueScrollToFixture(fixtureId);
    });
  }, [expandedFixtureId, queueScrollToFixture, runFixtureTransition, showAllExpanded]);

  const handleShowAll = React.useCallback(() => {
    runFixtureTransition(() => {
      if (showAllExpanded) {
        setShowAllExpanded(false);
        setExpandedFixtureId(null);
        setViewMenuOpen(false);
        return;
      }
      setShowAllExpanded(true);
      setExpandedFixtureId(null);
      setViewMenuOpen(false);
    });
  }, [runFixtureTransition, showAllExpanded]);

  React.useEffect(() => {
    if (!expandedFixtureId) return;
    const exists = stackFixtures.some((f) => String(f.id) === expandedFixtureId);
    if (!exists) setExpandedFixtureId(null);
  }, [expandedFixtureId, stackFixtures]);

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
  const teamFormsByCode = React.useMemo(
    () => normalizeTeamForms((predictionsMeta?.teamForms ?? {}) as Record<string, string>),
    [predictionsMeta?.teamForms]
  );
  const predictedTeamPositionsByCode = React.useMemo(
    () => normalizeTeamPositions((predictionsMeta?.teamPositions ?? {}) as Record<string, unknown>),
    [predictionsMeta?.teamPositions]
  );
  const { data: fallbackTeamPositionsByCode } = useQuery({
    queryKey: ['predictions-team-positions-home', viewingGw ?? currentGw ?? 'current'],
    queryFn: async () => {
      const seedPositions = await api
        .getPredictions()
        .then((res) => (res?.teamPositions ?? {}) as Record<string, unknown>)
        .catch(() => undefined);

      return fetchTeamPositionsWithFallback(seedPositions);
    },
    enabled: Object.keys(predictedTeamPositionsByCode).length < 20,
    staleTime: 60_000,
  });
  const teamPositionsByCode = React.useMemo(
    () => ({ ...(fallbackTeamPositionsByCode ?? {}), ...predictedTeamPositionsByCode }),
    [fallbackTeamPositionsByCode, predictedTeamPositionsByCode]
  );
  // RESULTS_PRE_GW only when the last GW fixture is FINISHED (see getGameweekStateFromSnapshot).
  // Do not infer from "no live games + some results": mid-GW gaps (e.g. Mon kickoff after weekend FTs)
  // would wrongly show Round Up and results header before the GW is complete.
  const isResultsPreGw = gwState === 'RESULTS_PRE_GW';
  const showRoundUpButton = isResultsPreGw && typeof viewingGw === 'number';
  const showReadyToMoveOn =
    typeof currentGw === 'number' && typeof viewingGw === 'number' ? viewingGw < currentGw : false;
  const showComingSoonBanner =
    gwState === 'RESULTS_PRE_GW' &&
    typeof currentGw === 'number' &&
    typeof viewingGw === 'number' &&
    viewingGw >= currentGw;
  // Temporary visual experiment: hide the top performance carousel without deleting its implementation.
  const showTopPerformanceCarousel = false;
  const performanceRailTopMargin = 16;
  const hasMovedOn = typeof currentGw === 'number' && typeof viewingGw === 'number' ? viewingGw >= currentGw : true;
  const showMakePicksBanner =
    hasMovedOn &&
    (gwState === 'GW_OPEN' || gwState === 'DEADLINE_PASSED') &&
    home?.hasSubmittedViewingGw === false;
  const supportsMiniCompactLayout =
    gwState === 'GW_OPEN' || gwState === 'GW_PREDICTED' || gwState === 'DEADLINE_PASSED' || gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
  const isMiniLayoutSelected = supportsMiniCompactLayout && gwOpenLayout === 'mini';
  const miniLayoutTransition = React.useMemo(
    () => LinearTransition.springify().damping(42).stiffness(260).mass(0.7),
    []
  );
  const handleViewRoundUp = React.useCallback(() => {
    if (typeof viewingGw !== 'number') return;
    openManualRoundUpStack(viewingGw, {
      newGameweekGw: showReadyToMoveOn && typeof currentGw === 'number' ? currentGw : null,
      includeResults: !!home?.hasSubmittedViewingGw,
    });
  }, [currentGw, home?.hasSubmittedViewingGw, openManualRoundUpStack, showReadyToMoveOn, viewingGw]);
  // The Players card: streak and all-time rank, from the same scores as its Scoreboard.
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
  const playersStreakDays = React.useMemo(
    () => (userId && playersScoresByUser ? playersStreak(playersScoresByUser[userId] ?? {}, playersDayKey(new Date(nowMs))) : 0),
    [nowMs, playersScoresByUser, userId]
  );
  const playersRank = React.useMemo(
    () => (userId && playersScoresByUser ? playersOverallRank(playersScoresByUser, userId) : null),
    [playersScoresByUser, userId]
  );
  const openPlayers = React.useCallback(() => {
    navigation.navigate('RetroTotlDailyPlayersFlow');
  }, [navigation]);
  const showGameweekBox = (showMakePicksBanner && typeof viewingGw === 'number') || showComingSoonBanner;
  const gameweekMenuItems = [
    ...(showRoundUpButton
      ? [{ key: 'roundup', label: 'Roundup', icon: 'copy-outline' as const, onPress: handleViewRoundUp }]
      : []),
    ...(supportsMiniCompactLayout
      ? [
          {
            key: 'grid',
            label: 'Grid view',
            icon: 'grid-outline' as const,
            onPress: () => {
              setGwOpenLayout('mini');
              setMiniExpandedFixtureId(null);
              setShowAllExpanded(false);
            },
          },
          {
            key: 'card',
            label: 'Card view',
            icon: 'tablet-landscape-outline' as const,
            onPress: () => {
              setGwOpenLayout('mini');
              setMiniExpandedFixtureId('__all__');
              setShowAllExpanded(true);
            },
          },
        ]
      : []),
  ];
  const isDetailsOnlyState = gwState === 'GW_OPEN' || gwState === 'GW_PREDICTED' || gwState === 'DEADLINE_PASSED';
  const isDetailsViewActive = isDetailsOnlyState || showAllExpanded;
  const collapsedStackStep = gwState === 'GW_OPEN' ? 58 : 125;

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
  const { tickerEvent: headerTickerEvent, tickerEventKey: headerTickerEventKey } = React.useMemo(
    () =>
      buildHeaderTickerEvent({
        fixtures,
        liveByFixtureIndex,
      }),
    [fixtures, liveByFixtureIndex]
  );

  const showLiveHeaderScore = gwState === 'LIVE' && !!scoreSummary;
  // While the next GW is coming soon, last week's score sits in the gameweek box instead.
  const showStaticResultsHeaderScore = isResultsPreGw && !!scoreSummary && !showComingSoonBanner;
  const headerScoreLabel = scoreSummary ? formatHeaderScoreLabel(scoreSummary, showLiveHeaderScore) : null;
  const liveHeaderGw = typeof viewingGw === 'number' ? viewingGw : typeof currentGw === 'number' ? currentGw : null;
  const { data: headerGwLiveTable } = useQuery({
    enabled: showLiveHeaderScore && typeof liveHeaderGw === 'number' && !!userId,
    queryKey: ['headerGwLiveTable', liveHeaderGw],
    queryFn: () => api.getGlobalGwLiveTable(liveHeaderGw as number),
    staleTime: 30_000,
  });
  const liveGwRank = React.useMemo(() => {
    if (!userId) return null;
    const rows = headerGwLiveTable?.rows ?? [];
    if (!rows.length) return null;
    const mine = rows.find((row) => String(row.user_id) === String(userId));
    if (!mine) return null;
    const higher = rows.filter((row) => Number(row.score ?? 0) > Number(mine.score ?? 0)).length;
    return higher + 1;
  }, [headerGwLiveTable?.rows, userId]);
  const headerExpandedStats = React.useMemo(
    () =>
      buildHeaderExpandedStats({
        gwRank: showLiveHeaderScore ? liveGwRank : ranks?.gwRank?.rank ?? null,
        gwTotal: showLiveHeaderScore ? headerGwLiveTable?.rows?.length ?? null : ranks?.gwRank?.total ?? null,
      }),
    [headerGwLiveTable?.rows?.length, liveGwRank, ranks?.gwRank?.rank, ranks?.gwRank?.total, showLiveHeaderScore]
  );

  // Keep Mini Leagues in live-table mode during LIVE and RESULTS_PRE_GW.
  // This includes the period before/after next GW publish, until user moves on.
  const showMiniLeaguesLiveCards = typeof viewingGw === 'number' && (gwState === 'LIVE' || isResultsPreGw);

//VERTICAL SPACING CONTROL HERE
  const errorMessage = homeError ? getErrorMessage(homeError) : leaguesError ? getErrorMessage(leaguesError) : null;
  const SECTION_GAP_Y = 40; // visual rhythm between major sections (spec)

  // Initial/empty load: avoid rendering empty/broken home sections while waiting on BFF/Railway.
  if (isHomeLoading && !home && !homeError) {
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
          isRefreshing={refreshing}
          hasLiveGames={gwState === 'LIVE' && gwIsLive}
          centerContent={
            showLiveHeaderScore && headerScoreLabel ? (
              <HeaderLiveScore
                scoreLabel={headerScoreLabel}
                fill
                tickerEvent={headerTickerEvent ?? undefined}
                tickerEventKey={headerTickerEventKey}
                expandedStats={headerExpandedStats}
                onSharePress={typeof liveHeaderGw === 'number' ? () => openManualResultsScoreSheetShare(liveHeaderGw) : undefined}
              />
            ) : showStaticResultsHeaderScore && headerScoreLabel ? (
              <HeaderLiveScore
                scoreLabel={headerScoreLabel}
                fill
                live={false}
                expandedStats={headerExpandedStats}
                onSharePress={typeof liveHeaderGw === 'number' ? () => openManualResultsScoreSheetShare(liveHeaderGw) : undefined}
              />
            ) : undefined
          }
          showLeftLiveBadge={!showLiveHeaderScore && !showStaticResultsHeaderScore}
        />

        <Animated.ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          onScrollBeginDrag={() => setViewMenuOpen(false)}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: t.space[4],
            paddingTop: 8,
            // Ensure the last fixture isn't hidden behind the floating bottom tab bar.
            paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
          }}
          refreshControl={
            Platform.OS === 'android' ? undefined : (
              <TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }
        >
        {isHomeLoading && <TotlText variant="muted">Loading…</TotlText>}

        {/* Gameweek message (deadline / coming soon) beside The Players; The Players goes full width when there's nothing to say. */}
        <View style={{ flexDirection: 'row', gap: 23, marginBottom: 16 }}>
          {showGameweekBox ? (
            <View style={{ flex: 1 }}>
              {showComingSoonBanner ? (
                <HomeGameweekBox
                  kind="comingSoon"
                  nextGw={typeof currentGw === 'number' ? currentGw + 1 : null}
                  lastGw={typeof viewingGw === 'number' ? viewingGw : null}
                  lastScore={headerScoreLabel}
                />
              ) : (
                <HomeGameweekBox
                  kind="deadline"
                  deadlineMs={deadline?.atMs ?? null}
                  expired={deadlineExpired}
                  onPress={() => {
                    if (advanceTransition.isAnimating || deadlineExpired) return;
                    navigation.navigate('PredictionsFlow');
                  }}
                />
              )}
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <PlayersHomeCard
              size={showGameweekBox ? 'square' : 'wide'}
              streak={playersStreakDays}
              rank={playersRank}
              onPress={openPlayers}
            />
          </View>
        </View>

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

        <HomeCarouselSection
          visible={showTopPerformanceCarousel}
          marginTop={performanceRailTopMargin}
          marginBottom={SECTION_GAP_Y}
          ranks={ranks}
          home={home}
          latestGwResults={latestGwResults}
          scoreSummary={scoreSummary}
          fixtures={fixtures}
          deadlineExpired={deadlineExpired}
          showMakePicksBanner={showMakePicksBanner}
          showComingSoonBanner={showComingSoonBanner}
          currentGw={currentGw}
          gwState={gwState}
          dismissedCountdownGw={dismissedCountdownGw}
          onDismissCountdown={setDismissedCountdownGw}
          onNavigatePredictions={() => navigation.navigate('PredictionsFlow')}
          onNavigateGameweekResults={(gw, mode) => {
            if (mode === 'fixturesShare') {
              navigation.navigate('GameweekResults', { gw, mode });
              return;
            }
            openManualResultsRecall(gw);
          }}
          onNavigateGlobal={(initialTab) => navigation.navigate('Global', { initialTab })}
        />

        {/* Mini leagues list removed from merged Predictions hub (moved to Mini Leagues page top rail). */}
        <HomeMiniLeaguesSection
          visible={false}
          screenWidth={screenWidth}
          leagues={leagues?.leagues ?? []}
          defaultLeagueBatches={defaultLeagueBatches}
          liveLeagueList={liveLeagueList}
          showMiniLeaguesLiveCards={showMiniLeaguesLiveCards}
          viewingGw={viewingGw}
          tableKind={gwState === 'LIVE' ? 'gw' : 'season'}
          onNavigateLeagues={() => navigation.navigate('Leagues')}
          onNavigateLeagueDetail={(leagueId, name) => navigation.navigate('LeagueDetail', { leagueId, name })}
        />

        {/* Predictions section */}
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <TotlText
              style={{
                color: '#000000',
                fontFamily: 'Gramatika-Regular',
                fontSize: 23,
                lineHeight: 29.9,
                letterSpacing: -0.3788,
              }}
            >
              {typeof home?.viewingGw === 'number' ? `Gameweek ${home.viewingGw}` : 'Gameweek'}
            </TotlText>
            <HomeGameweekMenu items={gameweekMenuItems} />
          </View>
        </View>

        <Animated.View
          style={{
            opacity: fixturesTransition,
            transform: [
              {
                translateY: fixturesTransition.interpolate({
                  inputRange: [0.82, 1],
                  outputRange: [6, 0],
                }),
              },
            ],
          }}
        >
        {fixtures.length === 0 && !isHomeLoading ? (
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
          <View>
            {isMiniLayoutSelected ? (
              <View>
                {fixturesByDate.map((section, sectionIdx) => {
                  return (
                    <Reanimated.View
                      key={`mini-day-${section.date}-${sectionIdx}`}
                      layout={Platform.OS === 'android' ? undefined : miniLayoutTransition}
                      style={{ marginBottom: sectionIdx === fixturesByDate.length - 1 ? 0 : 8 }}
                    >
                      <View style={{ marginBottom: 10, zIndex: 1 }}>
                        <TotlText style={{ fontSize: 17, lineHeight: 21, fontFamily: t.font.medium, color: t.color.text }}>{section.date}</TotlText>
                      </View>
                      <Reanimated.View
                        layout={Platform.OS === 'android' ? undefined : miniLayoutTransition}
                        style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, zIndex: 20 }}
                      >
                        {section.fixtures.map((f: Fixture, idx: number) => {
                          const fixtureId = String(f.id);
                          const ls = liveByFixtureIndex.get(f.fixture_index) ?? null;
                          const st: LiveStatus = (ls?.status as LiveStatus) ?? 'SCHEDULED';
                          const hasScore =
                            typeof ls?.home_score === 'number' &&
                            typeof ls?.away_score === 'number' &&
                            (st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED');
                          const headerHome = getMediumName(String(f.home_name ?? f.home_team ?? normalizeTeamCode(f.home_code) ?? 'Home'));
                          const headerAway = getMediumName(String(f.away_name ?? f.away_team ?? normalizeTeamCode(f.away_code) ?? 'Away'));
                          const homeCode = normalizeTeamCode(f.home_code) ?? '';
                          const awayCode = normalizeTeamCode(f.away_code) ?? '';
                          const homeBadge = TEAM_BADGES[homeCode] ?? null;
                          const awayBadge = TEAM_BADGES[awayCode] ?? null;
                          const pick = userPicks[String(f.fixture_index)];
                          const resultFromDb = resultByFixtureIndex.get(Number(f.fixture_index)) ?? null;
                          const hasFinalResult = resultFromDb === 'H' || resultFromDb === 'D' || resultFromDb === 'A';
                          const derivedOutcome: Pick | null =
                            hasFinalResult
                              ? resultFromDb
                              : hasScore
                                ? (ls?.home_score ?? 0) > (ls?.away_score ?? 0)
                                  ? 'H'
                                  : (ls?.home_score ?? 0) < (ls?.away_score ?? 0)
                                    ? 'A'
                                    : 'D'
                                : null;
                          const isMiniExpanded = miniExpandedFixtureId === '__all__' || miniExpandedFixtureId === fixtureId;
                          const isLiveOrResultsMini = gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
                          const miniLivePickCorrect = isLiveOrResultsMini && !!pick && !!derivedOutcome && pick === derivedOutcome;
                          const miniLivePickIncorrect = isLiveOrResultsMini && !!pick && !!derivedOutcome && pick !== derivedOutcome;
                          const miniPrimaryLabel = hasScore ? `${ls?.home_score ?? 0}-${ls?.away_score ?? 0}` : fixtureKickoffTimeLabel(f.kickoff_time ?? null);
                          const miniPrimaryExpandedLabel = isMiniExpanded && hasScore ? `${ls?.home_score ?? 0} - ${ls?.away_score ?? 0}` : miniPrimaryLabel;
                          const miniSecondaryLabel = hasScore ? formatMinute(st, ls?.minute) : '';
                          const miniPickIndex = pick === 'H' ? 0 : pick === 'D' ? 1 : 2;
                          const pctFromData = pickPercentagesByFixture.get(Number(f.fixture_index)) ?? null;
                          const percentBySide: Record<Pick, number> =
                            pctFromData && typeof pctFromData.H === 'number' && typeof pctFromData.D === 'number' && typeof pctFromData.A === 'number'
                              ? { H: Math.round(pctFromData.H), D: Math.round(pctFromData.D), A: Math.round(pctFromData.A) }
                              : {
                                  H: 36 + (idx % 4) * 5,
                                  D: 22 + (idx % 3) * 3,
                                  A: 100 - (36 + (idx % 4) * 5) - (22 + (idx % 3) * 3),
                                };
                          const showExpandedPercentages = gwState === 'DEADLINE_PASSED' || gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
                          const homeFormColors = formToDotColors(teamFormsByCode[homeCode] ?? null);
                          const awayFormColors = formToDotColors(teamFormsByCode[awayCode] ?? null);
                          const homePositionLabel = ordinalLabel(teamPositionsByCode[homeCode] ?? null);
                          const awayPositionLabel = ordinalLabel(teamPositionsByCode[awayCode] ?? null);
                          const goalsRaw = Array.isArray((ls as any)?.goals) ? ((ls as any).goals as Array<any>) : [];
                          const homeCandidates = [String(f.home_name ?? ''), String(f.home_team ?? ''), headerHome].map((v) => v.toLowerCase());
                          const awayCandidates = [String(f.away_name ?? ''), String(f.away_team ?? ''), headerAway].map((v) => v.toLowerCase());
                          const homeRedCardCount = countRedCardsForTeam((ls as any)?.red_cards, homeCandidates);
                          const awayRedCardCount = countRedCardsForTeam((ls as any)?.red_cards, awayCandidates);
                          const homeScorers = buildGoalScorerLines(goalsRaw, homeCandidates);
                          const awayScorers = buildGoalScorerLines(goalsRaw, awayCandidates);

                          return (
                            <Reanimated.View
                              key={`mini-${fixtureId}`}
                              layout={Platform.OS === 'android' ? undefined : miniLayoutTransition}
                              style={{
                                width: isMiniExpanded ? '100%' : '50%',
                                paddingHorizontal: 6,
                                marginBottom: 12,
                                position: 'relative',
                                zIndex: isMiniExpanded ? 80 : 30,
                                elevation: isMiniExpanded ? 6 : 2,
                              }}
                            >
                              <View
                                ref={(node) => { fixtureNodeRefs.current[fixtureId] = node; }}
                                style={
                                  gwState === 'LIVE' && !isMiniExpanded && (st === 'IN_PLAY' || st === 'PAUSED')
                                    ? {
                                        borderRadius: 16,
                                        shadowColor: isLightMode ? '#0F172A' : '#000000',
                                        shadowOpacity: isLightMode ? 0.22 : 0.72,
                                        shadowRadius: isLightMode ? 18 : 32,
                                        shadowOffset: { width: 0, height: isLightMode ? 10 : 18 },
                                        elevation: isLightMode ? 10 : 18,
                                      }
                                    : undefined
                                }
                              >
                                <MiniFixtureCard
                                  fixtureId={fixtureId}
                                  isExpanded={isMiniExpanded}
                                  onToggleExpand={() =>
                                    setMiniExpandedFixtureId((prev) => {
                                      const next = prev === fixtureId ? null : fixtureId;
                                      if (next) queueScrollToFixture(fixtureId);
                                      else scrollRef.current?.scrollTo?.({ y: 0, animated: true });
                                      return next;
                                    })
                                  }
                                  homeCode={homeCode}
                                  awayCode={awayCode}
                                  headerHome={headerHome}
                                  headerAway={headerAway}
                                  homeBadge={homeBadge}
                                  awayBadge={awayBadge}
                                  primaryLabel={miniPrimaryLabel}
                                  primaryExpandedLabel={miniPrimaryExpandedLabel}
                                  secondaryLabel={miniSecondaryLabel}
                                  fixtureStatus={st}
                                  gwState={gwState}
                                  pick={pick}
                                  derivedOutcome={derivedOutcome}
                                  hasScore={hasScore}
                                  compactVisualTone={
                                    (gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW') && st === 'FINISHED'
                                      ? 'finished-grey'
                                      : 'default'
                                  }
                                  compactLiveMinutePill={gwState === 'LIVE'}
                                  percentBySide={percentBySide}
                                  showExpandedPercentages={showExpandedPercentages}
                                  homeFormColors={homeFormColors}
                                  awayFormColors={awayFormColors}
                                  homePositionLabel={homePositionLabel}
                                  awayPositionLabel={awayPositionLabel}
                                  homeScorers={homeScorers}
                                  awayScorers={awayScorers}
                                  homeRedCardCount={homeRedCardCount}
                                  awayRedCardCount={awayRedCardCount}
                                  fixtureDateLabel={fixtureDateLabel(f.kickoff_time ?? null)}
                                />
                              </View>
                            </Reanimated.View>
                          );
                        })}
                      </Reanimated.View>
                    </Reanimated.View>
                  );
                })}
              </View>
            ) : (
              <>
            {fixturesByDate.map((section, sectionIdx) => (
              <View key={`${section.date}-${sectionIdx}`} style={{ marginTop: sectionIdx === 0 ? 0 : 10 }}>
                {showFixtureDateSections ? (
                  <View style={{ paddingHorizontal: 2, paddingBottom: 6 }}>
                    <TotlText
                      style={{
                        color: '#475569',
                        fontFamily: t.font.medium,
                        fontSize: 13,
                        lineHeight: 14,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {section.date}
                    </TotlText>
                  </View>
                ) : null}
                {section.fixtures.map((f: Fixture, idx: number) => {
                  const fixtureId = String(f.id);
                  const sectionExpandedIndex = section.fixtures.findIndex((sf) => String(sf.id) === expandedFixtureId);
                  const isCompactStack = !isDetailsViewActive;
                  const isAfterExpandedInCompact = isCompactStack && sectionExpandedIndex >= 0 && idx > sectionExpandedIndex;
                  const previousFixtureId = idx > 0 ? String(section.fixtures[idx - 1]?.id ?? '') : null;
                  const previousFixtureHeight = previousFixtureId ? (cardHeightsById[previousFixtureId] ?? 168) : 168;
                  const overlapAmount = Math.max(0, previousFixtureHeight - collapsedStackStep);
                  const compactStackMarginTop = idx === 0 ? 0 : isAfterExpandedInCompact ? 8 : -overlapAmount;
                  const fixtureMarginTop = isCompactStack ? compactStackMarginTop : idx === 0 ? 0 : 8;
                  const isExpanded = expandedFixtureId === fixtureId;
                  const isExpandedVisual = isDetailsOnlyState || showAllExpanded || isExpanded;
                  const ls = liveByFixtureIndex.get(f.fixture_index) ?? null;
                  const st: LiveStatus = (ls?.status as LiveStatus) ?? 'SCHEDULED';
                  const hasScore =
                    typeof ls?.home_score === 'number' &&
                    typeof ls?.away_score === 'number' &&
                    (st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED');
                  const headerPrimary = hasScore
                    ? `${ls?.home_score ?? 0} - ${ls?.away_score ?? 0}`
                    : fixtureKickoffTimeLabel(f.kickoff_time ?? null);
                  const headerSecondary = hasScore ? formatMinute(st, ls?.minute) : '';
                  const homeCode = normalizeTeamCode(f.home_code);
                  const awayCode = normalizeTeamCode(f.away_code);
                  const homeBadge = TEAM_BADGES[homeCode] ?? null;
                  const awayBadge = TEAM_BADGES[awayCode] ?? null;
                  const headerHome = getMediumName(String(f.home_name ?? f.home_team ?? homeCode ?? 'Home'));
                  const headerAway = getMediumName(String(f.away_name ?? f.away_team ?? awayCode ?? 'Away'));
                  const pick = userPicks[String(f.fixture_index)];
                  const homeTeamFontWeight =
                    pick === 'H' ? '800' : pick === 'D' ? '600' : pick === 'A' ? '600' : '800';
                  const awayTeamFontWeight =
                    pick === 'A' ? '800' : pick === 'D' ? '600' : pick === 'H' ? '600' : '800';
                  const resultFromDb = resultByFixtureIndex.get(Number(f.fixture_index)) ?? null;
                  const hasFinalResult = resultFromDb === 'H' || resultFromDb === 'D' || resultFromDb === 'A';
                  const derivedOutcome: Pick | null =
                    hasFinalResult
                      ? resultFromDb
                      : hasScore
                        ? (ls?.home_score ?? 0) > (ls?.away_score ?? 0)
                          ? 'H'
                          : (ls?.home_score ?? 0) < (ls?.away_score ?? 0)
                            ? 'A'
                            : 'D'
                        : null;
                  const isLiveOrResultsCard = gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
                  const isFinished = st === 'FINISHED';
                  const showTabsRow = gwState !== 'GW_OPEN';
                  const showTabPercentages = isLiveOrResultsCard || gwState === 'DEADLINE_PASSED';
                  const hideRepeatedKickoffInDetails =
                    (gwState === 'GW_OPEN' || gwState === 'GW_PREDICTED' || gwState === 'DEADLINE_PASSED') &&
                    isExpandedVisual &&
                    !hasScore;
                  const hideRepeatedKickoffInCompact = !isExpandedVisual && !hasScore;
                  const hideRepeatedKickoffInLiveScheduled = gwState === 'LIVE' && !hasScore;
                  const hideStatusRowCompletely = gwState === 'GW_OPEN';
                  const isCompactCard = !isDetailsViewActive && !isExpandedVisual;
                  const pctFromData = pickPercentagesByFixture.get(Number(f.fixture_index)) ?? null;
                  const percentBySide: Record<Pick, number> =
                    pctFromData && typeof pctFromData.H === 'number' && typeof pctFromData.D === 'number' && typeof pctFromData.A === 'number'
                      ? {
                          H: Math.round(pctFromData.H),
                          D: Math.round(pctFromData.D),
                          A: Math.round(pctFromData.A),
                        }
                      : {
                          H: 36 + (idx % 4) * 5,
                          D: 22 + (idx % 3) * 3,
                          A: 100 - (36 + (idx % 4) * 5) - (22 + (idx % 3) * 3),
                        };
                  const showPercentagesOnTabs = showTabPercentages;
                  const tabsAboveScorers = gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
                  const kickoffDetail = f.kickoff_time
                    ? new Date(f.kickoff_time).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) +
                      ' • ' +
                      fixtureKickoffTimeLabel(f.kickoff_time)
                    : '';
                  const goalsRaw = Array.isArray((ls as any)?.goals) ? ((ls as any).goals as Array<any>) : [];
                  const homeCandidates = [String(f.home_name ?? ''), String(f.home_team ?? ''), headerHome].map((v) => v.toLowerCase());
                  const awayCandidates = [String(f.away_name ?? ''), String(f.away_team ?? ''), headerAway].map((v) => v.toLowerCase());
                  const homeRedCardCount = countRedCardsForTeam((ls as any)?.red_cards, homeCandidates);
                  const awayRedCardCount = countRedCardsForTeam((ls as any)?.red_cards, awayCandidates);
                  const homeScorers = buildGoalScorerLines(goalsRaw, homeCandidates);
                  const awayScorers = buildGoalScorerLines(goalsRaw, awayCandidates);

                  return (
                    <View key={fixtureId} ref={(node) => { fixtureNodeRefs.current[fixtureId] = node; }}>
                      <ExpandedFixtureCard
                        fixtureId={fixtureId}
                        isExpandedVisual={isExpandedVisual}
                        isDetailsViewActive={isDetailsViewActive}
                        isCompactStack={isCompactStack}
                        isCompactCard={isCompactCard}
                        fixtureMarginTop={fixtureMarginTop}
                        stackZIndex={isCompactStack ? (sectionExpandedIndex === idx ? 300 : idx + 1) : 0}
                        stackElevation={isCompactStack ? idx + 1 : 0}
                        onPress={() => {
                          if (isDetailsOnlyState) return;
                          handleToggleFixture(fixtureId);
                        }}
                        homeCode={homeCode}
                        awayCode={awayCode}
                        headerPrimary={headerPrimary}
                        headerSecondary={headerSecondary}
                        headerHome={headerHome}
                        headerAway={headerAway}
                        homeBadge={homeBadge}
                        awayBadge={awayBadge}
                        homeTeamFontWeight={homeTeamFontWeight}
                        awayTeamFontWeight={awayTeamFontWeight}
                        gwState={gwState ?? 'GW_OPEN'}
                        pick={pick}
                        derivedOutcome={derivedOutcome}
                        hasScore={hasScore}
                        isFinished={isFinished}
                        isLiveOrResultsCard={isLiveOrResultsCard}
                        percentBySide={percentBySide}
                        showTabsRow={showTabsRow}
                        showTabPercentages={showTabPercentages}
                        showPercentagesOnTabs={showPercentagesOnTabs}
                        tabsAboveScorers={tabsAboveScorers}
                        homeScorers={homeScorers}
                        awayScorers={awayScorers}
                        homeRedCardCount={homeRedCardCount}
                        awayRedCardCount={awayRedCardCount}
                        kickoffDetail={kickoffDetail}
                        hideStatusRowCompletely={hideStatusRowCompletely}
                        hideRepeatedKickoffInDetails={hideRepeatedKickoffInDetails}
                        hideRepeatedKickoffInCompact={hideRepeatedKickoffInCompact}
                        hideRepeatedKickoffInLiveScheduled={hideRepeatedKickoffInLiveScheduled}
                        onLayout={(height) => {
                          setCardHeightsById((prev) => {
                            const existing = prev[fixtureId];
                            if (typeof existing === 'number' && Math.abs(existing - height) <= 1) return prev;
                            return { ...prev, [fixtureId]: height };
                          });
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
              </>
            )}
          </View>
        )}
        </Animated.View>
        </Animated.ScrollView>
      </Screen>
    </GameweekAdvanceTransition>
  );
}

