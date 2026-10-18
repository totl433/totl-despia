import type { Fixture, LiveScore, Pick } from '@totl/domain';

import { buildGoalScorerLines, parseGoalEvents } from '../../lib/goalEvents';
import { formatLocalTimeHHmm } from '../../lib/dateTime';
import { fixtureKickoffTimeLabel } from '../../lib/homeFixtureUi';
import { resolveLeagueAvatarUri } from '../../lib/leagueAvatars';
import { normalizeTeamCode } from '../../lib/teamColors';
import { getMediumName } from '../../../../../src/lib/teamNames';

const SAMPLE_EASY_AVATAR = resolveLeagueAvatarUri('ML-avatar-1.png');
const SAMPLE_FC_AVATAR = resolveLeagueAvatarUri('ML-avatar-3.png');

export type FeedLink = {
  label: string;
  to: 'league' | 'overall' | 'home' | 'chat';
  leagueId?: string;
  leagueName?: string;
};

export type FeedKind =
  | 'waiting'
  | 'opener'
  | 'lineup'
  | 'xi'
  | 'kickoff'
  | 'goal'
  | 'ruled-out'
  | 'half-time'
  | 'second-half'
  | 'full-time'
  | 'rank'
  | 'overall'
  | 'round-up'
  | 'message';

/** Cards that take global Fire / Cool / Melt reactions in Match Center. */
export const MATCH_CENTER_REACTABLE_KINDS: ReadonlySet<FeedKind> = new Set([
  'goal',
  'kickoff',
  'half-time',
  'full-time',
  'lineup',
  'xi',
  'ruled-out',
]);

export function isMatchCenterReactable(kind: FeedKind): boolean {
  return MATCH_CENTER_REACTABLE_KINDS.has(kind);
}

/** Stable reaction key — includes GW so fixture indexes don't collide across weeks. */
export function matchCenterReactionCardId(gw: number, itemId: string): string {
  return `mc:gw${gw}:${itemId}`;
}

export type FeedMatch = {
  homeCode: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  pick: Pick | null;
  live: boolean;
  finished: boolean;
  homeScorers?: string[];
  awayScorers?: string[];
  /** Share of submitted picks, same rounding as the home page. */
  percents?: { H: number; D: number; A: number } | null;
};

export type FeedBoard = {
  label: string;
  place: string;
  move: LeagueMove;
};

export type FeedItem = {
  id: string;
  sortAt: number;
  timeLabel: string;
  /** Clock time on the card, like a message. */
  stamp?: string;
  kind: FeedKind;
  eyebrow: string;
  title: string;
  body: string;
  personal?: string | null;
  standings?: LeagueStandingLine[] | null;
  /** GW, month, and season places on one line. */
  boards?: FeedBoard[] | null;
  boardAvatar?: string | null;
  link?: FeedLink | null;
  /** True when the signed-in user sent this chat line. */
  mine?: boolean;
  /** The message this line is answering, when it is a reply. */
  replyTo?: string | null;
  authorAvatar?: string | null;
  leagueAvatar?: string | null;
  match?: FeedMatch | null;
  slot?: Array<{ homeCode: string; awayCode: string }> | null;
  xi?: FeedXi | null;
  /** Home-page style header for a line-up card. */
  lineupTop?: FeedLineupTop | null;
  /** Winner lines on a round-up, with faces and a trophy. */
  honours?: FeedHonour[] | null;
};

export type FeedHonour = {
  text: string;
  userAvatar?: string | null;
  leagueAvatar?: string | null;
  /** Name used for the letter when there is no photo. */
  faceLabel?: string | null;
  /** A tie uses the mini-league badge in the face slot. */
  tie?: boolean;
  trophy?: boolean;
};

export type FeedLineupTop = {
  homeName: string;
  awayName: string;
  kickoffLabel: string;
  homeForm: string | null;
  awayForm: string | null;
  homeRank: number | null;
  awayRank: number | null;
};

export type FeedXiPlayer = {
  name: string;
  number: number | null;
};

export type FeedXi = {
  home: FeedXiPlayer[];
  away: FeedXiPlayer[];
  homeFormation: string | null;
  awayFormation: string | null;
  homeCode?: string;
  awayCode?: string;
  homeName?: string;
  awayName?: string;
};

const SURNAME_PARTICLES = new Set(['de', 'di', 'da', 'dos', 'del', 'van', 'von', 'der', 'den', 'le', 'la', 'st']);

function surname(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? name;
  const prev = parts[parts.length - 2]?.toLowerCase().replace(/\.$/, '');
  if (prev && SURNAME_PARTICLES.has(prev)) return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  return parts[parts.length - 1] ?? name;
}

function lineupIntro(
  homeName: string,
  awayName: string,
  percents: { H: number; D: number; A: number } | null,
  seed: number
): string {
  const pick = (lines: string[]) => lines[Math.abs(seed) % lines.length] ?? lines[0];
  if (!percents) return 'Teams are out!';
  const ranked = [
    { key: 'H' as const, name: homeName, pct: percents.H },
    { key: 'D' as const, name: 'the draw', pct: percents.D },
    { key: 'A' as const, name: awayName, pct: percents.A },
  ].sort((a, b) => b.pct - a.pct);
  const [top, second, last] = ranked;
  if (!top || !second || !last) return 'Teams are out!';
  const spread = top.pct - last.pct;
  const gap = top.pct - second.pct;
  if (spread <= 12) {
    return pick(['Teams are out. Proper split. Take your pick.', 'Teams are out! No consensus. This could be anything.']);
  }
  if (top.key === 'D') {
    return pick(['Teams are out. A lot of you fancy a draw.', 'Teams are out! The draw is the popular pick.']);
  }
  if (gap >= 15) {
    if (top.key === 'A') {
      return pick([`Teams are out! Players are backing ${awayName} for the win.`, 'Teams are out. The away win is the call.']);
    }
    return pick([
      `Teams are out! Players are backing ${homeName} for the win.`,
      `Teams are out. ${homeName}, and it's not even close.`,
    ]);
  }
  const leader = top.name;
  return pick([
    `Teams are out. Tight one. ${leader}, just about.`,
    `Teams are out! Split down the middle. ${leader} by a nose.`,
  ]);
}

function shirtNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function parseStoredLineup(raw: unknown): FeedXi | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as {
    home?: { formation?: unknown; players?: unknown };
    away?: { formation?: unknown; players?: unknown };
  };
  const side = (value: { formation?: unknown; players?: unknown } | undefined) => {
    const players = Array.isArray(value?.players) ? value.players : [];
    const named = players
      .map((player) => {
        if (!player || typeof player !== 'object') return null;
        const rawName = (player as { name?: unknown }).name;
        const name = typeof rawName === 'string' ? surname(rawName) : '';
        if (!name) return null;
        return { name, number: shirtNumber((player as { shirtNumber?: unknown }).shirtNumber) };
      })
      .filter((player): player is FeedXiPlayer => player !== null)
      .slice(0, 11);
    if (named.length < 11) return null;
    const formation = typeof value?.formation === 'string' && value.formation.trim() ? value.formation.trim() : null;
    return { players: named, formation };
  };
  const home = side(row.home);
  const away = side(row.away);
  if (!home || !away) return null;
  return { home: home.players, away: away.players, homeFormation: home.formation, awayFormation: away.formation };
}

export type LeagueMemberPicks = {
  userId: string;
  name: string;
  picks: Record<number, Pick>;
};

export type LeaguePickSnap = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  members: LeagueMemberPicks[];
};

export type LeagueMove = 'up' | 'down' | 'same';

export type LeagueStandingLine = {
  name: string;
  place: string;
  move: LeagueMove;
  avatarUrl?: string | null;
  /** Season table, shown under the mini-leagues on a rank card. */
  overall?: boolean;
};

export type OverallReplay = {
  /** Season points from gameweeks before this one. */
  beforeGw: Record<string, number>;
  /** Points already banked in the current month, before this gameweek. */
  monthBefore: Record<string, number>;
  /** Short month name, such as Oct. Empty when this gameweek has no month. */
  monthLabel: string;
  /** This gameweek's picks, so the tables can move as results land. */
  picks: Record<string, Record<number, Pick>>;
  userAvatar?: string | null;
};

export type LeagueTableSnap = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  rows: Array<{ user_id: string; name: string; score: number; avatarUrl?: string | null }>;
};

type Side = 'H' | 'A';

function teamLabel(fixture: Fixture, side: 'home' | 'away'): string {
  if (side === 'home') return fixture.home_name || fixture.home_team || fixture.home_code || 'Home';
  return fixture.away_name || fixture.away_team || fixture.away_code || 'Away';
}

