import React from 'react';
import { AppState, Linking, View, type AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { HomeSnapshot } from '@totl/domain';

import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { getGameweekStateFromSnapshot } from '../../lib/gameweekState';
import {
  fetchSeasonChampionBundle,
  type SeasonChampionBundle,
} from '../../lib/championEligibility';
import { getMonthForGw, resolveLeaderboardSeasonKey, SEASON_2025_26_LABEL, SEASON_LAST_GW } from '../../lib/leaderboardMonths';
import { isHiddenFromLeaderboards } from '../../lib/leaderboardVisibility';
import { isPopupAutoOpenSuppressed } from '../../lib/popupAutoOpenGate';
import { roundUpEventKey, roundUpSeasonScope } from '../../lib/popupRoundUpKeys';
import { hasSeenPopupCard, markPopupCardSeen, markPopupCardsSeen } from '../../lib/popupCardsStorage';
import { useViewerSeason } from '../../lib/useViewerSeason';
import { LEGACY_PILE_TABLES, SEASON_PILE_TABLES } from '../../lib/leagueSeasonPile';
import { createMainPopupStack, createPopupCard, createWelcomePopupStack } from './popupCardsCatalog';
import PopupCardStack from './PopupCardStack';
import type { PopupCardDescriptor, PopupCardKind } from './types';

type ActivePopupStack = {
  id: string;
  cards: PopupCardDescriptor[];
  persistSeen: boolean;
  initialShareCardId?: string;
  closeStackOnShareClose?: boolean;
};

type GwPointsRow = { user_id: string; gw: number; points: number };

type PopupCardsContextValue = {
  hasActivePopupStack: boolean;
  /** Closes a live auto-opened round-up without touching simulator-opened cards. */
  dismissAutoOpenedStack: () => void;
  openSimulatorCard: (kind: PopupCardKind) => void;
  openSimulatorResultsExample: (variant: 'wins' | 'noWinsInLeagues' | 'noLeagues') => void;
  openSimulatorPersonalWinnerExample: (variant: 'gw' | 'monthly') => void;
  openSimulatorWinnersExample: (variant: 'single' | '1to10' | '11plus' | '20each' | 'withMe') => void;
  openMainSimulatorStack: () => void;
  openPostGwReturnSimulatorStack: () => void;
  openWelcomeSimulatorStack: () => void;
  openManualResultsRecall: (gw: number) => void;
  openManualResultsScoreSheet: (gw: number, options?: { dataSource?: 'legacy' }) => void;
  /** Score sheet on top; Results card next after dismiss (same GW). */
  openManualResultsScoreSheetThenResults: (gw: number, options?: { dataSource?: 'legacy' }) => void;
  openManualResultsScoreSheetShare: (gw: number, options?: { dataSource?: 'legacy' }) => void;
  openManualRoundUpStack: (gw: number, options?: { newGameweekGw?: number | null; includeResults?: boolean }) => void;
  openSimulatorDoPredictionsCard: () => void;
  /** Opens stacked personal winner cards (most recent GW/month first). */
  openTrophyCabinetPersonalWinners: (
    kind: 'gameweek' | 'monthly',
    gwsDescending: number[],
    options?: { seasonScope?: string }
  ) => void;
  /** Opens stacked season champion cards (mini-leagues then overall), same stack as end-of-season popups. */
  openTrophyCabinetChampionCards: () => void | Promise<void>;
};

const PopupCardsContext = React.createContext<PopupCardsContextValue | null>(null);

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

function championCabinetQueryKey(userId: string, currentGwMeta: number | null) {
  return ['championTrophyCabinet', userId, currentGwMeta] as const;
}

function buildSeasonChampionPopupDescriptorsFromBundle(
  bundle: SeasonChampionBundle,
  seasonScope: string = SEASON_2025_26_LABEL
): PopupCardDescriptor[] {
  const cards: PopupCardDescriptor[] = [];
  const scopeSuffix = `:${seasonScope}`;
  for (const s of bundle.miniLeague) {
    cards.push(
      createPopupCard('championMiniLeague', {
        id: `champion-ml-${s.leagueId}-gw${SEASON_LAST_GW}-${seasonScope.replace(/\//g, '-')}`,
        eventKey: `championMiniLeague:${s.leagueId}:gw${SEASON_LAST_GW}${scopeSuffix}`,
        payload: s,
      })
    );
  }
  if (bundle.overall) {
    cards.push(
      createPopupCard('championOverall', {
        id: `champion-overall-gw${SEASON_LAST_GW}-${seasonScope.replace(/\//g, '-')}`,
        eventKey: `championOverall:gw${SEASON_LAST_GW}${scopeSuffix}`,
        payload: bundle.overall,
      })
    );
  }
  return cards;
}

async function getPersonalWinnerCardsForGw(
  userId: string,
  gw: number,
  opts: { useSeasonStack: boolean; seasonId: string | null; seasonLabel: string }
): Promise<{ gameweek: boolean; monthly: boolean }> {
  const uidNorm = String(userId).toLowerCase();
  const pileB = opts.useSeasonStack && !!opts.seasonId;
  const pointsTable = pileB ? SEASON_PILE_TABLES.gwPoints : LEGACY_PILE_TABLES.gwPoints;
  const seasonKey = resolveLeaderboardSeasonKey({
    seasonLabel: opts.seasonLabel,
    useSeasonStack: opts.useSeasonStack,
  });

  if (pileB) {
    try {
      const live = await api.getGlobalGwLiveTable(gw);
      const liveRows = (live?.rows ?? []).filter((row) => !isHiddenFromLeaderboards(String(row.user_id)));
      if (liveRows.length > 0) {
        const top = Math.max(...liveRows.map((row) => Number(row.score ?? 0)));
        const gameweek = liveRows.some(
          (row) => String(row.user_id).toLowerCase() === uidNorm && Number(row.score ?? 0) === top
        );
        const month = getMonthForGw(gw, seasonKey);
        if (!month || gw !== month.endGw) return { gameweek, monthly: false };
        // Fall through to monthly from season points below, keeping gameweek from live table.
        const monthRows = await fetchAllSupabaseRows<GwPointsRow>((from, to) => {
          let q = (supabase as any)
            .from(pointsTable)
            .select('user_id, gw, points')
            .gte('gw', month.startGw)
            .lte('gw', month.endGw)
            .order('gw', { ascending: true })
            .order('user_id', { ascending: true })
            .range(from, to);
          if (opts.seasonId) q = q.eq('season_id', opts.seasonId);
          return q;
        });
        if (!monthRows.length) return { gameweek, monthly: false };
        const monthlyTotalsByUser = new Map<string, number>();
        monthRows.forEach((row) => {
          if (isHiddenFromLeaderboards(String(row.user_id))) return;
          const rowUserId = String(row.user_id).toLowerCase();
          monthlyTotalsByUser.set(rowUserId, (monthlyTotalsByUser.get(rowUserId) ?? 0) + Number(row.points ?? 0));
        });
        const monthlyTop = Math.max(0, ...Array.from(monthlyTotalsByUser.values()));
        const monthly = (monthlyTotalsByUser.get(uidNorm) ?? Number.NEGATIVE_INFINITY) === monthlyTop;
        return { gameweek, monthly };
      }
    } catch {
      // Fall through to view-backed points.
    }
  }

  const gwRows = await fetchAllSupabaseRows<GwPointsRow>((from, to) => {
    let q = (supabase as any)
      .from(pointsTable)
      .select('user_id, gw, points')
      .eq('gw', gw)
      .order('user_id', { ascending: true })
      .range(from, to);
    if (pileB && opts.seasonId) q = q.eq('season_id', opts.seasonId);
    return q;
  });
  const visibleGwRows = gwRows.filter((row) => !isHiddenFromLeaderboards(String(row.user_id)));
  if (!visibleGwRows.length) return { gameweek: false, monthly: false };

  const gwWinningPoints = Math.max(...visibleGwRows.map((row) => Number(row.points ?? 0)));
  const gameweek = visibleGwRows.some(
    (row) => String(row.user_id).toLowerCase() === uidNorm && Number(row.points ?? 0) === gwWinningPoints
  );

  const month = getMonthForGw(gw, seasonKey);
  if (!month || gw !== month.endGw) return { gameweek, monthly: false };

  const monthRows = await fetchAllSupabaseRows<GwPointsRow>((from, to) => {
    let q = (supabase as any)
      .from(pointsTable)
      .select('user_id, gw, points')
      .gte('gw', month.startGw)
      .lte('gw', month.endGw)
      .order('gw', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to);
    if (pileB && opts.seasonId) q = q.eq('season_id', opts.seasonId);
    return q;
  });
  if (!monthRows.length) return { gameweek, monthly: false };

  const monthlyTotalsByUser = new Map<string, number>();
  monthRows.forEach((row) => {
    if (isHiddenFromLeaderboards(String(row.user_id))) return;
    const rowUserId = String(row.user_id).toLowerCase();
    monthlyTotalsByUser.set(rowUserId, (monthlyTotalsByUser.get(rowUserId) ?? 0) + Number(row.points ?? 0));
  });
  const monthlyTop = Math.max(0, ...Array.from(monthlyTotalsByUser.values()));
  const monthly = (monthlyTotalsByUser.get(uidNorm) ?? Number.NEGATIVE_INFINITY) === monthlyTop;
  return { gameweek, monthly };
}

function isLikelyNewUser(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= 15 * 60 * 1000;
}

function isDoPredictionsEventKey(eventKey: string | null | undefined): boolean {
  return typeof eventKey === 'string' && eventKey.startsWith('doPredictions:gw');
}

export default function PopupCardsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeStack, setActiveStack] = React.useState<ActivePopupStack | null>(null);
  const [initialUrlChecked, setInitialUrlChecked] = React.useState(false);
  const [foregroundReturnCount, setForegroundReturnCount] = React.useState(0);
  const suppressSessionAutoOpenRef = React.useRef(false);
  const suppressPredictionsPromptUntilForegroundRef = React.useRef(false);
  const autoOpenInFlightRef = React.useRef(false);
  const sessionDismissedEventKeysRef = React.useRef<Set<string>>(new Set());
  const lastGwSnapshotRef = React.useRef<{ viewingGw: number | null; currentGw: number | null } | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);

  const { data: authUser } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 60_000,
  });

  const { data: home } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
    staleTime: 60_000,
  });

  const userId = authUser?.id ? String(authUser.id) : null;
  const {
    useSeasonStack,
    seasonId,
    seasonLabel,
    loading: seasonLoading,
  } = useViewerSeason();
  const roundUpScope = roundUpSeasonScope({ useSeasonStack, seasonLabel });

  React.useEffect(() => {
    sessionDismissedEventKeysRef.current = new Set();
  }, [userId]);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      const returnedToForeground = previousState !== 'active' && nextState === 'active';
      if (!returnedToForeground) return;

      sessionDismissedEventKeysRef.current.forEach((eventKey) => {
        if (isDoPredictionsEventKey(eventKey)) {
          sessionDismissedEventKeysRef.current.delete(eventKey);
        }
      });
      suppressPredictionsPromptUntilForegroundRef.current = false;
      setForegroundReturnCount((count) => count + 1);
    });

    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    const viewingGw = typeof home?.viewingGw === 'number' ? home.viewingGw : null;
    const currentGw = typeof home?.currentGw === 'number' ? home.currentGw : null;
    const previous = lastGwSnapshotRef.current;

    if (
      previous &&
      typeof previous.viewingGw === 'number' &&
      typeof previous.currentGw === 'number' &&
      typeof viewingGw === 'number' &&
      typeof currentGw === 'number' &&
      previous.currentGw === currentGw &&
      previous.viewingGw < currentGw &&
      viewingGw === currentGw &&
      !home?.hasSubmittedViewingGw
    ) {
      suppressPredictionsPromptUntilForegroundRef.current = true;
    }

    lastGwSnapshotRef.current = { viewingGw, currentGw };
  }, [home?.currentGw, home?.hasSubmittedViewingGw, home?.viewingGw]);

  React.useEffect(() => {
    let alive = true;
    Linking.getInitialURL()
      .then((url) => {
        if (!alive) return;
        suppressSessionAutoOpenRef.current = Boolean(url);
        setInitialUrlChecked(true);
      })
      .catch(() => {
        if (!alive) return;
        setInitialUrlChecked(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  const openStack = React.useCallback(
    (cards: PopupCardDescriptor[], persistSeen: boolean, initialShareCardId?: string, closeStackOnShareClose = false) => {
      if (!cards.length) return;
      setActiveStack((current) => {
        if (current) return current;
        return {
          id: `${cards[0]?.id ?? 'popup-stack'}-${Date.now()}`,
          cards,
          persistSeen,
          initialShareCardId,
          closeStackOnShareClose,
        };
      });
    },
    []
  );

  const openWelcomeSimulatorStack = React.useCallback(() => {
    if (!userId) return;
    openStack(createWelcomePopupStack(userId, { simulatorOpenPredictions: true, simulatorGw: 39 }), false);
  }, [openStack, userId]);

  const openMainSimulatorStack = React.useCallback(() => {
    openStack(
      createMainPopupStack({
        resultsGw: 27,
        newGameweekGw: 28,
        includeResults: true,
        includePersonalGameweekWinner: true,
        includePersonalMonthlyWinner: true,
        includeWinners: true,
        includeNewGameweek: true,
      }),
      false
    );
  }, [openStack]);

  const openPostGwReturnSimulatorStack = React.useCallback(() => {
    openStack(
      createMainPopupStack({
        resultsGw: 35,
        newGameweekGw: 36,
        includeResults: true,
        includePersonalGameweekWinner: true,
        includePersonalMonthlyWinner: true,
        includeWinners: true,
        includeNewGameweek: true,
      }),
      false
    );
  }, [openStack]);

  const openSimulatorDoPredictionsCard = React.useCallback(() => {
    openStack(
      [
        createPopupCard('doPredictions', {
          id: 'simulator-do-predictions',
          eventKey: 'simulator:doPredictions:gw36',
        }),
      ],
      false
    );
  }, [openStack]);

  const openSimulatorCard = React.useCallback(
    (kind: PopupCardKind) => {
      if (kind === 'welcome1' || kind === 'welcome2' || kind === 'welcome3' || kind === 'welcome4') {
        openWelcomeSimulatorStack();
        return;
      }

      const simulatorGw = typeof home?.viewingGw === 'number' ? home.viewingGw : null;
      const simulatorEventKey =
        kind === 'resultsScoreSheet'
          ? 'simulator:resultsScoreSheet:example'
          : kind === 'personalWinner'
            ? 'simulator:personalWinner:gw'
          : kind === 'doPredictions'
            ? `simulator:doPredictions:gw${simulatorGw ?? 36}`
          : (kind === 'results' || kind === 'winners' || kind === 'newGameweek') && simulatorGw
          ? `${kind}:gw${simulatorGw}`
          : `simulator:${kind}`;

      openStack(
        [
          createPopupCard(kind, {
            id: `simulator-${kind}`,
            eventKey: simulatorEventKey,
          }),
        ],
        false
      );
    },
    [home?.viewingGw, openStack, openWelcomeSimulatorStack]
  );

  const openManualResultsRecall = React.useCallback(
    (gw: number) => {
      openStack(
        [
          createPopupCard('results', {
            id: `manual-results-gw${gw}`,
            eventKey: `results:gw${gw}`,
          }),
        ],
        false
      );
    },
    [openStack]
  );

  const openManualResultsScoreSheet = React.useCallback(
    (gw: number, options?: { dataSource?: 'legacy' }) => {
      const legacy = options?.dataSource === 'legacy';
      const suffix = legacy ? ':legacy' : '';
      openStack(
        [
          createPopupCard('resultsScoreSheet', {
            id: `manual-results-score-sheet-gw${gw}${legacy ? '-legacy' : ''}`,
            eventKey: `resultsScoreSheet:gw${gw}${suffix}`,
          }),
        ],
        false
      );
    },
    [openStack]
  );

  const openManualResultsScoreSheetThenResults = React.useCallback(
    (gw: number, options?: { dataSource?: 'legacy' }) => {
      const legacy = options?.dataSource === 'legacy';
      const suffix = legacy ? ':legacy' : '';
      openStack(
        [
          createPopupCard('resultsScoreSheet', {
            id: `manual-score-sheet-then-results-gw${gw}${legacy ? '-legacy' : ''}`,
            eventKey: `resultsScoreSheet:gw${gw}${suffix}`,
          }),
          createPopupCard('results', {
            id: `manual-results-under-score-sheet-gw${gw}${legacy ? '-legacy' : ''}`,
            eventKey: `results:gw${gw}${suffix}`,
          }),
        ],
        false
      );
    },
    [openStack]
  );

  const openManualResultsScoreSheetShare = React.useCallback(
    (gw: number, options?: { dataSource?: 'legacy' }) => {
      const legacy = options?.dataSource === 'legacy';
      const suffix = legacy ? ':legacy' : '';
      const card = createPopupCard('resultsScoreSheet', {
        id: `manual-results-score-sheet-share-gw${gw}${legacy ? '-legacy' : ''}`,
        eventKey: `resultsScoreSheet:gw${gw}${suffix}`,
      });
      openStack([card], false, card.id, true);
    },
    [openStack]
  );

  const openManualRoundUpStack = React.useCallback(
    (gw: number, options?: { newGameweekGw?: number | null; includeResults?: boolean }) => {
      const run = async () => {
        let personalWinnerCards = { gameweek: false, monthly: false };
        if (userId && options?.includeResults !== false) {
          try {
            personalWinnerCards = await getPersonalWinnerCardsForGw(userId, gw, {
              useSeasonStack,
              seasonId,
              seasonLabel,
            });
          } catch (error) {
            console.error('[PopupCardsProvider] Failed to check manual round-up winner eligibility:', error);
          }
        }

        openStack(
          createMainPopupStack({
            resultsGw: gw,
            newGameweekGw: options?.newGameweekGw,
            includeResults: options?.includeResults !== false,
            includePersonalGameweekWinner: personalWinnerCards.gameweek,
            includePersonalMonthlyWinner: personalWinnerCards.monthly,
            includeWinners: true,
            includeNewGameweek: typeof options?.newGameweekGw === 'number',
            seasonScope: roundUpScope,
          }),
          false
        );
      };

      void run();
    },
    [openStack, userId, useSeasonStack, seasonId, seasonLabel, roundUpScope]
  );

  const openTrophyCabinetPersonalWinners = React.useCallback(
    (kind: 'gameweek' | 'monthly', gwsDescending: number[], options?: { seasonScope?: string }) => {
      const uniq = [...new Set(gwsDescending)].filter((gw) => typeof gw === 'number' && gw > 0);
      if (!uniq.length) return;
      uniq.sort((a, b) => b - a);
      const variant = kind === 'gameweek' ? 'gameweek' : 'monthly';
      const scope = options?.seasonScope ?? roundUpScope;
      const cards = uniq.map((gw) =>
        createPopupCard('personalWinner', {
          id: `trophy-cabinet-${variant}-gw${gw}-${scope.replace(/\//g, '-')}`,
          eventKey: roundUpEventKey(`personalWinner:${variant}`, gw, scope),
        })
      );
      openStack(cards, false);
    },
    [openStack, roundUpScope]
  );

  const openTrophyCabinetChampionCards = React.useCallback(async () => {
    if (!userId) return;
    try {
      const currentGwMeta = typeof home?.currentGw === 'number' ? home.currentGw : null;
      // Reuse Stats page cache when present — opening used to re-run full season score recomputation per league.
      const bundle = await queryClient.ensureQueryData({
        queryKey: championCabinetQueryKey(userId, currentGwMeta),
        queryFn: () => fetchSeasonChampionBundle(userId, currentGwMeta),
        staleTime: 60_000,
      });
      const cards = buildSeasonChampionPopupDescriptorsFromBundle(bundle);
      if (!cards.length) return;
      openStack(cards, false);
    } catch (error) {
      console.error('[PopupCardsProvider] Failed to open champion trophy cards:', error);
    }
  }, [home?.currentGw, openStack, queryClient, userId]);

  const openSimulatorResultsExample = React.useCallback(
    (variant: 'wins' | 'noWinsInLeagues' | 'noLeagues') => {
      const eventKey =
        variant === 'noWinsInLeagues'
          ? 'simulator:results:example-no-wins-in-leagues'
          : variant === 'noLeagues'
            ? 'simulator:results:example-no-leagues'
            : 'simulator:results:example-wins';
      openStack(
        [
          createPopupCard('results', {
            id: `simulator-results-${variant}`,
            eventKey,
          }),
        ],
        false
      );
    },
    [openStack]
  );

  const openSimulatorPersonalWinnerExample = React.useCallback(
    (variant: 'gw' | 'monthly') => {
      openStack(
        [
          createPopupCard('personalWinner', {
            id: `simulator-personal-winner-${variant}`,
            eventKey: `simulator:personalWinner:${variant}`,
          }),
        ],
        false
      );
    },
    [openStack]
  );

  const openSimulatorWinnersExample = React.useCallback(
    (variant: 'single' | '1to10' | '11plus' | '20each' | 'withMe') => {
      openStack(
        [
          createPopupCard('winners', {
            id: `simulator-winners-${variant}`,
            eventKey: variant === 'withMe' ? 'simulator:winners:example-with-me' : `simulator:winners:example-${variant}`,
          }),
        ],
        false
      );
    },
    [openStack]
  );

  const dismissTop = React.useCallback(() => {
    setActiveStack((current) => {
      if (!current) return null;
      const [topCard, ...remainingCards] = current.cards;
      if (topCard?.eventKey) {
        sessionDismissedEventKeysRef.current.add(topCard.eventKey);
      }
      if (current.persistSeen && topCard?.eventKey) {
        void markPopupCardSeen(userId, topCard.eventKey);
      }
      if (!remainingCards.length) return null;
      return {
        ...current,
        cards: remainingCards,
      };
    });
  }, [userId]);

  const closeAll = React.useCallback(() => {
    setActiveStack((current) => {
      if (!current) return null;
      if (current.persistSeen) {
        current.cards.forEach((card) => {
          if (card.eventKey) {
            sessionDismissedEventKeysRef.current.add(card.eventKey);
          }
        });
        void markPopupCardsSeen(
          userId,
          current.cards.map((card) => card.eventKey)
        );
      } else {
        current.cards.forEach((card) => {
          if (card.eventKey) {
            sessionDismissedEventKeysRef.current.add(card.eventKey);
          }
        });
      }
      return null;
    });
  }, [userId]);

  const dismissAutoOpenedStack = React.useCallback(() => {
    setActiveStack((current) => {
      if (!current?.persistSeen) return current;
      return null;
    });
  }, []);

  React.useEffect(() => {
    if (!initialUrlChecked || !userId || !home || seasonLoading) return;
    if (activeStack || autoOpenInFlightRef.current) return;
    if (suppressSessionAutoOpenRef.current) return;
    if (isPopupAutoOpenSuppressed()) return;

    const run = async () => {
      autoOpenInFlightRef.current = true;
      try {
        if (isLikelyNewUser(authUser?.created_at ?? null)) {
          const welcomeCards = createWelcomePopupStack(userId);
          const welcomeVisibility = await Promise.all(
            welcomeCards.map(async (card) => ({
              card,
              seen:
                (card.eventKey ? sessionDismissedEventKeysRef.current.has(card.eventKey) : false) ||
                (await hasSeenPopupCard(userId, card.eventKey)),
            }))
          );
          const unseenWelcomeCards = welcomeVisibility.filter((item) => !item.seen).map((item) => item.card);
          if (unseenWelcomeCards.length) {
            openStack(unseenWelcomeCards, true);
            return;
          }
        }

        const gameweekState = getGameweekStateFromSnapshot({
          fixtures: home.fixtures ?? [],
          liveScores: home.liveScores ?? [],
          hasSubmittedViewingGw: !!home.hasSubmittedViewingGw,
        });
        const viewingGw = typeof home.viewingGw === 'number' ? home.viewingGw : null;
        const currentGw = typeof home.currentGw === 'number' ? home.currentGw : null;
        const newGameweekEligible =
          typeof currentGw === 'number' && typeof viewingGw === 'number' && currentGw > viewingGw;

        if (
          gameweekState === 'GW_OPEN' &&
          typeof viewingGw === 'number' &&
          typeof currentGw === 'number' &&
          viewingGw === currentGw &&
          !home.hasSubmittedViewingGw &&
          !suppressPredictionsPromptUntilForegroundRef.current
        ) {
          const doPredictionsCard = createPopupCard('doPredictions', {
            id: `do-predictions-gw${viewingGw}`,
            eventKey: `doPredictions:gw${viewingGw}`,
          });
          const dismissedThisSession = doPredictionsCard.eventKey
            ? sessionDismissedEventKeysRef.current.has(doPredictionsCard.eventKey)
            : false;
          if (!dismissedThisSession) {
            openStack([doPredictionsCard], false);
            return;
          }
        }

        if (gameweekState !== 'RESULTS_PRE_GW' && !newGameweekEligible) return;
        if (!viewingGw) return;

        let personalWinnerCards = { gameweek: false, monthly: false };
        if (gameweekState === 'RESULTS_PRE_GW' && !!home.hasSubmittedViewingGw) {
          try {
            personalWinnerCards = await getPersonalWinnerCardsForGw(userId, viewingGw, {
              useSeasonStack,
              seasonId,
              seasonLabel,
            });
          } catch (error) {
            console.error('[PopupCardsProvider] Failed to check personal winner popup eligibility:', error);
          }
        }

        const mainCards = createMainPopupStack({
          resultsGw: viewingGw,
          newGameweekGw: newGameweekEligible ? currentGw : null,
          includeResults: gameweekState === 'RESULTS_PRE_GW' && !!home.hasSubmittedViewingGw,
          includePersonalGameweekWinner: personalWinnerCards.gameweek,
          includePersonalMonthlyWinner: personalWinnerCards.monthly,
          includeWinners: gameweekState === 'RESULTS_PRE_GW',
          includeNewGameweek: newGameweekEligible,
          seasonScope: roundUpScope,
        });

        let championCards: PopupCardDescriptor[] = [];
        const seasonFinalePopup =
          viewingGw === SEASON_LAST_GW &&
          gameweekState === 'RESULTS_PRE_GW' &&
          !!home.hasSubmittedViewingGw;
        if (seasonFinalePopup) {
          try {
            const bundle = await queryClient.ensureQueryData({
              queryKey: championCabinetQueryKey(userId, currentGw),
              queryFn: () => fetchSeasonChampionBundle(userId, currentGw),
              staleTime: 60_000,
            });
            championCards = buildSeasonChampionPopupDescriptorsFromBundle(bundle);
          } catch (error) {
            console.error('[PopupCardsProvider] Failed to build season champion popup cards:', error);
          }
        }

        const eligibleCards = [...mainCards, ...championCards];

        if (!eligibleCards.length) return;

        const visibility = await Promise.all(
          eligibleCards.map(async (card) => ({
            card,
            seen:
              (card.eventKey ? sessionDismissedEventKeysRef.current.has(card.eventKey) : false) ||
              (await hasSeenPopupCard(userId, card.eventKey)),
          }))
        );
        const unseenCards = visibility.filter((item) => !item.seen).map((item) => item.card);
        if (!unseenCards.length) return;

        openStack(unseenCards, true);
      } finally {
        autoOpenInFlightRef.current = false;
      }
    };

    void run();
  }, [
    activeStack,
    authUser?.created_at,
    foregroundReturnCount,
    home,
    initialUrlChecked,
    openStack,
    queryClient,
    userId,
    seasonLoading,
    useSeasonStack,
    seasonId,
    seasonLabel,
    roundUpScope,
  ]);

  const contextValue = React.useMemo<PopupCardsContextValue>(
    () => ({
      hasActivePopupStack: !!activeStack,
      dismissAutoOpenedStack,
      openSimulatorCard,
      openSimulatorResultsExample,
      openSimulatorPersonalWinnerExample,
      openSimulatorWinnersExample,
      openSimulatorDoPredictionsCard,
      openMainSimulatorStack,
      openPostGwReturnSimulatorStack,
      openWelcomeSimulatorStack,
      openManualResultsRecall,
      openManualResultsScoreSheet,
      openManualResultsScoreSheetThenResults,
      openManualResultsScoreSheetShare,
      openManualRoundUpStack,
      openTrophyCabinetPersonalWinners,
      openTrophyCabinetChampionCards,
    }),
    [
      activeStack,
      dismissAutoOpenedStack,
      openMainSimulatorStack,
      openSimulatorDoPredictionsCard,
      openManualResultsRecall,
      openManualRoundUpStack,
      openManualResultsScoreSheet,
      openManualResultsScoreSheetThenResults,
      openManualResultsScoreSheetShare,
      openPostGwReturnSimulatorStack,
      openSimulatorCard,
      openSimulatorResultsExample,
      openSimulatorPersonalWinnerExample,
      openSimulatorWinnersExample,
      openWelcomeSimulatorStack,
      openTrophyCabinetPersonalWinners,
      openTrophyCabinetChampionCards,
    ]
  );

  return (
    <PopupCardsContext.Provider value={contextValue}>
      <View style={{ flex: 1 }}>
        {children}
        <PopupCardStack
          cards={activeStack?.cards ?? []}
          visible={!!activeStack}
          initialShareCardId={activeStack?.initialShareCardId}
          closeStackOnShareClose={!!activeStack?.closeStackOnShareClose}
          onDismissTop={dismissTop}
          onCloseAll={closeAll}
        />
      </View>
    </PopupCardsContext.Provider>
  );
}

export function usePopupCardsContext() {
  const context = React.useContext(PopupCardsContext);
  if (!context) {
    throw new Error('usePopupCardsContext must be used within PopupCardsProvider');
  }
  return context;
}
