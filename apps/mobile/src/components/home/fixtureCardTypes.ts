import type { ImageSourcePropType } from 'react-native';
import type { Pick } from '@totl/domain';
import type { GameweekState } from '../../lib/gameweekState';

export interface MiniFixtureCardProps {
  fixtureId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  footerInside?: React.ReactNode;
  expandedFooterInside?: React.ReactNode;
  suppressExpandedDetails?: boolean;

  homeCode: string;
  awayCode: string;
  headerHome: string;
  headerAway: string;
  homeBadge: ImageSourcePropType | null;
  awayBadge: ImageSourcePropType | null;

  primaryLabel: string;
  primaryExpandedLabel: string;
  secondaryLabel: string;

  gwState: GameweekState;
  pick: Pick | undefined;
  derivedOutcome: Pick | null;
  hasScore: boolean;

  percentBySide: Record<Pick, number>;
  showExpandedPercentages: boolean;

  homeFormColors: string[];
  awayFormColors: string[];
  homePositionLabel: string;
  awayPositionLabel: string;

  homeScorers: string[];
  awayScorers: string[];

  fixtureDateLabel: string;
}

export interface ExpandedFixtureCardProps {
  fixtureId: string;
  isExpandedVisual: boolean;
  isDetailsViewActive: boolean;
  isCompactStack: boolean;
  isCompactCard: boolean;
  fixtureMarginTop: number;
  stackZIndex: number;
  stackElevation: number;
  onPress: () => void;

  homeCode: string;
  awayCode: string;
  headerPrimary: string;
  headerSecondary: string;
  headerHome: string;
  headerAway: string;
  homeBadge: ImageSourcePropType | null;
  awayBadge: ImageSourcePropType | null;
  homeTeamFontWeight: '600' | '800';
  awayTeamFontWeight: '600' | '800';

  gwState: GameweekState;
  pick: Pick | undefined;
  derivedOutcome: Pick | null;
  hasScore: boolean;
  isFinished: boolean;
  isLiveOrResultsCard: boolean;

  percentBySide: Record<Pick, number>;
  showTabsRow: boolean;
  showTabPercentages: boolean;
  showPercentagesOnTabs: boolean;
  tabsAboveScorers: boolean;

  homeScorers: string[];
  awayScorers: string[];

  kickoffDetail: string;
  hideStatusRowCompletely: boolean;
  hideRepeatedKickoffInDetails: boolean;
  hideRepeatedKickoffInCompact: boolean;
  hideRepeatedKickoffInLiveScheduled: boolean;

  onLayout?: (height: number) => void;
}
