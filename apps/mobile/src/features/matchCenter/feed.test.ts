import type { Fixture, LiveScore } from '@totl/domain';
import { describe, expect, it, vi } from 'vitest';

// League avatars load images through react-native, which vitest can't parse.
vi.mock('../../lib/leagueAvatars', () => ({ resolveLeagueAvatarUri: () => null }));

import { buildMatchFeed, fixtureEngagementId, fixtureIndexOfCard, fixtureSides, sideForGoal } from './feed';
import { mergeGameCentrePosts, type GameCentrePost } from './posts';

const KO = Date.parse('2026-10-19T19:00:00Z');

const spursCoventry: Fixture = {
  id: 'gw7-9',
  gw: 7,
  fixture_index: 9,
  kickoff_time: '2026-10-19T19:00:00Z',
  api_match_id: 560606,
  home_team: 'Tottenham Hotspur',
  away_team: 'Coventry City',
  home_name: 'Tottenham',
  away_name: 'Coventry',
  home_code: 'TOT',
  away_code: 'COV',
};

// The GW7 live row as stored when the screenshots were taken: the provider calls them "Spurs".
const atHalfTime: LiveScore = {
  api_match_id: 560606,
  gw: 7,
  fixture_index: 9,
  home_score: 1,
  away_score: 0,
  status: 'PAUSED',
  minute: 45,
  home_team: 'Spurs',
  away_team: 'Coventry City',
  kickoff_time: '2026-10-19T19:00:00+00:00',
  updated_at: '2026-10-19T19:50:07+00:00',
  goals: [{ team: 'Spurs', minute: 14, scorer: 'James Maddison', teamId: 73, scorerId: 3992, isOwnGoal: false }],
};

function feedFor(live: LiveScore, nowMs = KO + 52 * 60_000) {
  return buildMatchFeed({
    gw: 7,
    fixtures: [spursCoventry],
    liveByFixtureIndex: new Map([[9, live]]),
    picks: { '9': 'H' },
    nowMs,
  });
}

describe('goal side', () => {
  it('credits the provider short name to the right team', () => {
    expect(sideForGoal(spursCoventry, 'Spurs', atHalfTime)).toBe('H');
    expect(sideForGoal(spursCoventry, 'Spurs')).toBe('H');
    expect(sideForGoal(spursCoventry, 'Coventry City', atHalfTime)).toBe('A');
  });

  it('leaves a goal unassigned when the team is unknown', () => {
    expect(sideForGoal(spursCoventry, 'Arsenal', atHalfTime)).toBeNull();
  });
});

describe('Spurs v Coventry at half-time (screenshot regression)', () => {
  it('shows 1–0 on the half-time card, matching the goal card', () => {
    const feed = feedFor(atHalfTime);
    const goals = feed.filter((item) => item.kind === 'goal');
    const halfTime = feed.filter((item) => item.kind === 'half-time');
    expect(goals).toHaveLength(1);
    expect(halfTime).toHaveLength(1);
    expect(goals[0].match).toMatchObject({ homeScore: 1, awayScore: 0 });
    expect(halfTime[0].match).toMatchObject({ homeScore: 1, awayScore: 0 });
  });

  it('builds the same card ids on every rebuild', () => {
    const ids = (nowMs: number) => feedFor(atHalfTime, nowMs).map((item) => item.id);
    expect(ids(KO + 50 * 60_000)).toEqual(ids(KO + 60 * 60_000));
  });
});