function matchLabel(fixture: Fixture): string {
  return `${teamLabel(fixture, 'home')} v ${teamLabel(fixture, 'away')}`;
}

function outcome(home: number, away: number): Pick {
  if (home > away) return 'H';
  if (away > home) return 'A';
  return 'D';
}

function positiveLine(seed: number, finalWhistle: boolean): string {
  const live = ['Going your way! ✨', 'Still with you 💪', 'Your pick is looking good 👀'];
  const done = ['You had it!! 🎉', 'Called it!! 🏆', 'That one is yours!! 🙌'];
  const lines = finalWhistle ? done : live;
  return lines[Math.abs(seed) % lines.length] ?? lines[0];
}

function missLine(home: number, away: number): string {
  return Math.abs(home - away) <= 1 ? 'So close! 😬' : "Didn't go your way 😅";
}

function halfTimeTitle(): string {
  return 'Half time';
}

function gwScoreLine(correct: number, finished: number, remaining: number): string {
  const tally = `${correct} out of ${finished} correct`;
  if (remaining <= 0) return tally;
  return `${tally}, ${remaining === 1 ? '1 more to go' : `${remaining} more to go`}`;
}

function personalLine(pick: Pick | null, home: number, away: number, finalWhistle: boolean, seed: number): string | null {
  if (!pick) return null;
  if (pick === outcome(home, away)) return positiveLine(seed, finalWhistle);
  if (!finalWhistle) return null;
  return missLine(home, away);
}

function fixtureMatch(
  fixture: Fixture,
  pick: Pick | null,
  homeScore: number | null,
  awayScore: number | null,
  status: string | null | undefined,
  goals: unknown = null,
  upToMinute?: number
): FeedMatch {
  const raw = parseGoalEvents(goals).filter((goal) => upToMinute == null || (typeof goal.minute === 'number' && goal.minute <= upToMinute));
  const homeCandidates = [fixture.home_name, fixture.home_team, fixture.home_code].map((value) => String(value ?? ''));
  const awayCandidates = [fixture.away_name, fixture.away_team, fixture.away_code].map((value) => String(value ?? ''));
  return {
    homeCode: String(fixture.home_code ?? '').toUpperCase(),
    awayCode: String(fixture.away_code ?? '').toUpperCase(),
    homeScore,
    awayScore,
    pick,
    live: status === 'IN_PLAY' || status === 'PAUSED',
    finished: status === 'FINISHED',
    homeScorers: buildGoalScorerLines(raw, homeCandidates),
    awayScorers: buildGoalScorerLines(raw, awayCandidates),
  };
}

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function ruledOutGoal(goal: { type?: string | null }): boolean {
  const type = String(goal.type ?? '');
  return type.includes('DISALLOW') || type.includes('CANCEL');
}

/** Score from goals on or before a minute. Later goals stay off older cards. */
function scoreThroughMinute(fixture: Fixture, goals: Array<{ team?: string | null; minute?: number | null; type?: string | null }>, upTo: number): { home: number; away: number } {
  let home = 0;
  let away = 0;
  goals.forEach((goal) => {
    if (typeof goal.minute !== 'number' || goal.minute > upTo || ruledOutGoal(goal)) return;
    const side = sideForGoal(fixture, goal.team);
    if (side === 'H') home += 1;
    else if (side === 'A') away += 1;
  });
  return { home, away };
}

function sideForGoal(fixture: Fixture, team: string | null | undefined): Side | null {
  const value = normalize(team);
  if (!value) return null;
  const home = [fixture.home_name, fixture.home_team, fixture.home_code].map(normalize).filter(Boolean);
  const away = [fixture.away_name, fixture.away_team, fixture.away_code].map(normalize).filter(Boolean);
  const hit = (candidates: string[]) =>
    candidates.some((candidate) => value === candidate || value.includes(candidate) || candidate.includes(value));
  if (hit(home)) return 'H';
  if (hit(away)) return 'A';
  return null;
}

function started(status: string | null | undefined): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
}

function clockStamp(sortAt: number, fallback: string): string {
  if (!Number.isFinite(sortAt) || sortAt < 1_000_000_000_000 || sortAt > 4_000_000_000_000) return fallback;
  return formatLocalTimeHHmm(new Date(sortAt).toISOString());
}

