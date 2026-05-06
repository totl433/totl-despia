import { fetchAllSupabaseRows } from './profileStreakRows';
import { supabase } from './supabase';

/**
 * Same merge as BFF `outcomesForGwFromResultsLive` — keep in sync with `apps/bff/src/profile.ts`.
 */
function outcomesForGwFromResultsLive(args: {
  gw: number;
  resultsRows: Array<{ gw?: number; fixture_index?: number; result?: string | null }>;
  fixturesRows: Array<{ gw?: number; fixture_index?: number; api_match_id?: number | null }>;
  liveRows: Array<{
    gw?: number;
    api_match_id?: number | null;
    fixture_index?: number | null;
    home_score?: number | null;
    away_score?: number | null;
    status?: string | null;
  }>;
}): Map<number, 'H' | 'D' | 'A'> {
  const { gw, resultsRows, fixturesRows, liveRows } = args;
  const outcomeByFixtureIndex = new Map<number, 'H' | 'D' | 'A'>();
  resultsRows.forEach((r) => {
    if (Number(r.gw) !== gw) return;
    const res = r.result;
    if (res === 'H' || res === 'D' || res === 'A') outcomeByFixtureIndex.set(Number(r.fixture_index), res);
  });
  const apiMatchIdToFixture = new Map<number, number>();
  fixturesRows.forEach((f) => {
    if (Number(f.gw) !== gw) return;
    if (typeof f.api_match_id === 'number' && typeof f.fixture_index === 'number')
      apiMatchIdToFixture.set(f.api_match_id, f.fixture_index);
  });
  liveRows.forEach((ls) => {
    if (Number(ls.gw) !== gw) return;
    const status = ls.status;
    const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
    if (!started) return;
    const fixtureIndex =
      typeof ls.fixture_index === 'number'
        ? ls.fixture_index
        : typeof ls.api_match_id === 'number'
          ? apiMatchIdToFixture.get(ls.api_match_id)
          : undefined;
    if (typeof fixtureIndex !== 'number') return;
    const hs = Number(ls.home_score ?? 0);
    const as = Number(ls.away_score ?? 0);
    outcomeByFixtureIndex.set(fixtureIndex, hs > as ? 'H' : hs < as ? 'A' : 'D');
  });
  return outcomeByFixtureIndex;
}

function pickKey(gw: number, fixtureIndex: number): string {
  return `${Number(gw)}:${Number(fixtureIndex)}`;
}

/**
 * % of scored picks in `app_picks` that matched the result (pool-wide).
 * Used when profile stats API omits `correctPredictionFieldAvgPct` (older BFF).
 */
export async function fetchLeaguePickAccuracyPct(): Promise<number | null> {
  const picks = await fetchAllSupabaseRows<{ gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' }>((from, to) =>
    supabase
      .from('app_picks')
      .select('gw, fixture_index, pick')
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true })
      .range(from, to)
  );
  if (!picks.length) return null;

  const resultsRows = await fetchAllSupabaseRows<{ gw?: number; fixture_index?: number; result?: string | null }>((from, to) =>
    supabase
      .from('app_gw_results')
      .select('gw, fixture_index, result')
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true })
      .range(from, to)
  );

  const gwSet = new Set<number>();
  picks.forEach((p) => {
    const g = Number(p.gw);
    if (Number.isFinite(g)) gwSet.add(g);
  });
  const gws = [...gwSet].sort((a, b) => a - b);

  const [liveRes, fxRes] = await Promise.all([
    supabase.from('live_scores').select('gw, api_match_id, fixture_index, home_score, away_score, status').in('gw', gws),
    supabase.from('app_fixtures').select('gw, fixture_index, api_match_id').in('gw', gws),
  ]);

  const liveRows = liveRes.error ? [] : liveRes.data ?? [];
  const fxRows = fxRes.error ? [] : fxRes.data ?? [];

  const augmented = new Map<string, 'H' | 'D' | 'A'>();
  gws.forEach((gw) => {
    const om = outcomesForGwFromResultsLive({
      gw,
      resultsRows: resultsRows as Array<{ gw?: number; fixture_index?: number; result?: string | null }>,
      fixturesRows: fxRows as Array<{ gw?: number; fixture_index?: number; api_match_id?: number | null }>,
      liveRows: liveRows as Array<{
        gw?: number;
        api_match_id?: number | null;
        fixture_index?: number | null;
        home_score?: number | null;
        away_score?: number | null;
        status?: string | null;
      }>,
    });
    om.forEach((res, fi) => augmented.set(pickKey(gw, fi), res));
  });

  let correct = 0;
  let total = 0;
  for (const p of picks) {
    const out = augmented.get(pickKey(Number(p.gw), Number(p.fixture_index)));
    if (!out) continue;
    total++;
    if (p.pick === out) correct++;
  }
  return total > 0 ? (correct / total) * 100 : null;
}

/** ±`band` percentage points counts as “about average”. */
export function formatCorrectRateVsLeague(userRate: number, leagueAvgPct: number, band = 2): string {
  const avg = Math.round(leagueAvgPct);
  const delta = userRate - leagueAvgPct;
  if (delta > band) return `Overall average is ${avg}%. You're above average.`;
  if (delta < -band) return `Overall average is ${avg}%. You're below average.`;
  return `Overall average is ${avg}%. You're about average.`;
}