describe('feed from stored posts', () => {
  const post = (id: string, kind: GameCentrePost['kind'], published: string, details: Record<string, unknown> = {}, extra: Partial<GameCentrePost> = {}): GameCentrePost => ({
    id: `mc:gw7:${id}`,
    gw: 7,
    api_match_id: kind === 'opener' ? null : 560606,
    fixture_index: kind === 'opener' ? null : 9,
    kind,
    status: 'active',
    details,
    occurred_minute: null,
    published_at: published,
    updated_at: published,
    revision: 1,
    ...extra,
  });
  const goal = post('goal:9:H1', 'goal', '2026-10-19T19:14:30Z', { side: 'H', n: 1, scorer: 'James Maddison', minute: 14, own_goal: false, score_after: { home: 1, away: 0 } });
  const posts = [
    post('ko:9', 'kickoff', '2026-10-19T19:00:40Z'),
    goal,
    post('ht:9', 'half-time', '2026-10-19T19:47:10Z', { score: { home: 1, away: 0 } }),
  ];
  const fromPosts = (list: GameCentrePost[], nowMs = KO + 52 * 60_000) =>
    buildMatchFeed({
      gw: 7,
      fixtures: [spursCoventry],
      liveByFixtureIndex: new Map([[9, atHalfTime]]),
      picks: { '9': 'H' },
      nowMs,
      posts: list,
    });

  it('uses each post as one card, keyed by its id', () => {
    const feed = fromPosts(posts);
    expect(feed.map((item) => item.id)).toEqual(['ko:9', 'goal:9:H1', 'ht:9']);
    expect(feed.find((item) => item.id === 'ht:9')?.match).toMatchObject({ homeScore: 1, awayScore: 0 });
  });

  it('puts the conversation starter on the kickoff card, pointing at comments', () => {
    const card = fromPosts(posts).find((item) => item.kind === 'kickoff');
    expect(["We're off", 'Kick-off']).toContain(card?.title);
    expect(card?.body).toMatch(/comment/i);
  });

  it('orders by first publish time, whatever the clock says', () => {
    const early = fromPosts(posts, KO + 50 * 60_000).map((item) => [item.id, item.sortAt]);
    const later = fromPosts(posts, KO + 90 * 60_000).map((item) => [item.id, item.sortAt]);
    expect(early).toEqual(later);
    expect(early[1]).toEqual(['goal:9:H1', Date.parse('2026-10-19T19:14:30Z')]);
  });

  it('shows a correction on the same card in the same place', () => {
    const corrected = { ...goal, revision: 2, details: { ...goal.details, scorer: 'Dominic Solanke' } };
    const feed = fromPosts([posts[0] as GameCentrePost, corrected, posts[2] as GameCentrePost]);
    const card = feed.find((item) => item.id === 'goal:9:H1');
    expect(card).toMatchObject({ kind: 'goal', sortAt: Date.parse('2026-10-19T19:14:30Z'), body: 'Dominic Solanke Scores!!! ⚽' });
  });

  it('turns a ruled-out goal into a VAR card without a new id', () => {
    const feed = fromPosts([{ ...goal, status: 'ruled_out', revision: 2 }]);
    expect(feed.map((item) => [item.id, item.kind])).toEqual([['goal:9:H1', 'ruled-out']]);
  });

  it('skips voided posts', () => {
    expect(fromPosts([{ ...goal, status: 'void' }])).toEqual([]);
  });

  it('shows the second-half card as the half began, even after full-time', () => {
    const finished: LiveScore = {
      ...atHalfTime,
      home_score: 3,
      away_score: 1,
      status: 'FINISHED',
      minute: 90,
      goals: [
        ...(atHalfTime.goals as unknown[]),
        { team: 'Coventry City', minute: 49, scorer: 'Haji Wright' },
        { team: 'Spurs', minute: 58, scorer: 'Omar Marmoush' },
        { team: 'Spurs', minute: 90, scorer: 'Micky van de Ven' },
      ],
    };
    const feed = buildMatchFeed({
      gw: 7,
      fixtures: [spursCoventry],
      liveByFixtureIndex: new Map([[9, finished]]),
      picks: { '9': 'H' },
      nowMs: KO + 3 * 3_600_000,
      posts: [...posts, post('sh:9', 'second-half', '2026-10-19T20:02:00Z')],
    });
    const secondHalf = feed.find((item) => item.id === 'sh:9');
    expect(secondHalf?.match).toMatchObject({ homeScore: 1, awayScore: 0, finished: false });
    expect(secondHalf?.match?.awayScorers ?? []).toEqual([]);
    // A goal card is a moment in play too: its chip isn't a final result.
    expect(feed.find((item) => item.id === 'goal:9:H1')?.match).toMatchObject({ homeScore: 1, awayScore: 0, finished: false });
  });

  it('puts the day wrap-up after the real final whistle, not a guessed one', () => {
    const finished: LiveScore = { ...atHalfTime, home_score: 3, away_score: 1, status: 'FINISHED', minute: 90 };
    const build = (list: GameCentrePost[]) =>
      buildMatchFeed({
        gw: 7,
        fixtures: [spursCoventry],
        liveByFixtureIndex: new Map([[9, finished]]),
        picks: { '9': 'H' },
        nowMs: KO + 3 * 3_600_000,
        posts: list,
      });
    const withWhistle = build([...posts, post('ft:9', 'full-time', '2026-10-19T20:52:00Z', { score: { home: 3, away: 1 } })]);
    const ftAt = withWhistle.find((item) => item.id === 'ft:9')?.sortAt ?? 0;
    const day = withWhistle.find((item) => item.id.startsWith('day:'));
    expect(day?.sortAt).toBe(ftAt + 60_000);
    expect(withWhistle.indexOf(day as never)).toBeGreaterThan(withWhistle.findIndex((item) => item.id === 'ft:9'));
    // No full-time card yet: kickoff + 100 minutes, as before.
    expect(build(posts).find((item) => item.id.startsWith('day:'))?.sortAt).toBe(KO + 101 * 60_000);
  });
});

