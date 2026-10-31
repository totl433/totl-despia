import type { Fixture, LiveScore } from '@totl/domain';
import { describe, expect, it } from 'vitest';

import { indexLiveScoresByFixture, isStaleLiveRow, liveScoreBelongsToFixture, resolveLiveScore } from './liveScoreRows';

const row = (updated_at: string | null, home_score: number): LiveScore => ({
  api_match_id: 560606,
  gw: 7,
  home_score,
  away_score: 0,
  updated_at,
});

describe('stale live rows', () => {
  it('drops an older response that would undo a goal', () => {
    const newer = row('2026-10-19T19:15:00Z', 1);
    const older = row('2026-10-19T19:13:00Z', 0);
    expect(isStaleLiveRow(newer, older)).toBe(true);
  });

  it('accepts newer and same-time rows', () => {
    const current = row('2026-10-19T19:15:00Z', 1);
    expect(isStaleLiveRow(current, row('2026-10-19T19:16:00Z', 1))).toBe(false);
    expect(isStaleLiveRow(current, row('2026-10-19T19:15:00Z', 1))).toBe(false);
  });

  it('never drops a row when either timestamp is missing', () => {
    expect(isStaleLiveRow(undefined, row('2026-10-19T19:15:00Z', 1))).toBe(false);
    expect(isStaleLiveRow(row(null, 1), row('2026-10-19T19:13:00Z', 0))).toBe(false);
    expect(isStaleLiveRow(row('2026-10-19T19:15:00Z', 1), row(null, 0))).toBe(false);
  });
});

describe('leftover live scores from last season', () => {
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
  const leftover: LiveScore = {
    api_match_id: 499001,
    gw: 8,
    fixture_index: 5,
    home_score: 2,
    away_score: 0,
    status: 'FINISHED',
    home_team: 'Not last season',
    away_team: 'Either',
    kickoff_time: '2025-10-18T15:00:00Z',
    lineups: { home: [], away: [] },
  };
  const thisWeek: LiveScore = {
    api_match_id: 560630,
    gw: 8,
    fixture_index: 5,
    home_score: 0,
    away_score: 0,
    status: 'TIMED',
    kickoff_time: '2026-10-25T14:00:00Z',
  };

  it('rejects last season’s row at the same fixture index', () => {
    expect(liveScoreBelongsToFixture(liverpool, leftover)).toBe(false);
    expect(liveScoreBelongsToFixture(liverpool, thisWeek)).toBe(true);
  });

  it('does not resolve a leftover finished game onto this week’s fixture', () => {
    const byIndex = new Map([[5, leftover]]);
    const byApi = new Map([[leftover.api_match_id, leftover]]);
    expect(resolveLiveScore(liverpool, byIndex, byApi)).toBeUndefined();
    expect(resolveLiveScore(liverpool, byIndex)).toBeUndefined();
  });

  it('indexes only the row whose match id is this week’s', () => {
    const map = indexLiveScoresByFixture([liverpool], [leftover, thisWeek]);
    expect(map.get(5)?.api_match_id).toBe(560630);
    expect(map.get(5)?.status).toBe('TIMED');
  });
});
