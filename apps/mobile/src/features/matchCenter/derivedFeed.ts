import type { Fixture, LiveScore, Pick } from '@totl/domain';

import { fixtureDateLabel, fixtureKickoffTimeLabel } from '../../lib/homeFixtureUi';
import { SEASON_LAST_GW } from '../../lib/leaderboardMonths';
import { playersDayKey, playersDaysInMonth, playersMonthKey, playersWeekStart, shiftPlayersDay } from '../../lib/retroPlayers/day';
import type { PlayersScoreStore } from '../../lib/retroPlayers/scores';
import { scoreForDay, scoreForMonth, scoreForWeek } from '../../lib/retroPlayers/scores';
import { resolveLiveScore } from '../../lib/liveScoreRows';
import { getMediumName } from '../../../../../src/lib/teamNames';
import { firstKickoffMs, type FeedFace, type FeedItem, type FeedScoreRow, type LeaguePickSnap, type LeagueTableSnap } from './feed';
import {
  awayWinsCopy,
  drawsCopy,
  easiestTeamCopy,
  everyonePredictedCopy,
  fixturesCopy,
  goodLuckCopy,
  lastMinuteCopy,
  mostMissedCopy,
  pickCopy,
  playerJoinedCopy,
  playersDailyCopy,
  playersMonthlyCopy,
  playersNudgeCopy,
  playersPerfectCopy,
  playersReadyCopy,
  playersWeeklyCopy,
  scoreSheetCopy,
  winnerShoutCopy,
} from './copyBank';
import type { SeasonStatFacts } from './seasonStatFacts';
import {
  hereWeGoMs,
  isWeekendGameweek,
  scheduleStatMoments,
  scheduleWinnerShouts,
  startOfLocalDay,
  type BusyInterval,
  type ScheduledShout,
  type StatMomentKind,
} from './shoutOutSlots';

export type FeedPerson = { id: string; name: string; avatarUrl: string | null };

export type LeagueJoin = {
  leagueId: string;
  leagueName: string;
  leagueAvatar: string | null;
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAtMs: number;
};

export type DerivedFeedInput = {
  gw: number;
  fixtures: Fixture[];
  /** Next published gameweek's fixtures, when the board is still last week. */
  publishedFixtures?: Fixture[] | null;
  liveByFixtureIndex: Map<number, LiveScore>;
  liveByApiMatchId?: Map<number, LiveScore>;
  picks: Record<string, Pick>;
  userId: string | null;
  nowMs: number;
  deadlineMs: number | null;
  allFinished: boolean;
  monthEndGw: number | null;
  leagues: LeaguePickSnap[];
  tables: LeagueTableSnap[];
  joins: LeagueJoin[];
  gwOpenMs: number | null;
  liveTable: Array<{ user_id: string; name: string; score: number }>;
  monthBefore: Record<string, number>;
  seasonBefore: Record<string, number>;
  people: Map<string, FeedPerson>;
  playersScores: Record<string, PlayersScoreStore>;
  nextHereWeGoMs: number | null;
  percents?: Map<number, { H: number; D: number; A: number }>;
  adminPosts?: AdminFeedPost[];
  seasonStats?: SeasonStatFacts | null;
};

export type AdminFeedPost = {
  id: string;
  title: string;
  body: string;
  publishedAtMs: number;
};

function teamName(fixture: Fixture, side: 'home' | 'away'): string {
  if (side === 'home') return getMediumName(fixture.home_name || fixture.home_team || fixture.home_code || 'Home');
  return getMediumName(fixture.away_name || fixture.away_team || fixture.away_code || 'Away');
}

function pickLabel(pick: Pick | null | undefined, fixture: Fixture): string {
  if (pick === 'H') return teamName(fixture, 'home');
  if (pick === 'A') return teamName(fixture, 'away');
  if (pick === 'D') return 'Draw';
  return '—';
}

function resultOf(live: LiveScore | undefined): Pick | null {
  if (!live || live.status !== 'FINISHED') return null;
  if (typeof live.home_score !== 'number' || typeof live.away_score !== 'number') return null;
  if (live.home_score > live.away_score) return 'H';
  if (live.home_score < live.away_score) return 'A';
  return 'D';
}