describe('merging posts', () => {
  const base = { gw: 7, api_match_id: 1, fixture_index: 9, kind: 'goal' as const, status: 'active' as const, details: {}, occurred_minute: 14, published_at: 'x', updated_at: 'x' };
  it('keeps one copy per id and the newer revision', () => {
    const v1 = { ...base, id: 'a', revision: 1 };
    const v2 = { ...base, id: 'a', revision: 2, status: 'ruled_out' as const };
    const merged = mergeGameCentrePosts([v1], [v2, v1, v1]);
    expect(merged).toEqual([v2]);
  });

  it('returns the same array when nothing changed, so cards do not redraw', () => {
    const current = [{ ...base, id: 'a', revision: 1 }];
    expect(mergeGameCentrePosts(current, [{ ...base, id: 'a', revision: 1 }])).toBe(current);
  });
});

describe('leftover last-season GW8 live scores', () => {
  const forest: Fixture = {
    id: 'gw8-0',
    gw: 8,
    fixture_index: 0,
    kickoff_time: '2026-10-23T19:00:00Z',
    api_match_id: 560620,
    home_name: 'Ipswich',
    away_name: 'Forest',
    home_code: 'IPS',
    away_code: 'NFO',
  };
  const liverpool: Fixture = {
    id: 'gw8-5',
    gw: 8,
    fixture_index: 5,
    kickoff_time: '2026-10-25T14:00:00Z',
    api_match_id: 560630,
    home_name: 'Liverpool',
    away_name: 'Brighton',
    home_code: 'LIV',
    away_code: 'BHA',
  };
  const leftoverXi: LiveScore = {
    api_match_id: 499000,
    gw: 8,
    fixture_index: 0,
    home_score: 0,
    away_score: 0,
    status: 'TIMED',
    home_team: 'Old Home',
    away_team: 'Old Away',
    kickoff_time: '2025-10-18T12:30:00Z',
    lineups: {
      home: { players: Array.from({ length: 11 }, (_, i) => ({ name: `Home ${i}` })) },
      away: { players: Array.from({ length: 11 }, (_, i) => ({ name: `Away ${i}` })) },
    },
  };
  const leftoverFt: LiveScore = {
    api_match_id: 499001,
    gw: 8,
    fixture_index: 5,
    home_score: 2,
    away_score: 0,
    status: 'FINISHED',
    minute: 90,
    home_team: 'Old Home',
    away_team: 'Old Away',
    kickoff_time: '2025-10-18T15:00:00Z',
    goals: [{ team: 'Old Home', minute: 12, scorer: 'Someone' }],
    lineups: {
      home: { players: Array.from({ length: 11 }, (_, i) => ({ name: `Home ${i}` })) },
      away: { players: Array.from({ length: 11 }, (_, i) => ({ name: `Away ${i}` })) },
    },
  };
  const leftoverByIndex = new Map([
    [0, leftoverXi],
    [5, leftoverFt],
  ]);
  const leftoverByApi = new Map([
    [leftoverXi.api_match_id, leftoverXi],
    [leftoverFt.api_match_id, leftoverFt],
  ]);

  it('stays on the waiting card at the 75-minute open if only last season’s XIs are on gw=8', () => {
    const feed = buildMatchFeed({
      gw: 8,
      fixtures: [forest, liverpool],
      liveByFixtureIndex: leftoverByIndex,
      liveByApiMatchId: leftoverByApi,
      picks: { '0': 'A', '5': 'H' },
      nowMs: Date.parse('2026-10-23T17:50:00Z'),
    });
    expect(feed.map((item) => item.kind)).toEqual(['waiting']);
    expect(feed.some((item) => item.kind === 'full-time' || item.kind === 'goal' || item.kind === 'lineup')).toBe(false);
  });

  it('does not paint last season’s 2–0 onto this week’s Liverpool card', () => {
    const feed = buildMatchFeed({
      gw: 8,
      fixtures: [forest, liverpool],
      liveByFixtureIndex: leftoverByIndex,
      liveByApiMatchId: leftoverByApi,
      picks: { '0': 'A', '5': 'H' },
      nowMs: Date.parse('2026-10-25T16:00:00Z'),
    });
    expect(feed.filter((item) => item.kind === 'full-time' || item.kind === 'goal')).toEqual([]);
    expect(feed.some((item) => item.body.includes('Someone'))).toBe(false);
  });
});

