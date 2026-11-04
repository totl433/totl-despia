/**
 * DEV ONLY: the feed audit. Every Game Centre card kind and its meaningful variations, in one
 * list, for reviewing the feed in the simulator (open `com.despia.totlnative://feed-audit`).
 *
 * Cards come from the production builders wherever they are exported, fed with mock data, and
 * every rotating copy version is shown as its own card. Nothing here is used by the real feed.
 * Match cards are built in the shape `matchItemsFromPosts` produces, since that builder needs
 * stored posts and live rows; their copy still comes from the copy bank.
 */
import type { Fixture, LiveScore, Pick } from '@totl/domain';

import type { GameweekPin } from '../../lib/gameweekState';
import { playersDayKey, shiftPlayersDay } from '../../lib/retroPlayers/day';
import type { PlayersScoreStore } from '../../lib/retroPlayers/scores';
import { resolveLeagueAvatarUri } from '../../lib/leagueAvatars';
import {
  awayWinsCopy,
  drawsCopy,
  easiestTeamCopy,
  everyonePredictedCopy,
  fixturesCopy,
  goodLuckCopy,
  kickoffCopy,
  lastMinuteCopy,
  liveCopy,
  mostMissedCopy,
  openerCopy,
  playerJoinedCopy,
  playersDailyCopy,
  playersMonthlyCopy,
  playersNudgeCopy,
  playersPerfectCopy,
  playersReadyCopy,
  playersWeeklyCopy,
  scoreSheetCopy,
  startingSoonCopy,
  winnerShoutCopy,
  type CopyVersion,
} from './copyBank';
import {
  adminFeedItems,
  everyonePredictedItems,
  fixtureListItem,
  goodLuckItem,
  joinNames,
  playerJoinedItems,
  playersStackItems,
  scoreSheetItem,
  statMomentItems,
  winnerShoutItems,
} from './derivedFeed';
import {
  buildRoundUp,
  chatMessageItem,
  overallChangeItem,
  rankChangeItem,
  type FeedItem,
  type FeedMatch,
} from './feed';
import type { SeasonStatFacts } from './seasonStatFacts';

export type AuditOrigin = 'Carl' | 'Joff' | 'Joff → Carl redesign';

export type AuditMeta = {
  /** Inventory id, e.g. "M05". */
  code: string;
  name: string;
  variant: string;
  origin: AuditOrigin;
  /** Mock social footer for public cards. */
  comments?: number;
};

export type AuditEntry =
  | { type: 'section'; id: string; title: string }
  | { type: 'card'; id: string; item: FeedItem; meta: AuditMeta }
  | {
      type: 'pin';
      id: string;
      pin: GameweekPin;
      leagues: { leagueCount: number; missingCount: number } | null;
      scoreLabel: string | null;
      meta: AuditMeta;
    }
  | { type: 'invite'; id: string; invite: { id: string; leagueName: string; invitedByName: string }; meta: AuditMeta }
  | { type: 'missing'; id: string; code: string; name: string; note: string; source: string };

const GW = 10;
const LETTERS = ['A', 'B', 'C'] as const;
const EASY = resolveLeagueAvatarUri('ML-avatar-1.png');
const FC = resolveLeagueAvatarUri('ML-avatar-3.png');

const HOUR = 3_600_000;
const MIN = 60_000;

function fixture(index: number, home: [string, string], away: [string, string], kickoff: string): Fixture {
  return {
    id: `audit-${index}`,
    gw: GW,
    fixture_index: index,
    kickoff_time: kickoff,
    api_match_id: 9000 + index,
    home_code: home[0],
    home_name: home[1],
    home_team: home[1],
    away_code: away[0],
    away_name: away[1],
    away_team: away[1],
  };
}

function live(f: Fixture, home: number, away: number, status: LiveScore['status'], updatedAt: string): LiveScore {
  return {
    api_match_id: f.api_match_id ?? 0,
    gw: GW,
    fixture_index: f.fixture_index,
    home_score: home,
    away_score: away,
    status,
    updated_at: updatedAt,
  };
}

function versions(list: CopyVersion[]): Array<{ letter: string; copy: CopyVersion }> {
  return list.map((copy, i) => ({ letter: LETTERS[i] ?? String(i + 1), copy }));
}

/** One card per copy version, keeping the builder's shape and swapping only the words. */
function copyCards(
  base: FeedItem,
  list: CopyVersion[],
  meta: AuditMeta,
  apply: (item: FeedItem, copy: CopyVersion) => FeedItem
): AuditEntry[] {
  return versions(list).map(({ letter, copy }) => ({
    type: 'card' as const,
    id: `${base.id}#${letter}`,
    item: { ...apply(base, copy), id: `${base.id}#${letter}` },
    meta: { ...meta, variant: `${meta.variant}${meta.variant ? ' · ' : ''}copy ${letter}` },
  }));
}

function card(item: FeedItem, meta: AuditMeta): AuditEntry {
  return { type: 'card', id: item.id, item, meta };
}

const MATCH_RIGHT: FeedMatch = {
  homeCode: 'ARS',
  awayCode: 'COV',
  homeScore: 1,
  awayScore: 0,
  pick: 'H',
  live: true,
  finished: false,
  percents: { H: 64, D: 22, A: 14 },
  homeScorers: ["Saka 23'"],
};

const MATCH_WRONG: FeedMatch = {
  homeCode: 'CHE',
  awayCode: 'LIV',
  homeScore: 0,
  awayScore: 1,
  pick: 'H',
  live: true,
  finished: false,
  percents: { H: 38, D: 24, A: 38 },
  awayScorers: ["Salah 12'"],
};

