/**
 * Premier League table ranks + form for fixture cards.
 *
 * Pre-season: empty form (no chips) is correct; ranks may fall back to the
 * latest stored snapshot (end of previous season).
 * After results land on the active season stack, ranks come from this season’s
 * results so they update without waiting for the next GW publish job.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applySeasonFilter,
  getSeasonTables,
  type SeasonCtx,
} from './seasonStack.js';

type PosMap = Record<string, number>;
type FormMap = Record<string, string>;

function normCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

/** Points-only table from H/D/A results (enough for early-season rank updates). */
export function computeTablePositionsFromResults(
  rows: Array<{ home_code: string; away_code: string; result: 'H' | 'D' | 'A' }>
): PosMap {
  type Stat = { played: number; pts: number; w: number; d: number; l: number };
  const stats = new Map<string, Stat>();

  const touch = (code: string): Stat => {
    let s = stats.get(code);
    if (!s) {
      s = { played: 0, pts: 0, w: 0, d: 0, l: 0 };
      stats.set(code, s);
    }
    return s;
  };

  for (const row of rows) {
    const home = normCode(row.home_code);
    const away = normCode(row.away_code);
    if (!home || !away) continue;
    const h = touch(home);
    const a = touch(away);
    h.played += 1;
    a.played += 1;
    if (row.result === 'H') {
      h.pts += 3;
      h.w += 1;
      a.l += 1;
    } else if (row.result === 'A') {
      a.pts += 3;
      a.w += 1;
      h.l += 1;
    } else {
      h.pts += 1;
      a.pts += 1;
      h.d += 1;
      a.d += 1;
    }
  }

  const ordered = Array.from(stats.entries()).sort(([, x], [, y]) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.w !== x.w) return y.w - x.w;
    // stable-ish name order for pure ties mid-GW
    return 0;
  });

  const out: PosMap = {};
  ordered.forEach(([code], idx) => {
    out[code] = idx + 1;
  });
  return out;
}

/** Form string oldest→newest, max 5, from chronological season results for a team. */
export function computeFormFromResults(
  chronOrdered: Array<{ home_code: string; away_code: string; result: 'H' | 'D' | 'A' }>
): FormMap {
  const perTeam: Record<string, string[]> = {};
  const push = (code: string, ch: 'W' | 'D' | 'L') => {
    if (!code) return;
    const arr = perTeam[code] ?? [];
    arr.push(ch);
    perTeam[code] = arr;
  };

  for (const row of chronOrdered) {
    const home = normCode(row.home_code);
    const away = normCode(row.away_code);
    if (row.result === 'H') {
      push(home, 'W');
      push(away, 'L');
    } else if (row.result === 'A') {
      push(home, 'L');
      push(away, 'W');
    } else {
      push(home, 'D');
      push(away, 'D');
    }
  }

  const out: FormMap = {};
  Object.entries(perTeam).forEach(([code, letters]) => {
    const slice = letters.slice(-5).join('');
    if (slice) out[code] = slice;
  });
  return out;
}

async function loadStoredFormsForGw(
  supa: SupabaseClient,
  gw: number
): Promise<{ teamForms: FormMap; teamPositions: PosMap; anyForm: boolean }> {
  const { data, error } = await (supa as any)
    .from('app_team_forms')
    .select('team_code, form, league_position')
    .eq('gw', gw);
  if (error) throw error;

  const teamForms: FormMap = {};
  const teamPositions: PosMap = {};
  let anyForm = false;

  (data ?? []).forEach((row: any) => {
    const code = normCode(row?.team_code);
    if (!code) return;
    const form = typeof row?.form === 'string' ? row.form.trim().toUpperCase() : '';
    if (form) {
      teamForms[code] = form;
      anyForm = true;
    }
    const position = Number(row?.league_position);
    if (Number.isFinite(position) && position > 0) {
      teamPositions[code] = Math.trunc(position);
    }
  });

  return { teamForms, teamPositions, anyForm };
}

