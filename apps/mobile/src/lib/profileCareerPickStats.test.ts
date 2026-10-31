import { describe, expect, it } from 'vitest';

import {
  computeCareerOverallPercentile,
  computeCareerPickStats,
  computeCareerWeeklyPar,
  isChaosUnderdogPick,
} from './profileCareerPickStats';

describe('computeCareerPickStats', () => {
  it('keeps 25/26 GW1 separate from 26/27 GW1', () => {
    const stats = computeCareerPickStats({
      picks: [
        { pile: 'legacy', gw: 1, fixture_index: 0, pick: 'H' },
        { pile: 'season', gw: 1, fixture_index: 0, pick: 'A' },
      ],
      results: [
        { pile: 'legacy', gw: 1, fixture_index: 0, result: 'H' },
        { pile: 'season', gw: 1, fixture_index: 0, result: 'H' },
      ],
      fixtures: [
        { pile: 'legacy', gw: 1, fixture_index: 0, home_code: 'BUR', away_code: 'SUN' },
        { pile: 'season', gw: 1, fixture_index: 0, home_code: 'BUR', away_code: 'SUN' },
      ],
    });
    expect(stats.scoredPicks).toBe(2);
    expect(stats.correctPicks).toBe(1);
    expect(stats.correctPredictionRate).toBe(50);
  });

  it('credits both clubs when the pick is right', () => {
    const stats = computeCareerPickStats({
      picks: [{ pile: 'legacy', gw: 2, fixture_index: 0, pick: 'H' }],
      results: [{ pile: 'legacy', gw: 2, fixture_index: 0, result: 'H' }],
      fixtures: [{ pile: 'legacy', gw: 2, fixture_index: 0, home_code: 'BUR', away_code: 'ARS' }],
    });
    expect(stats.mostCorrectTeam?.code).toBe('BUR');
    expect(stats.mostCorrectTeam?.percentage).toBe(100);
    expect(stats.mostIncorrectTeam?.percentage).toBe(0);
  });

  it('ignores scheduled fixtures with no result so a live week only counts finished games', () => {
    const stats = computeCareerPickStats({
      picks: [
        { pile: 'season', gw: 8, fixture_index: 0, pick: 'H' },
        { pile: 'season', gw: 8, fixture_index: 1, pick: 'A' },
      ],
      results: [{ pile: 'season', gw: 8, fixture_index: 0, result: 'H' }],
      fixtures: [
        { pile: 'season', gw: 8, fixture_index: 0, home_code: 'LIV', away_code: 'CHE' },
        { pile: 'season', gw: 8, fixture_index: 1, home_code: 'MCI', away_code: 'MUN' },
      ],
    });
    expect(stats.scoredPicks).toBe(1);
    expect(stats.correctPicks).toBe(1);
  });

  it('picks best and lowest weeks across both seasons', () => {
    const stats = computeCareerPickStats({
      picks: [
        { pile: 'legacy', gw: 38, fixture_index: 0, pick: 'H' },
        { pile: 'legacy', gw: 38, fixture_index: 1, pick: 'H' },
        { pile: 'season', gw: 2, fixture_index: 0, pick: 'A' },
      ],
      results: [
        { pile: 'legacy', gw: 38, fixture_index: 0, result: 'H' },
        { pile: 'legacy', gw: 38, fixture_index: 1, result: 'H' },
        { pile: 'season', gw: 2, fixture_index: 0, result: 'H' },
      ],
      fixtures: [],
    });
    expect(stats.bestSingleGw).toEqual({ points: 2, gw: 38, seasonLabel: '2025/26' });
    expect(stats.lowestSingleGw).toEqual({ points: 0, gw: 2, seasonLabel: '2026/27' });
  });

  it('counts a correct underdog pick as chaos success', () => {
    const popular = Array.from({ length: 3 }, () => ({
      pile: 'season' as const,
      gw: 1,
      fixture_index: 0,
      pick: 'H',
    }));
    const stats = computeCareerPickStats({
      picks: [{ pile: 'season', gw: 1, fixture_index: 0, pick: 'A' }],
      results: [{ pile: 'season', gw: 1, fixture_index: 0, result: 'A' }],
      fixtures: [{ pile: 'season', gw: 1, fixture_index: 0, home_code: 'BUR', away_code: 'SUN' }],
      fieldPicks: [...popular, { pile: 'season', gw: 1, fixture_index: 0, pick: 'A' }],
    });
    expect(stats.chaosIndex).toBe(100);
    expect(stats.chaosCorrectCount).toBe(1);
    expect(stats.chaosTotalCount).toBe(1);
  });
});

describe('isChaosUnderdogPick', () => {
  it('is the bottom 25% of everyone who picked that game', () => {
    expect(isChaosUnderdogPick(25, 100)).toBe(true);
    expect(isChaosUnderdogPick(26, 100)).toBe(false);
    expect(isChaosUnderdogPick(1, 4)).toBe(true);
    expect(isChaosUnderdogPick(0, 0)).toBe(false);
  });
});

describe('computeCareerWeeklyPar', () => {
  it('appends this season after last season and does not collide GW1', () => {
    const rows = computeCareerWeeklyPar({
      userId: 'me',
      legacyPoints: [
        { user_id: 'me', gw: 1, points: 6 },
        { user_id: 'you', gw: 1, points: 4 },
      ],
      seasonPoints: [
        { user_id: 'me', gw: 1, points: 8 },
        { user_id: 'you', gw: 1, points: 2 },
      ],
      legacyLabel: '2025/26',
      seasonLabel: '2026/27',
    });
    expect(rows).toEqual([
      { gw: 1, userPoints: 6, averagePoints: 5, seasonLabel: '2025/26' },
      { gw: 1, userPoints: 8, averagePoints: 5, seasonLabel: '2026/27' },
    ]);
  });
});

describe('computeCareerOverallPercentile', () => {
  it('sums both seasons before ranking', () => {
    const pct = computeCareerOverallPercentile({
      userId: 'me',
      legacy: [
        { user_id: 'me', ocp: 100 },
        { user_id: 'you', ocp: 80 },
      ],
      season: [
        { user_id: 'me', ocp: 20 },
        { user_id: 'you', ocp: 50 },
      ],
    });
    // me 120, you 130 → me is not top
    expect(pct).toBe(50);
  });
});
