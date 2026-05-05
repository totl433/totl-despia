export type PopupCardKind =
  | 'results'
  | 'resultsScoreSheet'
  | 'personalWinner'
  | 'winners'
  | 'newGameweek'
  | 'doPredictions'
  | 'welcome1'
  | 'welcome2'
  | 'welcome3';

export interface PopupCardDescriptor {
  id: string;
  kind: PopupCardKind;
  title: string;
  eventKey?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}
