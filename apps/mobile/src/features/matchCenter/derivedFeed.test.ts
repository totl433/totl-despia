import type { Fixture, LiveScore } from '@totl/domain';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/leagueAvatars', () => ({ resolveLeagueAvatarUri: () => null }));
vi.mock('../../lib/retroPlayers/scores', () => ({
  scoreForDay: (store: Record<string, { correct: number }>, day: string) => store[day]?.correct ?? null,
  scoreForWeek: () => null,
  scoreForMonth: () => null,
}));

import {
  adminFeedItems,
  everyonePredictedItems,
  fixtureListItem,
  seasonOf,
  goodLuckItem,
  joinNames,
  lastFinishedMs,
  playerJoinedItems,
  playersStackItems,
  scoreSheetItem,
  statMomentItems,
  toPeopleMap,
  topByScore,
} from './derivedFeed';
import { firstWinnerSlot, leftoverQuietSlots, nextWinnerSlot, scheduleStatMoments, scheduleWinnerShouts } from './shoutOutSlots';

const KO = Date.parse('2026-10-24T14:00:00Z');

const arsenal: Fixture = {
  id: 'f1',
  gw: 8,
  fixture_index: 0,
  kickoff_time: '2026-10-24T14:00:00Z',
  home_name: 'Arsenal',
  away_name: 'Coventry',
  home_code: 'ARS',
  away_code: 'COV',
};

const chelsea: Fixture = {
  id: 'f2',
  gw: 8,
  fixture_index: 1,
  kickoff_time: '2026-10-24T15:00:00Z',
  home_name: 'Chelsea',
  away_name: 'Brighton',
  home_code: 'CHE',
  away_code: 'BHA',
};

describe('fixture list', () => {
  it('shows the first four fixtures and a leftover count', () => {
    const extras = [2, 3, 4, 5].map((index) => ({ ...chelsea, id: `f${index}`, fixture_index: index, kickoff_time: `2026-10-24T1${index}:00:00Z` }));
    const card = fixtureListItem({ gw: 8, fixtures: [arsenal, chelsea, ...extras], nowMs: KO - 2 * 24 * 3_600_000 });
    expect(card?.kind).toBe('fixtures');
    expect(card?.title).toBe('Gameweek 8 fixtures');
    expect(card?.fixtureLines?.some((line) => line.includes('Arsenal'))).toBe(true);
    expect(card?.fixtureLines?.at(-1)).toBe('+2 more');
    // Every game, in kick-off order, for the club-pill rows.
    expect(card?.fixtureRows).toHaveLength(2 + extras.length);
    expect(card?.fixtureRows?.every((row) => typeof row.kickoff === 'string')).toBe(true);
    expect(card?.season).toMatch(/^\d{4}\/\d{2}$/);
  });
});

describe('score sheet', () => {
  it('marks each Prediction against the finished result', () => {
    const live = new Map<number, LiveScore>([
      [0, { api_match_id: 1, gw: 8, fixture_index: 0, status: 'FINISHED', home_score: 2, away_score: 0, updated_at: '2026-10-24T16:00:00Z' }],
      [1, { api_match_id: 2, gw: 8, fixture_index: 1, status: 'FINISHED', home_score: 1, away_score: 1, updated_at: '2026-10-24T17:00:00Z' }],
    ]);
    const card = scoreSheetItem({
      gw: 8,
      fixtures: [arsenal, chelsea],
      picks: { '0': 'H', '1': 'A' },
      liveByFixtureIndex: live,
      lastFtMs: KO + 3 * 3_600_000,
    });
    expect(card?.kind).toBe('score-sheet');
    expect(card?.scoreRows).toEqual([
      expect.objectContaining({ home: 'Arsenal', pick: 'Arsenal', result: 'Arsenal', hit: true }),
      expect.objectContaining({ home: 'Chelsea', pick: 'Brighton', result: 'Draw', hit: false }),
    ]);
  });
});

describe('good luck', () => {
  it('names up to five players on nine with one fixture left', () => {
    const live = new Map<number, LiveScore>([
      [0, { api_match_id: 1, gw: 8, fixture_index: 0, status: 'FINISHED', home_score: 1, away_score: 0 }],
    ]);
    const card = goodLuckItem({
      fixtures: [arsenal, chelsea],
      liveByFixtureIndex: live,
      liveTable: [
        { user_id: 'c', name: 'Carl', score: 9 },
        { user_id: 'j', name: 'Joff', score: 9 },
      ],
      people: new Map(),
    });
    expect(card?.title).toBe('Good luck');
    expect(card?.body).toContain('Carl and Joff');
    expect(card?.body).toMatch(/nine|ten/);
  });
});

