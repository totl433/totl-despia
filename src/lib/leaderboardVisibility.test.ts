import { describe, expect, it } from 'vitest';

import {
  filterHiddenLeaderboardRows,
  isHiddenFromLeaderboards,
} from './leaderboardVisibility';

const HOME_WINS = '41f23cc8-427c-40d4-a8b5-2527a63f39c5';
const JOF = '4542c037-5b38-40d0-b189-847b8f17c222';
const BBBJOF = '8ca79657-979e-48b7-9d7b-88d086250564';
const SOTBJOF_BRANDNEW = 'c483e6d2-2c2b-4134-8eba-bdde4605297d';
const DAVID_BIRD = 'd2cbeca9-7dae-4be1-88fb-706911d67256';

describe('leaderboard visibility', () => {
  it('hides the GW1 "User" test accounts and keeps HomeWins / Jof visible', () => {
    expect(isHiddenFromLeaderboards(BBBJOF)).toBe(true);
    expect(isHiddenFromLeaderboards(SOTBJOF_BRANDNEW)).toBe(true);
    expect(isHiddenFromLeaderboards(HOME_WINS)).toBe(false);
    expect(isHiddenFromLeaderboards(JOF)).toBe(false);
  });

  it('drops hidden rows from a live GW table', () => {
    const rows = [
      { user_id: DAVID_BIRD, points: 7 },
      { user_id: HOME_WINS, points: 7 },
      { user_id: BBBJOF, points: 7 },
      { user_id: SOTBJOF_BRANDNEW, points: 7 },
    ];
    expect(filterHiddenLeaderboardRows(rows).map((row) => row.user_id)).toEqual([
      DAVID_BIRD,
      HOME_WINS,
    ]);
  });
});