function scoresLine(scorer: string): string {
  const name = scorer.trim() || 'Someone';
  return `${name} Scores!!! ⚽`;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function rankOf(rows: Array<{ user_id: string; score: number }>, userId: string): number | null {
  const mine = rows.find((row) => row.user_id === userId);
  if (!mine) return null;
  const higher = rows.filter((row) => row.score > mine.score).length;
  return higher + 1;
}

export function winnerLine(leagueName: string, rows: Array<{ user_id: string; name: string; score: number }>, userId: string): FeedItem | null {
  if (!rows.length) return null;
  const top = Math.max(...rows.map((row) => row.score));
  const leaders = rows.filter((row) => row.score === top);
  if (leaders.length > 1) {
    const youShare = leaders.some((row) => row.user_id === userId);
    const names = leaders.map((row) => (row.user_id === userId ? 'You' : row.name)).join(' and ');
    return {
      id: `roundup:${leagueName}`,
      sortAt: Number.MAX_SAFE_INTEGER - 2,
      timeLabel: 'FT',
      kind: 'round-up',
      eyebrow: 'Round-up',
      title: youShare ? 'You share it' : 'All square',
      body: `${names} finish level in ${leagueName}.`,
      link: null,
    };
  }
  const winner = leaders[0];
  const you = winner.user_id === userId;
  return {
    id: `roundup:${leagueName}`,
    sortAt: Number.MAX_SAFE_INTEGER - 2,
    timeLabel: 'FT',
    kind: 'round-up',
    eyebrow: 'Round-up',
    title: you ? 'You win' : `${winner.name} wins ${leagueName}`,
    body: you ? `${leagueName}. Take a bow.` : 'Fair play.',
    link: null,
  };
}

function resolveLive(
  fixture: Fixture,
  liveByFixtureIndex: Map<number, LiveScore>,
  liveByApiMatchId?: Map<number, LiveScore>
): LiveScore | undefined {
  const idx = Number(fixture.fixture_index);
  if (Number.isInteger(idx)) {
    const row = liveByFixtureIndex.get(idx);
    if (row) return row;
  }
  const apiMatchId = Number(fixture.api_match_id);
  if (liveByApiMatchId && Number.isInteger(apiMatchId)) return liveByApiMatchId.get(apiMatchId);
  return undefined;
}

function kickoffMs(fixture: Fixture): number | null {
  if (!fixture.kickoff_time) return null;
  const ms = new Date(fixture.kickoff_time).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function firstKickoffMs(fixtures: Fixture[]): number | null {
  const times = fixtures.map(kickoffMs).filter((ms): ms is number => typeof ms === 'number');
  if (!times.length) return null;
  return Math.min(...times);
}

export function lastKickoffMs(fixtures: Fixture[]): number | null {
  const times = fixtures.map(kickoffMs).filter((ms): ms is number => typeof ms === 'number');
  if (!times.length) return null;
  return Math.max(...times);
}

/**
 * Match Center stays open through the calendar day after the last kickoff,
 * then closes at local midnight (start of the following day).
 * e.g. last game Sat 14:00 → open through Sunday → closes Mon 00:00 local.
 */
export function matchCenterClosesAtMs(fixtures: Fixture[]): number | null {
  const last = lastKickoffMs(fixtures);
  if (last == null) return null;
  const close = new Date(last);
  close.setHours(0, 0, 0, 0);
  close.setDate(close.getDate() + 2);
  return close.getTime();
}

/** Minutes before first kickoff when the first MC cards (opener / line-ups) land. */
export const MATCH_CENTER_LINEUP_LEAD_MS = 75 * 60_000;

const MINUTE_MS = 60_000;
/** Keep HT after any 45' goals, and second-half before any 46' goals (same wall-ms bucket). */
const HT_SORT_OFFSET_MS = 500;
const SECOND_HALF_SORT_OFFSET_MS = -500;

function parseUpdatedAtMs(live: LiveScore | null | undefined): number | null {
  const raw = live?.updated_at;
  if (typeof raw !== 'string' || !raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Wall-clock anchors for half-time / second-half — match minute ≠ real time
 * (stoppage + HT break). Prefer walking back from "now" using the live minute.
 */
function halfTimeWallMs(ko: number, live: LiveScore | null | undefined, nowMs: number): number {
  const minute = typeof live?.minute === 'number' ? live.minute : null;
  const updated = parseUpdatedAtMs(live);
  if (live?.status === 'PAUSED') {
    return updated ?? nowMs;
  }
  if (minute != null && minute >= 46) {
    const shWall = secondHalfWallMs(ko, live, nowMs);
    // Typical break ~15m; never before KO+45'.
    return Math.max(ko + 45 * MINUTE_MS, shWall - 15 * MINUTE_MS);
  }
  return updated ?? ko + 45 * MINUTE_MS;
}

function secondHalfWallMs(ko: number, live: LiveScore | null | undefined, nowMs: number): number {
  const minute = typeof live?.minute === 'number' ? live.minute : null;
  const updated = parseUpdatedAtMs(live);
  if (live?.status === 'PAUSED') {
    return Math.max(ko + 46 * MINUTE_MS, (updated ?? nowMs) + MINUTE_MS);
  }
  if (minute != null && minute >= 46) {
    // Live minute ticks in playing time — walk back from now to restart.
    return Math.max(ko + 46 * MINUTE_MS, nowMs - (minute - 46) * MINUTE_MS);
  }
  return updated ?? ko + 46 * MINUTE_MS;
}

/**
 * Wall-clock time for a goal/score card. Match minute is only a label (46'),
 * not KO+46 minutes on the wall.
 */
function goalWallMs(input: {
  ko: number;
  goalMinute: number;
  live: LiveScore;
  nowMs: number;
  isLatestGoal: boolean;
}): number {
  const { ko, goalMinute, live, nowMs, isLatestGoal } = input;
  const liveMinute = typeof live.minute === 'number' ? live.minute : null;
  const updated = parseUpdatedAtMs(live);

  // Fresh goal that just landed — trust the row's updated_at.
  if (isLatestGoal && updated != null && liveMinute != null && liveMinute - goalMinute <= 2) {
    return updated;
  }

  if (goalMinute >= 46) {
    const shWall = secondHalfWallMs(ko, live, nowMs);
    if (liveMinute != null && liveMinute >= goalMinute) {
      return shWall + (goalMinute - 46) * MINUTE_MS;
    }
    return updated ?? shWall + Math.max(0, goalMinute - 46) * MINUTE_MS;
  }

  // First-half goal: place across the real first-half wall span (includes stoppage).
  const htWall = halfTimeWallMs(ko, live, nowMs);
  const span = Math.max(MINUTE_MS, htWall - ko);
  return ko + Math.min(1, Math.max(0, goalMinute / 45)) * span;
}

/**
 * Match events use a synthetic kickoff+minute clock; chat uses wall clock.
 * Long half-time breaks make wall-clock messages land *after* the synthetic
 * "second half" card. Remap HT-break chat into the gap between HT and SH.
 */
export function alignChatSortAtMs(input: {
  createdAtMs: number;
  fixtures: Fixture[];
  liveByFixtureIndex: Map<number, LiveScore>;
  liveByApiMatchId?: Map<number, LiveScore>;
  nowMs?: number;
}): number {
  const createdAtMs = input.createdAtMs;
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return createdAtMs;
  const nowMs = input.nowMs ?? Date.now();
  const { fixtures, liveByFixtureIndex, liveByApiMatchId } = input;
  if (!fixtures.length) return createdAtMs;

  // Prefer the live/paused fixture; else earliest kickoff still in the MC window.
  const ranked = fixtures
    .map((fixture) => {
      const live = resolveLive(fixture, liveByFixtureIndex, liveByApiMatchId);
      const ko = kickoffMs(fixture);
      return { fixture, live, ko };
    })
    .filter((row): row is { fixture: Fixture; live: LiveScore | undefined; ko: number } => typeof row.ko === 'number');
  if (!ranked.length) return createdAtMs;

  const focus =
    ranked.find((row) => row.live?.status === 'PAUSED') ??
    ranked.find((row) => row.live?.status === 'IN_PLAY') ??
    ranked.find((row) => row.live?.status === 'FINISHED') ??
    ranked.sort((a, b) => a.ko - b.ko)[0];
  if (!focus) return createdAtMs;

  const { live, ko } = focus;
  const minute = typeof live?.minute === 'number' ? live.minute : null;
  const pastHalf =
    live?.status === 'PAUSED' ||
    live?.status === 'FINISHED' ||
    (minute !== null && minute >= 46);
  if (!pastHalf || createdAtMs < ko || !live) return createdAtMs;

  // Match cards now use wall-clock sortAts — chat created_at already interleaves.
  // Keep a light clamp so HT-break messages sit between HT and SH cards.
  const htWall = halfTimeWallMs(ko, live, nowMs) + HT_SORT_OFFSET_MS;
  const shWall = secondHalfWallMs(ko, live, nowMs) + SECOND_HALF_SORT_OFFSET_MS;
  if (createdAtMs > htWall && createdAtMs < shWall) return createdAtMs;
  return createdAtMs;
}

/**
 * Header LIVE control: on once the first Match Center card is live,
 * off once every fixture is finished (round-up message lands).
 *
 * Stay on through kickoff / in-play even if lineup JSON is missing from a
 * stale home snapshot (common when the header doesn't hold a Realtime channel).
 */
export function isMatchCenterLiveSignalActive(input: {
  fixtures: Fixture[];
  liveByFixtureIndex: Map<number, LiveScore>;
  liveByApiMatchId?: Map<number, LiveScore>;
  nowMs?: number;
}): boolean {
  const { fixtures, liveByFixtureIndex, liveByApiMatchId } = input;
  if (!fixtures.length) return false;
  const nowMs = input.nowMs ?? Date.now();
  const resolve = (fixture: Fixture) => resolveLive(fixture, liveByFixtureIndex, liveByApiMatchId);
  const allFinished = fixtures.every((fixture) => resolve(fixture)?.status === 'FINISHED');
  if (allFinished) return false;
  const first = firstKickoffMs(fixtures);
  if (first == null) return false;
  if (nowMs < first - MATCH_CENTER_LINEUP_LEAD_MS) return false;
  const anyLineup = fixtures.some((fixture) => parseStoredLineup(resolve(fixture)?.lineups));
  if (anyLineup) return true;
  // Mid-GW fallback: any fixture kicked off or marked live/finished keeps the entry visible.
  return fixtures.some((fixture) => {
    const status = resolve(fixture)?.status;
    if (status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED') return true;
    const ko = kickoffMs(fixture);
    return ko != null && nowMs >= ko;
  });
}

/** Countdown for the waiting card, always including seconds — e.g. "2h 08m 05s". */
export function formatCountdownShort(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}h ${mm}m ${ss}s`;
  if (minutes > 0) return `${minutes}m ${ss}s`;
  return `${seconds}s`;
}

type OutcomeEvent = {
  sortAt: number;
  stamp: string;
  fixtureIndex: number;
  outcome: Pick;
  announce: boolean;
  scorer: string | null;
  finalWhistle?: boolean;
};

export function buildMatchFeed(input: {
  gw: number;
  fixtures: Fixture[];
  liveByFixtureIndex: Map<number, LiveScore>;
  liveByApiMatchId?: Map<number, LiveScore>;
  picks: Record<string, Pick>;
  percents?: Map<number, { H: number; D: number; A: number }>;
  teamForms?: Record<string, string>;
  teamPositions?: Record<string, number>;
  nowMs: number;
  userId?: string | null;
  leagues?: LeaguePickSnap[];
  overall?: OverallReplay | null;
  /**
   * Stable wall/historical ms when each fixture's XI first appeared in this session.
   * Mutated as new lineups land so late XIs sort into the live end of the feed
   * instead of inserting silently above the viewport.
   */
  lineupArrivalMs?: Map<number, number>;
  /** True once the live feed has already painted once (not the initial catch-up). */
  sessionLive?: boolean;
}): FeedItem[] {
  const { gw, fixtures, liveByFixtureIndex, picks, nowMs } = input;
  const resolve = (fixture: Fixture) => resolveLive(fixture, liveByFixtureIndex, input.liveByApiMatchId);
  const board = (
    fixture: Fixture,
    pick: Pick | null,
    homeScore: number | null,
    awayScore: number | null,
    status: string | null | undefined,
    goals?: unknown,
    upToMinute?: number
  ): FeedMatch => ({
    ...fixtureMatch(fixture, pick, homeScore, awayScore, status, goals ?? null, upToMinute),
    percents: input.percents?.get(fixture.fixture_index) ?? null,
  });
  const lineupTopFor = (fixture: Fixture): FeedLineupTop => {
    const homeCode = normalizeTeamCode(fixture.home_code) ?? String(fixture.home_code ?? '').toUpperCase();
    const awayCode = normalizeTeamCode(fixture.away_code) ?? String(fixture.away_code ?? '').toUpperCase();
    const rank = (code: string) => {
      const value = input.teamPositions?.[code];
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    };
    return {
      homeName: getMediumName(teamLabel(fixture, 'home')),
      awayName: getMediumName(teamLabel(fixture, 'away')),
      kickoffLabel: fixtureKickoffTimeLabel(fixture.kickoff_time),
      homeForm: input.teamForms?.[homeCode] ?? null,
      awayForm: input.teamForms?.[awayCode] ?? null,
      homeRank: rank(homeCode),
      awayRank: rank(awayCode),
    };
  };
  const first = firstKickoffMs(fixtures);
  // Official XIs land about 75 minutes before kickoff — opener + teams cards from then.
  const lineupLeadMs = 75 * 60_000;
  const anyLineup = fixtures.some((fixture) => parseStoredLineup(resolve(fixture)?.lineups));
  // Coming-soon stays up until Here We Go can land, then it is gone — never both.
  const hereWeGoReady = anyLineup && first !== null && nowMs >= first - lineupLeadMs;
  if (first !== null && nowMs < first && !hereWeGoReady) {
    const teamsAt = first - lineupLeadMs;
    const msToTeams = teamsAt - nowMs;
    const countdown = msToTeams > 0 ? formatCountdownShort(msToTeams) : 'any second';
    return [
      {
        id: 'waiting',
        sortAt: first,
        timeLabel: countdown,
        stamp: countdown,
        kind: 'waiting',
        eyebrow: `Gameweek ${gw}`,
        title: `Gameweek ${gw} starting soon!`,
        body: 'Make sure everybody in your Mini Leagues has made their predictions',
      },
    ];
  }

  const items: FeedItem[] = [];
  const outcomeEvents: OutcomeEvent[] = [];
  const outcomeNow = new Map<number, Pick>();
  const noteOutcome = (
    fixtureIndex: number,
    home: number,
    away: number,
    sortAt: number,
    minuteLabel: string,
    announce: boolean,
    scorer: string | null
  ) => {
    const next = outcome(home, away);
    if (outcomeNow.get(fixtureIndex) === next) return;
    outcomeNow.set(fixtureIndex, next);
    outcomeEvents.push({
      sortAt,
      stamp: clockStamp(sortAt, minuteLabel),
      fixtureIndex,
      outcome: next,
      announce,
      scorer,
    });
  };
  for (const fixture of fixtures) {
    const live = resolve(fixture);
    const xi = parseStoredLineup(live?.lineups);
    const ko = kickoffMs(fixture);
    if (!xi || ko === null || nowMs < ko - lineupLeadMs) continue;
    const announced = ko - lineupLeadMs;
    const idx = fixture.fixture_index;
    if (input.lineupArrivalMs && !input.lineupArrivalMs.has(idx)) {
      // Catch-up open: keep story order at the official XI window.
      // Mid-session arrival: wall-clock so the cards appear at the live end, but only
      // before kickoff. A team sheet that loads once the game is on isn't news, so it
      // keeps its announced time rather than jumping to the top of the feed.
      input.lineupArrivalMs.set(idx, input.sessionLive && nowMs < ko ? nowMs : announced);
    }
    const arrived = input.lineupArrivalMs?.get(idx) ?? announced;
    const top = lineupTopFor(fixture);
    const match = board(
      fixture,
      picks[String(fixture.fixture_index)] ?? null,
      live && started(live.status) ? (live.home_score ?? null) : null,
      live && started(live.status) ? (live.away_score ?? null) : null,
      live?.status
    );
    const stamp = clockStamp(arrived, 'XI');
    const pairAt = arrived + fixture.fixture_index * 2;
    items.push({
      id: `xi:${fixture.fixture_index}`,
      sortAt: pairAt,
      timeLabel: stamp,
      stamp,
      kind: 'lineup',
      eyebrow: 'Line-up',
      title: lineupIntro(top.homeName, top.awayName, match.percents ?? null, fixture.fixture_index),
      body: '',
      lineupTop: top,
      match,
    });
    items.push({
      id: `xi-sheet:${fixture.fixture_index}`,
      sortAt: pairAt + 1,
      timeLabel: stamp,
      stamp,
      kind: 'xi',
      eyebrow: 'The teams',
      title: '',
      body: '',
      xi: {
        ...xi,
        homeCode: match.homeCode,
        awayCode: match.awayCode,
        homeName: top.homeName,
        awayName: top.awayName,
      },
    });
  }

  const firstTeams = items
    .filter((item) => item.kind === 'lineup')
    .sort((a, b) => a.sortAt - b.sortAt)[0];
  if (firstTeams) {
    items.push({
      id: `gw-open:${gw}`,
      sortAt: firstTeams.sortAt - 0.5,
      timeLabel: firstTeams.timeLabel,
      stamp: firstTeams.stamp,
      kind: 'opener',
      eyebrow: 'Match Center',
      title: `Gameweek ${gw}, Here We Go!`,
      body: 'First teams are out.',
    });
  }

  for (const fixture of fixtures) {
    const live = resolve(fixture);
    const ko = kickoffMs(fixture);
    const hasStarted = started(live?.status) || (ko !== null && nowMs >= ko && live != null);
    if (!hasStarted || ko === null) continue;
    const slot = Math.floor(ko / 60000) * 60000;
    items.push({
      id: `ko:${fixture.fixture_index}`,
      sortAt: slot,
      timeLabel: formatLocalTimeHHmm(new Date(slot).toISOString()),
      kind: 'kickoff',
      eyebrow: 'Kickoff',
      title: "We're off",
      body: matchLabel(fixture),
      match: board(fixture, picks[String(fixture.fixture_index)] ?? null, null, null, live?.status),
    });
  }

  for (const fixture of fixtures) {
    const live = resolve(fixture);
    if (!live || !started(live.status)) continue;
    const ko = kickoffMs(fixture) ?? 0;
    const pick = picks[String(fixture.fixture_index)] ?? null;
    const goals = parseGoalEvents(live.goals).slice().sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
    const homeScore = live.home_score ?? 0;
    const awayScore = live.away_score ?? 0;
    if (goals.length === 0) {
      if (live.status !== 'FINISHED') {
        const minute = typeof live.minute === 'number' ? live.minute : 0;
        const wallMs = goalWallMs({ ko, goalMinute: minute || 1, live, nowMs, isLatestGoal: true });
        noteOutcome(
          fixture.fixture_index,
          homeScore,
          awayScore,
          wallMs,
          formatLocalTimeHHmm(new Date(wallMs).toISOString()),
          homeScore + awayScore > 0,
          null
        );
      }
    } else {
      noteOutcome(fixture.fixture_index, 0, 0, ko, formatLocalTimeHHmm(new Date(ko).toISOString()), false, null);
    }
    if (goals.length === 0 && (homeScore > 0 || awayScore > 0)) {
      const minute = typeof live.minute === 'number' ? live.minute : 1;
      const wallMs = goalWallMs({ ko, goalMinute: minute, live, nowMs, isLatestGoal: true });
      const stamp = formatLocalTimeHHmm(new Date(wallMs).toISOString());
      items.push({
        id: `score:${fixture.fixture_index}:${homeScore}-${awayScore}`,
        sortAt: wallMs,
        timeLabel: typeof live.minute === 'number' ? `${live.minute}'` : 'Live',
        stamp,
        kind: 'goal',
        eyebrow: 'Goal',
        title: 'GOAL',
        body: scoresLine(''),
        personal: personalLine(pick, homeScore, awayScore, false, minute),
        match: board(fixture, pick, homeScore, awayScore, live.status),
      });
    }
    let home = 0;
    let away = 0;
    const lastGoalIndex = goals.length - 1;
    goals.forEach((goal, index) => {
      const side = sideForGoal(fixture, goal.team);
      const ruledOut = ruledOutGoal(goal);
      if (!ruledOut) {
        if (side === 'H') home += 1;
        else if (side === 'A') away += 1;
        else if ((live.home_score ?? 0) + (live.away_score ?? 0) === index + 1) {
          home = live.home_score ?? home;
          away = live.away_score ?? away;
        }
      }
      const minute = typeof goal.minute === 'number' ? goal.minute : index + 1;
      const shownHome = side ? home : (live.home_score ?? 0);
      const shownAway = side ? away : (live.away_score ?? 0);
      const scorer = goal.scorer?.trim() || 'Someone';
      const own = goal.isOwnGoal ? ' (og)' : '';
      const pen = goal.isPenalty ? ' (pen)' : '';
      // Wall clock for stamp/sort — match minute is only the label (46'), not KO+46'.
      const wallMs = goalWallMs({
        ko,
        goalMinute: minute,
        live,
        nowMs,
        isLatestGoal: index === lastGoalIndex,
      });
      const stamp = formatLocalTimeHHmm(new Date(wallMs).toISOString());
      if (!ruledOut) noteOutcome(fixture.fixture_index, shownHome, shownAway, wallMs, stamp, true, scorer);
      items.push({
        id: `goal:${fixture.fixture_index}:${minute}:${index}`,
        sortAt: wallMs,
        timeLabel: `${minute}'`,
        stamp,
        kind: ruledOut ? 'ruled-out' : 'goal',
        eyebrow: ruledOut ? 'VAR' : 'Goal',
        title: ruledOut ? 'Goal ruled out' : 'GOAL',
        body: ruledOut ? 'VAR has had a word.' : scoresLine(`${scorer}${own}${pen}`),
        personal: ruledOut ? null : personalLine(pick, shownHome, shownAway, false, minute),
        match: board(fixture, pick, shownHome, shownAway, live.status, live.goals, minute),
      });
    });

    const minute = typeof live.minute === 'number' ? live.minute : null;
    const pastHalf = live.status === 'PAUSED' || live.status === 'FINISHED' || (minute !== null && minute >= 46);
    const boardHome = live.home_score ?? home;
    const boardAway = live.away_score ?? away;
    if (pastHalf) {
      const atBreak = live.status === 'PAUSED' && goals.length === 0 ? { home: boardHome, away: boardAway } : scoreThroughMinute(fixture, goals, 45);
      const htMatch = board(fixture, pick, atBreak.home, atBreak.away, live.status === 'PAUSED' ? 'PAUSED' : 'TIMED', live.goals, 45);
      const htWall = halfTimeWallMs(ko, live, nowMs) + HT_SORT_OFFSET_MS;
      const htStamp = formatLocalTimeHHmm(new Date(htWall).toISOString());
      items.push({
        id: `ht:${fixture.fixture_index}`,
        sortAt: htWall,
        timeLabel: 'HT',
        stamp: htStamp,
        kind: 'half-time',
        eyebrow: 'Half-time',
        title: halfTimeTitle(),
        body: '',
        personal: personalLine(pick, atBreak.home, atBreak.away, false, 45),
        match: htMatch,
      });
    }
    if (live.status === 'IN_PLAY' && minute !== null && minute >= 46) {
      const shWall = secondHalfWallMs(ko, live, nowMs) + SECOND_HALF_SORT_OFFSET_MS;
      const shStamp = formatLocalTimeHHmm(new Date(shWall).toISOString());
      items.push({
        id: `sh:${fixture.fixture_index}`,
        sortAt: shWall,
        timeLabel: "46'",
        stamp: shStamp,
        kind: 'second-half',
        eyebrow: 'Second half',
        title: "They're back",
        body: 'Second half.',
        match: board(fixture, pick, boardHome, boardAway, 'IN_PLAY', live.goals, minute ?? undefined),
      });
    }
    if (live.status === 'FINISHED') {
      const sortAt = ko + 100 * 60_000 + fixture.fixture_index;
      const next = outcome(boardHome, boardAway);
      outcomeNow.set(fixture.fixture_index, next);
      outcomeEvents.push({
        sortAt,
        stamp: clockStamp(sortAt, 'FT'),
        fixtureIndex: fixture.fixture_index,
        outcome: next,
        announce: true,
        scorer: null,
        finalWhistle: true,
      });
      const done = fixtures.filter((other) => {
        const otherLive = resolve(other);
        if (!otherLive || otherLive.status !== 'FINISHED') return false;
        const at = kickoffMs(other);
        return at !== null && at + 100 * 60_000 <= sortAt;
      });
      const correct = done.filter((other) => {
        const otherLive = resolve(other);
        const otherPick = picks[String(other.fixture_index)] ?? null;
        if (!otherPick || !otherLive) return false;
        return otherPick === outcome(otherLive.home_score ?? 0, otherLive.away_score ?? 0);
      }).length;
      items.push({
        id: `ft:${fixture.fixture_index}`,
        sortAt,
        timeLabel: 'FT',
        kind: 'full-time',
        eyebrow: 'Full-time',
        title: pick && pick === outcome(boardHome, boardAway) ? 'Full-time!!' : 'Full-time',
        body: gwScoreLine(correct, done.length, fixtures.length - done.length),
        personal: personalLine(pick, boardHome, boardAway, true, fixture.fixture_index),
        match: board(fixture, pick, boardHome, boardAway, 'FINISHED', live.goals),
      });
    }
  }

  if (input.userId && input.leagues?.length) {
    items.push(...leagueMomentsFromEvents(outcomeEvents, input.leagues, input.userId, input.overall));
  }
  items.push(
    ...dayRoundUps({
      fixtures,
      picks,
      resolve,
      leagues: input.leagues,
      userId: input.userId,
    })
  );

  for (const item of items) {
    item.stamp = item.stamp || clockStamp(item.sortAt, item.timeLabel);
  }

  items.sort((a, b) => a.sortAt - b.sortAt || feedKindRank(a.kind) - feedKindRank(b.kind) || a.id.localeCompare(b.id));
  return items;
}

