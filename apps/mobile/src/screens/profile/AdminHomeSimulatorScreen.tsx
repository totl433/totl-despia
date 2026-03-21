import React from 'react';
import { Animated, Pressable, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, TotlText, useTokens } from '@totl/ui';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import type { Fixture, LiveStatus, Pick } from '@totl/domain';

import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import type { GameweekState } from '../../lib/gameweekState';

import AppTopHeader from '../../components/AppTopHeader';
import HeaderTotlLogo from '../../components/HeaderTotlLogo';
import HeaderLiveScore from '../../components/HeaderLiveScore';
import PageHeader from '../../components/PageHeader';
import { api } from '../../lib/api';
import { countRedCardsForTeam } from '../../lib/goalEvents';
import { fetchTeamPositionsWithFallback } from '../../lib/teamPositions';
import usePopupCards from '../../hooks/usePopupCards';
import MiniFixtureCard from '../../components/home/MiniFixtureCard';
import ExpandedFixtureCard from '../../components/home/ExpandedFixtureCard';
import SectionHeaderRow from '../../components/home/SectionHeaderRow';
import { buildHeaderScoreSummary, formatHeaderScoreLabel } from '../../lib/headerLiveScore';
import {
  buildFixturesByDate,
  fixtureDateLabel,
  fixtureKickoffTimeLabel,
  formatMinute,
  formToDotColors,
  ordinalLabel,
  sortFixturesByFixtureIndex,
} from '../../lib/homeFixtureUi';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';
import { useThemePreference, type ThemePreference } from '../../context/ThemePreferenceContext';

type SimGameState = 'GW_OPEN' | 'GW_PREDICTED' | 'DEADLINE_PASSED' | 'LIVE' | 'RESULTS_PRE_GW';
type SimFixtureStatus = 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';
type HeaderPreviewContext = 'HP' | 'ML' | '2526';

type SimFixture = {
  id: string;
  /** Same keying as BFF/Home (`userPicks[String(fixture_index)]`). */
  fixture_index: number;
  kickoff: string;
  kickoff_time: string;
  kickoffDetail: string;
  home: string;
  away: string;
  homeCode: string;
  awayCode: string;
  pick: Pick | null;
  status: SimFixtureStatus;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  outcome?: Pick;
};

const SIM_VIEWING_GW = 39;

/** Map simulator rows to `@totl/domain` fixtures so HP Sim uses the same paths as `HomeScreen`. */
function simFixtureToDomainFixture(f: SimFixture): Fixture {
  return {
    id: f.id,
    gw: SIM_VIEWING_GW,
    fixture_index: f.fixture_index,
    kickoff_time: f.kickoff_time,
    home_code: f.homeCode,
    away_code: f.awayCode,
    home_name: f.home,
    away_name: f.away,
    home_team: f.home,
    away_team: f.away,
  };
}

const GAME_STATES: SimGameState[] = ['GW_OPEN', 'GW_PREDICTED', 'DEADLINE_PASSED', 'LIVE', 'RESULTS_PRE_GW'];
const PICKS: Pick[] = ['H', 'D', 'A', 'H', 'A', 'D', 'H', 'D', 'A', 'H'];
const TEAMS: Array<{ name: string; code: string }> = [
  { name: 'Arsenal', code: 'ARS' },
  { name: 'Villa', code: 'AVL' },
  { name: 'Bournemouth', code: 'BOU' },
  { name: 'Brentford', code: 'BRE' },
  { name: 'Chelsea', code: 'CHE' },
  { name: 'Everton', code: 'EVE' },
  { name: 'Liverpool', code: 'LIV' },
  { name: 'Newcastle', code: 'NEW' },
  { name: 'Spurs', code: 'TOT' },
  { name: 'West Ham', code: 'WHU' },
  { name: 'Leeds', code: 'LEE' },
  { name: 'Brighton', code: 'BHA' },
];
const KICKOFFS = ['Sat 12:30', 'Sat 15:00', 'Sat 17:30', 'Sat 19:45', 'Sat 20:00', 'Sun 12:00', 'Sun 14:00', 'Sun 16:30', 'Sun 19:00', 'Mon 20:00'];
const KICKOFF_DETAILS = [
  'Sat 21 Feb • 12:30',
  'Sat 21 Feb • 15:00',
  'Sat 21 Feb • 17:30',
  'Sat 21 Feb • 19:45',
  'Sat 21 Feb • 20:00',
  'Sun 22 Feb • 12:00',
  'Sun 22 Feb • 14:00',
  'Sun 22 Feb • 16:30',
  'Sun 22 Feb • 19:00',
  'Mon 23 Feb • 20:00',
];

