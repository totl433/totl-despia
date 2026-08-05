/**
 * Premier League form + table ranks for fixture cards (web).
 *
 * Pre-season: blank form; ranks may use last stored snapshot.
 * After results exist on the active season stack: form + ranks from this season's results.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSeasonTables,
  withSeasonId,
  type SeasonCtx,
} from './seasonStack';

type PosMap = Record<string, number>;
type FormMap = Record<string, string>;

function normCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

export function computeTablePositionsFromResults(
  rows: Array<{ home_code: string; away_code: string; result: 'H' | 'D' | 'A' }>
): PosMap {
  type Stat = { played: number; pts: number; w: number };
  const stats = new Map<string, Stat>();
  const touch = (code: string): Stat => {
    let s = stats.get(code);
    if (!s) {
      s = { played: 0, pts: 0, w: 0 };
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
    } else if (row.result === 'A') {
      a.pts += 3;
      a.w += 1;
    } else {
      h.pts += 1;
      a.pts += 1;
    }
  }

  const ordered = Array.from(stats.entries()).sort(([, x], [, y]) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.w !== x.w) return y.w - x.w;
    return 0;
  });

  const out: PosMap = {};
  ordered.forEach(([code], idx) => {
    out[code] = idx + 1;
  });
  return out;
}

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
): Promise<{ teamForms: FormMap; teamPositions: PosMap }> {
  const { data, error } = await (supa as any)
    .from('app_team_forms')
    .select('team_code, form, league_position')
    .eq('gw', gw);
  if (error) throw error;

  const teamForms: FormMap = {};
  const teamPositions: PosMap = {};
  (data ?? []).forEach((row: any) => {
    const code = normCode(row?.team_code);
    if (!code) return;
    const form = typeof row?.form === 'string' ? row.form.trim().toUpperCase() : '';
    if (form) teamForms[code] = form;
    const position = Number(row?.league_position);
    if (Number.isFinite(position) && position > 0) teamPositions[code] = Math.trunc(position);
  });
  return { teamForms, teamPositions };
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

type JoinRow = {
  home_code: string;
  away_code: string;
  result: 'H' | 'D' | 'A';
  gw: number;
  fixture_index: number;
};

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
  resultsQ = withSeasonId(resultsQ, seasonCtx);

  let fixturesQ = (supa as any)
    .from(tables.fixtures)
    .select('gw, fixture_index, home_code, away_code')
    .lte('gw', throughGw);
  fixturesQ = withSeasonId(fixturesQ, seasonCtx);

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
 * Resolve forms + table ranks for prediction / fixture surfaces.
 */
export async function resolveTeamFormsAndPositions(
  supa: SupabaseClient,
  seasonCtx: SeasonCtx | null | undefined,
  gw: number
): Promise<{ teamForms: FormMap; teamPositions: PosMap }> {
  const ctx: SeasonCtx = seasonCtx ?? {
    useSeasonStack: false,
    seasonId: null,
    seasonLabel: null,
    currentGw: gw,
    viewingGw: null,
  };

  const stored = await loadStoredFormsForGw(supa, gw);

  if (ctx.useSeasonStack && ctx.seasonId) {
    const seasonRows = await loadSeasonResultRows(supa, ctx, gw);
    if (seasonRows.length > 0) {
      return {
        teamForms: computeFormFromResults(seasonRows),
        teamPositions: computeTablePositionsFromResults(seasonRows),
      };
    }
    const fallbackPositions =
      Object.keys(stored.teamPositions).length >= 10
        ? stored.teamPositions
        : await loadLatestStoredPositions(supa);
    return { teamForms: {}, teamPositions: fallbackPositions };
  }

  let { teamForms, teamPositions } = stored;
  if (Object.keys(teamPositions).length < 10) {
    teamPositions = { ...(await loadLatestStoredPositions(supa)), ...teamPositions };
  }
  return { teamForms, teamPositions };
}
