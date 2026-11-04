/**
 * The Game Centre card codes: one permanent code per card type, used in the feed audit, the audit
 * doc, Figma and conversation ("M05" is always Kick-off).
 *
 * Rules:
 * - A code never changes and is never reused, even if the card is renamed, redesigned or removed.
 *   A removed card stays here with status 'removed'.
 * - A new card takes the next free number in its family (the next match card is M11).
 * - Variants (copy versions A/B/C, states such as "moving up") are not separate codes. Name them
 *   after the code, e.g. "M06 · own goal" or "P01#B".
 * - The #n in the audit view is the card's position on that screen, not an id. Use the code.
 *
 * Families: X pinned · M match · D shared feed (added 24–25 Oct) · P Players · S season stats ·
 * R personal · C chat · N documented but not built. An N card keeps its code once it is built.
 *
 * `feedAuditCodes.test.ts` checks the audit view only uses codes listed here, with the same names.
 */
import type { FeedKind } from './feed';

export type FeedCardFamily = 'X' | 'M' | 'D' | 'P' | 'S' | 'R' | 'C' | 'N';

export type FeedCardStatus =
  | 'live'
  /** Built and wired up, but its condition is never met (see `note`). */
  | 'never-shows'
  /** Built, then filtered out of the real feed. */
  | 'hidden'
  | 'not-built'
  | 'removed';

export type FeedCardCode = {
  code: string;
  name: string;
  /** Feed item kinds this card renders as; pinned cards sit above the feed and have none. */
  kinds: readonly FeedKind[];
  /** Where the real card is built or drawn. */
  source: string;
  status: FeedCardStatus;
  note?: string;
};