/** Tie-break when sortAt collides — keeps HT → second half → goal → ML. */
function feedKindRank(kind: FeedKind): number {
  switch (kind) {
    case 'half-time':
      return 10;
    case 'second-half':
      return 20;
    case 'goal':
    case 'ruled-out':
      return 30;
    case 'rank':
      return 40;
    case 'message':
      return 50;
    default:
      return 35;
  }
}

type Standing = { rank: number; sole: boolean; points: number };

function memberTable(league: LeaguePickSnap, outcomes: Map<number, Pick>): Array<{ userId: string; score: number; unicorns: number }> {
  const rows = league.members.map((member) => ({ userId: member.userId, score: 0, unicorns: 0 }));
  const submitted = league.members.length;
  outcomes.forEach((result, fixtureIndex) => {
    const correct = league.members.filter((member) => member.picks[fixtureIndex] === result);
    correct.forEach((member) => {
      const row = rows.find((candidate) => candidate.userId === member.userId);
      if (row) row.score += 1;
    });
    if (correct.length === 1 && submitted >= 3) {
      const row = rows.find((candidate) => candidate.userId === correct[0]?.userId);
      if (row) row.unicorns += 1;
    }
  });
  return rows;
}

function standingOf(rows: Array<{ userId: string; score: number; unicorns: number }>, userId: string): Standing | null {
  const mine = rows.find((row) => row.userId === userId);
  if (!mine) return null;
  const ahead = rows.filter(
    (row) => row.score > mine.score || (row.score === mine.score && row.unicorns > mine.unicorns)
  ).length;
  const best = rows.reduce((top, row) => {
    if (row.score > top.score || (row.score === top.score && row.unicorns > top.unicorns)) return row;
    return top;
  }, rows[0]);
  const tiedBest = rows.filter((row) => row.score === best.score && row.unicorns === best.unicorns);
  return {
    rank: ahead + 1,
    sole: tiedBest.length === 1 && tiedBest[0]?.userId === userId,
    points: mine.score,
  };
}

