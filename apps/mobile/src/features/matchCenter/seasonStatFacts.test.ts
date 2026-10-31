import { describe, expect, it } from 'vitest';

import { buildSeasonStatFacts } from './seasonStatFacts';

describe('season stat facts', () => {
  it('uses the whole season for draws, away wins, accuracy and 90+ heroes', () => {
    const facts = buildSeasonStatFacts({
      fixtures: [
        { gw: 1, fixture_index: 0, api_match_id: 1, home_code: 'SUN', away_code: 'ARS', home_name: 'Sunderland', away_name: 'Arsenal' },
        { gw: 2, fixture_index: 0, api_match_id: 2, home_code: 'MCI', away_code: 'WHU', home_name: 'Man City', away_name: 'West Ham' },
        { gw: 3, fixture_index: 0, api_match_id: 3, home_code: 'LIV', away_code: 'CHE', home_name: 'Liverpool', away_name: 'Chelsea' },
        { gw: 4, fixture_index: 0, api_match_id: 4, home_code: 'SUN', away_code: 'BOU', home_name: 'Sunderland', away_name: 'Bournemouth' },
        { gw: 5, fixture_index: 0, api_match_id: 5, home_code: 'ARS', away_code: 'BRE', home_name: 'Arsenal', away_name: 'Brentford' },
        { gw: 6, fixture_index: 0, api_match_id: 6, home_code: 'WHU', away_code: 'BOU', home_name: 'West Ham', away_name: 'Bournemouth' },
      ],
      results: [
        { gw: 1, fixture_index: 0, result: 'A' },
        { gw: 2, fixture_index: 0, result: 'H' },
        { gw: 3, fixture_index: 0, result: 'D' },
        { gw: 4, fixture_index: 0, result: 'A' },
        { gw: 5, fixture_index: 0, result: 'H' },
        { gw: 6, fixture_index: 0, result: 'H' },
      ],
      pickCounts: new Map([
        ['1:0', { H: 80, D: 10, A: 10, total: 100 }],
        ['2:0', { H: 90, D: 5, A: 5, total: 100 }],
        ['3:0', { H: 20, D: 50, A: 30, total: 100 }],
        ['4:0', { H: 70, D: 10, A: 20, total: 100 }],
        ['5:0', { H: 80, D: 10, A: 10, total: 100 }],
        ['6:0', { H: 70, D: 15, A: 15, total: 100 }],
      ]),
      live: [
        {
          api_match_id: 3,
          status: 'FINISHED',
          home_score: 1,
          away_score: 1,
          home_team: 'Liverpool',
          away_team: 'Chelsea',
          goals: [{ team: 'Liverpool', minute: 92, scorer: 'Salah' }],
        },
      ],
    });
    // Last gameweek alone would be 0% draws / 0% away. Season is 1 draw and 2 away from 6.
    expect(facts.sampleSize).toBe(6);
    expect(facts.drawPct).toBe(17);
    expect(facts.awayPct).toBe(33);
    expect(facts.mostMissed?.name).toBe('Sunderland');
    expect(facts.mostMissed?.pct).toBe(15);
    expect(facts.easiest?.name).toBe('Man City');
    expect(facts.easiest?.pct).toBe(90);
    expect(facts.lastMinuteHero?.name).toBe('Liverpool');
  });
});
