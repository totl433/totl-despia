import type { Fixture, LiveScore } from '@totl/domain';
import { describe, expect, it, vi } from 'vitest';

// League avatars load images through react-native, which vitest can't parse.
vi.mock('../../lib/leagueAvatars', () => ({ resolveLeagueAvatarUri: () => null }));

import { buildMatchFeed, sideForGoal } from './feed';

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
