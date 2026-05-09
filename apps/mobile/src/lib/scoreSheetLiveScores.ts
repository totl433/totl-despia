import type { Fixture, LiveScore, Pick } from '@totl/domain';

/** Postgres / JSON can surface scores as numeric strings — treat those as numbers for the sheet. */
export function coerceScoreInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** True when we have usable numeric lines on the scoresheet centre column. */
export function liveScoreHasNumericLine(ls: LiveScore | null | undefined): boolean {
  const h = coerceScoreInt(ls?.home_score ?? null);
  const a = coerceScoreInt(ls?.away_score ?? null);
  return h != null && a != null;
}

function pickRicherLiveScore(prev: LiveScore | undefined, next: LiveScore): LiveScore {
  if (!prev) return next;
  const prevHas = liveScoreHasNumericLine(prev);
  const nextHas = liveScoreHasNumericLine(next);
  if (nextHas && !prevHas) return next;
  if (prevHas && !nextHas) return prev;
  const nextFinished = next.status === 'FINISHED' || next.status === 'FT';
  const prevFinished = prev.status === 'FINISHED' || prev.status === 'FT';
  if (nextFinished && !prevFinished) return next;
  return prev;
}

export function apiMatchIdsFromFixtures(fixtures: Fixture[]): number[] {
  const ids: number[] = [];
  for (const fx of fixtures) {
    if (typeof fx.api_match_id === 'number' && Number.isFinite(fx.api_match_id)) ids.push(fx.api_match_id);
  }
  return ids;
}

/**
 * Indexes `live_scores`-shaped payloads by `fixture_index`, resolving `api_match_id` → index like web Home.
 */
export function buildLiveScoreMapForFixtures(fixtures: Fixture[], rowsInput: Iterable<LiveScore>): Map<number, LiveScore> {
  const apiMatchToFixtureIndex = new Map<number, number>();
  for (const fx of fixtures) {
    const ai = typeof fx.api_match_id === 'number' ? fx.api_match_id : null;
    const fi = Number(fx.fixture_index);
    if (ai != null && Number.isFinite(fi)) apiMatchToFixtureIndex.set(ai, fi);
  }

  const liveByFixture = new Map<number, LiveScore>();
  for (const liveScore of rowsInput) {
    let fixtureIndex: number | null =
      typeof liveScore.fixture_index === 'number' && Number.isFinite(liveScore.fixture_index)
        ? Number(liveScore.fixture_index)
        : null;
    if (fixtureIndex == null && typeof liveScore.api_match_id === 'number') {
      fixtureIndex = apiMatchToFixtureIndex.get(liveScore.api_match_id) ?? null;
    }
    if (fixtureIndex == null || !Number.isFinite(fixtureIndex)) continue;

    const prev = liveByFixture.get(fixtureIndex);
    liveByFixture.set(fixtureIndex, prev ? pickRicherLiveScore(prev, liveScore) : liveScore);
  }
  return liveByFixture;
}

/**
 * When finals are recorded as H/D/A but line scores never arrived in `/v1/home`, mirror web `Home.tsx`
 * behaviour: derive a canonical scoreline that reflects the outcome (not the real tally).
 */
export function outcomeFallbackScoreline(outcome: Pick | null | undefined): { home: number; away: number } | null {
  if (outcome === 'H') return { home: 1, away: 0 };
  if (outcome === 'A') return { home: 0, away: 1 };
  if (outcome === 'D') return { home: 0, away: 0 };
  return null;
}

export function scoreStringsForFixtureRow(ls: LiveScore | null | undefined, outcome: Pick | null): { home: string; away: string } {
  const h = coerceScoreInt(ls?.home_score ?? null);
  const a = coerceScoreInt(ls?.away_score ?? null);
  if (h != null && a != null) return { home: String(h), away: String(a) };
  const fb = outcomeFallbackScoreline(outcome);
  if (fb) return { home: String(fb.home), away: String(fb.away) };
  return { home: '-', away: '-' };
}

/** Normalise a `live_scores` row for merging (handles stringly-typed numbers from PostgREST). */
export function hydrateLiveScoreFromDb(raw: Record<string, unknown>): LiveScore | null {
  const apiMatchId = Number(raw.api_match_id);
  const gwNum = Number(raw.gw);
  if (!Number.isFinite(apiMatchId) || apiMatchId <= 0 || !Number.isFinite(gwNum) || gwNum <= 0) return null;

  const fiRaw = raw.fixture_index;
  const fixture_index =
    fiRaw === null || fiRaw === undefined || fiRaw === ''
      ? undefined
      : Number.isFinite(Number(fiRaw))
        ? Number(fiRaw)
        : undefined;

  const hs = coerceScoreInt(raw.home_score);
  const as = coerceScoreInt(raw.away_score);

  return {
    api_match_id: apiMatchId,
    gw: gwNum,
    fixture_index,
    home_score: hs ?? null,
    away_score: as ?? null,
    status: typeof raw.status === 'string' ? (raw.status as LiveScore['status']) : null,
    minute: raw.minute == null || raw.minute === '' ? null : Number(raw.minute),
    home_team: typeof raw.home_team === 'string' ? raw.home_team : null,
    away_team: typeof raw.away_team === 'string' ? raw.away_team : null,
    kickoff_time: typeof raw.kickoff_time === 'string' ? raw.kickoff_time : null,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    goals: raw.goals ?? null,
    red_cards: raw.red_cards ?? null,
  };
}
