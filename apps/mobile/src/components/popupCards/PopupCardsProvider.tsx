import React from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { HomeSnapshot } from '@totl/domain';

import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { getGameweekStateFromSnapshot } from '../../lib/gameweekState';
import { getMonthForGw } from '../../lib/leaderboardMonths';
import { hasSeenPopupCard, markPopupCardSeen, markPopupCardsSeen } from '../../lib/popupCardsStorage';
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
  openSimulatorCard: (kind: PopupCardKind) => void;
  openSimulatorResultsExample: (variant: 'wins' | 'noWinsInLeagues' | 'noLeagues') => void;
  openSimulatorPersonalWinnerExample: (variant: 'gw' | 'monthly') => void;
  openSimulatorWinnersExample: (variant: 'single' | '1to10' | '11plus' | '20each' | 'withMe') => void;
  openMainSimulatorStack: () => void;
  openPostGwReturnSimulatorStack: () => void;
  openWelcomeSimulatorStack: () => void;
  openManualResultsRecall: (gw: number) => void;
  openManualResultsScoreSheet: (gw: number) => void;
  /** Score sheet on top; Results card next after dismiss (same GW). */
  openManualResultsScoreSheetThenResults: (gw: number) => void;
  openManualResultsScoreSheetShare: (gw: number) => void;
  openManualRoundUpStack: (gw: number, options?: { newGameweekGw?: number | null; includeResults?: boolean }) => void;
  openSimulatorDoPredictionsCard: () => void;
  /** Opens stacked personal winner cards (most recent GW/month first). */
  openTrophyCabinetPersonalWinners: (kind: 'gameweek' | 'monthly', gwsDescending: number[]) => void;
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

async function getPersonalWinnerCardsForGw(userId: string, gw: number): Promise<{ gameweek: boolean; monthly: boolean }> {
  const gwRows = await fetchAllSupabaseRows<GwPointsRow>((from, to) =>
    supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .eq('gw', gw)
      .order('user_id', { ascending: true })
      .range(from, to)
  );
  if (!gwRows.length) return { gameweek: false, monthly: false };

  const gwWinningPoints = Math.max(...gwRows.map((row) => Number(row.points ?? 0)));
  const gameweek = gwRows.some((row) => String(row.user_id) === userId && Number(row.points ?? 0) === gwWinningPoints);

  const month = getMonthForGw(gw);
  if (!month || gw !== month.endGw) return { gameweek, monthly: false };

  const monthRows = await fetchAllSupabaseRows<GwPointsRow>((from, to) =>
    supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .gte('gw', month.startGw)
      .lte('gw', month.endGw)
      .order('gw', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to)
  );
  if (!monthRows.length) return { gameweek, monthly: false };

  const monthlyTotalsByUser = new Map<string, number>();
  monthRows.forEach((row) => {
    const rowUserId = String(row.user_id);
    monthlyTotalsByUser.set(rowUserId, (monthlyTotalsByUser.get(rowUserId) ?? 0) + Number(row.points ?? 0));
  });
  const monthlyTop = Math.max(...Array.from(monthlyTotalsByUser.values()));
  const monthly = (monthlyTotalsByUser.get(userId) ?? Number.NEGATIVE_INFINITY) === monthlyTop;
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
    openStack(createWelcomePopupStack(userId), false);
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
      if (kind === 'welcome1' || kind === 'welcome2' || kind === 'welcome3') {
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
    (gw: number) => {
      openStack(
        [
          createPopupCard('resultsScoreSheet', {
            id: `manual-results-score-sheet-gw${gw}`,
            eventKey: `resultsScoreSheet:gw${gw}`,
          }),
        ],
        false
      );
    },
    [openStack]
  );

  const openManualResultsScoreSheetThenResults = React.useCallback(
    (gw: number) => {
      openStack(
        [
          createPopupCard('resultsScoreSheet', {
            id: `manual-score-sheet-then-results-gw${gw}`,
            eventKey: `resultsScoreSheet:gw${gw}`,
          }),
          createPopupCard('results', {
            id: `manual-results-under-score-sheet-gw${gw}`,
            eventKey: `results:gw${gw}`,
          }),
        ],
        false
      );
    },
    [openStack]
  );

  const openManualResultsScoreSheetShare = React.useCallback(
    (gw: number) => {
      const card = createPopupCard('resultsScoreSheet', {
        id: `manual-results-score-sheet-share-gw${gw}`,
        eventKey: `resultsScoreSheet:gw${gw}`,
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
            personalWinnerCards = await getPersonalWinnerCardsForGw(userId, gw);
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
          }),
          false
        );
      };

      void run();
    },
    [openStack, userId]
  );

  const openTrophyCabinetPersonalWinners = React.useCallback(
    (kind: 'gameweek' | 'monthly', gwsDescending: number[]) => {
      const uniq = [...new Set(gwsDescending)].filter((gw) => typeof gw === 'number' && gw > 0);
      if (!uniq.length) return;
      uniq.sort((a, b) => b - a);
      const variant = kind === 'gameweek' ? 'gameweek' : 'monthly';
      const cards = uniq.map((gw) =>
        createPopupCard('personalWinner', {
          id: `trophy-cabinet-${variant}-gw${gw}`,
          eventKey: `personalWinner:${variant}:gw${gw}`,
        })
      );
      openStack(cards, false);
    },
    [openStack]
  );

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

  React.useEffect(() => {
    if (!initialUrlChecked || !userId || !home) return;
    if (activeStack || autoOpenInFlightRef.current) return;
    if (suppressSessionAutoOpenRef.current) return;

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
            personalWinnerCards = await getPersonalWinnerCardsForGw(userId, viewingGw);
          } catch (error) {
            console.error('[PopupCardsProvider] Failed to check personal winner popup eligibility:', error);
          }
        }

        const eligibleCards = createMainPopupStack({
          resultsGw: viewingGw,
          newGameweekGw: newGameweekEligible ? currentGw : null,
          includeResults: gameweekState === 'RESULTS_PRE_GW' && !!home.hasSubmittedViewingGw,
          includePersonalGameweekWinner: personalWinnerCards.gameweek,
          includePersonalMonthlyWinner: personalWinnerCards.monthly,
          includeWinners: gameweekState === 'RESULTS_PRE_GW',
          includeNewGameweek: newGameweekEligible,
        });

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
  }, [activeStack, authUser?.created_at, foregroundReturnCount, home, initialUrlChecked, openStack, userId]);

  const contextValue = React.useMemo<PopupCardsContextValue>(
    () => ({
      hasActivePopupStack: !!activeStack,
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
    }),
    [
      activeStack,
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
    ]
  );

  return (
    <PopupCardsContext.Provider value={contextValue}>
      {children}
      <PopupCardStack
        cards={activeStack?.cards ?? []}
        visible={!!activeStack}
        initialShareCardId={activeStack?.initialShareCardId}
        closeStackOnShareClose={!!activeStack?.closeStackOnShareClose}
        onDismissTop={dismissTop}
        onCloseAll={closeAll}
      />
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