export function lastFinishedMs(input: {
  fixtures: Fixture[];
  liveByFixtureIndex: Map<number, LiveScore>;
  liveByApiMatchId?: Map<number, LiveScore>;
}): number | null {
  let last: number | null = null;
  for (const fixture of input.fixtures) {
    const live = resolveLiveScore(fixture, input.liveByFixtureIndex, input.liveByApiMatchId);
    if (live?.status !== 'FINISHED') return null;
    const updated = live.updated_at ? Date.parse(live.updated_at) : Number.NaN;
    const ko = fixture.kickoff_time ? Date.parse(fixture.kickoff_time) : Number.NaN;
    const at = Number.isFinite(updated) ? updated : Number.isFinite(ko) ? ko + 2 * 3_600_000 : null;
    if (at == null) continue;
    if (last == null || at > last) last = at;
  }
  return last;
}

export function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function topByScore<T extends { score: number; name: string; user_id: string }>(
  rows: T[],
  limit = 3
): T[] {
  if (!rows.length) return [];
  const best = Math.max(...rows.map((row) => row.score));
  return rows
    .filter((row) => row.score === best)
    .sort((a, b) => a.name.localeCompare(b.name) || a.user_id.localeCompare(b.user_id))
    .slice(0, limit);
}

function facesFor(rows: Array<{ user_id: string; name: string }>, people: Map<string, FeedPerson>): FeedFace[] {
  return rows.map((row) => {
    const person = people.get(row.user_id);
    return { name: person?.name || row.name, avatarUrl: person?.avatarUrl ?? null };
  });
}

function card(partial: Omit<FeedItem, 'timeLabel' | 'stamp'> & { timeLabel?: string; stamp?: string }): FeedItem {
  const stamp = partial.stamp ?? formatLocalStamp(partial.sortAt);
  return { timeLabel: stamp, stamp, ...partial };
}

function shoutCard(input: {
  id: string;
  sortAt: number;
  title: string;
  body: string;
  faces: FeedFace[];
}): FeedItem {
  return card({
    id: input.id,
    sortAt: input.sortAt,
    kind: 'shout',
    eyebrow: input.title,
    title: input.title,
    body: input.body,
    faces: input.faces,
    link: null,
  });
}

export function fixtureListItem(input: { gw: number; fixtures: Fixture[]; nowMs: number; sortAt?: number }): FeedItem | null {
  if (!input.fixtures.length) return null;
  const first = firstKickoffMs(input.fixtures);
  if (first == null || input.nowMs < first - 21 * 24 * 3_600_000) return null;
  const lines = [...input.fixtures]
    .sort((a, b) => Date.parse(a.kickoff_time ?? '') - Date.parse(b.kickoff_time ?? ''))
    .map((fixture) => {
      const day = fixtureDateLabel(fixture.kickoff_time);
      const time = fixtureKickoffTimeLabel(fixture.kickoff_time);
      return `${day} ${time}  ${teamName(fixture, 'home')} v ${teamName(fixture, 'away')}`;
    });
  const shown = lines.slice(0, 4);
  if (lines.length > 4) shown.push(`+${lines.length - 4} more`);
  const sortAt = input.sortAt ?? first - 7 * 24 * 3_600_000;
  return card({
    id: `fixtures:${input.gw}`,
    sortAt,
    kind: 'fixtures',
    eyebrow: `Gameweek ${input.gw} fixtures`,
    title: pickCopy(fixturesCopy(input.gw), `fixtures:${input.gw}`).title,
    body: pickCopy(fixturesCopy(input.gw), `fixtures:${input.gw}`).line,
    fixtureLines: shown,
    link: null,
  });
}

export function scoreSheetItem(input: {
  gw: number;
  fixtures: Fixture[];
  picks: Record<string, Pick>;
  liveByFixtureIndex: Map<number, LiveScore>;
  liveByApiMatchId?: Map<number, LiveScore>;
  lastFtMs: number;
}): FeedItem | null {
  if (!input.fixtures.length) return null;
  const rows: FeedScoreRow[] = [...input.fixtures]
    .sort((a, b) => a.fixture_index - b.fixture_index)
    .map((fixture) => {
      const live = resolveLiveScore(fixture, input.liveByFixtureIndex, input.liveByApiMatchId);
      const result = resultOf(live);
      const pick = input.picks[String(fixture.fixture_index)] ?? input.picks[fixture.fixture_index] ?? null;
      return {
        home: teamName(fixture, 'home'),
        away: teamName(fixture, 'away'),
        pick: pickLabel(pick, fixture),
        result: pickLabel(result, fixture),
        hit: pick != null && result != null && pick === result,
      };
    });
  return card({
    id: `score-sheet:${input.gw}`,
    sortAt: input.lastFtMs + 30_000,
    kind: 'score-sheet',
    eyebrow: pickCopy(scoreSheetCopy(), `score-sheet:${input.gw}`).title,
    title: pickCopy(scoreSheetCopy(), `score-sheet:${input.gw}`).title,
    body: pickCopy(scoreSheetCopy(), `score-sheet:${input.gw}`).line,
    scoreRows: rows,
    link: { label: 'Share', to: 'score-sheet' },
  });
}

