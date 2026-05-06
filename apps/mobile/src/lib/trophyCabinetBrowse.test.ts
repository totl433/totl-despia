import { describe, expect, it } from 'vitest';

import { computeMonthlyWinnerEndGwsDescending } from './trophyCabinetBrowse';

describe('computeMonthlyWinnerEndGwsDescending', () => {
  const uid = 'AAAA1111-2222-3333-4444-555555555555';
  const other = 'BBBB1111-2222-3333-4444-555555555555';

  it('includes month-end GW when user leads that calendar month and lc >= endGw', () => {
    const rows = [
      { user_id: uid, gw: 1, points: 10 },
      { user_id: other, gw: 1, points: 8 },
      { user_id: uid, gw: 2, points: 9 },
      { user_id: other, gw: 2, points: 11 },
      { user_id: uid, gw: 3, points: 12 },
      { user_id: other, gw: 3, points: 10 },
    ];
    const wins = computeMonthlyWinnerEndGwsDescending({
      gwPointsRows: rows,
      userId: uid.toUpperCase(),
      lastCompletedGw: 3,
    });
    expect(wins).toEqual([3]);
  });

  it('excludes months not yet completed (lc < endGw)', () => {
    const rows = [
      { user_id: uid, gw: 1, points: 50 },
      { user_id: other, gw: 1, points: 1 },
    ];
    const wins = computeMonthlyWinnerEndGwsDescending({
      gwPointsRows: rows,
      userId: uid,
      lastCompletedGw: 2,
    });
    expect(wins).not.toContain(3);
  });

  it('sorts multiple wins newest month first (by endGw descending)', () => {
    const rows = [
      // Aug GWs 1–3: user wins
      { user_id: uid, gw: 1, points: 30 },
      { user_id: other, gw: 1, points: 10 },
      { user_id: uid, gw: 2, points: 30 },
      { user_id: other, gw: 2, points: 10 },
      { user_id: uid, gw: 3, points: 30 },
      { user_id: other, gw: 3, points: 10 },
      // Sep GWs 4–7: user wins
      { user_id: uid, gw: 4, points: 40 },
      { user_id: other, gw: 4, points: 10 },
      { user_id: uid, gw: 5, points: 40 },
      { user_id: other, gw: 5, points: 10 },
      { user_id: uid, gw: 6, points: 40 },
      { user_id: other, gw: 6, points: 10 },
      { user_id: uid, gw: 7, points: 40 },
      { user_id: other, gw: 7, points: 10 },
    ];
    const wins = computeMonthlyWinnerEndGwsDescending({
      gwPointsRows: rows,
      userId: uid,
      lastCompletedGw: 7,
    });
    expect(wins).toEqual([7, 3]);
  });

  it('treats joint leaders as winners', () => {
    const rows = [
      { user_id: uid, gw: 1, points: 10 },
      { user_id: other, gw: 1, points: 10 },
      { user_id: uid, gw: 2, points: 10 },
      { user_id: other, gw: 2, points: 10 },
      { user_id: uid, gw: 3, points: 10 },
      { user_id: other, gw: 3, points: 10 },
    ];
    const wins = computeMonthlyWinnerEndGwsDescending({
      gwPointsRows: rows,
      userId: uid,
      lastCompletedGw: 3,
    });
    expect(wins).toEqual([3]);
  });

  it('skips months the user did not play any GW of', () => {
    const rows = [{ user_id: other, gw: 1, points: 10 }];
    const wins = computeMonthlyWinnerEndGwsDescending({
      gwPointsRows: rows,
      userId: uid,
      lastCompletedGw: 3,
    });
    expect(wins).toEqual([]);
  });
});
