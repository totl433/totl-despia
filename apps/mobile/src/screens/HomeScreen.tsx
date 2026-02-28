import React from 'react';
import { AppState, Animated, Image, Pressable, View, useWindowDimensions } from 'react-native';

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
import { TEAM_BADGES } from '../lib/teamBadges';
import { normalizeTeamCode } from '../lib/teamColors';
import { getMediumName } from '../../../../src/lib/teamNames';

import MiniFixtureCard from '../components/home/MiniFixtureCard';
import ExpandedFixtureCard from '../components/home/ExpandedFixtureCard';

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

function fixtureKickoffTimeLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'KO';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'KO';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function normalizeTeamForms(input: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(input ?? {}).forEach(([rawCode, rawForm]) => {
    const code = normalizeTeamCode(rawCode);
    const form = typeof rawForm === 'string' ? rawForm.trim().toUpperCase() : '';
    if (code && form) out[code] = form;
  });
  return out;
}

function ordinalLabel(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return '—';
  const n = Math.trunc(Number(value));
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function formToDotColors(form: string | null | undefined): string[] {
  const chars = (typeof form === 'string' ? form.toUpperCase() : '').replace(/[^WDL]/g, '').slice(-5).split('');
  const padded = chars.length >= 5 ? chars : [...Array(5 - chars.length).fill('D'), ...chars];
  return padded.map((ch) => (ch === 'W' ? '#10B981' : ch === 'L' ? '#DC2626' : '#CBD5E1'));
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const scrollYRef = React.useRef(0);
  const fixtureNodeRefs = React.useRef<Record<string, View | null>>({});
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
    const ordered = [...fixtures].sort((a, b) => Number(a?.fixture_index ?? 0) - Number(b?.fixture_index ?? 0));
    const groups = new Map<string, Fixture[]>();
    ordered.forEach((fixture) => {
      const key = fixtureDateLabel(fixture.kickoff_time ?? null);
      const arr = groups.get(key) ?? [];
      arr.push(fixture);
      groups.set(key, arr);
    });

    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (a === 'No date') return 1;
      if (b === 'No date') return -1;
      const a0 = groups.get(a)?.[0]?.kickoff_time;
      const b0 = groups.get(b)?.[0]?.kickoff_time;
      const da = a0 ? new Date(a0).getTime() : Number.POSITIVE_INFINITY;
      const db = b0 ? new Date(b0).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });

    return keys.map((date) => ({ date, fixtures: groups.get(date) ?? [] }));
  }, [fixtures]);

  const showFixtureDateSections = true;

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
  const TIME_ICON = require('../../assets/icons/time.png');

  // Leaderboard cards and pills are now shared components.

  const [expandedFixtureId, setExpandedFixtureId] = React.useState<string | null>(null);
  const [cardHeightsById, setCardHeightsById] = React.useState<Record<string, number>>({});
  const [showAllExpanded, setShowAllExpanded] = React.useState(false);
  const [viewMenuOpen, setViewMenuOpen] = React.useState(false);
  const [gwOpenLayout, setGwOpenLayout] = React.useState<'mini' | 'compact'>('mini');
  const [miniExpandedFixtureId, setMiniExpandedFixtureId] = React.useState<string | null>(null);
  const fixturesTransition = React.useRef(new Animated.Value(1)).current;
  const fixturesTransitionInFlight = React.useRef(false);
  const stackFixtures = React.useMemo(
    () => [...fixtures].sort((a, b) => Number(a?.fixture_index ?? 0) - Number(b?.fixture_index ?? 0)),
    [fixtures]
  );

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
  const viewingGw = home?.viewingGw ?? null;
  const currentGw = home?.currentGw ?? null;
  const { data: predictionsMeta } = useQuery({
    enabled: typeof viewingGw === 'number',
    queryKey: ['home-predictions-meta', viewingGw],
    queryFn: () => api.getPredictions({ gw: viewingGw as number }),
    staleTime: 60_000,
  });
  const teamFormsByCode = React.useMemo(
    () => normalizeTeamForms((predictionsMeta?.teamForms ?? {}) as Record<string, string>),
    [predictionsMeta?.teamForms]
  );
  const teamPositionsByCode = React.useMemo(() => {
    const out: Record<string, number> = {};
    const raw = (predictionsMeta?.teamPositions ?? {}) as Record<string, unknown>;
    Object.entries(raw).forEach(([codeRaw, posRaw]) => {
      const code = normalizeTeamCode(codeRaw);
      const pos = Number(posRaw);
      if (!code) return;
      if (!Number.isFinite(pos) || pos <= 0) return;
      out[code] = Math.trunc(pos);
    });
    return out;
  }, [predictionsMeta?.teamPositions]);
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
    gwState === 'RESULTS_PRE_GW' &&
    typeof currentGw === 'number' &&
    typeof viewingGw === 'number' &&
    viewingGw >= currentGw;
  // Temporary visual experiment: hide the top performance carousel without deleting its implementation.
  const showTopPerformanceCarousel = false;
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
          isRefreshing={refreshing}
          hasLiveGames={gwState === 'LIVE' && gwIsLive}
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
              backgroundColor: t.color.surface,
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
                  <TotlText style={{ fontFamily: t.font.medium, fontSize: 16, lineHeight: 18 }}>
                    Gameweek {viewingGw} Predictions
                  </TotlText>
                </View>
                <TotlText variant="muted" style={{ marginLeft: 30 }}>
                  Deadline{' '}
                  {deadline?.text ? (
                    <TotlText style={{ color: deadlineExpired ? '#64748B' : '#1C8376', fontFamily: t.font.medium }}>
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
                  <TotlText style={{ color: '#FFFFFF', fontFamily: t.font.medium }}>Go</TotlText>
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

        {showTopPerformanceCarousel ? (
          /* Full-bleed horizontal row (remove side margins from the page padding) */
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
                const predictionsLocked = Boolean(home?.hasSubmittedViewingGw) || deadlineExpired;
                const viewingGwForCountdown =
                  typeof home?.viewingGw === 'number' ? home.viewingGw : typeof home?.currentGw === 'number' ? home.currentGw : null;

                if (predictionsLocked && typeof viewingGwForCountdown === 'number') {
                  const wallNowMs = Date.now();
                  const firstFixture = fixtures
                    .filter((f) => {
                      const k = f?.kickoff_time ? new Date(f.kickoff_time).getTime() : NaN;
                      return Number.isFinite(k);
                    })
                    .map((f) => ({ f, k: new Date(f.kickoff_time as string).getTime() }))
                    .sort((a, b) => a.k - b.k)[0]?.f;

                  const firstFixtureKickoffTimeMs = firstFixture?.kickoff_time ? new Date(firstFixture.kickoff_time).getTime() : null;

                  const countdownVisible =
                    typeof firstFixtureKickoffTimeMs === 'number' &&
                    Number.isFinite(firstFixtureKickoffTimeMs) &&
                    wallNowMs < firstFixtureKickoffTimeMs &&
                    dismissedCountdownGw !== viewingGwForCountdown;

                  if (countdownVisible && firstFixtureKickoffTimeMs && firstFixture) {
                    cards.push({
                      key: 'gw-kickoff-countdown',
                      node: (
                        <GameweekCountdownItem
                          variant="tile"
                          gw={viewingGwForCountdown}
                          kickoffTimeMs={firstFixtureKickoffTimeMs}
                          homeCode={String(firstFixture?.home_code ?? '').toUpperCase() || null}
                          awayCode={String(firstFixture?.away_code ?? '').toUpperCase() || null}
                          onKickedOff={() => setDismissedCountdownGw(viewingGwForCountdown)}
                        />
                      ),
                    });
                  }
                }

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
              } else if (!showComingSoonBanner && resultsGw) {
                const currentScore = typeof scoreSummary?.correct === 'number' ? String(scoreSummary.correct) : '--';
                const currentTotal = typeof scoreSummary?.total === 'number' && scoreSummary.total > 0 ? String(scoreSummary.total) : '--';
                cards.push({
                  key: 'gw-current-score',
                  node: (
                    <LeaderboardCardResultsCta
                      gw={resultsGw}
                      badge={LB_BADGE_5}
                      score={currentScore}
                      totalFixtures={currentTotal}
                      label="Current Score"
                      tone="gradient"
                      showSheen
                      rightActionIcon="share"
                      onPress={() => navigation.navigate('GameweekResults', { gw: resultsGw, mode: 'fixturesShare' })}
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
                      leftNode={<Image source={TIME_ICON} style={{ width: 28, height: 28 }} resizeMode="contain" />}
                      badge={null}
                      label="Coming Soon!"
                      tone="light"
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
                    tone="light"
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
        ) : null}

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
        <View style={{ marginTop: 8 }}>
          <SectionHeaderRow
            title={typeof home?.viewingGw === 'number' ? `Gameweek ${home.viewingGw}` : 'Gameweek'}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {supportsMiniCompactLayout ? (
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
                )}
              </View>
            }
          />
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
                        <TotlText style={{ fontSize: 17, lineHeight: 21, fontFamily: t.font.medium, color: t.color.text }}>{section.date}</TotlText>
                      </View>
                      <Reanimated.View layout={miniLayoutTransition} style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, zIndex: 20 }}>
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
                              : typeof ls?.home_score === 'number' && typeof ls?.away_score === 'number'
                                ? ls.home_score > ls.away_score
                                  ? 'H'
                                  : ls.home_score < ls.away_score
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
                          const formatScorerLine = (g: any) => {
                            const full = typeof g?.scorer === 'string' ? g.scorer.trim() : 'Unknown';
                            const surname = full.split(/\s+/).filter(Boolean).slice(-1)[0] ?? full;
                            const minute = typeof g?.minute === 'number' ? `${g.minute}'` : '';
                            return `${surname} ${minute}`.trim();
                          };
                          const homeScorers = goalsRaw
                            .filter((g) => {
                              const team = String(g?.team ?? '').toLowerCase();
                              return team && homeCandidates.some((c) => c && (team.includes(c) || c.includes(team)));
                            })
                            .map(formatScorerLine)
                            .slice(0, 3);
                          const awayScorers = goalsRaw
                            .filter((g) => {
                              const team = String(g?.team ?? '').toLowerCase();
                              return team && awayCandidates.some((c) => c && (team.includes(c) || c.includes(team)));
                            })
                            .map(formatScorerLine)
                            .slice(0, 3);

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
                              <View ref={(node) => { fixtureNodeRefs.current[fixtureId] = node; }}>
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
                                  gwState={gwState}
                                  pick={pick}
                                  derivedOutcome={derivedOutcome}
                                  hasScore={hasScore}
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
                  const formatScorerLine = (g: any) => {
                    const full = typeof g?.scorer === 'string' ? g.scorer.trim() : 'Unknown';
                    const surname = full.split(/\s+/).filter(Boolean).slice(-1)[0] ?? full;
                    const minute = typeof g?.minute === 'number' ? `${g.minute}'` : "";
                    return `${surname} ${minute}`.trim();
                  };
                  const homeScorers = goalsRaw
                    .filter((g) => {
                      const team = String(g?.team ?? '').toLowerCase();
                      return team && homeCandidates.some((c) => c && (team.includes(c) || c.includes(team)));
                    })
                    .map(formatScorerLine)
                    .slice(0, 3);
                  const awayScorers = goalsRaw
                    .filter((g) => {
                      const team = String(g?.team ?? '').toLowerCase();
                      return team && awayCandidates.some((c) => c && (team.includes(c) || c.includes(team)));
                    })
                    .map(formatScorerLine)
                    .slice(0, 3);

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