export function everyonePredictedItems(input: {
  tables: LeagueTableSnap[];
  leagues: LeaguePickSnap[];
  deadlineMs: number | null;
  firstKickoffMs: number | null;
  nowMs: number;
}): FeedItem[] {
  if (input.deadlineMs == null || input.nowMs >= input.deadlineMs) return [];
  const sortAt = (input.firstKickoffMs ?? input.deadlineMs) - 2 * 3_600_000;
  return input.tables.flatMap((table) => {
    const submitted = new Set(table.submittedUserIds ?? []);
    const members = table.rows.length;
    if (members < 2) return [];
    const fromPicks = input.leagues.find((league) => league.id === table.id);
    const predicted = fromPicks
      ? fromPicks.members.filter((member) => Object.keys(member.picks).length > 0).length
      : submitted.size;
    const allIn = submitted.size > 0 ? submitted.size >= members : predicted >= members;
    if (!allIn) return [];
    return [
      card({
        id: `everyone:${table.id}`,
        sortAt,
        kind: 'league-event',
        eyebrow: pickCopy(everyonePredictedCopy(table.name), `everyone:${table.id}`).title,
        title: pickCopy(everyonePredictedCopy(table.name), `everyone:${table.id}`).title,
        body: pickCopy(everyonePredictedCopy(table.name), `everyone:${table.id}`).line,
        faces: table.rows.slice(0, 3).map((row) => ({ name: row.name, avatarUrl: row.avatarUrl ?? null })),
        link: { label: table.name, to: 'league', leagueId: table.id, leagueName: table.name },
      }),
    ];
  });
}

export function playerJoinedItems(input: {
  joins: LeagueJoin[];
  userId: string | null;
  gwOpenMs: number | null;
  nowMs: number;
}): FeedItem[] {
  const since = input.gwOpenMs ?? input.nowMs - 21 * 24 * 3_600_000;
  return input.joins
    .filter((join) => join.userId !== input.userId)
    .filter((join) => join.joinedAtMs >= since && join.joinedAtMs <= input.nowMs)
    .map((join) =>
      card({
        id: `joined:${join.leagueId}:${join.userId}`,
        sortAt: join.joinedAtMs,
        kind: 'league-event',
        eyebrow: 'Mini-leagues',
        title: pickCopy(playerJoinedCopy(join.name, join.leagueName), `joined:${join.leagueId}:${join.userId}`).title,
        body: pickCopy(playerJoinedCopy(join.name, join.leagueName), `joined:${join.leagueId}:${join.userId}`).line,
        faces: [
          { name: join.name, avatarUrl: join.avatarUrl },
          { name: join.leagueName, avatarUrl: join.leagueAvatar },
        ],
        link: { label: join.leagueName, to: 'league', leagueId: join.leagueId, leagueName: join.leagueName },
      })
    );
}

function personRow(id: string, people: Map<string, FeedPerson>, fallback = 'Someone'): { user_id: string; name: string; score: number } {
  return { user_id: id, name: people.get(id)?.name || fallback, score: 0 };
}

export function goodLuckItem(input: {
  fixtures: Fixture[];
  liveByFixtureIndex: Map<number, LiveScore>;
  liveByApiMatchId?: Map<number, LiveScore>;
  liveTable: Array<{ user_id: string; name: string; score: number }>;
  people: Map<string, FeedPerson>;
}): FeedItem | null {
  const left = input.fixtures.filter((fixture) => {
    const live = resolveLiveScore(fixture, input.liveByFixtureIndex, input.liveByApiMatchId);
    return live?.status !== 'FINISHED';
  });
  if (left.length !== 1) return null;
  const onNine = input.liveTable.filter((row) => row.score >= 9).sort((a, b) => a.name.localeCompare(b.name));
  if (!onNine.length) return null;
  const lastKo = left[0]?.kickoff_time ? Date.parse(left[0].kickoff_time) : Date.now();
  const names = onNine.map((row) => row.name);
  const copy = pickCopy(goodLuckCopy(joinNames(names), names.length > 5, names.length !== 1), 'shout:good-luck');
  return shoutCard({
    id: 'shout:good-luck',
    sortAt: Number.isFinite(lastKo) ? lastKo - 60_000 : Date.now(),
    title: copy.title,
    body: copy.line,
    faces: facesFor(onNine.slice(0, 5), input.people),
  });
}