function placeLabel(standing: Standing): string {
  if (standing.rank === 1 && standing.sole) return 'Top';
  if (standing.rank === 1) return 'Tied top';
  return ordinal(standing.rank);
}

function standingMoved(before: Standing, after: Standing): boolean {
  return before.rank !== after.rank || before.sole !== after.sole || before.points !== after.points;
}

function roundupHeadline(rows: Array<{ before: Standing; after: Standing }>): string {
  const climbed = rows.some((row) => row.after.rank < row.before.rank || (row.after.sole && !row.before.sole));
  const dropped = rows.some((row) => row.after.rank > row.before.rank || (row.before.sole && !row.after.sole && row.after.rank > 1));
  const allTop = rows.length > 0 && rows.every((row) => row.after.rank === 1);
  if (allTop && !dropped) return 'Running the show';
  if (climbed && !dropped) return 'On the up';
  if (dropped && !climbed) return 'A little wobble';
  if (climbed && dropped) return 'A proper shuffle';
  if (rows.every((row) => row.after.sole)) return 'Still the one';
  return 'Where you stand';
}

function gwPointsNow(replay: OverallReplay, outcomes: Map<number, Pick>): Map<string, number> {
  const ids = new Set<string>([
    ...Object.keys(replay.beforeGw),
    ...Object.keys(replay.monthBefore),
    ...Object.keys(replay.picks),
  ]);
  const scores = new Map<string, number>();
  ids.forEach((id) => {
    let gwPoints = 0;
    const mine = replay.picks[id];
    if (mine) {
      outcomes.forEach((result, fixtureIndex) => {
        if (mine[fixtureIndex] === result) gwPoints += 1;
      });
    }
    scores.set(id, gwPoints);
  });
  return scores;
}