const MATCH_NO_PICK: FeedMatch = { ...MATCH_RIGHT, homeCode: 'AVL', awayCode: 'BRE', pick: null, percents: { H: 41, D: 27, A: 32 }, homeScorers: ["Rogers 63'"] };

const XI = {
  homeCode: 'ARS',
  awayCode: 'COV',
  homeName: 'Arsenal',
  awayName: 'Coventry',
  homeFormation: '4-3-3',
  awayFormation: '5-3-2',
  home: [
    ['Raya', 1], ['Timber', 12], ['Saliba', 2], ['Gabriel', 6], ['Calafiori', 33], ['Rice', 41],
    ['Zubimendi', 36], ['Odegaard', 8], ['Saka', 7], ['Gyokeres', 14], ['Martinelli', 11],
  ].map(([name, number]) => ({ name: name as string, number: number as number })),
  away: [
    ['Wilson', 13], ['Van Ewijk', 27], ['Kitching', 15], ['Thomas', 4], ['Dasilva', 3], ['Bidwell', 21],
    ['Grimes', 6], ['Torp', 29], ['Simms', 9], ['Wright', 11], ['Rudoni', 7],
  ].map(([name, number]) => ({ name: name as string, number: number as number })),
};

function matchCards(): AuditEntry[] {
  const out: AuditEntry[] = [];
  const origin: AuditOrigin = 'Joff → Carl redesign';

  // M01 Starting soon (`waiting`): the only card before the first XIs.
  const waiting: FeedItem = {
    id: 'waiting', sortAt: 0, timeLabel: '2h 08m', stamp: '2h 08m', kind: 'waiting', eyebrow: `Gameweek ${GW}`, title: '', body: '',
  };
  out.push(...copyCards(waiting, startingSoonCopy(GW), { code: 'M01', name: 'Starting soon', variant: '', origin }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));

  // M02 Here We Go (`opener`).
  const opener: FeedItem = { id: 'gw-open', sortAt: 0, timeLabel: '13:45', stamp: '13:45', kind: 'opener', eyebrow: 'Match Center', title: '', body: '' };
  out.push(...copyCards(opener, openerCopy(GW), { code: 'M02', name: 'Here We Go', variant: '', origin }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));

  // M03 Line-up: lineupIntro() picks from the pick split (not the copy bank's lineupCopy).
  const lineupTop = { homeName: 'Arsenal', awayName: 'Coventry', kickoffLabel: '15:00', homeForm: 'WWDLW', awayForm: 'LDWDL', homeRank: 1, awayRank: 19 };
  const lineupLines: Array<[string, string, FeedMatch['percents']]> = [
    ['clear favourite', 'Teams are out! Players are backing Arsenal for the win.', { H: 64, D: 22, A: 14 }],
    ['clear favourite · alt', "Teams are out. Arsenal, and it's not even close.", { H: 64, D: 22, A: 14 }],
    ['away favourite', 'Teams are out! Players are backing Coventry for the win.', { H: 18, D: 22, A: 60 }],
    ['draw favourite', 'Teams are out. A lot of you fancy a draw.', { H: 25, D: 50, A: 25 }],
    ['tight', 'Teams are out. Tight one. Arsenal, just about.', { H: 44, D: 34, A: 22 }],
    ['even split', 'Teams are out. Proper split. Take your pick.', { H: 36, D: 31, A: 33 }],
    ['no percentages yet', 'Teams are out!', null],
  ];
  lineupLines.forEach(([variant, title, percents], i) => {
    out.push(card(
      { id: `xi:1#${i}`, sortAt: 0, timeLabel: '13:46', stamp: '13:46', kind: 'lineup', eyebrow: 'Line-up', title, body: '', lineupTop, match: { ...MATCH_RIGHT, homeScore: null, awayScore: null, live: false, homeScorers: [], percents } },
      { code: 'M03', name: 'Line-up', variant, origin }
    ));
  });

  // M04 The teams (`xi`).
  out.push(card({ id: 'xi-sheet:1', sortAt: 0, timeLabel: '13:46', stamp: '13:46', kind: 'xi', eyebrow: 'The teams', title: '', body: '', xi: XI }, { code: 'M04', name: 'The teams (XI)', variant: '', origin }));

  // M05 Kick-off.
  const kickoff: FeedItem = { id: 'kickoff:1', sortAt: 0, timeLabel: '15:00', stamp: '15:00', kind: 'kickoff', eyebrow: 'Kickoff', title: '', body: '', match: { ...MATCH_RIGHT, homeScore: null, awayScore: null, live: false, homeScorers: [] } };
  out.push(...copyCards(kickoff, kickoffCopy('Arsenal v Coventry'), { code: 'M05', name: 'Kick-off', variant: '', origin }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));

  // M06 Goal: right / wrong / no pick / own goal.
  const goal = (id: string, scorer: string, match: FeedMatch): FeedItem => ({
    id, sortAt: 0, timeLabel: "23'", stamp: '15:23', kind: 'goal', eyebrow: 'Goal', title: 'GOAL', body: `${scorer} Scores!!!`, personal: null, match,
  });
  out.push(...copyCards(goal('goal:1:23:0', 'Saka', MATCH_RIGHT), liveCopy('goal', true), { code: 'M06', name: 'Goal', variant: 'pick going right', origin, comments: 12 }, (item, copy) => ({ ...item, personal: copy.line })));
  out.push(...copyCards(goal('goal:2:12:0', 'Salah', MATCH_WRONG), liveCopy('goal', false), { code: 'M06', name: 'Goal', variant: 'pick going wrong', origin, comments: 3 }, (item, copy) => ({ ...item, personal: copy.line })));
  out.push(card(goal('goal:3:63:0', 'Rogers', MATCH_NO_PICK), { code: 'M06', name: 'Goal', variant: 'no pick (no personal line)', origin }));
  out.push(card(goal('goal:4:70:0', 'Gabriel (og)', { ...MATCH_WRONG, homeCode: 'NEW', awayCode: 'ARS', homeScore: 1, awayScore: 1, awayScorers: ["Salah 12'"], homeScorers: ["Gabriel (og) 70'"] }), { code: 'M06', name: 'Goal', variant: 'own goal', origin }));

  // M07 Goal ruled out.
  const ruled = (id: string, match: FeedMatch): FeedItem => ({
    id, sortAt: 0, timeLabel: "61'", stamp: '16:16', kind: 'ruled-out', eyebrow: 'VAR', title: 'Goal ruled out', body: 'VAR has had a word.', match,
  });
  out.push(...copyCards(ruled('goal:1:61:1', MATCH_RIGHT), liveCopy('ruled-out', true), { code: 'M07', name: 'Goal ruled out', variant: 'helps your pick', origin }, (item, copy) => ({ ...item, personal: copy.line })));
  out.push(...copyCards(ruled('goal:2:61:1', MATCH_WRONG), liveCopy('ruled-out', false), { code: 'M07', name: 'Goal ruled out', variant: 'hurts your pick', origin }, (item, copy) => ({ ...item, personal: copy.line })));

  // M08 Half-time.
  const ht = (id: string, match: FeedMatch): FeedItem => ({ id, sortAt: 0, timeLabel: 'HT', stamp: '15:47', kind: 'half-time', eyebrow: 'Half-time', title: 'Half-time', body: '', match: { ...match, live: false } });
  out.push(...copyCards(ht('ht:1', MATCH_RIGHT), liveCopy('half-time', true), { code: 'M08', name: 'Half-time', variant: 'pick right', origin }, (item, copy) => ({ ...item, title: copy.title, personal: copy.line })));
  out.push(...copyCards(ht('ht:2', MATCH_WRONG), liveCopy('half-time', false), { code: 'M08', name: 'Half-time', variant: 'pick wrong', origin }, (item, copy) => ({ ...item, title: copy.title, personal: copy.line })));

  // M09 Second half.
  const sh = (id: string, match: FeedMatch): FeedItem => ({ id, sortAt: 0, timeLabel: "46'", stamp: '16:03', kind: 'second-half', eyebrow: 'Second half', title: 'Second half', body: '', match });
  out.push(...copyCards(sh('sh:1', MATCH_RIGHT), liveCopy('second-half', true), { code: 'M09', name: 'Second half', variant: 'pick right', origin }, (item, copy) => ({ ...item, title: copy.title, personal: copy.line })));
  out.push(...copyCards(sh('sh:2', MATCH_WRONG), liveCopy('second-half', false), { code: 'M09', name: 'Second half', variant: 'pick wrong', origin }, (item, copy) => ({ ...item, title: copy.title, personal: copy.line })));

  // M10 Full-time: right (rainbow border) / wrong.
  const ft = (id: string, title: string, body: string, match: FeedMatch): FeedItem => ({ id, sortAt: 0, timeLabel: 'FT', stamp: '16:52', kind: 'full-time', eyebrow: 'Full-time', title, body, match: { ...match, live: false, finished: true } });
  out.push(...copyCards(ft('ft:1', 'Full-time!!', '1 out of 1 correct, 9 more to go', { ...MATCH_RIGHT, homeScore: 2, homeScorers: ["Saka 23'", "Saka 80'"] }), liveCopy('full-time', true), { code: 'M10', name: 'Full-time', variant: 'pick right', origin, comments: 8 }, (item, copy) => ({ ...item, personal: copy.line })));
  out.push(...copyCards(ft('ft:2', 'Full-time', '1 out of 2 correct, 8 more to go', { ...MATCH_WRONG, homeScore: 1, awayScore: 2, homeScorers: ["Palmer 55'"], awayScorers: ["Salah 12'", "Gakpo 70'"] }), liveCopy('full-time', false), { code: 'M10', name: 'Full-time', variant: 'pick wrong', origin }, (item, copy) => ({ ...item, personal: copy.line })));
  return out;
}