function winnerCopy(kind: ScheduledShout['kind'], names: string[], seed: string) {
  return pickCopy(winnerShoutCopy(kind, joinNames(names)), seed);
}

export function winnerShoutItems(input: {
  lastFtMs: number;
  nowMs: number;
  nextHereWeGoMs: number | null;
  monthClosed: boolean;
  seasonClosed: boolean;
  weekendGw: boolean;
  liveTable: Array<{ user_id: string; name: string; score: number }>;
  monthBefore: Record<string, number>;
  seasonBefore: Record<string, number>;
  people: Map<string, FeedPerson>;
}): FeedItem[] {
  const scheduled = scheduleWinnerShouts({
    lastFtMs: input.lastFtMs,
    nowMs: input.nowMs,
    nextHereWeGoMs: input.nextHereWeGoMs,
    monthClosed: input.monthClosed,
    seasonClosed: input.seasonClosed,
    weekendGw: input.weekendGw,
  });
  const gwScore = new Map(input.liveTable.map((row) => [row.user_id, row.score]));
  const monthRows = input.liveTable.map((row) => ({
    ...row,
    score: (input.monthBefore[row.user_id] ?? 0) + row.score,
  }));
  const seasonRows = input.liveTable.map((row) => ({
    ...row,
    score: (input.seasonBefore[row.user_id] ?? 0) + (gwScore.get(row.user_id) ?? 0),
  }));
  const pickRows = (kind: ScheduledShout['kind']) => {
    if (kind === 'gw') return topByScore(input.liveTable);
    if (kind === 'monthly' || kind === 'midweek-month') return topByScore(monthRows, kind === 'monthly' ? 3 : 1);
    return topByScore(seasonRows, kind === 'season' ? 3 : 1);
  };
  return scheduled.flatMap((slot) => {
    const rows = pickRows(slot.kind);
    if (!rows.length) return [];
    return [
      shoutCard({
        id: `shout:${slot.kind}:${input.lastFtMs}`,
        sortAt: slot.at,
        ...(() => {
          const shout = winnerCopy(slot.kind, rows.map((row) => row.name), `shout:${slot.kind}:${input.lastFtMs}`);
          return { title: shout.title, body: shout.line };
        })(),
        faces: facesFor(rows, input.people),
      }),
    ];
  });
}

function localHourOnDay(dayMs: number, hour: number, minute = 0): number {
  return startOfLocalDay(dayMs) + hour * 3_600_000 + minute * 60_000;
}

function topPlayers(
  scores: Record<string, PlayersScoreStore>,
  people: Map<string, FeedPerson>,
  scoreOf: (store: PlayersScoreStore) => number | null,
  limit = 3
): Array<{ user_id: string; name: string; score: number }> {
  const rows = Object.entries(scores)
    .map(([id, store]) => {
      const score = scoreOf(store);
      if (score == null) return null;
      return { user_id: id, name: people.get(id)?.name || 'Someone', score };
    })
    .filter((row): row is { user_id: string; name: string; score: number } => row != null);
  return topByScore(rows, limit);
}