async function loadLatestStoredPositions(supa: SupabaseClient): Promise<PosMap> {
  const { data: latest, error } = await (supa as any)
    .from('app_team_forms')
    .select('gw')
    .not('league_position', 'is', null)
    .order('gw', { ascending: false })
    .limit(1);
  if (error) throw error;
  const fallbackGw = Number(latest?.[0]?.gw);
  if (!Number.isFinite(fallbackGw) || fallbackGw <= 0) return {};
  const { teamPositions } = await loadStoredFormsForGw(supa, Math.trunc(fallbackGw));
  return teamPositions;
}

type JoinRow = { home_code: string; away_code: string; result: 'H' | 'D' | 'A'; gw: number; fixture_index: number };

async function loadSeasonResultRows(
  supa: SupabaseClient,
  seasonCtx: SeasonCtx,
  throughGw: number
): Promise<JoinRow[]> {
  const tables = getSeasonTables(seasonCtx);
  let resultsQ = (supa as any)
    .from(tables.results)
    .select('gw, fixture_index, result')
    .lte('gw', throughGw);
  resultsQ = applySeasonFilter(resultsQ, seasonCtx);

  let fixturesQ = (supa as any)
    .from(tables.fixtures)
    .select('gw, fixture_index, home_code, away_code')
    .lte('gw', throughGw);
  fixturesQ = applySeasonFilter(fixturesQ, seasonCtx);

  const [resultsRes, fixturesRes] = await Promise.all([resultsQ, fixturesQ]);
  if (resultsRes.error) throw resultsRes.error;
  if (fixturesRes.error) throw fixturesRes.error;

  const fixtureKey = (gw: number, idx: number) => `${gw}:${idx}`;
  const byKey = new Map<string, { home_code: string; away_code: string; gw: number; fixture_index: number }>();
  (fixturesRes.data ?? []).forEach((f: any) => {
    const gw = Number(f.gw);
    const fixture_index = Number(f.fixture_index);
    if (!Number.isFinite(gw) || !Number.isFinite(fixture_index)) return;
    byKey.set(fixtureKey(gw, fixture_index), {
      gw,
      fixture_index,
      home_code: normCode(f.home_code),
      away_code: normCode(f.away_code),
    });
  });

  const out: JoinRow[] = [];
  (resultsRes.data ?? []).forEach((r: any) => {
    const result = r?.result;
    if (result !== 'H' && result !== 'D' && result !== 'A') return;
    const gw = Number(r.gw);
    const fixture_index = Number(r.fixture_index);
    const fx = byKey.get(fixtureKey(gw, fixture_index));
    if (!fx?.home_code || !fx?.away_code) return;
    out.push({
      home_code: fx.home_code,
      away_code: fx.away_code,
      result,
      gw,
      fixture_index,
    });
  });

  out.sort((a, b) => a.gw - b.gw || a.fixture_index - b.fixture_index);
  return out;
}

/**
 * Resolve forms + table ranks for prediction cards.
 */
export async function resolveTeamFormsAndPositions(
  supa: SupabaseClient,
  seasonCtx: SeasonCtx,
  gw: number
): Promise<{ teamForms: FormMap; teamPositions: PosMap }> {
  const stored = await loadStoredFormsForGw(supa, gw);

  // Season stack: once this season has results, ranks/form come from season results
  // (updates after the first completed game without waiting for next publish).
  if (seasonCtx.useSeasonStack && seasonCtx.seasonId) {
    const seasonRows = await loadSeasonResultRows(supa, seasonCtx, gw);
    if (seasonRows.length > 0) {
      return {
        teamForms: computeFormFromResults(seasonRows),
        teamPositions: computeTablePositionsFromResults(seasonRows),
      };
    }

    // Pre-season (no results yet): blank form; keep last-season table rank snapshot.
    const fallbackPositions =
      Object.keys(stored.teamPositions).length >= 10
        ? stored.teamPositions
        : await loadLatestStoredPositions(supa);
    return { teamForms: {}, teamPositions: fallbackPositions };
  }

  // Legacy pile: stored snapshot for this GW, else latest ranks if positions missing.
  let { teamForms, teamPositions } = stored;
  if (Object.keys(teamPositions).length < 10) {
    teamPositions = { ...(await loadLatestStoredPositions(supa)), ...teamPositions };
  }
  return { teamForms, teamPositions };
}
