import { describe, expect, it } from 'vitest';
import { assignCompetitionRanks, formatCompetitionRank } from './competitionRanks';

describe('assignCompetitionRanks', () => {
  it('marks equal top scores as 1= and skips to 3', () => {
    const rows = [
      { score: 5, unicorns: 1 },
      { score: 5, unicorns: 1 },
      { score: 2, unicorns: 0 },
    ];
    const ranked = assignCompetitionRanks(
      rows,
      (a, b) => a.score === b.score && a.unicorns === b.unicorns
    );
    expect(ranked.map((r) => formatCompetitionRank(r.rank, r.tied))).toEqual(['1=', '1=', '3']);
  });

  it('does not tie when unicorns break the standing', () => {
    const rows = [
      { score: 5, unicorns: 2 },
      { score: 5, unicorns: 1 },
      { score: 2, unicorns: 0 },
    ];
    const ranked = assignCompetitionRanks(
      rows,
      (a, b) => a.score === b.score && a.unicorns === b.unicorns
    );
    expect(ranked.map((r) => formatCompetitionRank(r.rank, r.tied))).toEqual(['1', '2', '3']);
  });
});