function rankOn(base: Record<string, number>, gwPoints: Map<string, number>, userId: string): number | null {
  const ids = new Set<string>([...Object.keys(base), ...gwPoints.keys(), userId]);
  const rows = [...ids].map((id) => ({
    user_id: id,
    score: (base[id] ?? 0) + (gwPoints.get(id) ?? 0),
  }));
  return rankOf(rows, userId);
}

type PlaceTrio = { gw: number | null; month: number | null; overall: number | null };

function placesNow(replay: OverallReplay, outcomes: Map<number, Pick>, userId: string): PlaceTrio {
  const gwPoints = gwPointsNow(replay, outcomes);
  return {
    gw: rankOn({}, gwPoints, userId),
    month: replay.monthLabel ? rankOn(replay.monthBefore, gwPoints, userId) : null,
    overall: rankOn(replay.beforeGw, gwPoints, userId),
  };
}

function boardsFrom(before: PlaceTrio, after: PlaceTrio, monthLabel: string): FeedBoard[] {
  const cell = (label: string, from: number | null, to: number | null): FeedBoard | null => {
    if (!label || to == null) return null;
    const prior = from ?? to;
    return { label, place: ordinal(to), move: to < prior ? 'up' : to > prior ? 'down' : 'same' };
  };
  return [
    cell('GW', before.gw, after.gw),
    cell(monthLabel, before.month, after.month),
    cell('Overall', before.overall, after.overall),
  ].filter((row): row is FeedBoard => row != null);
}

function leagueMomentsFromEvents(
  events: OutcomeEvent[],
  leagues: LeaguePickSnap[],
  userId: string,
  overall?: OverallReplay | null
): FeedItem[] {
  const ordered = events.slice().sort((a, b) => a.sortAt - b.sortAt || a.fixtureIndex - b.fixtureIndex);
  const outcomes = new Map<number, Pick>();
  const previous = new Map<string, Standing>();
  leagues.forEach((league) => {
    const place = standingOf(memberTable(league, outcomes), userId);
    if (place) previous.set(league.id, place);
  });
  const cards: FeedItem[] = [];
  // Two moments can share a fixture and a time (a late goal and the final whistle), so the
  // id counts repeats; the order is fixed above, so each card keeps its id between updates.
  const idCounts = new Map<string, number>();
  const cardId = (event: OutcomeEvent): string => {
    const base = `ml:${event.fixtureIndex}:${event.sortAt}`;
    const seen = idCounts.get(base) ?? 0;
    idCounts.set(base, seen + 1);
    return seen === 0 ? base : `${base}:${seen}`;
  };
  ordered.forEach((event) => {
    const beforePlaces = overall ? placesNow(overall, outcomes, userId) : null;
    outcomes.set(event.fixtureIndex, event.outcome);
    const afterPlaces = overall ? placesNow(overall, outcomes, userId) : null;
    if (!event.announce) {
      leagues.forEach((league) => {
        const place = standingOf(memberTable(league, outcomes), userId);
        if (place) previous.set(league.id, place);
      });
      return;
    }
    const snapshot: Array<{ name: string; avatarUrl: string | null; before: Standing; after: Standing }> = [];
    leagues.forEach((league) => {
      const before = previous.get(league.id);
      const after = standingOf(memberTable(league, outcomes), userId);
      if (after) previous.set(league.id, after);
      if (!before || !after) return;
      snapshot.push({ name: league.name, avatarUrl: league.avatarUrl ?? null, before, after });
    });
    const moved = snapshot.filter((row) => standingMoved(row.before, row.after));
    const boards = beforePlaces && afterPlaces ? boardsFrom(beforePlaces, afterPlaces, overall?.monthLabel ?? '') : [];
    if (!snapshot.length && !boards.length) return;
    if (!moved.length && !event.finalWhistle) return;
    cards.push({
      id: cardId(event),
      sortAt: event.finalWhistle ? event.sortAt + 0.5 : event.sortAt + 1,
      timeLabel: event.stamp,
      stamp: event.stamp,
      kind: 'rank',
      eyebrow: 'Mini-leagues',
      title: roundupHeadline(moved.length ? moved : snapshot),
      body: '',
      standings: snapshot.map((row): LeagueStandingLine => ({
        name: row.name,
        avatarUrl: row.avatarUrl,
        place: placeLabel(row.after),
        move: row.after.rank < row.before.rank ? 'up' : row.after.rank > row.before.rank ? 'down' : 'same',
      })),
      boards: boards.length ? boards : null,
      boardAvatar: overall?.userAvatar ?? null,
      link: null,
    });
  });
  return cards;
}

function localDayKey(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function weekdayName(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { weekday: 'long' });
}

function finishedOutcome(live: LiveScore | undefined): Pick | null {
  if (!live || live.status !== 'FINISHED') return null;
  if (typeof live.home_score !== 'number' || typeof live.away_score !== 'number') return null;
  return outcome(live.home_score, live.away_score);
}

function dayHeadline(hits: number, total: number): string {
  if (total > 0 && hits === total) return 'Swept the day';
  if (hits === 0) return "We'll move on";
  if (hits * 2 >= total) return 'Good day at the office';
  return 'A mixed bag';
}

function dayStandings(
  fixtures: Fixture[],
  dayFixtures: Fixture[],
  resolve: (fixture: Fixture) => LiveScore | undefined,
  leagues: LeaguePickSnap[] | undefined,
  userId: string | null | undefined
): LeagueStandingLine[] | null {
  if (!userId || !leagues?.length || dayFixtures.length < 2) return null;
  const dayIds = new Set(dayFixtures.map((fixture) => fixture.fixture_index));
  const before = new Map<number, Pick>();
  const after = new Map<number, Pick>();
  fixtures.forEach((fixture) => {
    const result = finishedOutcome(resolve(fixture));
    if (!result) return;
    after.set(fixture.fixture_index, result);
    if (!dayIds.has(fixture.fixture_index)) before.set(fixture.fixture_index, result);
  });
  const lines: LeagueStandingLine[] = [];
  leagues.forEach((league) => {
    const earlier = standingOf(memberTable(league, before), userId);
    const later = standingOf(memberTable(league, after), userId);
    if (!earlier || !later) return;
    lines.push({
      name: league.name,
      avatarUrl: league.avatarUrl ?? null,
      place: placeLabel(later),
      move: later.rank < earlier.rank ? 'up' : later.rank > earlier.rank ? 'down' : 'same',
    });
  });
  return lines.length ? lines : null;
}

function dayRoundUps(input: {
  fixtures: Fixture[];
  picks: Record<string, Pick>;
  resolve: (fixture: Fixture) => LiveScore | undefined;
  leagues?: LeaguePickSnap[];
  userId?: string | null;
}): FeedItem[] {
  const groups = new Map<string, { at: number; fixtures: Fixture[] }>();
  input.fixtures.forEach((fixture) => {
    const ko = kickoffMs(fixture);
    if (ko === null) return;
    const key = localDayKey(ko);
    const group = groups.get(key) ?? { at: ko, fixtures: [] };
    group.fixtures.push(fixture);
    if (ko < group.at) group.at = ko;
    groups.set(key, group);
  });

  const cards: FeedItem[] = [];
  groups.forEach((group, key) => {
    if (!group.fixtures.every((fixture) => input.resolve(fixture)?.status === 'FINISHED')) return;
    const lastWhistle = Math.max(...group.fixtures.map((fixture) => (kickoffMs(fixture) ?? group.at) + 100 * 60_000));
    const sortAt = lastWhistle + 60_000;
    const dayName = weekdayName(group.at);
    if (group.fixtures.length === 1) {
      const fixture = group.fixtures[0];
      const pick = input.picks[String(fixture.fixture_index)] ?? null;
      const result = finishedOutcome(input.resolve(fixture));
      const hit = Boolean(pick && result && pick === result);
      cards.push({
        id: `day:${key}`,
        sortAt,
        timeLabel: 'FT',
        kind: 'round-up',
        eyebrow: dayName,
        title: pick && hit ? 'Job done' : "That's the night",
        body: pick ? `${matchLabel(fixture)}. ${hit ? 'You had it.' : 'Not this one.'}` : matchLabel(fixture),
        standings: null,
      });
      return;
    }
    let hits = 0;
    let picked = 0;
    group.fixtures.forEach((fixture) => {
      const pick = input.picks[String(fixture.fixture_index)] ?? null;
      if (!pick) return;
      picked += 1;
      const result = finishedOutcome(input.resolve(fixture));
      if (result && pick === result) hits += 1;
    });
    cards.push({
      id: `day:${key}`,
      sortAt,
      timeLabel: 'FT',
      kind: 'round-up',
      eyebrow: dayName,
      title: picked ? dayHeadline(hits, group.fixtures.length) : "That's the day",
      body: picked ? `You went ${hits}/${group.fixtures.length}` : `${group.fixtures.length} down.`,
      standings: dayStandings(input.fixtures, group.fixtures, input.resolve, input.leagues, input.userId),
    });
  });
  return cards;
}

