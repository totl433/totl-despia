import { describe, expect, it } from 'vitest';

import {
  buildLiveSeasonStreakRows,
  capGameweekStreakRowsAtLastCompleted,
  countTrailingGameweekParticipationStreak,
  formatStreakLadderFooter,
  mergeCareerAndLiveSeasonStreak,
  scoreUserPicksByGw,
  scoreUserPicksForGwFromLive,
} from './gameweekStreakCount';

describe('countTrailingGameweekParticipationStreak', () => {
  it('counts only trailing scored gameweeks (skipped weeks break streak)', () => {
    const rows = [
      { gw: 32, points: null },
      { gw: 33, points: null },
      { gw: 34, points: null },
      { gw: 35, points: 6 },
    ];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(1);
  });

  it('counts a longer trailing run', () => {
    const rows = [
      { gw: 10, points: null },
      { gw: 11, points: 5 },
      { gw: 12, points: 4 },
      { gw: 13, points: 8 },
    ];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(3);
  });

  it('returns 0 when latest gameweek has no score', () => {
    const rows = [
      { gw: 34, points: 5 },
      { gw: 35, points: null },
    ];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(0);
  });

  it('counts gameweeks with 0 points as participation', () => {
    const rows = [{ gw: 35, points: 0 }];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(1);
  });

  it('carries streak across seasons in ladder order', () => {
    const rows = [
      { gw: 37, points: 5, seasonLabel: '2025/26' },
      { gw: 38, points: 4, seasonLabel: '2025/26' },
      { gw: 1, points: 6, seasonLabel: '2026/27' },
    ];
    expect(countTrailingGameweekParticipationStreak(rows)).toBe(3);
  });
});

describe('formatStreakLadderFooter', () => {
  it('labels a single-season ladder with season tag', () => {
    const rows = [
      { gw: 1, points: 5, seasonLabel: '2025/26' },
      { gw: 38, points: 4, seasonLabel: '2025/26' },
    ];
    expect(formatStreakLadderFooter(rows)).toBe('25/26 · GW1–GW38 · 2 gameweeks');
  });

  it('labels a cross-season span clearly', () => {
    const rows = [
      { gw: 36, points: 5, seasonLabel: '2025/26' },
      { gw: 1, points: 4, seasonLabel: '2026/27' },
    ];
    expect(formatStreakLadderFooter(rows)).toBe('25/26 GW36 → 26/27 GW1 · 2 gameweeks');
  });
});

describe('capGameweekStreakRowsAtLastCompleted', () => {
  it('keeps prior-season chips when only the live season is capped', () => {
    const rows = [
      { gw: 36, points: 5, seasonLabel: '2025/26' },
      { gw: 38, points: 4, seasonLabel: '2025/26' },
      { gw: 1, points: 6, seasonLabel: '2026/27' },
      { gw: 9, points: 3, seasonLabel: '2026/27' },
    ];
    expect(capGameweekStreakRowsAtLastCompleted(rows, 8, '2026/27')).toEqual([
      { gw: 36, points: 5, seasonLabel: '2025/26' },
      { gw: 38, points: 4, seasonLabel: '2025/26' },
      { gw: 1, points: 6, seasonLabel: '2026/27' },
    ]);
  });

  it('caps every chip when no live season is provided', () => {
    const rows = [
      { gw: 7, points: 5 },
      { gw: 9, points: 3 },
    ];
    expect(capGameweekStreakRowsAtLastCompleted(rows, 8)).toEqual([{ gw: 7, points: 5 }]);
  });
});

