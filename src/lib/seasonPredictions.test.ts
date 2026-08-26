import { describe, expect, it } from 'vitest';

import {
  emptySeasonPredictionPicks,
  isSeasonPredictionsDeadlinePassed,
  normalizePlayerName,
  playerNamesMatch,
  playerStatusFromRows,
  allPlayersSubmitted,
  positionPoints,
  scoreSeasonPredictions,
  SEASON_PREDICTIONS_DEADLINE,
  validateSeasonPredictionPicks,
  type NamedSeasonPicks,
  type SeasonPredictionPicks,
} from './seasonPredictions';

function picks(partial: Partial<SeasonPredictionPicks>): SeasonPredictionPicks {
  return { ...emptySeasonPredictionPicks(), ...partial };
}

describe('season prediction validation', () => {
  it('requires nine distinct clubs plus the four other answers', () => {
    const errors = validateSeasonPredictionPicks(emptySeasonPredictionPicks());
    expect(errors.length).toBeGreaterThan(0);

    const complete = picks({
      pos1: 'ARS',
      pos2: 'MCI',
      pos3: 'LIV',
      pos4: 'CHE',
      pos5: 'MUN',
      pos6: 'TOT',
      pos18: 'HUL',
      pos19: 'IPS',
      pos20: 'COV',
      haalandGoals: 28,
      firstManagerId: 'HUL',
      highestScorer: 'Isak',
      mostAssists: 'Saka',
    });
    expect(validateSeasonPredictionPicks(complete)).toEqual([]);
  });

  it('rejects overlapping top and bottom clubs', () => {
    const overlapping = picks({
      pos1: 'ARS',
      pos2: 'MCI',
      pos3: 'LIV',
      pos4: 'CHE',
      pos5: 'MUN',
      pos6: 'TOT',
      pos18: 'ARS',
      pos19: 'IPS',
      pos20: 'COV',
      haalandGoals: 28,
      firstManagerId: 'HUL',
      highestScorer: 'Isak',
      mostAssists: 'Saka',
    });
    expect(validateSeasonPredictionPicks(overlapping)).toContain('Top 6 and bottom 3 must be nine different clubs');
  });
});

describe('season prediction scoring', () => {
  it('awards 1 for in-group and 3 for exact position', () => {
    expect(positionPoints('MCI', ['ARS', 'MCI', 'LIV'], 'ARS')).toBe(1);
    expect(positionPoints('ARS', ['ARS', 'MCI', 'LIV'], 'ARS')).toBe(3);
    expect(positionPoints('HUL', ['ARS', 'MCI', 'LIV'], 'ARS')).toBe(0);
  });

  it('gives closest Haaland guess 1 point, and 1 each when tied', () => {
    const results = picks({
      pos1: 'ARS',
      pos2: 'MCI',
      pos3: 'LIV',
      pos4: 'CHE',
      pos5: 'MUN',
      pos6: 'TOT',
      pos18: 'HUL',
      pos19: 'IPS',
      pos20: 'COV',
      haalandGoals: 30,
      firstManagerId: 'HUL',
      highestScorer: 'Alexander Isak',
      mostAssists: 'Bukayo Saka',
    });

    const entries: NamedSeasonPicks[] = [
      {
        userId: 'a',
        name: 'A',
        submitted: true,
        picks: picks({
          pos1: 'ARS',
          pos2: 'CHE',
          pos3: 'BHA',
          haalandGoals: 29,
          firstManagerId: 'HUL',
          highestScorer: 'alexander isak',
          mostAssists: 'Saka',
        }),
      },
      {
        userId: 'b',
        name: 'B',
        submitted: true,
        picks: picks({
          pos1: 'MCI',
          haalandGoals: 31,
          firstManagerId: 'IPS',
          highestScorer: 'Watkins',
          mostAssists: 'Palmer',
        }),
      },
      {
        userId: 'c',
        name: 'C',
        submitted: true,
        picks: picks({
          pos1: 'NFO',
          haalandGoals: 20,
          firstManagerId: 'HUL',
          highestScorer: 'Isak',
          mostAssists: 'bukayo saka',
        }),
      },
    ];

    const scores = scoreSeasonPredictions(entries, results);
    expect(scores.a.haalandGoals).toBe(1);
    expect(scores.b.haalandGoals).toBe(1);
    expect(scores.c.haalandGoals).toBe(0);
    expect(scores.a.top[0]).toBe(3);
    expect(scores.b.top[0]).toBe(1);
    expect(scores.c.top[0]).toBe(0);
    expect(scores.a.firstManager).toBe(1);
    expect(scores.b.firstManager).toBe(0);
    expect(scores.c.firstManager).toBe(1);
    expect(scores.a.highestScorer).toBe(1);
    expect(scores.c.highestScorer).toBe(1);
    expect(scores.b.highestScorer).toBe(0);
    expect(scores.a.mostAssists).toBe(1);
    expect(scores.c.mostAssists).toBe(1);
  });

  it('ignores unsubmitted drafts', () => {
    const scores = scoreSeasonPredictions(
      [
        {
          userId: 'draft',
          name: 'Draft',
          submitted: false,
          picks: picks({ haalandGoals: 30 }),
        },
      ],
      picks({ haalandGoals: 30 })
    );
    expect(scores.draft).toBeUndefined();
  });
});

describe('season prediction helpers', () => {
  it('treats the deadline as passed at 10pm UK on 1 Sep 2026', () => {
    expect(isSeasonPredictionsDeadlinePassed(new Date('2026-09-01T20:59:59.000Z'))).toBe(false);
    expect(isSeasonPredictionsDeadlinePassed(SEASON_PREDICTIONS_DEADLINE)).toBe(true);
  });

  it('builds a four-player lobby and only reveals when everyone has submitted', () => {
    const status = playerStatusFromRows([
      { user_id: '4542c037-5b38-40d0-b189-847b8f17c222', submitted: true },
    ]);
    expect(status.map((player) => player.name)).toEqual(['Jof', 'SP', 'ThomasJamesBird', 'Carl']);
    expect(status[0].submitted).toBe(true);
    expect(status[1].submitted).toBe(false);
    expect(allPlayersSubmitted(status)).toBe(false);
    expect(allPlayersSubmitted(status.map((player) => ({ ...player, submitted: true })))).toBe(true);
  });

  it('normalises player names for scoring ties', () => {
    expect(normalizePlayerName('  Bukayo   Saka ')).toBe('bukayo saka');
    expect(normalizePlayerName('Álvaro')).toBe('alvaro');
    expect(playerNamesMatch('Isak', 'Alexander Isak')).toBe(true);
    expect(playerNamesMatch('Saka', 'Bukayo Saka')).toBe(true);
    expect(playerNamesMatch('Watkins', 'Isak')).toBe(false);
  });
});