export function buildRoundUp(input: {
  leagues: LeagueTableSnap[];
  userId: string;
  userAvatar?: string | null;
  overallBefore: number | null;
  overallAfter: number | null;
}): FeedItem[] {
  const honours: FeedHonour[] = [];
  let youWon = 0;
  let counted = 0;
  input.leagues.forEach((league) => {
    if (!league.rows.length) return;
    const top = Math.max(...league.rows.map((row) => row.score));
    const leaders = league.rows.filter((row) => row.score === top);
    const winner = leaders[0];
    if (!winner) return;
    counted += 1;
    if (leaders.length > 1) {
      const youShare = leaders.some((row) => row.user_id === input.userId);
      if (youShare) youWon += 1;
      honours.push({
        text: youShare ? `You share ${league.name}` : `All square in ${league.name}`,
        leagueAvatar: league.avatarUrl ?? null,
        faceLabel: league.name,
        tie: true,
        trophy: false,
      });
      return;
    }
    const you = winner.user_id === input.userId;
    if (you) youWon += 1;
    honours.push({
      text: you ? `You win ${league.name}` : `${winner.name} wins ${league.name}`,
      userAvatar: winner.avatarUrl ?? (you ? input.userAvatar : null),
      faceLabel: you ? 'You' : winner.name,
      trophy: true,
    });
  });

  const before = input.overallBefore;
  const after = input.overallAfter;
  if (before && after && before !== after) {
    const climbed = after < before;
    const places = Math.abs(before - after);
    honours.push({
      text: `${climbed ? 'Up' : 'Down'} ${places} on Overall, you're ${ordinal(after)}`,
      userAvatar: input.userAvatar ?? null,
      faceLabel: 'You',
    });
  } else if (after) {
    honours.push({
      text: `You're ${ordinal(after)} on Overall`,
      userAvatar: input.userAvatar ?? null,
      faceLabel: 'You',
    });
  }

  if (!honours.length) return [];
  const title = counted > 0 && youWon === counted ? 'Take a bow' : youWon > 0 ? 'You got one' : 'Fair play';
  return [
    {
      id: 'roundup:leagues',
      sortAt: Number.MAX_SAFE_INTEGER - 2,
      timeLabel: 'FT',
      stamp: 'FT',
      kind: 'round-up',
      eyebrow: 'Round-up',
      title,
      body: '',
      honours,
      link: null,
    },
  ];
}

export function rankChangeItem(input: {
  leagueId: string;
  leagueName: string;
  before: number;
  after: number;
  at: number;
}): FeedItem | null {
  if (input.before === input.after) return null;
  const climbed = input.after < input.before;
  const tookLead = input.after === 1 && input.before !== 1;
  const lostLead = input.before === 1 && input.after !== 1;
  const title = tookLead
    ? `Top of ${input.leagueName}`
    : lostLead
      ? `Lead's gone in ${input.leagueName}`
      : climbed
        ? `Up to ${ordinal(input.after)}`
        : `Now ${ordinal(input.after)}`;
  const body = tookLead
    ? "That's you."
    : lostLead
      ? 'Still all to play for.'
      : climbed
        ? `${input.leagueName}. Moving.`
        : `${input.leagueName}. Stay with it.`;
  return {
    id: `rank:${input.leagueId}:${input.at}`,
    sortAt: input.at,
    timeLabel: clockStamp(input.at, 'Now'),
    stamp: clockStamp(input.at, 'Now'),
    kind: 'rank',
    eyebrow: 'Mini-league',
    title,
    body,
    link: { label: `Open ${input.leagueName}`, to: 'league', leagueId: input.leagueId, leagueName: input.leagueName },
  };
}

export function overallChangeItem(before: number, after: number, at: number): FeedItem | null {
  if (before === after) return null;
  const places = Math.abs(before - after);
  const enteredTop = after <= 10 && before > 10;
  const leftTop = before <= 10 && after > 10;
  if (places < 5 && !enteredTop && !leftTop) return null;
  const climbed = after < before;
  return {
    id: `overall:${at}`,
    sortAt: at,
    timeLabel: clockStamp(at, 'Now'),
    stamp: clockStamp(at, 'Now'),
    kind: 'overall',
    eyebrow: 'This gameweek',
    title: climbed ? `Up ${places} this gameweek` : `A shuffle this gameweek`,
    body: `You're ${ordinal(after)} on the live table.`,
    link: { label: 'Open Overall', to: 'overall' },
  };
}

const SAMPLE_MATCH: FeedMatch = {
  homeCode: 'ARS',
  awayCode: 'COV',
  homeScore: 1,
  awayScore: 0,
  pick: 'H',
  live: true,
  finished: false,
  percents: { H: 64, D: 22, A: 14 },
};

export function chatMessageItem(input: {
  id: string;
  at: string;
  leagueId: string;
  leagueName: string;
  author: string;
  body: string;
  mine: boolean;
  replyTo?: string | null;
  authorAvatar?: string | null;
  leagueAvatar?: string | null;
}): FeedItem {
  const sortAt = Date.parse(input.at);
  const stamp = Number.isFinite(sortAt) ? formatLocalTimeHHmm(input.at) : '';
  return {
    id: `chat:${input.id}`,
    sortAt: Number.isFinite(sortAt) ? sortAt : 0,
    timeLabel: stamp,
    stamp,
    kind: 'message',
    eyebrow: input.leagueName,
    title: input.mine ? 'You' : input.author,
    body: input.body,
    mine: input.mine,
    replyTo: input.replyTo ?? null,
    authorAvatar: input.authorAvatar ?? null,
    leagueAvatar: input.leagueAvatar ?? null,
    link: {
      label: input.leagueName,
      to: 'chat',
      leagueId: input.leagueId,
      leagueName: input.leagueName,
    },
  };
}