const KICKOFFS = [
  ['ARS', 'Arsenal', 'COV', 'Coventry', '2026-11-07T12:30:00Z'],
  ['CHE', 'Chelsea', 'LIV', 'Liverpool', '2026-11-07T15:00:00Z'],
  ['AVL', 'Aston Villa', 'BRE', 'Brentford', '2026-11-07T15:00:00Z'],
  ['NEW', 'Newcastle', 'MUN', 'Man United', '2026-11-07T17:30:00Z'],
  ['BHA', 'Brighton', 'EVE', 'Everton', '2026-11-08T14:00:00Z'],
  ['MCI', 'Man City', 'FUL', 'Fulham', '2026-11-08T14:00:00Z'],
  ['TOT', 'Spurs', 'WHU', 'West Ham', '2026-11-08T16:30:00Z'],
  ['CRY', 'Crystal Palace', 'BOU', 'Bournemouth', '2026-11-09T20:00:00Z'],
  ['NFO', "Nott'm Forest", 'WOL', 'Wolves', '2026-11-10T19:45:00Z'],
  ['SUN', 'Sunderland', 'LEE', 'Leeds', '2026-11-10T20:00:00Z'],
] as const;

function gameweekFixtures(): Fixture[] {
  return KICKOFFS.map(([hc, hn, ac, an, ko], i) => fixture(i + 1, [hc, hn], [ac, an], ko));
}

