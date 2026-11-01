import { describe, expect, it } from 'vitest';

import { accumulatePlayersInsights, eraForQuestionSeason, inferPlayedOutcomes } from './playersInsights';

describe('inferPlayedOutcomes', () => {
  it('counts only the hits plus the miss that ended the run', () => {
    expect(inferPlayedOutcomes(7, 10)).toEqual(['hit', 'hit', 'hit', 'hit', 'hit', 'hit', 'hit', 'miss']);
  });

  it('has no miss on a perfect run', () => {
    expect(inferPlayedOutcomes(10, 10)).toHaveLength(10);
    expect(inferPlayedOutcomes(10, 10).every((o) => o === 'hit')).toBe(true);
  });
});

describe('eraForQuestionSeason', () => {
  it('buckets 90s, 00s and recent from the question season', () => {
    expect(eraForQuestionSeason('96/97')).toBe('90s');
    expect(eraForQuestionSeason('2004/05')).toBe('00s');
    expect(eraForQuestionSeason('21/22')).toBe('recent');
  });
});

describe('accumulatePlayersInsights', () => {
  it('picks the club you know and the club that fools you from seen cards only', () => {
    const ars = { questionSeason: '96/97', correct: { clubCode: 'ARS', clubName: 'Arsenal' } };
    const nfo = { questionSeason: '21/22', correct: { clubCode: 'NFO', clubName: "Nott'm Forest" } };
    const stats = accumulatePlayersInsights([
      { cards: [ars, ars, nfo], correct: 2, total: 10 },
      { cards: [nfo, ars], correct: 0, total: 10 },
    ]);
    expect(stats.know?.code).toBe('ARS');
    expect(stats.fool?.code).toBe('NFO');
    expect(stats.eras.map((e) => e.key)).toEqual(['90s', 'recent']);
  });
});
