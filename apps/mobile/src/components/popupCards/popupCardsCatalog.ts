import type { PopupCardDescriptor, PopupCardKind } from './types';

function buildTitle(kind: PopupCardKind): string {
  switch (kind) {
    case 'results':
      return 'Results';
    case 'winners':
      return 'Winners';
    case 'newGameweek':
      return 'New Game Week';
    case 'welcome1':
      return 'Welcome 1';
    case 'welcome2':
      return 'Welcome 2';
    case 'welcome3':
      return 'Welcome 3';
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
  };
}

export function createMainPopupStack({
  resultsGw,
  newGameweekGw,
  includeResults = true,
  includeWinners = true,
  includeNewGameweek = true,
}: {
  resultsGw: number;
  newGameweekGw?: number | null;
  includeResults?: boolean;
  includeWinners?: boolean;
  includeNewGameweek?: boolean;
}): PopupCardDescriptor[] {
  const cards: PopupCardDescriptor[] = [];

  if (includeResults) {
    cards.push(createPopupCard('results', { id: `results-gw${resultsGw}`, eventKey: `results:gw${resultsGw}` }));
  }

  if (includeWinners) {
    cards.push(createPopupCard('winners', { id: `winners-gw${resultsGw}`, eventKey: `winners:gw${resultsGw}` }));
  }

  if (includeNewGameweek && typeof newGameweekGw === 'number') {
    cards.push(
      createPopupCard('newGameweek', {
        id: `new-gameweek-gw${newGameweekGw}`,
        eventKey: `newGameweek:gw${newGameweekGw}`,
      })
    );
  }

  return cards;
}

export function createWelcomePopupStack(userId: string | null | undefined): PopupCardDescriptor[] {
  const eventBase = userId ?? 'guest';
  return [
    createPopupCard('welcome1', { id: `welcome-1-${eventBase}`, eventKey: 'welcome:1' }),
    createPopupCard('welcome2', { id: `welcome-2-${eventBase}`, eventKey: 'welcome:2' }),
    createPopupCard('welcome3', { id: `welcome-3-${eventBase}`, eventKey: 'welcome:3' }),
  ];
}
