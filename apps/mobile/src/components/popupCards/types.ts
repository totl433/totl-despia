export type PopupCardKind =
  | 'results'
  | 'winners'
  | 'newGameweek'
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
