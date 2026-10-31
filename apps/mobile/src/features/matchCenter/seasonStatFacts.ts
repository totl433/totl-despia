import type { Pick } from '@totl/domain';

import { areTeamNamesSimilar, getMediumName } from '../../../../../src/lib/teamNames';

export type SeasonTeamStat = { name: string; code: string; pct: number; games: number };
export type SeasonLateHero = { name: string; code: string; count: number };

export type SeasonStatFacts = {
  drawPct: number | null;
  awayPct: number | null;
  sampleSize: number;
  mostMissed: SeasonTeamStat | null;
  easiest: SeasonTeamStat | null;
  lastMinuteHero: SeasonLateHero | null;
};

export type SeasonFixture = {
  gw: number;
  fixture_index: number;
  api_match_id: number | null;
  home_code: string;
  away_code: string;
  home_name: string;
  away_name: string;
};

function teamLabel(name: string, code: string): string {
  return getMediumName(name || code || 'Team');
}

function keyOf(gw: number, fixtureIndex: number): string {
  return `${gw}:${fixtureIndex}`;
}

function outcome(home: number | null | undefined, away: number | null | undefined): Pick | null {
  if (typeof home !== 'number' || typeof away !== 'number') return null;
  if (home > away) return 'H';
  if (home < away) return 'A';
  return 'D';
}

/**
 * Season-wide facts for the five stat cards. Draws / away wins are result mix.
 * Most missed / easiest are Prediction accuracy on that team's matches.
 * Last-minute heroes are 90+ goals in matches that team then drew or won.
 */
export function buildSeasonStatFacts(input: {
  fixtures: SeasonFixture[];
  results: Array<{ gw: number; fixture_index: number; result: string }>;
  pickCounts: Map<string, { H: number; D: number; A: number; total: number }>;
  live: Array<{
    api_match_id?: number | null;
    status?: string | null;
    home_score?: number | null;
    away_score?: number | null;
    home_team?: string | null;
    away_team?: string | null;
    goals?: unknown;
  }>;
}): SeasonStatFacts {
  const resultByKey = new Map<string, Pick>();
  input.results.forEach((row) => {
    if (row.result === 'H' || row.result === 'D' || row.result === 'A') {
      resultByKey.set(keyOf(row.gw, row.fixture_index), row.result);
    }
  });
  const liveByMatch = new Map<number, (typeof input.live)[number]>();
  input.live.forEach((row) => {
    if (typeof row.api_match_id === 'number') liveByMatch.set(row.api_match_id, row);
  });

  const outcomes: Pick[] = [];
  input.fixtures.forEach((fixture) => {
    const fromTable = resultByKey.get(keyOf(fixture.gw, fixture.fixture_index));
    if (fromTable) {
      outcomes.push(fromTable);
      return;
    }
    const live = typeof fixture.api_match_id === 'number' ? liveByMatch.get(fixture.api_match_id) : undefined;
    if (live?.status !== 'FINISHED') return;
    const next = outcome(live.home_score, live.away_score);
    if (next) {
      outcomes.push(next);
      resultByKey.set(keyOf(fixture.gw, fixture.fixture_index), next);
    }
  });

  const drawPct = outcomes.length ? Math.round((outcomes.filter((row) => row === 'D').length / outcomes.length) * 100) : null;
  const awayPct = outcomes.length ? Math.round((outcomes.filter((row) => row === 'A').length / outcomes.length) * 100) : null;

  const acc = new Map<string, { name: string; code: string; sum: number; games: number }>();
  const addAcc = (code: string, name: string, pct: number) => {
    const key = code || name;
    const current = acc.get(key) ?? { name, code, sum: 0, games: 0 };
    current.sum += pct;
    current.games += 1;
    if (!current.name) current.name = name;
    acc.set(key, current);
  };
  input.fixtures.forEach((fixture) => {
    const result = resultByKey.get(keyOf(fixture.gw, fixture.fixture_index));
    const counts = input.pickCounts.get(keyOf(fixture.gw, fixture.fixture_index));
    if (!result || !counts || counts.total <= 0) return;
    const pct = Math.round((counts[result] / counts.total) * 100);
    addAcc(fixture.home_code, teamLabel(fixture.home_name, fixture.home_code), pct);
    addAcc(fixture.away_code, teamLabel(fixture.away_name, fixture.away_code), pct);
  });
  const ranked = [...acc.values()]
    .filter((row) => row.games > 0)
    .map((row) => ({ name: row.name, code: row.code, pct: Math.round(row.sum / row.games), games: row.games }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const mostMissed = ranked.length ? ranked.reduce((best, row) => (row.pct < best.pct ? row : best)) : null;
  const easiest = ranked.length ? ranked.reduce((best, row) => (row.pct > best.pct ? row : best)) : null;

  const late = new Map<string, { name: string; code: string; count: number }>();
  const bumpLate = (code: string, name: string) => {
    const key = code || name;
    const current = late.get(key) ?? { name, code, count: 0 };
    current.count += 1;
    late.set(key, current);
  };
  input.fixtures.forEach((fixture) => {
    const live = typeof fixture.api_match_id === 'number' ? liveByMatch.get(fixture.api_match_id) : undefined;
    if (!live || live.status !== 'FINISHED') return;
    const result = outcome(live.home_score, live.away_score);
    if (!result) return;
    const goals = Array.isArray(live.goals) ? live.goals : [];
    const homeName = teamLabel(fixture.home_name, fixture.home_code);
    const awayName = teamLabel(fixture.away_name, fixture.away_code);
    const lateSides = new Set<'H' | 'A'>();
    goals.forEach((goal) => {
      if (!goal || typeof goal !== 'object') return;
      const minute = Number((goal as { minute?: unknown }).minute);
      if (!Number.isFinite(minute) || minute < 90) return;
      const team = String((goal as { team?: unknown }).team ?? '');
      if (!team) return;
      if (areTeamNamesSimilar(team, live.home_team ?? '') || areTeamNamesSimilar(team, fixture.home_name) || areTeamNamesSimilar(team, fixture.home_code)) {
        lateSides.add('H');
      } else if (areTeamNamesSimilar(team, live.away_team ?? '') || areTeamNamesSimilar(team, fixture.away_name) || areTeamNamesSimilar(team, fixture.away_code)) {
        lateSides.add('A');
      }
    });
    if (lateSides.has('H') && (result === 'H' || result === 'D')) bumpLate(fixture.home_code, homeName);
    if (lateSides.has('A') && (result === 'A' || result === 'D')) bumpLate(fixture.away_code, awayName);
  });
  const lateRanked = [...late.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    drawPct,
    awayPct,
    sampleSize: outcomes.length,
    mostMissed,
    easiest,
    lastMinuteHero: lateRanked[0] ?? null,
  };
}

export function seasonPickKey(gw: number, fixtureIndex: number): string {
  return keyOf(gw, fixtureIndex);
}
