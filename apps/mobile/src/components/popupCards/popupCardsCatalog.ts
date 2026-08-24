import { roundUpEventKey } from '../../lib/popupRoundUpKeys';
import type { PopupCardDescriptor, PopupCardKind } from './types';

function buildTitle(kind: PopupCardKind): string {
  switch (kind) {
    case 'resultsScoreSheet':
      return 'Score Sheet';
    case 'results':
      return 'Results';
    case 'personalWinner':
      return 'You Win!';
    case 'winners':
      return 'Winners';
    case 'newGameweek':
      return 'New Game Week';
    case 'newSeason':
      return 'New Season';
    case 'doPredictions':
      return 'Do Your Predictions';
    case 'championMiniLeague':
      return 'Champion';
    case 'championOverall':
      return 'Overall Champion';
    case 'welcome1':
      return 'Welcome 1';
    case 'welcome2':
      return 'Welcome 2';
    case 'welcome3':
      return 'Welcome 3';
    case 'welcome4':
      return 'Welcome 4';
  }
}

export function createPopupCard(
  kind: PopupCardKind,
  overrides: Partial<PopupCardDescriptor> = {}
): PopupCardDescriptor {
  return {
    id: overrides.id ?? `${kind}-${overrides.eventKey ?? 'card'}`,
    kind,
    title: overrides.title ?? buildTitle(kind),
    eventKey: overrides.eventKey,
    secondaryActionLabel: overrides.secondaryActionLabel,
    onSecondaryAction: overrides.onSecondaryAction,
    payload: overrides.payload,
  };
}

export function createMainPopupStack({
  resultsGw,
  newGameweekGw,
  includeResults = true,
  includePersonalGameweekWinner = false,
  includePersonalMonthlyWinner = false,
  includeWinners = true,
  includeNewGameweek = true,
  seasonScope,
}: {
  resultsGw: number;
  newGameweekGw?: number | null;
  includeResults?: boolean;
  includePersonalGameweekWinner?: boolean;
  includePersonalMonthlyWinner?: boolean;
  includeWinners?: boolean;
  includeNewGameweek?: boolean;
  /** e.g. "2026/27" so GW1 is not last season’s already-seen `winners:gw1`. */
  seasonScope?: string | null;
}): PopupCardDescriptor[] {
  const cards: PopupCardDescriptor[] = [];
  const scopedKey = (kind: string, gw: number) =>
    seasonScope ? roundUpEventKey(kind, gw, seasonScope) : `${kind}:gw${gw}`;
  const scopedId = (prefix: string, gw: number) =>
    seasonScope ? `${prefix}-gw${gw}-${seasonScope.replace(/\//g, '-')}` : `${prefix}-gw${gw}`;

  if (includePersonalGameweekWinner) {
    cards.push(
      createPopupCard('personalWinner', {
        id: scopedId('personal-winner-gameweek', resultsGw),
        eventKey: scopedKey('personalWinner:gameweek', resultsGw),
      })
    );
  }

  if (includePersonalMonthlyWinner) {
    cards.push(
      createPopupCard('personalWinner', {
        id: scopedId('personal-winner-monthly', resultsGw),
        eventKey: scopedKey('personalWinner:monthly', resultsGw),
      })
    );
  }

  if (includeResults) {
    cards.push(
      createPopupCard('resultsScoreSheet', {
        id: scopedId('results-score-sheet', resultsGw),
        eventKey: scopedKey('resultsScoreSheet', resultsGw),
      })
    );
    cards.push(
      createPopupCard('results', {
        id: scopedId('results', resultsGw),
        eventKey: scopedKey('results', resultsGw),
      })
    );
  }

  if (includeWinners) {
    cards.push(
      createPopupCard('winners', {
        id: scopedId('winners', resultsGw),
        eventKey: scopedKey('winners', resultsGw),
      })
    );
  }

  if (includeNewGameweek && typeof newGameweekGw === 'number') {
    cards.push(
      createPopupCard('newGameweek', {
        id: scopedId('new-gameweek', newGameweekGw),
        eventKey: scopedKey('newGameweek', newGameweekGw),
      })
    );
  }

  return cards;
}

export function createWelcomePopupStack(
  userId: string | null | undefined,
  options: { simulatorOpenPredictions?: boolean; simulatorGw?: number } = {}
): PopupCardDescriptor[] {
  const eventBase = userId ?? 'guest';
  const welcome4EventKey = options.simulatorOpenPredictions
    ? `simulator:welcome:open-predictions:gw${options.simulatorGw ?? 39}`
    : 'welcome:4';
  return [
    createPopupCard('welcome1', { id: `welcome-1-${eventBase}`, eventKey: 'welcome:1' }),
    createPopupCard('welcome2', { id: `welcome-2-${eventBase}`, eventKey: 'welcome:2' }),
    createPopupCard('welcome3', { id: `welcome-3-${eventBase}`, eventKey: 'welcome:3' }),
    createPopupCard('welcome4', { id: `welcome-4-${eventBase}`, eventKey: welcome4EventKey }),
  ];
}