export function playersStackItems(input: {
  nowMs: number;
  userId: string | null;
  scores: Record<string, PlayersScoreStore>;
  people: Map<string, FeedPerson>;
}): FeedItem[] {
  const today = playersDayKey(new Date(input.nowMs));
  const yesterday = shiftPlayersDay(today, -1);
  const eightAm = localHourOnDay(input.nowMs, 8);
  if (input.nowMs < eightAm) return playersEveningAndPerfect(input, today);
  const items: FeedItem[] = [];
  const daily = topPlayers(input.scores, input.people, (store) => scoreForDay(store, yesterday));
  if (daily.length) {
    items.push(
      shoutCard({
        id: `players:daily:${yesterday}`,
        sortAt: eightAm,
        title: pickCopy(playersDailyCopy(joinNames(daily.map((row) => row.name))), `players:daily:${yesterday}`).title,
        body: pickCopy(playersDailyCopy(joinNames(daily.map((row) => row.name))), `players:daily:${yesterday}`).line,
        faces: facesFor(daily, input.people),
      })
    );
  }
  const weekClosed = yesterday === shiftPlayersDay(playersWeekStart(today), 6);
  if (weekClosed) {
    const weekly = topPlayers(input.scores, input.people, (store) => scoreForWeek(store, yesterday));
    if (weekly.length) {
      items.push(
        shoutCard({
          id: `players:weekly:${yesterday}`,
          sortAt: eightAm + 30_000,
          title: pickCopy(playersWeeklyCopy(joinNames(weekly.map((row) => row.name))), `players:weekly:${yesterday}`).title,
          body: pickCopy(playersWeeklyCopy(joinNames(weekly.map((row) => row.name))), `players:weekly:${yesterday}`).line,
          faces: facesFor(weekly, input.people),
        })
      );
    }
  }
  const monthClosed = yesterday === `${playersMonthKey(yesterday)}-${String(playersDaysInMonth(yesterday)).padStart(2, '0')}`;
  if (monthClosed) {
    const monthly = topPlayers(input.scores, input.people, (store) => scoreForMonth(store, yesterday));
    if (monthly.length) {
      items.push(
        shoutCard({
          id: `players:monthly:${yesterday}`,
          sortAt: eightAm + 60_000,
          title: pickCopy(playersMonthlyCopy(joinNames(monthly.map((row) => row.name))), `players:monthly:${yesterday}`).title,
          body: pickCopy(playersMonthlyCopy(joinNames(monthly.map((row) => row.name))), `players:monthly:${yesterday}`).line,
          faces: facesFor(monthly, input.people),
        })
      );
    }
  }
  const mine = input.userId ? input.scores[input.userId] : undefined;
  if (!mine?.[today]) {
    items.push(
      card({
        id: `players:ready:${today}`,
        sortAt: eightAm + 90_000,
        kind: 'players-ready',
        eyebrow: 'The Players',
        title: pickCopy(playersReadyCopy(), `players:ready:${today}`).title,
        body: pickCopy(playersReadyCopy(), `players:ready:${today}`).line,
        link: { label: 'Play today', to: 'players' },
      })
    );
  }
  items.push(...playersEveningAndPerfect(input, today));
  return items;
}

function playersEveningAndPerfect(
  input: { nowMs: number; userId: string | null; scores: Record<string, PlayersScoreStore>; people: Map<string, FeedPerson> },
  today: string
): FeedItem[] {
  const items: FeedItem[] = [];
  const eightPm = localHourOnDay(input.nowMs, 20);
  const mine = input.userId ? input.scores[input.userId] : undefined;
  if (input.nowMs >= eightPm && !mine?.[today]) {
    items.push(
      card({
        id: `players:nudge:${today}`,
        sortAt: eightPm,
        kind: 'players-nudge',
        eyebrow: 'The Players',
        title: pickCopy(playersNudgeCopy(), `players:nudge:${today}`).title,
        body: pickCopy(playersNudgeCopy(), `players:nudge:${today}`).line,
        stamp: '20:00',
        link: { label: 'Play now', to: 'players' },
      })
    );
  }
  const perfect = Object.entries(input.scores)
    .filter(([, store]) => store[today]?.correct === 10)
    .map(([id]) => personRow(id, input.people, 'Someone'));
  for (const row of perfect) {
    items.push(
      shoutCard({
        id: `players:perfect:${today}:${row.user_id}`,
        sortAt: localHourOnDay(input.nowMs, 12),
        title: pickCopy(playersPerfectCopy(row.name), `players:perfect:${today}:${row.user_id}`).title,
        body: pickCopy(playersPerfectCopy(row.name), `players:perfect:${today}:${row.user_id}`).line,
        faces: facesFor([row], input.people),
      })
    );
  }
  return items;
}

const HERE_WE_GO_LEAD_MS = 75 * 60_000;