describe('people lookup', () => {
  it('rebuilds a Map after React Query persist turns it into a plain object', () => {
    const map = toPeopleMap({ carl: { id: 'carl', name: 'Carl', avatarUrl: null } });
    expect(map.get('carl')?.name).toBe('Carl');
  });

  it('does not crash Players cards when people is a plain object', () => {
    expect(() =>
      playersStackItems({
        nowMs: Date.parse('2026-10-24T18:00:00Z'),
        userId: 'me',
        scores: { carl: { '2026-10-23': { correct: 8 } } } as any,
        people: { carl: { id: 'carl', name: 'Carl', avatarUrl: null } },
      })
    ).not.toThrow();
  });
});

describe('mini league events', () => {
  it('posts when every member has predicted, before the deadline', () => {
    const items = everyonePredictedItems({
      tables: [{ id: 'lg', name: 'Easy League', rows: [{ user_id: 'a', name: 'A', score: 0 }, { user_id: 'b', name: 'B', score: 0 }], submittedUserIds: ['a', 'b'] }],
      leagues: [],
      deadlineMs: KO,
      firstKickoffMs: KO + 75 * 60_000,
      nowMs: KO - 3_600_000,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.body).toMatch(/Predictions|predicted/i);
  });

  it('shows a join to other members in this gameweek window', () => {
    const items = playerJoinedItems({
      joins: [{ leagueId: 'lg', leagueName: 'Easy League', leagueAvatar: null, userId: 'sam', name: 'Sam', avatarUrl: null, joinedAtMs: KO - 60_000 }],
      userId: 'me',
      gwOpenMs: KO - 2 * 3_600_000,
      nowMs: KO,
    });
    expect(items[0]?.body).toMatch(/Sam.*Easy League/);
  });
});

describe('season stat cards', () => {
  const seasonStats = {
    drawPct: 29,
    awayPct: 31,
    sampleSize: 72,
    mostMissed: { name: 'Sunderland', code: 'SUN', pct: 22, games: 8 },
    easiest: { name: 'Man City', code: 'MCI', pct: 71, games: 8 },
    lastMinuteHero: { name: 'Liverpool', code: 'LIV', count: 4 },
  };
  const gwOpen = Date.parse('2026-10-19T10:00:00');
  const deadline = Date.parse('2026-10-24T12:45:00');

  it('quotes season facts, never the current gameweek', () => {
    const items = statMomentItems({
      seasonStats,
      lastFtMs: null,
      deadlineMs: deadline,
      gwOpenMs: gwOpen,
      nowMs: deadline - 3_600_000,
    });
    expect(items.find((item) => item.id === 'stat:draws')?.body).toMatch(/29 percent|this season/);
    expect(items.find((item) => item.id === 'stat:away')?.body).toMatch(/31 percent|away/);
    expect(items.find((item) => item.id === 'stat:missed')?.body).toContain('this season');
    expect(items.find((item) => item.id === 'stat:easiest')?.body).toContain('this season');
    expect(items.find((item) => item.id === 'stat:late')?.body).toMatch(/this season|90 plus|late/);
  });

  it('spreads open-week cards across leftover quiet slots', () => {
    const items = statMomentItems({
      seasonStats,
      lastFtMs: null,
      deadlineMs: deadline,
      gwOpenMs: gwOpen,
      nowMs: deadline - 3_600_000,
    });
    const times = items.map((item) => item.sortAt);
    expect(times).toHaveLength(5);
    expect(new Set(times).size).toBe(5);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(12 * 3_600_000);
    expect(items[0]?.id).toBe('stat:draws');
    expect(items[1]?.id).toBe('stat:away');
  });

  it('fills leftover mornings after full time, skipping winner days', () => {
    const lastFt = new Date(2026, 9, 24, 17, 0).getTime();
    const winnerAt = lastFt + 45 * 60_000;
    const items = statMomentItems({
      seasonStats,
      lastFtMs: lastFt,
      deadlineMs: lastFt - 2 * 24 * 3_600_000,
      reservedMs: [winnerAt],
      nowMs: lastFt + 6 * 24 * 3_600_000,
    });
    expect(items.map((item) => item.id).slice(0, 3)).toEqual(['stat:missed', 'stat:easiest', 'stat:late']);
    expect(items[0]?.sortAt).toBeGreaterThan(winnerAt);
    expect(items[0]?.body).toContain('Sunderland');
    expect(items[1]?.body).toContain('Man City');
    expect(items[2]?.body).toContain('Liverpool');
  });
});

describe('admin posts', () => {
  it('turns a published admin row into a TotL card', () => {
    const items = adminFeedItems([{ id: '1', title: 'Announcement', body: 'Football is crazy right now!', publishedAtMs: KO }], KO);
    expect(items[0]?.title).toBe('Announcement');
    expect(items[0]?.body).toBe('Football is crazy right now!');
  });
});

describe('shout-out slots', () => {
  it('posts the first winner 45 minutes after an afternoon full-time', () => {
    const lastFt = new Date(2026, 9, 24, 17, 0).getTime();
    expect(firstWinnerSlot(lastFt)).toBe(lastFt + 45 * 60_000);
    const next = nextWinnerSlot(lastFt + 45 * 60_000);
    expect(next).toBeGreaterThan(lastFt + 12 * 3_600_000);
  });

  it('queues gw then monthly then season before Here We Go', () => {
    const lastFt = new Date(2026, 9, 24, 17, 0).getTime();
    const slots = scheduleWinnerShouts({
      lastFtMs: lastFt,
      nowMs: lastFt + 3 * 24 * 3_600_000,
      nextHereWeGoMs: lastFt + 10 * 24 * 3_600_000,
      monthClosed: true,
      seasonClosed: true,
      weekendGw: true,
    });
    expect(slots.map((slot) => slot.kind).slice(0, 3)).toEqual(['gw', 'monthly', 'season']);
  });

  it('gives leftover quiet days to season stats', () => {
    const lastFt = new Date(2026, 9, 24, 17, 0).getTime();
    const winners = scheduleWinnerShouts({
      lastFtMs: lastFt,
      nowMs: lastFt + 6 * 24 * 3_600_000,
      nextHereWeGoMs: lastFt + 10 * 24 * 3_600_000,
      monthClosed: false,
      seasonClosed: false,
      weekendGw: true,
    });
    const leftover = leftoverQuietSlots({
      startMs: lastFt,
      hardStopMs: lastFt + 10 * 24 * 3_600_000,
      nowMs: lastFt + 6 * 24 * 3_600_000,
      firstSoon: true,
      reservedMs: winners.map((slot) => slot.at),
    });
    expect(leftover.length).toBeGreaterThanOrEqual(3);
    expect(leftover.every((at) => !winners.some((slot) => slot.at === at))).toBe(true);
    const stats = scheduleStatMoments({
      nowMs: lastFt + 6 * 24 * 3_600_000,
      gwOpenMs: null,
      deadlineMs: lastFt - 2 * 24 * 3_600_000,
      lastFtMs: lastFt,
      nextHereWeGoMs: lastFt + 10 * 24 * 3_600_000,
      reservedMs: winners.map((slot) => slot.at),
      available: ['missed', 'easiest', 'late', 'draws', 'away'],
    });
    expect(stats.map((slot) => slot.kind).slice(0, 3)).toEqual(['missed', 'easiest', 'late']);
    expect(stats[0]?.at).toBe(leftover[0]);
  });
});

describe('helpers', () => {
  it('joins names and picks tied winners', () => {
    expect(joinNames(['Carl', 'Joff', 'Tom'])).toBe('Carl, Joff, and Tom');
    expect(topByScore([{ user_id: 'b', name: 'Bea', score: 8 }, { user_id: 'a', name: 'Amy', score: 8 }, { user_id: 'c', name: 'Cal', score: 7 }], 2)).toEqual([
      { user_id: 'a', name: 'Amy', score: 8 },
      { user_id: 'b', name: 'Bea', score: 8 },
    ]);
  });

  it('needs every fixture finished before last full-time', () => {
    expect(
      lastFinishedMs({
        fixtures: [arsenal, chelsea],
        liveByFixtureIndex: new Map([[0, { api_match_id: 1, gw: 8, fixture_index: 0, status: 'FINISHED', updated_at: '2026-10-24T16:00:00Z' }]]),
      })
    ).toBeNull();
  });
});

describe('seasonOf', () => {
  it('starts a new season in August', () => {
    expect(seasonOf(Date.parse('2026-10-31T13:30:00Z'))).toBe('2026/27');
    expect(seasonOf(Date.parse('2027-05-23T15:00:00Z'))).toBe('2026/27');
    expect(seasonOf(Date.parse('2027-08-14T11:30:00Z'))).toBe('2027/28');
    expect(seasonOf(Date.parse('2099-09-01T12:00:00Z'))).toBe('2099/00');
  });
});