const PEOPLE = new Map([
  ['u-carl', { id: 'u-carl', name: 'Carl', avatarUrl: null }],
  ['u-jof', { id: 'u-jof', name: 'Jof', avatarUrl: null }],
  ['u-tom', { id: 'u-tom', name: 'Tom', avatarUrl: null }],
  ['u-sam', { id: 'u-sam', name: 'Sam', avatarUrl: null }],
  ['u-me', { id: 'u-me', name: 'You', avatarUrl: null }],
]);

function derivedCards(nowMs: number): AuditEntry[] {
  const out: AuditEntry[] = [];
  const fixtures = gameweekFixtures();

  // D01 Fixtures: the redesigned card (fixtureRows), every copy version.
  const fixtureCard = fixtureListItem({ gw: GW, fixtures, nowMs: Date.parse('2026-11-01T09:00:00Z'), sortAt: nowMs });
  if (fixtureCard) {
    out.push(...copyCards(fixtureCard, fixturesCopy(GW), { code: 'D01', name: 'Fixtures', variant: '', origin: 'Joff → Carl redesign', comments: 0 }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));
    // The older text-list fallback still in FeedCardView, drawn when a card has fixtureLines but no fixtureRows.
    out.push(card({ ...fixtureCard, id: 'fixtures:legacy', fixtureRows: null }, { code: 'D01', name: 'Fixtures', variant: 'text-list fallback (no fixtureRows)', origin: 'Joff' }));
  }

  // D02 Score sheet.
  const liveRows = new Map<number, LiveScore>();
  const results: Array<[number, number]> = [[2, 1], [1, 2], [1, 0], [0, 0], [3, 1], [2, 2], [1, 3], [0, 1], [2, 0], [1, 1]];
  fixtures.forEach((f, i) => {
    const [h, a] = results[i] ?? [0, 0];
    liveRows.set(f.fixture_index, live(f, h, a, 'FINISHED', '2026-11-10T21:55:00Z'));
  });
  const picks: Record<string, Pick> = { '1': 'H', '2': 'H', '3': 'H', '4': 'D', '5': 'A', '6': 'D', '7': 'A', '8': 'H', '9': 'H', '10': 'A' };
  const sheet = scoreSheetItem({ gw: GW, fixtures, picks, liveByFixtureIndex: liveRows, lastFtMs: Date.parse('2026-11-10T21:55:00Z') });
  if (sheet) out.push(...copyCards(sheet, scoreSheetCopy(), { code: 'D02', name: 'Score sheet', variant: '', origin: 'Joff' }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));

  // D03 Everyone has predicted.
  const tables = [
    { id: 'lg-easy', name: 'Easy League', avatarUrl: EASY, rows: [
      { user_id: 'u-me', name: 'You', score: 6 }, { user_id: 'u-carl', name: 'Carl', score: 5 }, { user_id: 'u-sam', name: 'Sam', score: 4 },
    ], submittedUserIds: ['u-me', 'u-carl', 'u-sam'] },
  ];
  const everyone = everyonePredictedItems({ tables, leagues: [], deadlineMs: nowMs + 2 * HOUR, firstKickoffMs: nowMs + 3 * HOUR, nowMs })[0];
  if (everyone) out.push(...copyCards(everyone, everyonePredictedCopy('Easy League'), { code: 'D03', name: 'Everyone has predicted', variant: '', origin: 'Joff' }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));

  // D04 Player joined.
  const joined = playerJoinedItems({
    joins: [{ leagueId: 'lg-easy', leagueName: 'Easy League', leagueAvatar: EASY, userId: 'u-sam', name: 'Sam', avatarUrl: null, joinedAtMs: nowMs - HOUR }],
    userId: 'u-me', gwOpenMs: nowMs - 24 * HOUR, nowMs,
  })[0];
  if (joined) out.push(...copyCards(joined, playerJoinedCopy('Sam', 'Easy League'), { code: 'D04', name: 'Player joined', variant: '', origin: 'Joff' }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));

  // D05 Good luck: named (one, three) and the generic "many players" version.
  const oneLeft = new Map(liveRows);
  const lastFixture = fixtures[fixtures.length - 1]!;
  oneLeft.set(lastFixture.fixture_index, live(lastFixture, 0, 0, 'TIMED', '2026-11-10T19:00:00Z'));
  const luckBase = goodLuckItem({
    fixtures, liveByFixtureIndex: oneLeft,
    liveTable: [{ user_id: 'u-carl', name: 'Carl', score: 9 }, { user_id: 'u-jof', name: 'Jof', score: 9 }, { user_id: 'u-tom', name: 'Tom', score: 9 }],
    people: PEOPLE,
  });
  if (luckBase) {
    const meta = { code: 'D05', name: 'Good luck shout-out', origin: 'Joff' as const, comments: 16 };
    out.push(...copyCards({ ...luckBase, id: 'shout:good-luck:one' }, goodLuckCopy('Carl', false, false), { ...meta, variant: 'one name' }, (item, copy) => ({ ...item, title: copy.title, body: copy.line, faces: item.faces?.slice(0, 1) })));
    out.push(...copyCards({ ...luckBase, id: 'shout:good-luck:three' }, goodLuckCopy(joinNames(['Carl', 'Jof', 'Tom']), false), { ...meta, variant: 'three names' }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));
    out.push(...copyCards({ ...luckBase, id: 'shout:good-luck:many' }, goodLuckCopy('', true), { ...meta, variant: 'more than five (generic)' }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));
  }

  // D06–D08 Winner shout-outs (GW, monthly, season) and midweek leaders, via the scheduler.
  const lastFt = Date.parse('2026-11-08T17:20:00Z');
  const shouts = winnerShoutItems({
    lastFtMs: lastFt, nowMs: lastFt + 6 * 24 * HOUR, nextHereWeGoMs: null, monthClosed: true, seasonClosed: true, weekendGw: true,
    liveTable: [{ user_id: 'u-carl', name: 'Carl', score: 8 }, { user_id: 'u-jof', name: 'Jof', score: 8 }, { user_id: 'u-tom', name: 'Tom', score: 8 }, { user_id: 'u-sam', name: 'Sam', score: 5 }],
    monthBefore: { 'u-carl': 20, 'u-jof': 20, 'u-tom': 20, 'u-sam': 10 },
    seasonBefore: { 'u-carl': 60, 'u-jof': 60, 'u-tom': 60, 'u-sam': 40 },
    people: PEOPLE,
  });
  const shoutNames: Record<string, { code: string; name: string; kind: Parameters<typeof winnerShoutCopy>[0]; names: string }> = {
    gw: { code: 'D06', name: 'Gameweek winners shout-out', kind: 'gw', names: 'Carl, Jof, and Tom' },
    monthly: { code: 'D07', name: 'Monthly winners shout-out', kind: 'monthly', names: 'Carl, Jof, and Tom' },
    season: { code: 'D08', name: 'Season winners shout-out', kind: 'season', names: 'Carl, Jof, and Tom' },
    'midweek-month': { code: 'D09', name: 'Midweek monthly leader', kind: 'midweek-month', names: 'Carl' },
    'midweek-overall': { code: 'D10', name: 'Midweek overall leader', kind: 'midweek-overall', names: 'Carl' },
  };
  // A gameweek that closes no month: the Tuesday slot is free, so the monthly leader card can land.
  const quietWeek = winnerShoutItems({
    lastFtMs: lastFt, nowMs: lastFt + 6 * 24 * HOUR, nextHereWeGoMs: null, monthClosed: false, seasonClosed: false, weekendGw: true,
    liveTable: [{ user_id: 'u-carl', name: 'Carl', score: 8 }, { user_id: 'u-sam', name: 'Sam', score: 5 }],
    monthBefore: { 'u-carl': 30, 'u-sam': 10 },
    seasonBefore: { 'u-carl': 90, 'u-sam': 40 },
    people: PEOPLE,
  });
  const seenShouts = new Set<string>();
  [...shouts, ...quietWeek].forEach((item) => {
    const kind = item.id.split(':')[1] ?? '';
    const info = shoutNames[kind];
    if (!info || seenShouts.has(kind)) return;
    seenShouts.add(kind);
    out.push(...copyCards(item, winnerShoutCopy(info.kind, info.names), { code: info.code, name: info.name, variant: '', origin: 'Joff', comments: 14 }, (base, copy) => ({ ...base, title: copy.title, body: copy.line })));
  });
  Object.entries(shoutNames).forEach(([kind, info]) => {
    if (!seenShouts.has(kind)) {
      out.push({ type: 'missing', id: `missing:${kind}`, code: info.code, name: info.name, note: 'The scheduler gave this shout-out no slot for the mock gameweek, so it is not shown.', source: 'shoutOutSlots.ts' });
    }
  });

  // D11 Admin posts: an announcement, a chat prompt, an operational notice, and comments/reacts off.
  const admin = adminFeedItems([
    { id: 'a1', title: 'Announcement', body: 'Football is crazy right now!', publishedAtMs: nowMs - HOUR },
    { id: 'a2', title: "How's everyone feeling?", body: 'Are you looking forward to the games today?', publishedAtMs: nowMs - HOUR },
    { id: 'a3', title: 'Match update', body: "Brighton v Liverpool is off. Your scores will still work out — we'll void or settle that fixture fairly.", publishedAtMs: nowMs - HOUR },
    { id: 'a4', title: 'Comments and reactions off', body: 'An admin post with both switched off.', publishedAtMs: nowMs - HOUR, comments: false, reacts: false },
  ], nowMs);
  const adminVariants = ['announcement', 'football chat prompt', 'operational notice', 'comments + reactions off'];
  admin.forEach((item, i) => out.push(card(item, { code: 'D11', name: 'Admin post', variant: adminVariants[i] ?? '', origin: 'Joff', comments: i === 3 ? undefined : 6 })));
  return out;
}

