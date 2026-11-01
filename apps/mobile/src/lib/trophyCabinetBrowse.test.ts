import { describe, expect, it } from 'vitest';

import {
  buildPersonalWinnerPayloadFromGwPoints,
  computeMonthlyWinnerEndGwsDescending,
} from './trophyCabinetBrowse';

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

  it('uses 2026/27 August (GW1–2), not last season’s GW1–3', () => {
    const rows = [
      { user_id: uid, gw: 1, points: 10 },
      { user_id: other, gw: 1, points: 8 },
      { user_id: uid, gw: 2, points: 10 },
      { user_id: other, gw: 2, points: 8 },
    ];
    expect(
      computeMonthlyWinnerEndGwsDescending({
        gwPointsRows: rows,
        userId: uid,
        lastCompletedGw: 2,
        seasonKey: '2026/27',
      })
    ).toEqual([2]);
    expect(
      computeMonthlyWinnerEndGwsDescending({
        gwPointsRows: rows,
        userId: uid,
        lastCompletedGw: 2,
        seasonKey: '2025/26',
      })
    ).toEqual([]);
  });
});

describe('buildPersonalWinnerPayloadFromGwPoints', () => {
  const uid = 'AAAA1111-2222-3333-4444-555555555555';
  const other = 'BBBB1111-2222-3333-4444-555555555555';

  it('builds a gameweek winner payload from stacked GW points', () => {
    const payload = buildPersonalWinnerPayloadFromGwPoints({
      gwPointsRows: [
        { user_id: uid, gw: 8, points: 18 },
        { user_id: other, gw: 8, points: 14 },
        { user_id: uid, gw: 7, points: 4 },
      ],
      userId: uid.toUpperCase(),
      gw: 8,
      victoryType: 'gameweek',
    });
    expect(payload).toEqual({
      gw: 8,
      victoryType: 'gameweek',
      label: 'Gameweek 8',
      points: 18,
      winnerCount: 1,
      joint: false,
    });
  });

  it('marks joint gameweek wins', () => {
    const payload = buildPersonalWinnerPayloadFromGwPoints({
      gwPointsRows: [
        { user_id: uid, gw: 4, points: 12 },
        { user_id: other, gw: 4, points: 12 },
      ],
      userId: uid,
      gw: 4,
      victoryType: 'gameweek',
    });
    expect(payload?.joint).toBe(true);
    expect(payload?.winnerCount).toBe(2);
    expect(payload?.points).toBe(12);
  });

  it('builds a monthly winner payload from the month label and totals', () => {
    const payload = buildPersonalWinnerPayloadFromGwPoints({
      gwPointsRows: [
        { user_id: uid, gw: 1, points: 10 },
        { user_id: other, gw: 1, points: 8 },
        { user_id: uid, gw: 2, points: 9 },
        { user_id: other, gw: 2, points: 11 },
        { user_id: uid, gw: 3, points: 12 },
        { user_id: other, gw: 3, points: 10 },
      ],
      userId: uid,
      gw: 3,
      victoryType: 'monthly',
      seasonKey: '2025/26',
    });
    expect(payload).toEqual({
      gw: 3,
      victoryType: 'monthly',
      label: 'August 2025',
      points: 31,
      winnerCount: 1,
      joint: false,
    });
  });
});