export function sampleFeed(): FeedItem[] {
  const items: FeedItem[] = [
    {
      id: 'sample-open',
      sortAt: 0,
      timeLabel: '13:30',
      stamp: '13:30',
      kind: 'opener',
      eyebrow: 'Match Center',
      title: 'Gameweek 7, Here We Go!',
      body: 'First teams are out.',
    },
    {
      id: 'sample-xi',
      sortAt: 0.4,
      timeLabel: '13:30',
      stamp: '13:30',
      kind: 'lineup',
      eyebrow: 'Line-up',
      title: lineupIntro('Arsenal', 'Coventry', { H: 64, D: 22, A: 14 }, 0),
      body: '',
      lineupTop: {
        homeName: 'Arsenal',
        awayName: 'Coventry',
        kickoffLabel: '15:00',
        homeForm: 'WWDLW',
        awayForm: 'LDWDL',
        homeRank: 1,
        awayRank: 19,
      },
      match: { ...SAMPLE_MATCH, homeScore: null, awayScore: null, live: false, finished: false },
    },
    {
      id: 'sample-xi-sheet',
      sortAt: 0.45,
      timeLabel: '13:30',
      stamp: '13:30',
      kind: 'xi',
      eyebrow: 'The teams',
      title: '',
      body: '',
      xi: {
        homeCode: 'ARS',
        awayCode: 'COV',
        homeName: 'Arsenal',
        awayName: 'Coventry',
        homeFormation: '4-3-3',
        awayFormation: '5-3-2',
        home: [
          { name: 'Raya', number: 1 },
          { name: 'Timber', number: 12 },
          { name: 'Saliba', number: 2 },
          { name: 'Gabriel', number: 6 },
          { name: 'Calafiori', number: 33 },
          { name: 'Rice', number: 41 },
          { name: 'Zubimendi', number: 36 },
          { name: 'Odegaard', number: 8 },
          { name: 'Saka', number: 7 },
          { name: 'Gyokeres', number: 14 },
          { name: 'Martinelli', number: 11 },
        ],
        away: [
          { name: 'Wilson', number: 13 },
          { name: 'Van Ewijk', number: 27 },
          { name: 'Kitching', number: 15 },
          { name: 'Thomas', number: 4 },
          { name: 'Dasilva', number: 3 },
          { name: 'Bidwell', number: 21 },
          { name: 'Grimes', number: 6 },
          { name: 'Torp', number: 29 },
          { name: 'Simms', number: 9 },
          { name: 'Wright', number: 11 },
          { name: 'Rudoni', number: 7 },
        ],
      },
    },
    {
      id: 'sample-ko',
      sortAt: 1,
      timeLabel: '15:00',
      stamp: '15:00',
      kind: 'kickoff',
      eyebrow: 'Kickoff',
      title: "We're off",
      body: 'Arsenal v Coventry',
      match: { ...SAMPLE_MATCH, homeScore: null, awayScore: null, live: false, finished: false },
    },
    {
      id: 'sample-chat-ko',
      sortAt: 1.4,
      timeLabel: '15:02',
      stamp: '15:02',
      kind: 'message',
      eyebrow: 'Easy League',
      title: 'Carl',
      body: 'No excuses today. I can feel a wobble.',
      mine: false,
      leagueAvatar: SAMPLE_EASY_AVATAR,
    },
    {
      id: 'sample-goal',
      sortAt: 2,
      timeLabel: "23'",
      stamp: '15:23',
      kind: 'goal',
      eyebrow: 'Goal',
      title: 'GOAL',
      body: 'Saka Scores!!! ⚽',
      personal: 'Going your way! ✨',
      match: SAMPLE_MATCH,
    },
    {
      id: 'sample-rank',
      sortAt: 3,
      timeLabel: "23'",
      stamp: '15:23',
      kind: 'rank',
      eyebrow: 'Mini-leagues',
      title: 'On the up',
      body: '',
      standings: [
        { name: 'Easy League', place: 'Top', move: 'up', avatarUrl: SAMPLE_EASY_AVATAR },
        { name: 'FC Football', place: '2nd', move: 'up', avatarUrl: SAMPLE_FC_AVATAR },
      ],
      boards: [
        { label: 'GW', place: '4th', move: 'up' },
        { label: 'Oct', place: '11th', move: 'up' },
        { label: 'Overall', place: '40th', move: 'up' },
      ],
    },
    {
      id: 'sample-chat-saka',
      sortAt: 3.2,
      timeLabel: '15:23',
      stamp: '15:23',
      kind: 'message',
      eyebrow: 'Easy League',
      title: 'You',
      body: 'Told you. Saka.',
      mine: true,
      leagueAvatar: SAMPLE_EASY_AVATAR,
    },
    {
      id: 'sample-ht',
      sortAt: 4,
      timeLabel: 'HT',
      stamp: '16:00',
      kind: 'half-time',
      eyebrow: 'Half-time',
      title: halfTimeTitle(),
      body: '',
      personal: 'Still with you 💪',
      match: { ...SAMPLE_MATCH, live: false, homeScorers: ["Saka 23'"] },
    },
    {
      id: 'sample-goal-2',
      sortAt: 4.5,
      timeLabel: "63'",
      stamp: '16:18',
      kind: 'goal',
      eyebrow: 'Goal',
      title: 'GOAL',
      body: 'Morgan Rogers Scores!!! ⚽',
      personal: null,
      match: { homeCode: 'AVL', awayCode: 'BRE', homeScore: 1, awayScore: 0, pick: 'A', live: true, finished: false, percents: { H: 41, D: 27, A: 32 } },
    },
    {
      id: 'sample-rank-drop',
      sortAt: 4.6,
      timeLabel: "63'",
      stamp: '16:18',
      kind: 'rank',
      eyebrow: 'Mini-leagues',
      title: 'A little wobble',
      body: '',
      standings: [
        { name: 'Easy League', place: '2nd', move: 'down', avatarUrl: SAMPLE_EASY_AVATAR },
        { name: 'FC Football', place: '2nd', move: 'same', avatarUrl: SAMPLE_FC_AVATAR },
      ],
      boards: [
        { label: 'GW', place: '9th', move: 'down' },
        { label: 'Oct', place: '11th', move: 'same' },
        { label: 'Overall', place: '41st', move: 'down' },
      ],
    },
    {
      id: 'sample-chat-rogers',
      sortAt: 4.75,
      timeLabel: '16:18',
      stamp: '16:18',
      kind: 'message',
      eyebrow: 'FC Football',
      title: 'Sam',
      body: 'Rogers. Of course it is.',
      mine: false,
      leagueAvatar: SAMPLE_FC_AVATAR,
    },
    {
      id: 'sample-ruled',
      sortAt: 4.3,
      timeLabel: "61'",
      stamp: '16:16',
      kind: 'ruled-out',
      eyebrow: 'VAR',
      title: 'Goal ruled out',
      body: 'VAR has had a word.',
      match: { ...SAMPLE_MATCH, homeScore: 1, awayScore: 0, live: true },
    },
    {
      id: 'sample-ft',
      sortAt: 6,
      timeLabel: 'FT',
      stamp: '16:52',
      kind: 'full-time',
      eyebrow: 'Full-time',
      title: 'Full-time!!',
      body: '1 out of 1 correct, 3 more to go',
      personal: 'You had it!! 🎉',
      match: {
        ...SAMPLE_MATCH,
        homeScore: 2,
        awayScore: 1,
        live: false,
        finished: true,
        homeScorers: ["Saka 23'", "Saka 80'"],
      },
    },
    {
      id: 'sample-rank-ft',
      sortAt: 6.2,
      timeLabel: 'FT',
      stamp: '16:52',
      kind: 'rank',
      eyebrow: 'Mini-leagues',
      title: 'On the up',
      body: '',
      standings: [
        { name: 'Easy League', place: 'Top', move: 'up', avatarUrl: SAMPLE_EASY_AVATAR },
        { name: 'FC Football', place: '2nd', move: 'same', avatarUrl: SAMPLE_FC_AVATAR },
      ],
      boards: [
        { label: 'GW', place: '3rd', move: 'up' },
        { label: 'Oct', place: '8th', move: 'up' },
        { label: 'Overall', place: '38th', move: 'up' },
      ],
    },
    {
      id: 'sample-ft-miss',
      sortAt: 6.5,
      timeLabel: 'FT',
      stamp: '16:54',
      kind: 'full-time',
      eyebrow: 'Full-time',
      title: 'Full-time',
      body: '1 out of 2 correct, 2 more to go',
      personal: 'So close! 😬',
      match: {
        homeCode: 'CHE',
        awayCode: 'LIV',
        homeScore: 1,
        awayScore: 2,
        pick: 'H',
        live: false,
        finished: true,
        percents: { H: 38, D: 24, A: 38 },
        homeScorers: ["Palmer 55'"],
        awayScorers: ["Salah 12'", "Gakpo 70'"],
      },
    },
    {
      id: 'sample-rank-ft-miss',
      sortAt: 6.55,
      timeLabel: 'FT',
      stamp: '16:54',
      kind: 'rank',
      eyebrow: 'Mini-leagues',
      title: 'A little wobble',
      body: '',
      standings: [
        { name: 'Easy League', place: '2nd', move: 'down', avatarUrl: SAMPLE_EASY_AVATAR },
        { name: 'FC Football', place: '2nd', move: 'same', avatarUrl: SAMPLE_FC_AVATAR },
      ],
      boards: [
        { label: 'GW', place: '7th', move: 'down' },
        { label: 'Oct', place: '9th', move: 'down' },
        { label: 'Overall', place: '40th', move: 'down' },
      ],
    },
    {
      id: 'sample-chat-chelsea',
      sortAt: 6.6,
      timeLabel: '16:55',
      stamp: '16:55',
      kind: 'message',
      eyebrow: 'FC Football',
      title: 'Carl',
      body: 'Chelsea. I cannot look.',
      mine: false,
      leagueAvatar: SAMPLE_FC_AVATAR,
    },
    {
      id: 'sample-day',
      sortAt: 6.8,
      timeLabel: 'FT',
      stamp: '17:00',
      kind: 'round-up',
      eyebrow: 'Saturday',
      title: 'Good day at the office',
      body: 'You went 3/4',
      standings: [
        { name: 'Easy League', place: 'Top', move: 'up', avatarUrl: SAMPLE_EASY_AVATAR },
        { name: 'FC Football', place: '2nd', move: 'same', avatarUrl: SAMPLE_FC_AVATAR },
      ],
    },
    {
      id: 'sample-roundup',
      sortAt: 7,
      timeLabel: 'FT',
      stamp: '17:10',
      kind: 'round-up',
      eyebrow: 'Round-up',
      title: 'Take a bow',
      body: '',
      honours: [
        { text: 'You win Easy League', userAvatar: SAMPLE_EASY_AVATAR, faceLabel: 'You', trophy: true },
        { text: 'Carl wins FC Football', userAvatar: SAMPLE_FC_AVATAR, faceLabel: 'Carl', trophy: true },
        { text: "Up 12 on Overall, you're 40th", faceLabel: 'You' },
      ],
    },
  ];
  return items.sort((a, b) => a.sortAt - b.sortAt || a.id.localeCompare(b.id));
}