function playersCards(): AuditEntry[] {
  const out: AuditEntry[] = [];
  // A Monday that is also the 1st, so yesterday closed a Players week and a month (2026-06-01).
  const today = '2026-06-01';
  const yesterday = shiftPlayersDay(today, -1);
  const scores: Record<string, PlayersScoreStore> = {};
  ['u-carl', 'u-jof', 'u-tom'].forEach((id) => {
    const store: PlayersScoreStore = {};
    for (let back = 1; back <= 31; back++) store[shiftPlayersDay(today, -back)] = { correct: 9, total: 10 };
    store[today] = { correct: id === 'u-carl' ? 10 : 6, total: 10 };
    scores[id] = store;
  });
  scores['u-sam'] = { [yesterday]: { correct: 4, total: 10 } };
  const nightMs = new Date(`${today}T21:00:00`).getTime();
  const items = playersStackItems({ nowMs: nightMs, userId: 'u-me', scores, people: PEOPLE });
  const named = (prefix: string) => items.find((item) => item.id.startsWith(prefix));
  const origin: AuditOrigin = 'Joff → Carl redesign';
  const names = 'Carl, Jof, and Tom';
  const rows: Array<[string, string, string, CopyVersion[]]> = [
    ['players:daily:', 'P01', "Daily winners (yesterday's)", playersDailyCopy(names, 3)],
    ['players:weekly:', 'P02', "Weekly winners (this week's)", playersWeeklyCopy(names, 3)],
    ['players:monthly:', 'P03', "Monthly winners (this month's)", playersMonthlyCopy(names, 3)],
    ['players:ready:', 'P04', 'New game ready (8am)', playersReadyCopy()],
    ['players:nudge:', 'P05', "Haven't played (8pm)", playersNudgeCopy()],
    ['players:perfect:', 'P06', 'Perfect 10 shout-out', playersPerfectCopy('Carl')],
  ];
  rows.forEach(([prefix, code, name, list]) => {
    const base = named(prefix);
    if (!base) {
      if (prefix === 'players:weekly:') return;
      out.push({ type: 'missing', id: `missing:${prefix}`, code, name, note: 'The builder produced no card for the mock day.', source: 'derivedFeed.ts playersStackItems' });
      return;
    }
    out.push(...copyCards(base, list, { code, name, variant: '', origin, comments: base.link ? undefined : 10 }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));
    if (prefix === 'players:daily:') {
      // The weekly card never builds: playersStackItems checks yesterday against the end of
      // *today's* week, which is never yesterday. Shown here in the daily card's shape.
      const weekly = playersWeeklyCopy(names, 3);
      out.push(...copyCards({ ...base, id: `players:weekly:${yesterday}` }, weekly, { code: 'P02', name: "Weekly winners (this week's)", variant: 'never shows in production (weekClosed bug)', origin, comments: 10 }, (item, copy) => ({ ...item, title: copy.title, body: copy.line })));
    }
    if (prefix === 'players:daily:') {
      out.push(card({ ...base, id: `${base.id}#solo`, title: playersDailyCopy('Carl', 1)[0]!.title, body: playersDailyCopy('Carl', 1)[0]!.line, faces: base.faces?.slice(0, 1) }, { code, name, variant: 'one winner', origin, comments: 10 }));
    }
  });
  void playersDayKey;
  return out;
}

