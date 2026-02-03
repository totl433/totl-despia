import React from 'react';
import { Animated, type ImageSourcePropType, Image, Pressable, Share, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Carousel from 'react-native-reanimated-carousel';
import type { ICarouselInstance } from 'react-native-reanimated-carousel';
import { Extrapolation, interpolate, useSharedValue } from 'react-native-reanimated';
import type { Fixture, GwResultRow, HomeRanks, HomeSnapshot, LiveScore, LiveStatus, Pick, RankBadge } from '@totl/domain';
import { api } from '../lib/api';
import { TotlRefreshControl } from '../lib/refreshControl';
import { supabase } from '../lib/supabase';
import FixtureCard from '../components/FixtureCard';
import MiniLeagueCard from '../components/MiniLeagueCard';
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

function formatKickoffUtc(kickoff: string | null | undefined) {
  if (!kickoff) return '—';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
  const { width: screenWidth } = useWindowDimensions();

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

  const { data: ranks } = useQuery<HomeRanks>({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });

  const fixtures: Fixture[] = home?.fixtures ?? [];
  const userPicks: Record<string, Pick> = home?.userPicks ?? {};

  const resultByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, Pick>();
    (home?.gwResults ?? []).forEach((r: GwResultRow) => m.set(r.fixture_index, r.result));
    return m;
  }, [home?.gwResults]);

  const liveByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, LiveScore>();
    if (!home) return m;
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
  }, [home]);

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
      const isStarted = st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED';
      if (!isStarted) continue;
      started += 1;
      if (st === 'IN_PLAY' || st === 'PAUSED') live += 1;

      if (!pick) continue;

      const resultFromDb = resultByFixtureIndex.get(fixtureIndex);
      const hs = Number(ls?.home_score ?? 0);
      const as = Number(ls?.away_score ?? 0);

      const outcome: Pick | null =
        resultFromDb ?? (hs > as ? 'H' : hs < as ? 'A' : 'D');

      if (outcome === pick) correct += 1;
    }

    return { started, live, correct, total: fixtures.length };
  }, [fixtures, liveByFixtureIndex, resultByFixtureIndex, userPicks]);

  const refreshing = homeRefetching || leaguesRefetching;
  const onRefresh = () => {
    void Promise.all([refetchHome(), refetchLeagues()]);
  };
  const [visibleLeagueIds, setVisibleLeagueIds] = React.useState<Set<string>>(() => new Set());
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

  function HomeMiniLeagueCardItem({
    league,
    index,
    totalCount,
    mode,
  }: {
    league: LeagueSummary;
    index: number;
    totalCount: number;
    mode: 'live' | 'default';
  }) {
    const leagueId = String(league.id);
    const enabled = mode === 'live' && !!viewingGw && visibleLeagueIds.has(leagueId);

    const { data: table, isLoading } = useQuery({
      enabled,
      queryKey: ['leagueGwTable', leagueId, viewingGw],
      queryFn: () => api.getLeagueGwTable(leagueId, viewingGw!),
    });

    const rows = mode === 'live' ? (table?.rows?.slice(0, 4) ?? []) : [];
    const winnerName = rows?.[0]?.name as string | undefined;
    const isDraw =
      rows.length >= 2 &&
      Number(rows[0]?.score ?? 0) === Number(rows[1]?.score ?? 0) &&
      Number(rows[0]?.unicorns ?? 0) === Number(rows[1]?.unicorns ?? 0);
    const winnerChip = rows.length ? (isDraw ? 'Draw!' : winnerName ? `${winnerName} Wins!` : null) : null;
    const avatarUri = resolveLeagueAvatarUri(typeof league.avatar === 'string' ? league.avatar : null);

    const emptyLabel =
      mode === 'default'
        ? 'Tap to open'
        : !viewingGw
          ? '—'
          : !visibleLeagueIds.has(leagueId)
            ? 'Swipe to load…'
            : isLoading
              ? 'Loading table…'
              : 'No table yet.';

    return (
      <Pressable
        onPress={() =>
          navigation.navigate('Leagues', {
            screen: 'LeagueDetail',
            params: { leagueId: league.id, name: league.name },
          })
        }
        style={({ pressed }) => ({
          width: mlCardWidth,
          opacity: pressed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <MiniLeagueCard
          title={String(league.name ?? '')}
          avatarUri={avatarUri}
          gwIsLive={mode === 'live' ? gwIsLive : false}
          winnerChip={winnerChip}
          rows={rows}
          emptyLabel={emptyLabel}
          width={mlCardWidth}
          fixedRowCount={mode === 'live' ? 4 : undefined}
        />
      </Pressable>
    );
  }

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
  const mlLiveCarouselRef = React.useRef<ICarouselInstance>(null);
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
    });
  }, [home]);

  const showMlToggleButtons = gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
  const [showLiveTables, setShowLiveTables] = React.useState<boolean>(showMlToggleButtons);
  const prevGwRef = React.useRef<number | null>(viewingGw);

  React.useEffect(() => {
    if (prevGwRef.current !== null && viewingGw !== null && prevGwRef.current !== viewingGw) {
      setShowLiveTables(false);
    }
    prevGwRef.current = viewingGw;
  }, [viewingGw]);

  React.useEffect(() => {
    if (showMlToggleButtons) setShowLiveTables(true);
  }, [showMlToggleButtons]);

  const defaultLeagueBatches = React.useMemo(() => {
    const leagueList: LeagueSummary[] = leagues?.leagues ?? [];
    const out: Array<Array<LeagueSummary>> = [];
    const batchSize = 3;
    for (let i = 0; i < leagueList.length; i += batchSize) out.push(leagueList.slice(i, i + batchSize));
    return out;
  }, [leagues?.leagues]);

  React.useEffect(() => {
    // With the carousel we don't have RN FlatList viewability callbacks.
    // Approximate “visible” cards as current + neighbors to keep GW table fetch lazy.
    if (!showLiveTables) {
      setVisibleLeagueIds((prev) => (prev.size ? new Set() : prev));
      return;
    }

    const leagueList: LeagueSummary[] = leagues?.leagues ?? [];
    if (!leagueList.length) return;

    const next = new Set<string>();
    const idxs = [activeLeagueIndex - 1, activeLeagueIndex, activeLeagueIndex + 1];
    for (const idx of idxs) {
      if (idx < 0 || idx >= leagueList.length) continue;
      const id = leagueList[idx]?.id;
      if (id) next.add(String(id));
    }

    setVisibleLeagueIds((prev) => {
      if (prev.size === next.size) {
        let same = true;
        for (const id of prev) {
          if (!next.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [activeLeagueIndex, leagues?.leagues, showLiveTables]);
//VERTICAL SPACING CONTROL HERE
  const errorMessage = homeError ? getErrorMessage(homeError) : leaguesError ? getErrorMessage(leaguesError) : null;
  const SECTION_GAP_Y = 40; // visual rhythm between major sections (spec)
  const MINI_TO_GW_GAP_Y = -20; // slightly tighter to balance the heavier mini leagues block

  // Mini Leagues block spacing controls.
  // - Gap between carousel cards and the pagination dots (per view).
  const ML_LIVE_DOTS_GAP_Y = 12;
  const ML_DEFAULT_DOTS_GAP_Y = -40;
  // - Gap between the carousel section (viewport+dots) and the content below it (per view).
  const ML_LIVE_SECTION_BOTTOM_PADDING = MINI_TO_GW_GAP_Y + 80;
  const ML_DEFAULT_SECTION_BOTTOM_PADDING = MINI_TO_GW_GAP_Y +80;

  // Each view keeps its own viewport height so dots stay visually attached to the bottom of that view.
  const ML_LIVE_HEIGHT = mlCarouselHeight;
  const ML_DEFAULT_HEIGHT = 350;

  return (
    <Screen fullBleed>
      {/* Floating menu buttons (stay visible while scrolling) */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: t.space[2],
          right: t.space[4],
          zIndex: 50,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <RoundIconButton
            onPress={() => {}}
            icon={require('../../../../public/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png')}
          />
          <View style={{ width: 10 }} />
          <RoundIconButton
            onPress={() => navigation.navigate('Profile')}
            icon={require('../../../../public/assets/Icons/Person--Streamline-Outlined-Material-Pro_white.png')}
          />
        </View>
      </View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: 0,
          // Ensure the last fixture isn't hidden behind the floating bottom tab bar.
          paddingBottom: t.space[12] + 60,
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

        {isHomeLoading && <TotlText variant="muted">Loading…</TotlText>}

        {(homeError || leaguesError) && (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="heading" style={{ marginBottom: 8 }}>
              Couldn’t load everything
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {errorMessage ?? 'Unknown error'}
            </TotlText>
            <Button title="Retry" onPress={onRefresh} loading={refreshing} />
          </Card>
        )}

        {/* Leaderboards row (match web card structure) */}
        <View style={{ marginTop: SECTION_GAP_Y }}>
          <SectionHeaderRow title="Performance" />
        </View>
        {/* Full-bleed horizontal row (remove side margins from the page padding) */}
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -t.space[4], marginBottom: SECTION_GAP_Y }}
          contentContainerStyle={{ paddingHorizontal: t.space[4], paddingBottom: 12 }}
        >
          {(() => {
            const gw = ranks?.latestGw ?? home?.viewingGw ?? null;
            const score = home?.hasSubmittedViewingGw && scoreSummary ? String(scoreSummary.correct) : '--';
            const total = scoreSummary ? String(scoreSummary.total) : String(fixtures.length || '--');
            const lastGwDisplay = ranks?.gwRank?.percentileLabel ? String(ranks.gwRank.percentileLabel) : 'Top —';

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
            subtitle={showLiveTables && home?.viewingGw ? `${viewingGwLabel} Live Tables` : undefined}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  onPress={() =>
                    navigation.navigate('Leagues', {
                      screen: 'LeaguesList',
                    })
                  }
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

                {showMlToggleButtons ? (
                  <Pressable
                    onPress={() => setShowLiveTables((v) => !v)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: t.radius.pill,
                      backgroundColor: showLiveTables ? t.color.surface2 : t.color.brand,
                      borderWidth: showLiveTables ? 1 : 0,
                      borderColor: showLiveTables ? t.color.border : 'transparent',
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      marginLeft: 10,
                    })}
                  >
                    <TotlText
                      style={{
                        color: '#FFFFFF',
                        fontFamily: 'Gramatika-Regular',
                        fontWeight: '400',
                        fontSize: 12,
                        lineHeight: 12,
                      }}
                    >
                      {showLiveTables ? 'Default View' : 'View Live Tables'}
                    </TotlText>
                  </Pressable>
                ) : null}
              </View>
            }
          />
        </View>
        {leagues?.leagues?.length ? (
          showLiveTables ? (
            <CarouselWithPagination
              carouselRef={mlLiveCarouselRef}
              width={mlCarouselViewportWidth}
              height={ML_LIVE_HEIGHT}
              data={leagues.leagues}
              progress={mlAbsoluteProgress}
              currentIndex={activeLeagueIndex}
              onIndexChange={(idx) => setActiveLeagueIndex(idx)}
              dotsGap={ML_LIVE_DOTS_GAP_Y}
              sectionBottomPadding={ML_LIVE_SECTION_BOTTOM_PADDING}
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
                height: ML_LIVE_HEIGHT,
                marginHorizontal: -mlCarouselOuterGutter,
              }}
              containerStyle={{ paddingBottom: 0 }}
              renderItem={({ item: l, index, animationValue }) => (
                <CarouselFocusShell animationValue={animationValue} width={mlCardWidth}>
                  <HomeMiniLeagueCardItem
                    league={l}
                    index={index}
                    totalCount={leagues.leagues.length}
                    mode="live"
                  />
                </CarouselFocusShell>
              )}
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
                      navigation.navigate('Leagues', { screen: 'LeagueDetail', params: { leagueId, name } })
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
  );
}