describe('mergeCareerAndLiveSeasonStreak', () => {
  const prior = Array.from({ length: 38 }, (_, i) => ({ gw: i + 1, points: 4 }));
  const live = [
    { gw: 1, points: 6, seasonLabel: '2026/27' },
    { gw: 8, points: 5, seasonLabel: '2026/27' },
  ];

  it('keeps an unlabeled 1–38 ladder as 2025/26 and appends this season', () => {
    const merged = mergeCareerAndLiveSeasonStreak({
      careerRows: prior,
      liveSeasonLabel: '2026/27',
      priorSeasonLabel: '2025/26',
      liveRows: live,
    });
    expect(merged).toHaveLength(40);
    expect(merged[0]).toEqual({ gw: 1, points: 4, seasonLabel: '2025/26' });
    expect(merged[37]).toEqual({ gw: 38, points: 4, seasonLabel: '2025/26' });
    expect(merged[38]).toEqual(live[0]);
    expect(countTrailingGameweekParticipationStreak(merged)).toBe(40);
  });

  it('untags a 1–38 ladder that was wrongly labelled 2026/27', () => {
    const mistagged = prior.map((r) => ({ ...r, seasonLabel: '2026/27' }));
    const merged = mergeCareerAndLiveSeasonStreak({
      careerRows: mistagged,
      liveSeasonLabel: '2026/27',
      priorSeasonLabel: '2025/26',
      liveRows: live,
    });
    expect(merged[0]?.seasonLabel).toBe('2025/26');
    expect(merged).toHaveLength(40);
  });

  it('does not duplicate when the BFF already sent both seasons', () => {
    const dual = [
      ...prior.map((r) => ({ ...r, seasonLabel: '2025/26' })),
      ...live,
    ];
    expect(
      mergeCareerAndLiveSeasonStreak({
        careerRows: dual,
        liveSeasonLabel: '2026/27',
        priorSeasonLabel: '2025/26',
        liveRows: live,
      })
    ).toEqual(dual);
  });
});

describe('buildLiveSeasonStreakRows', () => {
  it('fills skipped weeks as null so the streak can break', () => {
    const rows = buildLiveSeasonStreakRows({
      seasonLabel: '2026/27',
      pointsByGw: new Map([[1, 6], [3, 4]]),
      playedGws: [1, 3],
      maxGw: 3,
    });
    expect(rows).toEqual([
      { gw: 1, points: 6, seasonLabel: '2026/27' },
      { gw: 2, points: null, seasonLabel: '2026/27' },
      { gw: 3, points: 4, seasonLabel: '2026/27' },
    ]);
  });

  it('does not invent a 0 when a played week has no scored points yet', () => {
    const rows = buildLiveSeasonStreakRows({
      seasonLabel: '2026/27',
      pointsByGw: new Map(),
      playedGws: [1, 2],
      maxGw: 2,
    });
    expect(rows.map((r) => r.points)).toEqual([null, null]);
  });
});

describe('scoreUserPicksForGwFromLive', () => {
  it('scores only started fixtures matched by api_match_id', () => {
    const pts = scoreUserPicksForGwFromLive({
      gw: 8,
      picks: [
        { gw: 8, fixture_index: 0, pick: 'H' },
        { gw: 8, fixture_index: 1, pick: 'A' },
        { gw: 8, fixture_index: 2, pick: 'D' },
      ],
      fixtures: [
        { fixture_index: 0, api_match_id: 101 },
        { fixture_index: 1, api_match_id: 102 },
        { fixture_index: 2, api_match_id: 103 },
      ],
      liveScores: [
        { api_match_id: 101, status: 'FINISHED', home_score: 2, away_score: 1 },
        { api_match_id: 102, status: 'IN_PLAY', home_score: 0, away_score: 1 },
        { api_match_id: 103, status: 'SCHEDULED', home_score: 0, away_score: 0 },
        { api_match_id: 999, status: 'FINISHED', fixture_index: 2, home_score: 1, away_score: 1 },
      ],
    });
    expect(pts).toBe(2);
  });

  it('returns null when no live fixture has started', () => {
    expect(
      scoreUserPicksForGwFromLive({
        gw: 8,
        picks: [{ gw: 8, fixture_index: 0, pick: 'H' }],
        fixtures: [{ fixture_index: 0, api_match_id: 101 }],
        liveScores: [{ api_match_id: 101, status: 'SCHEDULED', home_score: 0, away_score: 0 }],
      })
    ).toBeNull();
  });
});

describe('scoreUserPicksByGw', () => {
  it('counts correct H/D/A picks per gameweek', () => {
    const scored = scoreUserPicksByGw(
      [
        { gw: 1, fixture_index: 0, pick: 'H' },
        { gw: 1, fixture_index: 1, pick: 'D' },
        { gw: 2, fixture_index: 0, pick: 'A' },
      ],
      [
        { gw: 1, fixture_index: 0, result: 'H' },
        { gw: 1, fixture_index: 1, result: 'A' },
        { gw: 2, fixture_index: 0, result: 'A' },
      ]
    );
    expect(scored.get(1)).toBe(1);
    expect(scored.get(2)).toBe(1);
  });
});