function statCards(nowMs: number): AuditEntry[] {
  const out: AuditEntry[] = [];
  const stats: SeasonStatFacts = {
    sampleSize: 120,
    drawPct: 22,
    awayPct: 31,
    mostMissed: { name: 'Sunderland', code: 'SUN', pct: 30, games: 10 },
    easiest: { name: 'Man City', code: 'MCI', pct: 85, games: 10 },
    lastMinuteHero: { name: 'Liverpool', code: 'LIV', count: 4 },
  };
  const items = statMomentItems({
    seasonStats: stats,
    lastFtMs: nowMs - 6 * 24 * HOUR,
    deadlineMs: nowMs + 24 * HOUR,
    gwOpenMs: nowMs - 6 * 24 * HOUR,
    nextHereWeGoMs: null,
    nowMs,
  });
  const rows: Array<[string, string, string, CopyVersion[]]> = [
    ['stat:draws', 'S01', 'Draws this season', drawsCopy(22)],
    ['stat:away', 'S02', 'Away wins this season', awayWinsCopy(31)],
    ['stat:missed', 'S03', 'Most missed team', mostMissedCopy('Sunderland', 30)],
    ['stat:easiest', 'S04', 'Easiest team', easiestTeamCopy('Man City', 85)],
    ['stat:late', 'S05', 'Last minute heroes', lastMinuteCopy('Liverpool')],
  ];
  rows.forEach(([id, code, name, list]) => {
    const base = items.find((item) => item.id === id) ?? {
      // The scheduler spreads stat moments over quiet slots; build any it skipped in the same shape.
      id, sortAt: nowMs, timeLabel: '', stamp: '', kind: 'league-event' as const, eyebrow: name, title: list[0]!.title, body: list[0]!.line, link: null,
    };
    // The builder keeps its own title; only the line rotates.
    out.push(...copyCards(base, list, { code, name, variant: '', origin: 'Joff → Carl redesign' }, (item, copy) => ({ ...item, body: copy.line })));
  });
  return out;
}

