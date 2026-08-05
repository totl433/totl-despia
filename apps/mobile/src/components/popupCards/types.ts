import type { MiniLeagueChampionSummary, OverallChampionSummary } from '../../lib/championEligibility';

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
export type PopupCardPayload = MiniLeagueChampionSummary | OverallChampionSummary;

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
