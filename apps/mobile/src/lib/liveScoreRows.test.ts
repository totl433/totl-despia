import type { LiveScore } from '@totl/domain';
import { describe, expect, it } from 'vitest';

import { isStaleLiveRow } from './liveScoreRows';

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