function personalCards(nowMs: number): AuditEntry[] {
  const out: AuditEntry[] = [];
  const origin: AuditOrigin = 'Joff → Carl redesign';
  const standings = (a: 'up' | 'down' | 'same', b: 'up' | 'down' | 'same', placeA: string, placeB: string) => [
    { name: 'Easy League', place: placeA, move: a, avatarUrl: EASY, leagueId: 'lg-easy' },
    { name: 'FC Football', place: placeB, move: b, avatarUrl: FC, leagueId: 'lg-fc' },
  ];
  const boards = (gw: string, month: string, overall: string, move: 'up' | 'down' | 'same') => [
    { label: 'GW', place: gw, move, tab: 'gw' as const },
    { label: 'Nov', place: month, move, tab: 'monthly' as const },
    { label: 'Overall', place: overall, move, tab: 'overall' as const },
  ];
  const rank = (id: string, s: ReturnType<typeof standings>, b: ReturnType<typeof boards> | null): FeedItem => ({
    id, sortAt: 0, timeLabel: "23'", stamp: '15:23', kind: 'rank', eyebrow: 'Where you stand', title: 'Mini leagues & leaderboard', body: '', standings: s, boards: b, link: null,
  });
  out.push(card(rank('ml:1:a', standings('up', 'up', 'Top', '2nd'), boards('4th', '11th', '40th', 'up')), { code: 'R01', name: 'Where you stand (mini-league replay)', variant: 'moving up', origin }));
  out.push(card(rank('ml:2:a', standings('down', 'same', '2nd', '2nd'), boards('9th', '11th', '41st', 'down')), { code: 'R01', name: 'Where you stand (mini-league replay)', variant: 'dropping', origin }));
  out.push(card(rank('ml:3:a', standings('same', 'same', 'Top', '2nd'), null), { code: 'R01', name: 'Where you stand (mini-league replay)', variant: 'final whistle, nothing moved, no boards', origin }));

  // R02 Live rank move without the replay (rankChangeItem).
  const live: Array<[string, number, number]> = [['took the lead', 3, 1], ['lost the lead', 1, 2], ['climbed', 5, 3], ['dropped', 3, 5]];
  live.forEach(([variant, before, after], i) => {
    const item = rankChangeItem({ leagueId: 'lg-easy', leagueName: 'Easy League', before, after, at: nowMs - i * MIN });
    if (item) out.push(card(item, { code: 'R02', name: 'Mini-league move (live, no replay)', variant, origin }));
  });

  // R03 Overall move: built, then filtered out by the screen.
  const overall = overallChangeItem(52, 40, nowMs);
  if (overall) out.push(card(overall, { code: 'R03', name: 'Overall move (built, not shown in the real feed)', variant: 'up 12', origin: 'Joff' }));

  // R04 Day round-ups (shape of dayRoundUps: one match, several matches).
  const day = (id: string, title: string, body: string, s: ReturnType<typeof standings> | null): FeedItem => ({
    id, sortAt: 0, timeLabel: 'FT', kind: 'round-up', eyebrow: 'Saturday', title, body, standings: s,
  });
  out.push(card(day('day:1', 'Swept the day', 'You went 4/4', standings('up', 'up', 'Top', '2nd')), { code: 'R04', name: 'Day round-up', variant: 'all right (rainbow)', origin }));
  out.push(card(day('day:2', 'Good day at the office', 'You went 3/4', standings('up', 'same', 'Top', '2nd')), { code: 'R04', name: 'Day round-up', variant: 'half or more', origin }));
  out.push(card(day('day:3', 'A mixed bag', 'You went 1/4', standings('down', 'same', '3rd', '2nd')), { code: 'R04', name: 'Day round-up', variant: 'under half', origin }));
  out.push(card(day('day:4', "We'll move on", 'You went 0/4', null), { code: 'R04', name: 'Day round-up', variant: 'none right', origin }));
  out.push(card(day('day:5', 'Job done', 'Crystal Palace v Bournemouth. You had it.', null), { code: 'R04', name: 'Day round-up', variant: 'one match, right', origin }));
  out.push(card(day('day:6', "That's the night", 'Crystal Palace v Bournemouth. Not this one.', null), { code: 'R04', name: 'Day round-up', variant: 'one match, wrong', origin }));
  out.push(card(day('day:7', "That's the day", '4 down.', null), { code: 'R04', name: 'Day round-up', variant: 'no picks', origin }));

  // R05 Gameweek round-up (buildRoundUp): won all, won one, won none (with a tie).
  type Row = { user_id: string; name: string; score: number };
  const leagueRows = (easy: Row[], fc: Row[]) => [
    { id: 'lg-easy', name: 'Easy League', avatarUrl: EASY, rows: easy },
    { id: 'lg-fc', name: 'FC Football', avatarUrl: FC, rows: fc },
  ];
  const me = (score: number): Row => ({ user_id: 'u-me', name: 'You', score });
  const them = (name: string, score: number): Row => ({ user_id: `u-${name.toLowerCase()}`, name, score });
  const ups: Array<[string, Row[], Row[], number, number]> = [
    ['won every league (teal), climbed Overall', [me(8), them('Sam', 6)], [me(8), them('Carl', 7)], 52, 40],
    ['won one, shared the other (a share counts as a win)', [me(8), them('Sam', 6)], [me(7), them('Carl', 7)], 40, 40],
    ['won one, lost one', [me(8), them('Sam', 6)], [me(5), them('Carl', 7)], 40, 38],
    ['won none, a tie between others, dropped Overall', [me(4), them('Sam', 6), them('Tom', 6)], [me(4), them('Carl', 7)], 40, 47],
  ];
  ups.forEach(([variant, easy, fc, before, after], i) => {
    const item = buildRoundUp({ leagues: leagueRows(easy, fc), userId: 'u-me', overallBefore: before, overallAfter: after })[0];
    if (item) out.push(card({ ...item, id: `roundup:leagues#${i}` }, { code: 'R05', name: 'Gameweek round-up', variant, origin }));
  });
  return out;
}

function chatCards(): AuditEntry[] {
  const at = '2026-11-07T15:24:00Z';
  const base = { leagueId: 'lg-easy', leagueName: 'Easy League', leagueAvatar: EASY };
  return [
    card(chatMessageItem({ ...base, id: 'c1', at, author: 'Carl', body: 'No excuses today. I can feel a wobble.', mine: false }), { code: 'C01', name: 'Mini-league chat message', variant: "someone else's", origin: 'Joff → Carl redesign' }),
    card(chatMessageItem({ ...base, id: 'c2', at, author: 'You', body: 'Told you. Saka.', mine: true }), { code: 'C01', name: 'Mini-league chat message', variant: 'yours', origin: 'Joff → Carl redesign' }),
    card(chatMessageItem({ ...base, id: 'c3', at, author: 'Sam', body: 'Rogers. Of course it is.', mine: false, replyTo: 'Told you. Saka.' }), { code: 'C01', name: 'Mini-league chat message', variant: 'a reply', origin: 'Joff → Carl redesign' }),
  ];
}