function getSimMediumName(input: string): string {
  const value = String(input ?? '').trim();
  if (!value) return value;
  const normalizedCode = normalizeTeamCode(value);
  const matchedTeam = TEAMS.find(
    (team) => team.code === normalizedCode || team.name.toLowerCase() === value.toLowerCase()
  );
  return matchedTeam?.name ?? value;
}

function resultForScore(homeScore: number, awayScore: number): Pick {
  if (homeScore > awayScore) return 'H';
  if (homeScore < awayScore) return 'A';
  return 'D';
}

/** Deterministic fake form string per team index for simulator visuals. */
function fakeFormForTeamIndex(i: number): string {
  const pool = ['W', 'D', 'L'];
  return [0, 1, 2, 3, 4].map((j) => pool[(i + j) % 3]).join('');
}

function buildFixtures(state: SimGameState): SimFixture[] {
  const anchorMs = Date.UTC(2026, 1, 21, 12, 30, 0);
  return Array.from({ length: 10 }, (_, i) => {
    const home = TEAMS[i % TEAMS.length];
    const away = TEAMS[(i + 4) % TEAMS.length];
    const baseHome = i % 3;
    const baseAway = (i + 1) % 3;
    let status: SimFixtureStatus = 'SCHEDULED';
    let minute: number | undefined;
    let homeScore: number | undefined;
    let awayScore: number | undefined;

    if (state === 'LIVE') {
      if (i <= 2) {
        status = 'FINISHED';
        homeScore = baseHome + 1;
        awayScore = baseAway;
      } else if (i <= 4) {
        status = i % 2 === 0 ? 'PAUSED' : 'IN_PLAY';
        minute = i % 2 === 0 ? 45 : 7 + i * 8;
        homeScore = baseHome;
        awayScore = baseAway;
      }
    } else if (state === 'RESULTS_PRE_GW') {
      status = 'FINISHED';
      homeScore = baseHome + (i % 2);
      awayScore = baseAway;
    }

    const outcome =
      status === 'FINISHED' && typeof homeScore === 'number' && typeof awayScore === 'number'
        ? resultForScore(homeScore, awayScore)
        : undefined;

    const kickoff_time = new Date(anchorMs + i * 150 * 60 * 1000).toISOString();

    return {
      id: `sim-${i + 1}`,
      fixture_index: i + 1,
      kickoff: KICKOFFS[i],
      kickoff_time,
      kickoffDetail: KICKOFF_DETAILS[i],
      home: home.name,
      away: away.name,
      homeCode: home.code,
      awayCode: away.code,
      pick: state === 'GW_OPEN' ? null : PICKS[i],
      status,
      minute,
      homeScore,
      awayScore,
      outcome,
    };
  });
}

