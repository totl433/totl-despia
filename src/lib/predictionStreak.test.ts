import { describe, expect, it } from 'vitest';

import {
  buildCareerMarks,
  computeCareerStreak,
  countCareerStreak,
  last10CareerScores,
} from './predictionStreak';

function playedMap(gws: number[], points = 6): Map<number, number> {
  return new Map(gws.map((gw) => [gw, points]));
}

function allGws(from: number, to: number): number[] {
  const gws: number[] = [];
  for (let gw = from; gw <= to; gw++) gws.push(gw);
  return gws;
}

describe('career prediction streak', () => {
  it('counts last season plus the current gameweek (38 + 1 = 39)', () => {
    const result = computeCareerStreak({
      currentGw: 1,
      currentPointsByGw: playedMap([1]),
      currentSubmitted: new Set([1]),
      previousPointsByGw: playedMap(allGws(1, 38)),
      previousSubmitted: new Set(allGws(1, 38)),
    });

    expect(result.streak).toBe(39);
    expect(result.last10GwScores).toHaveLength(10);
    expect(result.last10GwScores[result.last10GwScores.length - 1]).toEqual({
      gw: 1,
      score: 6,
      season: 'current',
    });
    expect(result.last10GwScores[0]).toEqual({
      gw: 30,
      score: 6,
      season: 'previous',
    });
  });

  it('keeps last season streak when the current GW is still open', () => {
    const result = computeCareerStreak({
      currentGw: 1,
      currentPointsByGw: new Map(),
      currentSubmitted: new Set(),
      previousPointsByGw: playedMap(allGws(1, 38)),
      previousSubmitted: new Set(allGws(1, 38)),
    });

    expect(result.streak).toBe(38);
  });

  it('resets after a missed final week of last season', () => {
    const result = computeCareerStreak({
      currentGw: 1,
      currentPointsByGw: playedMap([1]),
      currentSubmitted: new Set([1]),
      previousPointsByGw: playedMap(allGws(1, 37)),
      previousSubmitted: new Set(allGws(1, 37)),
    });

    expect(result.streak).toBe(1);
  });

  it('counts only the current season for new players', () => {
    const result = computeCareerStreak({
      currentGw: 1,
      currentPointsByGw: new Map(),
      currentSubmitted: new Set([1]),
      previousPointsByGw: new Map(),
      previousSubmitted: new Set(),
    });

    expect(result.streak).toBe(1);
    expect(result.last10GwScores).toEqual([
      { gw: 1, score: null, season: 'current' },
    ]);
  });

  it('does not treat a trailing unplayed current GW as a break when counting', () => {
    const marks = buildCareerMarks({
      currentGw: 2,
      currentPointsByGw: playedMap([1]),
      currentSubmitted: new Set([1]),
      previousPointsByGw: playedMap(allGws(1, 38)),
      previousSubmitted: new Set(allGws(1, 38)),
    });

    expect(countCareerStreak(marks)).toBe(39);
    expect(countCareerStreak(marks, false)).toBe(0);
    expect(last10CareerScores(marks).map((bar) => bar.gw)).toEqual([
      31, 32, 33, 34, 35, 36, 37, 38, 1, 2,
    ]);
  });
});
