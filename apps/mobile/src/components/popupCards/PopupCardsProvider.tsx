import React from 'react';
import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { HomeSnapshot } from '@totl/domain';

import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { getGameweekStateFromSnapshot } from '../../lib/gameweekState';
import { hasSeenPopupCard, markPopupCardSeen, markPopupCardsSeen } from '../../lib/popupCardsStorage';
import { createMainPopupStack, createPopupCard, createWelcomePopupStack } from './popupCardsCatalog';
import PopupCardStack from './PopupCardStack';
import type { PopupCardDescriptor, PopupCardKind } from './types';

type ActivePopupStack = {
  id: string;
  cards: PopupCardDescriptor[];
  persistSeen: boolean;
};

type PopupCardsContextValue = {
  hasActivePopupStack: boolean;
  openSimulatorCard: (kind: PopupCardKind) => void;
  openMainSimulatorStack: () => void;
  openWelcomeSimulatorStack: () => void;
  openManualResultsRecall: (gw: number) => void;
};

const PopupCardsContext = React.createContext<PopupCardsContextValue | null>(null);

function isLikelyNewUser(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= 15 * 60 * 1000;
}

export default function PopupCardsProvider({ children }: { children: React.ReactNode }) {
  const [activeStack, setActiveStack] = React.useState<ActivePopupStack | null>(null);
  const [initialUrlChecked, setInitialUrlChecked] = React.useState(false);
  const suppressSessionAutoOpenRef = React.useRef(false);
  const autoOpenInFlightRef = React.useRef(false);
  const sessionDismissedEventKeysRef = React.useRef<Set<string>>(new Set());

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

  const openStack = React.useCallback((cards: PopupCardDescriptor[], persistSeen: boolean) => {
    if (!cards.length) return;
    setActiveStack((current) => {
      if (current) return current;
      return {
        id: `${cards[0]?.id ?? 'popup-stack'}-${Date.now()}`,
        cards,
        persistSeen,
      };
    });
  }, []);

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
        includeWinners: true,
        includeNewGameweek: true,
      }),
      false
    );
  }, [openStack]);

  const openSimulatorCard = React.useCallback(
    (kind: PopupCardKind) => {
      if (kind === 'welcome1' || kind === 'welcome2' || kind === 'welcome3') {
        openWelcomeSimulatorStack();
        return;
      }

      openStack(
        [
          createPopupCard(kind, {
            id: `simulator-${kind}`,
            eventKey: `simulator:${kind}`,
          }),
        ],
        false
      );
    },
    [openStack, openWelcomeSimulatorStack]
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

  const dismissTop = React.useCallback(() => {
    setActiveStack((current) => {
      if (!current) return null;
      const [topCard, ...remainingCards] = current.cards;
      if (current.persistSeen && topCard?.eventKey) {
        sessionDismissedEventKeysRef.current.add(topCard.eventKey);
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

        if (gameweekState !== 'RESULTS_PRE_GW' && !newGameweekEligible) return;
        if (!viewingGw) return;

        const eligibleCards = createMainPopupStack({
          resultsGw: viewingGw,
          newGameweekGw: newGameweekEligible ? currentGw : null,
          includeResults: gameweekState === 'RESULTS_PRE_GW' && !!home.hasSubmittedViewingGw,
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
  }, [activeStack, authUser?.created_at, home, initialUrlChecked, openStack, userId]);

  const contextValue = React.useMemo<PopupCardsContextValue>(
    () => ({
      hasActivePopupStack: !!activeStack,
      openSimulatorCard,
      openMainSimulatorStack,
      openWelcomeSimulatorStack,
      openManualResultsRecall,
    }),
    [activeStack, openMainSimulatorStack, openManualResultsRecall, openSimulatorCard, openWelcomeSimulatorStack]
  );

  return (
    <PopupCardsContext.Provider value={contextValue}>
      {children}
      <PopupCardStack
        cards={activeStack?.cards ?? []}
        visible={!!activeStack}
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