export function matchBusyIntervals(
  fixtures: Fixture[],
  liveByFixtureIndex: Map<number, LiveScore>,
  liveByApiMatchId?: Map<number, LiveScore>
): BusyInterval[] {
  return fixtures.flatMap((fixture) => {
    const ko = fixture.kickoff_time ? Date.parse(fixture.kickoff_time) : Number.NaN;
    if (!Number.isFinite(ko)) return [];
    const live = resolveLiveScore(fixture, liveByFixtureIndex, liveByApiMatchId);
    const from = ko - HERE_WE_GO_LEAD_MS;
    if (live?.status === 'FINISHED') {
      const updated = live.updated_at ? Date.parse(live.updated_at) : Number.NaN;
      const to = Number.isFinite(updated) ? updated : ko + 2 * 3_600_000;
      return [{ from, to }];
    }
    if (live?.status === 'IN_PLAY' || live?.status === 'PAUSED') {
      return [{ from, to: Number.POSITIVE_INFINITY }];
    }
    return [{ from, to: ko + 2 * 3_600_000 }];
  });
}

function availableStatKinds(stats: SeasonStatFacts): StatMomentKind[] {
  const kinds: StatMomentKind[] = [];
  if (stats.drawPct != null) kinds.push('draws');
  if (stats.awayPct != null) kinds.push('away');
  if (stats.mostMissed) kinds.push('missed');
  if (stats.easiest) kinds.push('easiest');
  if (stats.lastMinuteHero) kinds.push('late');
  return kinds;
}

function statCard(kind: StatMomentKind, at: number, stats: SeasonStatFacts): FeedItem | null {
  if (kind === 'draws' && stats.drawPct != null) {
    return card({
      id: 'stat:draws',
      sortAt: at,
      kind: 'league-event',
      eyebrow: 'Draws this season',
      title: 'Draws this season',
      body: pickCopy(drawsCopy(stats.drawPct), 'stat:draws').line,
      link: null,
    });
  }
  if (kind === 'away' && stats.awayPct != null) {
    return card({
      id: 'stat:away',
      sortAt: at,
      kind: 'league-event',
      eyebrow: 'Away wins this season',
      title: 'Away wins this season',
      body: pickCopy(awayWinsCopy(stats.awayPct), 'stat:away').line,
      link: null,
    });
  }
  if (kind === 'missed' && stats.mostMissed) {
    return card({
      id: 'stat:missed',
      sortAt: at,
      kind: 'league-event',
      eyebrow: 'Most missed',
      title: 'Most missed',
      body: pickCopy(mostMissedCopy(stats.mostMissed.name, stats.mostMissed.pct), 'stat:missed').line,
      link: null,
    });
  }
  if (kind === 'easiest' && stats.easiest) {
    return card({
      id: 'stat:easiest',
      sortAt: at,
      kind: 'league-event',
      eyebrow: 'Easiest team',
      title: 'Easiest team',
      body: pickCopy(easiestTeamCopy(stats.easiest.name, stats.easiest.pct), 'stat:easiest').line,
      link: null,
    });
  }
  if (kind === 'late' && stats.lastMinuteHero) {
    return card({
      id: 'stat:late',
      sortAt: at,
      kind: 'league-event',
      eyebrow: 'Last minute heroes',
      title: 'Last minute heroes',
      body: pickCopy(lastMinuteCopy(stats.lastMinuteHero.name), 'stat:late').line,
      link: null,
    });
  }
  return null;
}

export function statMomentItems(input: {
  seasonStats?: SeasonStatFacts | null;
  lastFtMs: number | null;
  deadlineMs: number | null;
  gwOpenMs?: number | null;
  nextHereWeGoMs?: number | null;
  reservedMs?: number[];
  busy?: BusyInterval[];
  nowMs: number;
}): FeedItem[] {
  const stats = input.seasonStats;
  if (!stats || stats.sampleSize <= 0) return [];
  const scheduled = scheduleStatMoments({
    nowMs: input.nowMs,
    gwOpenMs: input.gwOpenMs ?? null,
    deadlineMs: input.deadlineMs,
    lastFtMs: input.lastFtMs,
    nextHereWeGoMs: input.nextHereWeGoMs ?? null,
    reservedMs: input.reservedMs,
    busy: input.busy,
    available: availableStatKinds(stats),
  });
  return scheduled.flatMap((slot) => {
    const item = statCard(slot.kind, slot.at, stats);
    return item ? [item] : [];
  });
}

