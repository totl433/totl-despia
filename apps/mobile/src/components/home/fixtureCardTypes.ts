import type { ImageSourcePropType } from 'react-native';
import type { LiveStatus, Pick } from '@totl/domain';
import type { GameweekState } from '../../lib/gameweekState';

export interface MiniFixtureCardProps {
  fixtureId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  footerInside?: React.ReactNode;
  expandedFooterInside?: React.ReactNode;
  /** When provided, renders a single footer that receives isExpanded for morphing (e.g. avatar chips). */
  footerWithExpandState?: (props: { isExpanded: boolean }) => React.ReactNode;
  /** Tighter layout for Predictions ML cards (50px badge height, no bottom padding). */
  tightLayout?: boolean;
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
  fixtureStatus?: LiveStatus | 'SCHEDULED';

  gwState: GameweekState;
  pick: Pick | undefined;
  derivedOutcome: Pick | null;
  hasScore: boolean;
  compactVisualTone?: 'default' | 'finished-grey';
  compactLiveMinutePill?: boolean;

  percentBySide: Record<Pick, number>;
  showExpandedPercentages: boolean;

  homeFormColors: string[];
  awayFormColors: string[];
  homePositionLabel: string;
  awayPositionLabel: string;

  homeScorers: string[];
  awayScorers: string[];
  homeRedCardCount?: number;
  awayRedCardCount?: number;

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
  homeRedCardCount?: number;
  awayRedCardCount?: number;

  kickoffDetail: string;
  hideStatusRowCompletely: boolean;
  hideRepeatedKickoffInDetails: boolean;
  hideRepeatedKickoffInCompact: boolean;
  hideRepeatedKickoffInLiveScheduled: boolean;

  onLayout?: (height: number) => void;
}