describe('fixture threads', () => {
  it('finds the fixture in every match card id, old and new', () => {
    expect(['xi:9', 'xi-sheet:9', 'ko:9', 'goal:9:H1', 'goal:9:14:0', 'score:9:1-0', 'ht:9', 'sh:9', 'ft:9'].map(fixtureIndexOfCard)).toEqual(
      Array(9).fill(9)
    );
    expect(fixtureIndexOfCard('gw-open:7')).toBeNull();
    expect(fixtureIndexOfCard('ft:12')).toBe(12);
  });

  it('puts all of a match’s cards on one thread and keeps other cards on their own', () => {
    expect(fixtureEngagementId(7, 'goal:9:H1')).toBe('mc:gw7:fixture:9');
    expect(fixtureEngagementId(7, 'ft:9')).toBe('mc:gw7:fixture:9');
    expect(fixtureEngagementId(7, 'ft:10')).toBe('mc:gw7:fixture:10');
    expect(fixtureEngagementId(7, 'gw-open:7')).toBe('mc:gw7:gw-open:7');
  });

  it('names both clubs for the thread header', () => {
    const sides = fixtureSides({
      id: 'f',
      gw: 8,
      fixture_index: 0,
      home_name: 'Manchester United FC',
      away_name: 'Chelsea FC',
      home_code: 'MUN',
      away_code: 'CHE',
    } as Fixture);
    expect(sides.home.code).toBe('MUN');
    expect(sides.away.code).toBe('CHE');
    expect(sides.home.name).not.toMatch(/FC$/);
  });
});

describe('mini-league snapshots', () => {
  it('puts league ids and board tabs on each row', () => {
    const me = 'user-me';
    const them = 'user-them';
    const finished: LiveScore = { ...atHalfTime, status: 'FINISHED', home_score: 2, away_score: 0, minute: 90 };
    const feed = buildMatchFeed({
      gw: 7,
      fixtures: [spursCoventry],
      liveByFixtureIndex: new Map([[9, finished]]),
      picks: { '9': 'H' },
      nowMs: KO + 110 * 60_000,
      userId: me,
      leagues: [
        {
          id: 'league-easy',
          name: 'Easy League',
          members: [
            { userId: me, name: 'Me', picks: { 9: 'H' } },
            { userId: them, name: 'Them', picks: { 9: 'A' } },
          ],
        },
      ],
      overall: {
        beforeGw: { [me]: 10, [them]: 10 },
        monthBefore: { [me]: 3, [them]: 3 },
        monthLabel: 'Oct',
        picks: { [me]: { 9: 'H' }, [them]: { 9: 'A' } },
      },
    });
    const rank = feed.filter((item) => item.kind === 'rank');
    expect(rank.length).toBeGreaterThan(0);
    expect(rank[0].standings?.[0]).toMatchObject({ name: 'Easy League', leagueId: 'league-easy' });
    expect(rank[0].boards?.map((board) => board.tab)).toEqual(['gw', 'monthly', 'overall']);
  });
});
