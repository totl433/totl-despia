export type PopupCardKind =
  | 'results'
  | 'resultsScoreSheet'
  | 'personalWinner'
  | 'winners'
  | 'newGameweek'
  | 'doPredictions'
  | 'championMiniLeague'
  | 'championOverall'
  | 'welcome1'
  | 'welcome2'
  | 'welcome3'
  | 'welcome4';

export interface PopupCardDescriptor {
  id: string;
  kind: PopupCardKind;
  title: string;
  eventKey?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}
