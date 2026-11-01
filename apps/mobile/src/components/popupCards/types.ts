import type { MiniLeagueChampionSummary, OverallChampionSummary } from '../../lib/championEligibility';
import type { PersonalWinnerBrowsePayload } from '../../lib/trophyCabinetBrowse';

export type PopupCardKind =
  | 'results'
  | 'resultsScoreSheet'
  | 'personalWinner'
  | 'winners'
  | 'newGameweek'
  | 'newSeason'
  | 'doPredictions'
  | 'championMiniLeague'
  | 'championOverall'
  | 'welcome1'
  | 'welcome2'
  | 'welcome3'
  | 'welcome4';

/** Optional prefetched body data so cards can open without network recompute. */
export type PersonalWinnerPopupPayload = PersonalWinnerBrowsePayload;

export type PopupCardPayload = MiniLeagueChampionSummary | OverallChampionSummary | PersonalWinnerPopupPayload;

export function isPersonalWinnerPopupPayload(
  payload: PopupCardPayload | undefined
): payload is PersonalWinnerPopupPayload {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'victoryType' in payload &&
    (payload.victoryType === 'gameweek' || payload.victoryType === 'monthly') &&
    'points' in payload &&
    'label' in payload
  );
}

export interface PopupCardDescriptor {
  id: string;
  kind: PopupCardKind;
  title: string;
  eventKey?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Prefetched champion (or other) payload — avoids replaying season scoring when opening. */
  payload?: PopupCardPayload;
}