export function adminFeedItems(posts: AdminFeedPost[], nowMs: number): FeedItem[] {
  return posts
    .filter((post) => post.publishedAtMs <= nowMs)
    .map((post) =>
      card({
        id: `admin:${post.id}`,
        sortAt: post.publishedAtMs,
        kind: 'shout',
        eyebrow: 'TotL',
        title: 'TotL',
        body: post.body,
        stamp: formatLocalStamp(post.publishedAtMs),
        personal: post.title,
        link: null,
      })
    );
}

export function buildDerivedFeed(input: DerivedFeedInput): FeedItem[] {
  const items: FeedItem[] = [];
  const first = firstKickoffMs(input.fixtures);
  const published = input.publishedFixtures?.length ? input.publishedFixtures : input.fixtures;
  const publishedGw = published[0]?.gw ?? input.gw;
  const lastFt = lastFinishedMs(input);
  const fixtureSortAt = input.publishedFixtures?.length && lastFt != null && published !== input.fixtures ? lastFt + 90_000 : undefined;
  const fixtureCard = fixtureListItem({ gw: publishedGw, fixtures: published, nowMs: input.nowMs, sortAt: fixtureSortAt });
  if (fixtureCard) items.push(fixtureCard);

  items.push(
    ...everyonePredictedItems({
      tables: input.tables,
      leagues: input.leagues,
      deadlineMs: input.deadlineMs,
      firstKickoffMs: first,
      nowMs: input.nowMs,
    }),
    ...playerJoinedItems({
      joins: input.joins,
      userId: input.userId,
      gwOpenMs: input.gwOpenMs,
      nowMs: input.nowMs,
    })
  );

  const nextHereWeGo = input.nextHereWeGoMs ?? hereWeGoMs(firstKickoffMs(input.publishedFixtures ?? []));
  const kickoffs = input.fixtures
    .map((fixture) => (fixture.kickoff_time ? Date.parse(fixture.kickoff_time) : Number.NaN))
    .filter((ms) => Number.isFinite(ms));
  const winnerSlots =
    input.allFinished && lastFt != null
      ? scheduleWinnerShouts({
          lastFtMs: lastFt,
          nowMs: input.nowMs,
          nextHereWeGoMs: nextHereWeGo,
          monthClosed: input.monthEndGw != null && input.gw >= input.monthEndGw,
          seasonClosed: input.gw >= SEASON_LAST_GW,
          weekendGw: isWeekendGameweek(kickoffs),
        })
      : [];

  if (input.allFinished && lastFt != null) {
    const sheet = scoreSheetItem({
      gw: input.gw,
      fixtures: input.fixtures,
      picks: input.picks,
      liveByFixtureIndex: input.liveByFixtureIndex,
      liveByApiMatchId: input.liveByApiMatchId,
      lastFtMs: lastFt,
    });
    if (sheet) items.push(sheet);
    items.push(
      ...winnerShoutItems({
        lastFtMs: lastFt,
        nowMs: input.nowMs,
        nextHereWeGoMs: nextHereWeGo,
        monthClosed: input.monthEndGw != null && input.gw >= input.monthEndGw,
        seasonClosed: input.gw >= SEASON_LAST_GW,
        weekendGw: isWeekendGameweek(kickoffs),
        liveTable: input.liveTable,
        monthBefore: input.monthBefore,
        seasonBefore: input.seasonBefore,
        people: input.people,
      })
    );
  } else {
    const luck = goodLuckItem(input);
    if (luck) items.push(luck);
  }

  items.push(
    ...playersStackItems({
      nowMs: input.nowMs,
      userId: input.userId,
      scores: input.playersScores,
      people: input.people,
    }),
    ...statMomentItems({
      seasonStats: input.seasonStats,
      lastFtMs: lastFt,
      deadlineMs: input.deadlineMs,
      gwOpenMs: first != null ? first - 7 * 24 * 3_600_000 : input.deadlineMs != null ? input.deadlineMs - 6 * 24 * 3_600_000 : input.gwOpenMs,
      nextHereWeGoMs: nextHereWeGo != null && nextHereWeGo > (lastFt ?? input.nowMs) ? nextHereWeGo : null,
      reservedMs: winnerSlots.map((slot) => slot.at),
      busy: matchBusyIntervals(input.fixtures, input.liveByFixtureIndex, input.liveByApiMatchId),
      nowMs: input.nowMs,
    }),
    ...adminFeedItems(input.adminPosts ?? [], input.nowMs)
  );
  return items;
}

/** Keep formatLocalStamp local if feed doesn't export it. */
function formatLocalStamp(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