export default function AdminHomeSimulatorScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const { height: screenHeight } = useWindowDimensions();
  const { effectiveTheme, setPreference } = useThemePreference();
  const { hasActivePopupStack, openMainSimulatorStack, openSimulatorCard, openWelcomeSimulatorStack } = usePopupCards();
  const scrollRef = React.useRef<Animated.ScrollView | null>(null);
  const scrollYRef = React.useRef(0);
  const fixtureNodeRefs = React.useRef<Record<string, View | null>>({});

  const [state, setState] = React.useState<SimGameState>('GW_OPEN');
  const [headerContext, setHeaderContext] = React.useState<HeaderPreviewContext>('HP');
  const [gwOpenLayout, setGwOpenLayout] = React.useState<'mini' | 'compact'>('mini');
  const [stateMenuOpen, setStateMenuOpen] = React.useState(false);
  const [expandedFixtureId, setExpandedFixtureId] = React.useState<string | null>(null);
  const [miniExpandedFixtureId, setMiniExpandedFixtureId] = React.useState<string | null>(null);
  const [cardHeightsById, setCardHeightsById] = React.useState<Record<string, number>>({});
  const [showAllExpanded, setShowAllExpanded] = React.useState(false);
  const fixturesTransition = React.useRef(new Animated.Value(1)).current;
  const fixturesTransitionInFlight = React.useRef(false);

  const { data: teamPositionsByCode } = useQuery({
    queryKey: ['predictions-team-positions-hp-sim'],
    queryFn: async () => {
      const seedPositions = await api
        .getPredictions()
        .then((res) => (res?.teamPositions ?? {}) as Record<string, unknown>)
        .catch(() => undefined);

      return fetchTeamPositionsWithFallback(seedPositions);
    },
    staleTime: 60_000,
  });

  const fixtures = React.useMemo(() => buildFixtures(state), [state]);
  /** Domain-shaped fixtures — must match `HomeScreen` / BFF (`f.fixture_index` keys). */
  const fixturesForHome = React.useMemo(() => fixtures.map(simFixtureToDomainFixture), [fixtures]);
  const gwState: GameweekState = state;

  const teamFormsByCode = React.useMemo(() => {
    const out: Record<string, string> = {};
    TEAMS.forEach((team, i) => {
      out[normalizeTeamCode(team.code) ?? team.code] = fakeFormForTeamIndex(i);
    });
    return out;
  }, []);

  /** Same grouping + ordering as `HomeScreen` (`buildFixturesByDate` → sort by `fixture_index`). */
  const fixturesByDate = React.useMemo(() => buildFixturesByDate(fixturesForHome), [fixturesForHome]);

  const pickPercentagesByFixture = React.useMemo(() => {
    const m = new Map<number, { H: number; D: number; A: number }>();
    fixtures.forEach((f) => {
      const idx = f.fixture_index - 1;
      const h = 36 + (idx % 4) * 5;
      const d = 22 + (idx % 3) * 3;
      const a = 100 - h - d;
      m.set(f.fixture_index, { H: h, D: d, A: a });
    });
    return m;
  }, [fixtures]);

  const simulatorBackgroundColor = effectiveTheme === 'dark' ? '#1A2435' : t.color.background;

  const userPicks = React.useMemo(() => {
    const o: Record<string, Pick | undefined> = {};
    fixtures.forEach((f) => {
      if (f.pick) o[String(f.fixture_index)] = f.pick;
    });
    return o;
  }, [fixtures]);

  const liveByFixtureIndex = React.useMemo(() => {
    const m = new Map<
      number,
      {
        status?: string;
        home_score?: number;
        away_score?: number;
        minute?: number | null;
        goals?: unknown[];
      }
    >();
    fixtures.forEach((f) => {
      m.set(f.fixture_index, {
        status: f.status,
        home_score: f.homeScore,
        away_score: f.awayScore,
        minute: f.minute ?? null,
        goals: [],
      });
    });
    return m;
  }, [fixtures]);

  const resultByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, Pick>();
    fixtures.forEach((f) => {
      if (f.outcome) m.set(f.fixture_index, f.outcome);
    });
    return m;
  }, [fixtures]);

  const supportsMiniCompactLayout =
    gwState === 'GW_OPEN' || gwState === 'GW_PREDICTED' || gwState === 'DEADLINE_PASSED' || gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
  const isMiniLayoutSelected = supportsMiniCompactLayout && gwOpenLayout === 'mini';
  const isAllExpandedMiniMode = isMiniLayoutSelected && miniExpandedFixtureId === '__all__';
  const isMiniToggleActive = isMiniLayoutSelected && !isAllExpandedMiniMode;
  const isExpandedToggleActive = isAllExpandedMiniMode || !isMiniLayoutSelected;
  const miniLayoutTransition = React.useMemo(
    () => LinearTransition.springify().damping(42).stiffness(260).mass(0.7),
    []
  );
  const isDetailsOnlyState = gwState === 'GW_OPEN' || gwState === 'GW_PREDICTED' || gwState === 'DEADLINE_PASSED';
  const isDetailsViewActive = isDetailsOnlyState || showAllExpanded;
  const collapsedStackStep = gwState === 'GW_OPEN' ? 58 : 125;
  const stackFixtures = React.useMemo(() => sortFixturesByFixtureIndex(fixturesForHome), [fixturesForHome]);

  const showFixtureDateSections = true;

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

  const queueScrollToFixture = React.useCallback(
    (fixtureId: string) => {
      setTimeout(() => {
        const node = fixtureNodeRefs.current[fixtureId];
        if (!node?.measureInWindow) return;
        node.measureInWindow((x, y, width, height) => {
          const cardTop = Number(y ?? 0);
          const cardBottom = cardTop + Number(height ?? 0);
          if (!Number.isFinite(cardTop) || !Number.isFinite(cardBottom)) return;

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
    },
    [screenHeight]
  );

  const handleToggleFixture = React.useCallback(
    (fixtureId: string) => {
      runFixtureTransition(() => {
        if (showAllExpanded) return;
        if (expandedFixtureId === fixtureId) {
          setExpandedFixtureId(null);
          scrollRef.current?.scrollTo?.({ y: 0, animated: true });
          return;
        }
        setExpandedFixtureId(fixtureId);
        queueScrollToFixture(fixtureId);
      });
    },
    [expandedFixtureId, queueScrollToFixture, runFixtureTransition, showAllExpanded]
  );

  React.useEffect(() => {
    if (!expandedFixtureId) return;
    const exists = stackFixtures.some((f) => String(f.id) === expandedFixtureId);
    if (!exists) setExpandedFixtureId(null);
  }, [expandedFixtureId, stackFixtures]);

  const goBack = React.useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('AdminHome');
  }, [navigation]);

  const headerTitle = headerContext === 'HP' ? state : headerContext === 'ML' ? 'Mini Leagues' : 'Leaderboards';
  const headerScoreSummary = React.useMemo(
    () =>
      buildHeaderScoreSummary({
        fixtures: fixturesForHome,
        userPicks,
        liveByFixtureIndex,
        resultByFixtureIndex,
      }),
    [fixturesForHome, liveByFixtureIndex, resultByFixtureIndex, userPicks]
  );
  const showStaticResultsHeaderScore = (headerContext === 'HP' || headerContext === 'ML') && gwState === 'RESULTS_PRE_GW';
  const showLiveHeaderScore = (headerContext === 'HP' || headerContext === 'ML') && gwState === 'LIVE';
  const liveScore = headerScoreSummary ? formatHeaderScoreLabel(headerScoreSummary, showLiveHeaderScore) : '0/0';
  /** Match real Home header: wordmark for pre-kickoff / pre-live states (not score pill). */
  const showHeaderTotlLogo =
    (headerContext === 'HP' || headerContext === 'ML') &&
    (gwState === 'GW_OPEN' || gwState === 'GW_PREDICTED' || gwState === 'DEADLINE_PASSED');
  const headerRightAction = React.useMemo(() => {
    if (headerContext === 'ML') {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create or join mini league"
          onPress={() => {}}
          style={({ pressed }) => ({
            width: 30,
            height: 38,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.86 : 1,
          })}
        >
          <Ionicons name="add" size={24} color={t.color.muted} />
        </Pressable>
      );
    }

    if (headerContext === '2526') {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open stats"
          onPress={() => {}}
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
      );
    }

    return null;
  }, [headerContext, t.color.muted]);

  const headerContextControl = React.useMemo(
    () => (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.26)',
          backgroundColor: t.color.surface,
          padding: 4,
        }}
      >
        {([
          { id: 'HP', label: 'HP' },
          { id: 'ML', label: 'ML' },
          { id: '2526', label: '25/26' },
        ] as const).map((option) => {
          const active = headerContext === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Header context ${option.label}`}
              onPress={() => setHeaderContext(option.id)}
              style={({ pressed }) => ({
                minWidth: option.id === '2526' ? 62 : 46,
                height: 26,
                borderRadius: 13,
                paddingHorizontal: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? 'rgba(28,131,118,0.14)' : 'transparent',
                opacity: pressed ? 0.86 : 1,
              })}
            >
              <TotlText
                style={{
                  fontSize: 10,
                  fontFamily: t.font.medium,
                  color: active ? '#1C8376' : t.color.muted,
                }}
              >
                {option.label}
              </TotlText>
            </Pressable>
          );
        })}
      </View>
    ),
    [headerContext, t.color.muted, t.color.surface, t.font.medium]
  );

  const gameStateControl = React.useMemo(
    () => (
      <View style={{ alignItems: 'flex-end', position: 'relative' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open game state menu"
          onPress={() => setStateMenuOpen((prev) => !prev)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(28,131,118,0.28)',
            backgroundColor: 'rgba(28,131,118,0.08)',
            paddingHorizontal: 9,
            paddingVertical: 4,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <TotlText style={{ fontSize: 11, fontWeight: '800', color: '#1C8376' }}>{state}</TotlText>
          <View style={{ width: 4 }} />
          <Ionicons name={stateMenuOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#1C8376" />
        </Pressable>

        {stateMenuOpen ? (
          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 34,
              width: 190,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: t.color.border,
              backgroundColor: t.color.surface,
              shadowColor: '#000000',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              zIndex: 60,
            }}
          >
            {GAME_STATES.map((s, idx) => {
              const active = s === state;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    setState(s);
                    setStateMenuOpen(false);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: t.color.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <TotlText
                    style={{
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      color: active ? t.color.brand : t.color.text,
                    }}
                  >
                    {s}
                  </TotlText>
                  {active ? <Ionicons name="checkmark" size={16} color={t.color.brand} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    ),
    [state, stateMenuOpen, t.color.border, t.color.brand, t.color.surface, t.color.text]
  );

  const topRightControls = React.useMemo(
    () => (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        {gameStateControl}
        {headerContextControl}
      </View>
    ),
    [gameStateControl, headerContextControl]
  );
  const headerExpandedStats = React.useMemo(
    () => [
      { value: '#3', icon: 'people-outline' as const, trailingValue: '46' },
      { value: 'Top 7%' },
    ],
    []
  );

  React.useEffect(() => {
    setStateMenuOpen(false);
  }, [state]);

  return (
    <Screen fullBleed>
      <View style={{ flex: 1, backgroundColor: simulatorBackgroundColor }}>
        <AppTopHeader
          embedded
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => navigation.navigate('Profile')}
          title={
            showLiveHeaderScore || showStaticResultsHeaderScore || showHeaderTotlLogo ? undefined : headerTitle
          }
          centerContent={
            showLiveHeaderScore ? (
              <HeaderLiveScore
                scoreLabel={liveScore}
                fill
                tickerEventKey="hp-sim-preview-goal"
                tickerIntervalMs={10_000}
                previewTickerLoop
                expandedStats={headerExpandedStats}
                tickerEvent={{
                  scorerName: 'Stratton',
                  minuteLabel: "(58')",
                  homeCode: 'TOT',
                  awayCode: 'NFO',
                  homeBadge: TEAM_BADGES.TOT,
                  awayBadge: TEAM_BADGES.NFO,
                  homeScore: '2',
                  awayScore: '1',
                  scoringSide: 'home',
                }}
              />
            ) : showStaticResultsHeaderScore ? (
              <HeaderLiveScore scoreLabel={liveScore} fill live={false} expandedStats={headerExpandedStats} />
            ) : showHeaderTotlLogo ? (
              <HeaderTotlLogo />
            ) : undefined
          }
          rightAction={headerRightAction}
          hasLiveGames={gwState === 'LIVE'}
          showLeftLiveBadge={!showLiveHeaderScore && !showStaticResultsHeaderScore}
        />

        <Animated.ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: simulatorBackgroundColor }}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: t.space[4],
            paddingTop: 8,
            paddingBottom: 176 + FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
          }}
        >
        {state === 'GW_OPEN' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to predictions"
            onPress={() => {
              const parent = navigation.getParent?.();
              parent?.navigate?.('PredictionsTestFlow');
            }}
            style={({ pressed }) => ({
              backgroundColor: t.color.surface,
              borderWidth: 1,
              borderColor: t.color.border,
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 12,
              marginBottom: 10,
              opacity: pressed ? 0.92 : 1,
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
                      backgroundColor: t.color.brand,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}
                  >
                    <TotlText style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 10 }}>!</TotlText>
                  </View>
                  <TotlText
                    style={{
                      fontFamily: 'Gramatika-Bold',
                      fontWeight: '700',
                      fontSize: 16,
                      lineHeight: 18,
                      color: t.color.text,
                    }}
                  >
                    Gameweek Predictions
                  </TotlText>
                </View>
                <TotlText variant="muted" style={{ marginLeft: 30 }}>
                  Deadline{' '}
                  <TotlText style={{ color: t.color.brand, fontWeight: '700' }}>
                    {fixtures[0]?.kickoff ?? 'TBD'}
                  </TotlText>
                </TotlText>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: t.radius.pill,
                    backgroundColor: t.color.brand,
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

        <View style={{ marginTop: 8 }}>
          <SectionHeaderRow
            title={`Gameweek ${SIM_VIEWING_GW}`}
            right={
              supportsMiniCompactLayout ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: 'rgba(148,163,184,0.26)',
                    backgroundColor: t.color.surface,
                    padding: 4,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mini view"
                    onPress={() => {
                      setGwOpenLayout('mini');
                      setMiniExpandedFixtureId(null);
                      setShowAllExpanded(false);
                    }}
                    style={({ pressed }) => ({
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isMiniToggleActive ? 'rgba(28,131,118,0.14)' : 'transparent',
                      opacity: pressed ? 0.86 : 1,
                    })}
                  >
                    <Ionicons name="grid-outline" size={18} color={isMiniToggleActive ? '#1C8376' : '#475569'} />
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Expanded view"
                    onPress={() => {
                      setGwOpenLayout('mini');
                      setMiniExpandedFixtureId('__all__');
                      setShowAllExpanded(true);
                    }}
                    style={({ pressed }) => ({
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isExpandedToggleActive ? 'rgba(28,131,118,0.14)' : 'transparent',
                      opacity: pressed ? 0.86 : 1,
                    })}
                  >
                    <Ionicons name="tablet-landscape-outline" size={18} color={isExpandedToggleActive ? '#1C8376' : '#475569'} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ width: 48, height: 48 }} />
              )
            }
          />
        </View>

        <View style={{ position: 'relative' }}>
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
            {fixtures.length === 0 ? (
              <View style={{ paddingVertical: 14 }}>
                <TotlText variant="muted">No fixtures in simulator.</TotlText>
              </View>
            ) : (
              <View>
                {isMiniLayoutSelected ? (
                  <View>
                    {fixturesByDate.map((section, sectionIdx) => {
                      return (
                        <Reanimated.View
                          key={`mini-day-${section.date}-${sectionIdx}`}
                          layout={miniLayoutTransition}
                          style={{ marginBottom: sectionIdx === fixturesByDate.length - 1 ? 0 : 8 }}
                        >
                          <View style={{ marginBottom: 10, zIndex: 1 }}>
                            <TotlText style={{ fontSize: 17, lineHeight: 21, fontFamily: t.font.medium, color: t.color.text }}>
                              {section.date}
                            </TotlText>
                          </View>
                          <Reanimated.View layout={miniLayoutTransition} style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, zIndex: 20 }}>
                            {section.fixtures.map((f: Fixture) => {
                              const fixtureId = String(f.id);
                              const fixture_index = f.fixture_index;
                              const ls = liveByFixtureIndex.get(fixture_index) ?? null;
                              const st: LiveStatus = (ls?.status as LiveStatus) ?? 'SCHEDULED';
                              const hasScore =
                                typeof ls?.home_score === 'number' &&
                                typeof ls?.away_score === 'number' &&
                                (st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED');
                              const headerHome = getSimMediumName(
                                String(f.home_name ?? f.home_team ?? normalizeTeamCode(f.home_code) ?? 'Home')
                              );
                              const headerAway = getSimMediumName(
                                String(f.away_name ?? f.away_team ?? normalizeTeamCode(f.away_code) ?? 'Away')
                              );
                              const homeCode = normalizeTeamCode(f.home_code) ?? '';
                              const awayCode = normalizeTeamCode(f.away_code) ?? '';
                              const homeBadge = TEAM_BADGES[homeCode] ?? null;
                              const awayBadge = TEAM_BADGES[awayCode] ?? null;
                              const pick = userPicks[String(fixture_index)];
                              const resultFromDb = resultByFixtureIndex.get(Number(fixture_index)) ?? null;
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
                              const isMiniExpanded = miniExpandedFixtureId === '__all__' || miniExpandedFixtureId === fixtureId;
                              const miniPrimaryLabel = hasScore ? `${ls?.home_score ?? 0}-${ls?.away_score ?? 0}` : fixtureKickoffTimeLabel(f.kickoff_time ?? null);
                              const miniPrimaryExpandedLabel =
                                isMiniExpanded && hasScore ? `${ls?.home_score ?? 0} - ${ls?.away_score ?? 0}` : miniPrimaryLabel;
                              const miniSecondaryLabel = hasScore ? formatMinute(st, ls?.minute) : '';
                              const pctFromData = pickPercentagesByFixture.get(Number(fixture_index)) ?? null;
                              const percentBySide: Record<Pick, number> =
                                pctFromData && typeof pctFromData.H === 'number' && typeof pctFromData.D === 'number' && typeof pctFromData.A === 'number'
                                  ? { H: Math.round(pctFromData.H), D: Math.round(pctFromData.D), A: Math.round(pctFromData.A) }
                                  : {
                                      H: 36 + ((f.fixture_index - 1) % 4) * 5,
                                      D: 22 + ((f.fixture_index - 1) % 3) * 3,
                                      A: 100 - (36 + ((f.fixture_index - 1) % 4) * 5) - (22 + ((f.fixture_index - 1) % 3) * 3),
                                    };
                              const showExpandedPercentages =
                                gwState === 'DEADLINE_PASSED' || gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
                              const homeFormColors = formToDotColors(teamFormsByCode[homeCode] ?? null);
                              const awayFormColors = formToDotColors(teamFormsByCode[awayCode] ?? null);
                              const homePositionLabel = ordinalLabel(teamPositionsByCode?.[String(homeCode).toUpperCase()] ?? null);
                              const awayPositionLabel = ordinalLabel(teamPositionsByCode?.[String(awayCode).toUpperCase()] ?? null);
                              const scorerPoolHome = [[`Stratton 24'`, `Bird 28'`], [`Saka 13'`, `Trossard 71'`], [`Watkins 41'`]];
                              const scorerPoolAway = [[`Middleton 1'`], [`No.9 22'`], [`Winger 81'`, `Defender 90+1'`]];
                              const homeScorers = scorerPoolHome[(f.fixture_index - 1) % scorerPoolHome.length];
                              const awayScorers = scorerPoolAway[(f.fixture_index - 1) % scorerPoolAway.length];

                              return (
                                <Reanimated.View
                                  key={`mini-${fixtureId}`}
                                  layout={miniLayoutTransition}
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
                                            shadowColor: effectiveTheme === 'dark' ? '#000000' : '#0F172A',
                                            shadowOpacity: effectiveTheme === 'dark' ? 0.72 : 0.22,
                                            shadowRadius: effectiveTheme === 'dark' ? 32 : 18,
                                            shadowOffset: { width: 0, height: effectiveTheme === 'dark' ? 18 : 10 },
                                            elevation: effectiveTheme === 'dark' ? 18 : 10,
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
                          const fixture_index = f.fixture_index;
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
                          const ls = liveByFixtureIndex.get(fixture_index) ?? null;
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
                          const headerHome = getSimMediumName(String(f.home_name ?? f.home_team ?? homeCode ?? 'Home'));
                          const headerAway = getSimMediumName(String(f.away_name ?? f.away_team ?? awayCode ?? 'Away'));
                          const homeCandidates = [String(f.home_name ?? ''), String(f.home_team ?? ''), headerHome].map((v) => v.toLowerCase());
                          const awayCandidates = [String(f.away_name ?? ''), String(f.away_team ?? ''), headerAway].map((v) => v.toLowerCase());
                          const homeRedCardCount = countRedCardsForTeam((ls as any)?.red_cards, homeCandidates);
                          const awayRedCardCount = countRedCardsForTeam((ls as any)?.red_cards, awayCandidates);
                          const pick = userPicks[String(fixture_index)];
                          const homeTeamFontWeight =
                            pick === 'H' ? '800' : pick === 'D' ? '600' : pick === 'A' ? '600' : '800';
                          const awayTeamFontWeight =
                            pick === 'A' ? '800' : pick === 'D' ? '600' : pick === 'H' ? '600' : '800';
                          const resultFromDb = resultByFixtureIndex.get(Number(fixture_index)) ?? null;
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
                          const pctFromData = pickPercentagesByFixture.get(Number(fixture_index)) ?? null;
                          const percentBySide: Record<Pick, number> =
                            pctFromData && typeof pctFromData.H === 'number' && typeof pctFromData.D === 'number' && typeof pctFromData.A === 'number'
                              ? {
                                  H: Math.round(pctFromData.H),
                                  D: Math.round(pctFromData.D),
                                  A: Math.round(pctFromData.A),
                                }
                              : {
                                  H: 36 + ((f.fixture_index - 1) % 4) * 5,
                                  D: 22 + ((f.fixture_index - 1) % 3) * 3,
                                  A: 100 - (36 + ((f.fixture_index - 1) % 4) * 5) - (22 + ((f.fixture_index - 1) % 3) * 3),
                                };
                          const showPercentagesOnTabs = showTabPercentages;
                          const tabsAboveScorers = gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
                          const kickoffDetail = f.kickoff_time
                            ? new Date(f.kickoff_time).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) +
                              ' • ' +
                              fixtureKickoffTimeLabel(f.kickoff_time)
                            : '';
                          const scorerPoolHome = [[`Pedro 24'`, `Palmer 58'`], [`Saka 13'`, `Trossard 71'`], [`Watkins 41'`]];
                          const scorerPoolAway = [[`Nmecha 67'`, `Okafor 73'`], [`No.9 22'`], [`Winger 81'`, `Defender 90+1'`]];
                          const homeScorers = scorerPoolHome[(f.fixture_index - 1) % scorerPoolHome.length];
                          const awayScorers = scorerPoolAway[(f.fixture_index - 1) % scorerPoolAway.length];

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
                                homeCode={homeCode ?? ''}
                                awayCode={awayCode ?? ''}
                                headerPrimary={headerPrimary}
                                headerSecondary={headerSecondary}
                                headerHome={headerHome}
                                headerAway={headerAway}
                                homeBadge={homeBadge}
                                awayBadge={awayBadge}
                                homeTeamFontWeight={homeTeamFontWeight}
                                awayTeamFontWeight={awayTeamFontWeight}
                                gwState={gwState}
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
        </View>
        </Animated.ScrollView>

        <View
          style={{
            paddingHorizontal: t.space[4],
            paddingTop: 6,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: effectiveTheme === 'dark' ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)',
            backgroundColor: effectiveTheme === 'dark' ? 'rgba(13,18,30,0.94)' : 'rgba(255,255,255,0.96)',
          }}
        >
        <PageHeader
          title=""
          leftAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={24} color={t.color.text} />
            </Pressable>
          }
          rightAction={topRightControls}
          style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 6 }}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
          {([
            { key: 'dark', label: 'Dark', value: 'dark' },
            { key: 'light', label: 'Light', value: 'light' },
          ] as Array<{ key: string; label: string; value: ThemePreference }>).map((button) => {
            const active = effectiveTheme === button.value;
            return (
              <Pressable
                key={button.key}
                accessibilityRole="button"
                accessibilityLabel={`Switch simulator theme to ${button.label.toLowerCase()} mode`}
                onPress={() => setPreference(button.value)}
                style={({ pressed }) => ({
                  marginHorizontal: 4,
                  marginBottom: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active
                    ? effectiveTheme === 'dark'
                      ? 'rgba(255,255,255,0.34)'
                      : 'rgba(15,23,42,0.2)'
                    : effectiveTheme === 'dark'
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(15,23,42,0.08)',
                  backgroundColor: active
                    ? effectiveTheme === 'dark'
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(15,23,42,0.08)'
                    : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <TotlText
                  style={{
                    fontSize: 11,
                    lineHeight: 13,
                    fontWeight: '800',
                    color: effectiveTheme === 'dark' ? '#E2E8F0' : '#0F172A',
                  }}
                >
                  {button.label}
                </TotlText>
              </Pressable>
            );
          })}
          {[
            { key: 'results', label: 'Results', onPress: () => openSimulatorCard('results') },
            { key: 'winners', label: 'Winners', onPress: () => openSimulatorCard('winners') },
            { key: 'new-gw', label: 'New Game Week', onPress: () => openSimulatorCard('newGameweek') },
            { key: 'welcome', label: 'Welcome', onPress: () => openWelcomeSimulatorStack() },
            { key: 'main-stack', label: 'Load Main Stack', onPress: () => openMainSimulatorStack() },
            { key: 'welcome-stack', label: 'Load Welcome Stack', onPress: () => openWelcomeSimulatorStack() },
          ].map((button) => (
            <Pressable
              key={button.key}
              accessibilityRole="button"
              accessibilityLabel={button.label}
              disabled={hasActivePopupStack}
              onPress={button.onPress}
              style={({ pressed }) => ({
                marginHorizontal: 4,
                marginBottom: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: effectiveTheme === 'dark' ? 'rgba(28,131,118,0.28)' : 'rgba(28,131,118,0.22)',
                backgroundColor:
                  hasActivePopupStack
                    ? effectiveTheme === 'dark'
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(15,23,42,0.04)'
                    : 'rgba(28,131,118,0.08)',
                opacity: hasActivePopupStack ? 0.45 : pressed ? 0.8 : 1,
              })}
            >
              <TotlText
                style={{
                  fontSize: 11,
                  lineHeight: 13,
                  fontWeight: '800',
                  color: effectiveTheme === 'dark' ? '#E2E8F0' : '#0F172A',
                }}
              >
                {button.label}
              </TotlText>
            </Pressable>
          ))}
        </View>
        </View>
      </View>
    </Screen>
  );
}