function pinEntries(nowMs: number): AuditEntry[] {
  const pins: Array<[string, GameweekPin, { leagueCount: number; missingCount: number } | null, string]> = [
    ['predict', { kind: 'predict', gw: GW, deadlineMs: nowMs + 2.5 * HOUR }, null, 'predictions due'],
    ['locked-open', { kind: 'locked', gw: GW, kickoffMs: nowMs + 3 * 24 * HOUR, deadlineMs: nowMs + 2 * 24 * HOUR }, null, "you're in, predictions still open"],
    ['locked-missing', { kind: 'locked', gw: GW, kickoffMs: nowMs + 3 * 24 * HOUR, deadlineMs: nowMs + 2 * 24 * HOUR }, { leagueCount: 2, missingCount: 1 }, "you're in, someone in your leagues still to predict"],
    ['locked-all-in', { kind: 'locked', gw: GW, kickoffMs: nowMs + 3 * 24 * HOUR, deadlineMs: nowMs + 2 * 24 * HOUR }, { leagueCount: 2, missingCount: 0 }, "you're in, everyone in your leagues is in"],
    ['locked-soon', { kind: 'locked', gw: GW, kickoffMs: nowMs + 3 * HOUR, deadlineMs: nowMs + 2 * HOUR }, null, 'starting soon, with the countdown'],
    ['locked-after', { kind: 'locked', gw: GW, kickoffMs: nowMs + HOUR, deadlineMs: nowMs - 15 * MIN }, null, 'after the deadline'],
    ['missed', { kind: 'missed', gw: GW, kickoffMs: nowMs + HOUR }, null, 'deadline passed without predictions'],
    ['coming-soon', { kind: 'comingSoon', gw: GW, nextGw: GW + 1 }, null, 'gameweek finished, next not published'],
    ['ready', { kind: 'ready', gw: GW, nextGw: GW + 1 }, null, 'next gameweek published'],
  ];
  const entries: AuditEntry[] = pins.map(([id, pin, leagues, variant]) => ({
    type: 'pin',
    id: `pin:${id}`,
    pin,
    leagues,
    scoreLabel: pin.kind === 'comingSoon' || pin.kind === 'ready' ? '7/10' : null,
    meta: { code: 'X01', name: 'Pinned gameweek card', variant, origin: 'Carl' },
  }));
  entries.push({
    type: 'invite',
    id: 'pin:invite',
    invite: { id: 'inv-1', leagueName: 'Easy League', invitedByName: 'Sam' },
    meta: { code: 'X02', name: 'Mini-league invite pin', variant: '', origin: 'Joff' },
  });
  return entries;
}

/** Documented (Joff's card map or the copy bank) but not built, or built differently. */
function missingEntries(): AuditEntry[] {
  const rows: Array<[string, string, string, string]> = [
    ['N01', 'Pinned card copy rotation (A/B/C)', 'deadlinePinTitles, youreInCopy, comingSoonCopy and nextGwHereCopy exist in copyBank.ts but nothing uses them. The pinned card always shows the fixed copy in pinnedCardCopy().', "Joff's card map: GW Management"],
    ['N02', 'Invite pin copy rotation (A/B/C)', 'inviteCopy exists in copyBank.ts but the invite pin uses its own fixed copy.', "Joff's card map: Mini-leagues → Invite"],
    ['N03', 'Line-up copy bank', 'lineupCopy is unused. Line-up cards use lineupIntro() in feed.ts, which reads the pick split instead (shown above as M03).', "Joff's card map: Line-up"],
    ['N04', 'Mini-leagues snapshot headlines', 'mlSnapshotCopy ("Running the show", "Up 12 this gameweek", "A shuffle this gameweek") is unused. The replay card always reads "Where you stand" / "Mini leagues & leaderboard".', "Joff's card map: ML snapshot"],
    ['N05', 'Admin post types (Announcement, Football chat prompt, Operational notice)', 'Built as one admin post card. The map shows a kicker per type ("Announcement", "Match update"); the app has only the title and body an admin types, under a "TotL" kicker.', "Joff's card map: Admin messages"],
    ['N06', 'Perfect 10 at the moment it happens', 'The map says it posts when someone finishes with 10/10. The builder stamps it at 12:00 that day instead.', "Joff's card map: Players shout out"],
  ];
  return rows.map(([code, name, note, source]) => ({ type: 'missing', id: `missing:${code}`, code, name, note, source }));
}

export function auditEntries(nowMs = Date.now()): AuditEntry[] {
  const section = (id: string, title: string): AuditEntry => ({ type: 'section', id: `section:${id}`, title });
  return [
    section('pins', 'Pinned cards (shown above the feed in the app)'),
    ...pinEntries(nowMs),
    section('match', 'Match cards (public)'),
    ...matchCards(),
    section('derived', 'Gameweek cards added 24–25 Oct'),
    ...derivedCards(nowMs),
    section('players', 'The Players cards'),
    ...playersCards(),
    section('stats', 'Insights (season stats)'),
    ...statCards(nowMs),
    section('personal', 'Your cards (personal)'),
    ...personalCards(nowMs),
    section('chat', 'Mini-league chat'),
    ...chatCards(),
    section('missing', 'Documented but not implemented'),
    ...missingEntries(),
  ];
}