export const FEED_CARD_CODES: readonly FeedCardCode[] = [
  { code: 'X01', name: 'Pinned gameweek card', kinds: [], source: 'GameCentrePinnedCard', status: 'live' },
  { code: 'X02', name: 'Mini-league invite pin', kinds: [], source: 'GameCentreInvitePinnedCard', status: 'live' },

  { code: 'M01', name: 'Starting soon', kinds: ['waiting'], source: 'buildMatchFeed', status: 'live' },
  { code: 'M02', name: 'Here We Go', kinds: ['opener'], source: 'matchItemsFromPosts', status: 'live' },
  { code: 'M03', name: 'Line-up', kinds: ['lineup'], source: 'matchItemsFromPosts', status: 'live' },
  { code: 'M04', name: 'The teams (XI)', kinds: ['xi'], source: 'matchItemsFromPosts', status: 'live' },
  { code: 'M05', name: 'Kick-off', kinds: ['kickoff'], source: 'matchItemsFromPosts', status: 'live' },
  { code: 'M06', name: 'Goal', kinds: ['goal'], source: 'matchItemsFromPosts', status: 'live' },
  { code: 'M07', name: 'Goal ruled out', kinds: ['ruled-out'], source: 'matchItemsFromPosts', status: 'live' },
  { code: 'M08', name: 'Half-time', kinds: ['half-time'], source: 'matchItemsFromPosts', status: 'live' },
  { code: 'M09', name: 'Second half', kinds: ['second-half'], source: 'matchItemsFromPosts', status: 'live' },
  { code: 'M10', name: 'Full-time', kinds: ['full-time'], source: 'matchItemsFromPosts', status: 'live' },

  { code: 'D01', name: 'Fixtures', kinds: ['fixtures'], source: 'fixtureListItem', status: 'live' },
  { code: 'D02', name: 'Score sheet', kinds: ['score-sheet'], source: 'scoreSheetItem', status: 'live' },
  { code: 'D03', name: 'Everyone has predicted', kinds: ['league-event'], source: 'everyonePredictedItems', status: 'live' },
  { code: 'D04', name: 'Player joined', kinds: ['league-event'], source: 'playerJoinedItems', status: 'live' },
  { code: 'D05', name: 'Good luck shout-out', kinds: ['shout'], source: 'goodLuckItem', status: 'live' },
  { code: 'D06', name: 'Gameweek winners shout-out', kinds: ['shout'], source: 'winnerShoutItems', status: 'live' },
  { code: 'D07', name: 'Monthly winners shout-out', kinds: ['shout'], source: 'winnerShoutItems', status: 'live' },
  { code: 'D08', name: 'Season winners shout-out', kinds: ['shout'], source: 'winnerShoutItems', status: 'live' },
  { code: 'D09', name: 'Midweek monthly leader', kinds: ['shout'], source: 'winnerShoutItems', status: 'live' },
  { code: 'D10', name: 'Midweek overall leader', kinds: ['shout'], source: 'winnerShoutItems', status: 'live' },
  { code: 'D11', name: 'Admin post', kinds: ['shout'], source: 'adminFeedItems', status: 'live' },

  { code: 'P01', name: "Daily winners (yesterday's)", kinds: ['shout'], source: 'playersStackItems', status: 'live' },
  {
    code: 'P02',
    name: "Weekly winners (this week's)",
    kinds: ['shout'],
    source: 'playersStackItems',
    status: 'never-shows',
    note: 'weekClosed compares yesterday with the end of the current week, so it is never true.',
  },
  { code: 'P03', name: "Monthly winners (this month's)", kinds: ['shout'], source: 'playersStackItems', status: 'live' },
  { code: 'P04', name: 'New game ready (8am)', kinds: ['players-ready'], source: 'playersStackItems', status: 'live' },
  { code: 'P05', name: "Haven't played (8pm)", kinds: ['players-nudge'], source: 'playersStackItems', status: 'live' },
  { code: 'P06', name: 'Perfect 10 shout-out', kinds: ['shout'], source: 'playersStackItems', status: 'live' },

  { code: 'S01', name: 'Draws this season', kinds: ['league-event'], source: 'statMomentItems', status: 'live' },
  { code: 'S02', name: 'Away wins this season', kinds: ['league-event'], source: 'statMomentItems', status: 'live' },
  { code: 'S03', name: 'Most missed team', kinds: ['league-event'], source: 'statMomentItems', status: 'live' },
  { code: 'S04', name: 'Easiest team', kinds: ['league-event'], source: 'statMomentItems', status: 'live' },
  { code: 'S05', name: 'Last minute heroes', kinds: ['league-event'], source: 'statMomentItems', status: 'live' },

  { code: 'R01', name: 'Where you stand (mini-league replay)', kinds: ['rank'], source: 'buildMatchFeed (leagueMomentsFromEvents)', status: 'live' },
  { code: 'R02', name: 'Mini-league move (live, no replay)', kinds: ['rank'], source: 'rankChangeItem', status: 'live' },
  {
    code: 'R03',
    name: 'Overall move (built, not shown in the real feed)',
    kinds: ['overall'],
    source: 'overallChangeItem',
    status: 'hidden',
  },
  { code: 'R04', name: 'Day round-up', kinds: ['round-up'], source: 'buildMatchFeed (dayRoundUps)', status: 'live' },
  { code: 'R05', name: 'Gameweek round-up', kinds: ['round-up'], source: 'buildRoundUp', status: 'live' },

  { code: 'C01', name: 'Mini-league chat message', kinds: ['message'], source: 'chatMessageItem', status: 'live' },

  { code: 'N01', name: 'Pinned card copy rotation (A/B/C)', kinds: [], source: 'copyBank: deadlinePinTitles, youreInCopy, comingSoonCopy, nextGwHereCopy', status: 'not-built' },
  { code: 'N02', name: 'Invite pin copy rotation (A/B/C)', kinds: [], source: 'copyBank: inviteCopy', status: 'not-built' },
  { code: 'N03', name: 'Line-up copy bank', kinds: [], source: 'copyBank: lineupCopy', status: 'not-built' },
  { code: 'N04', name: 'Mini-leagues snapshot headlines', kinds: [], source: 'copyBank: mlSnapshotCopy', status: 'not-built' },
  {
    code: 'N05',
    name: 'Admin post types (Announcement, Football chat prompt, Operational notice)',
    kinds: [],
    source: "Joff's card map",
    status: 'not-built',
  },
  { code: 'N06', name: 'Perfect 10 at the moment it happens', kinds: [], source: "Joff's card map", status: 'not-built' },
];

export function feedCardCode(code: string): FeedCardCode | undefined {
  return FEED_CARD_CODES.find((entry) => entry.code === code);
}
