/**
 * Hydrate prediction-flip card caches after a GW is published.
 *
 * - Standings: 1 Football Data call → app_team_forms (form, position, W/D/L, GF/GA)
 * - H2H: 1 call per fixture, spaced out so we stay under FD free-tier ~10 req/min
 */

import { supabase } from './supabase';
import {
  computePlH2HFromMatches,
  type FdH2HMatch,
} from './matchPreviewStats';

const H2H_GAP_MS = 6500; // ~9/min with standings already used
const H2H_LIMIT = 50;

export type HydrateProgress = {
  phase: 'forms' | 'h2h' | 'done' | 'error';
  message: string;
  h2hDone?: number;
  h2hTotal?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFunctionUrl(): string {
  // Same site the admin is open on. Local dev proxies this to the functions server.
  return '/.netlify/functions/fetchFootballData';
}

type StandingTeamPayload = {
  form: string;
  leaguePosition: number | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  /** Club name for PL-style alphabetical tie-break when PTS/GD/GF are equal. */
  sortName: string;
};

function finiteOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Re-rank standings with PL live-table order: points → GD → GF → club name.
 * Football Data sometimes disagrees on fully-tied teams (e.g. LIV vs NEW both 5pts/+2/6GF).
 */
function recomputeLeaguePositions(
  rows: Array<{ teamCode: string; payload: StandingTeamPayload }>
): void {
  const ranked = [...rows].sort((a, b) => {
    const ptsA = (a.payload.won ?? 0) * 3 + (a.payload.drawn ?? 0);
    const ptsB = (b.payload.won ?? 0) * 3 + (b.payload.drawn ?? 0);
    if (ptsB !== ptsA) return ptsB - ptsA;

    const gdA = (a.payload.goalsFor ?? 0) - (a.payload.goalsAgainst ?? 0);
    const gdB = (b.payload.goalsFor ?? 0) - (b.payload.goalsAgainst ?? 0);
    if (gdB !== gdA) return gdB - gdA;

    const gfA = a.payload.goalsFor ?? 0;
    const gfB = b.payload.goalsFor ?? 0;
    if (gfB !== gfA) return gfB - gfA;

    return a.payload.sortName.localeCompare(b.payload.sortName, 'en', { sensitivity: 'base' });
  });

  ranked.forEach((row, idx) => {
    row.payload.leaguePosition = idx + 1;
  });
}

/** One standings call — stores full season snapshot for the GW. */
export async function fetchAndStoreTeamFormsForGw(gw: number): Promise<number> {
  const functionUrl = getFunctionUrl();
  const today = new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({
    resource: 'standings',
    competition: 'PL',
    date: today,
  });
  const response = await fetch(`${functionUrl}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Standings fetch failed: ${response.status}`);
  }
  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error('Invalid standings API response');
  }

  const formsMap = new Map<string, StandingTeamPayload>();
  const standings = result.data?.standings || result.data;
  if (standings && Array.isArray(standings)) {
    const overallTable = standings.find((s: any) => s.type === 'TOTAL') || standings[0];
    if (overallTable?.table && Array.isArray(overallTable.table)) {
      overallTable.table.forEach((team: any) => {
        const teamCode = (team.team?.tla || team.team?.shortName || '').toUpperCase().trim();
        const sortName = String(team.team?.name || team.team?.shortName || teamCode).trim();
        const formRaw = (team.form || '').trim().toUpperCase().replace(/,/g, '');
        const form = formRaw ? formRaw.split('').reverse().join('') : '';
        const played = finiteOrNull(team?.playedGames);
        const won = finiteOrNull(team?.won);
        const drawn = finiteOrNull(team?.draw);
        const lost = finiteOrNull(team?.lost);
        const goalsFor = finiteOrNull(team?.goalsFor);
        const goalsAgainst = finiteOrNull(team?.goalsAgainst);

        if (teamCode && (form || played != null || won != null)) {
          formsMap.set(teamCode, {
            form: form || '',
            leaguePosition: null, // filled by recomputeLeaguePositions
            played,
            won,
            drawn,
            lost,
            goalsFor,
            goalsAgainst,
            sortName,
          });
        }
      });
    }
  }

  if (formsMap.size === 0) {
    console.warn('[predictionCardStats] No standings rows to store');
    return 0;
  }

  recomputeLeaguePositions(
    Array.from(formsMap.entries()).map(([teamCode, payload]) => ({ teamCode, payload }))
  );

  const formsToInsert = Array.from(formsMap.entries()).map(([team_code, payload]) => ({
    gw,
    team_code,
    form: payload.form || '',
    league_position: payload.leaguePosition,
    played: payload.played,
    won: payload.won,
    drawn: payload.drawn,
    lost: payload.lost,
    goals_for: payload.goalsFor,
    goals_against: payload.goalsAgainst,
  }));

  const { error } = await supabase.from('app_team_forms').upsert(formsToInsert, {
    onConflict: 'gw,team_code',
    ignoreDuplicates: false,
  });
  if (error) throw error;
  return formsMap.size;
}

async function fetchHead2HeadMatches(apiMatchId: number): Promise<FdH2HMatch[]> {
  const functionUrl = getFunctionUrl();
  const params = new URLSearchParams({
    resource: 'head2head',
    matchId: String(apiMatchId),
    limit: String(H2H_LIMIT),
  });
  const response = await fetch(`${functionUrl}?${params.toString()}`);
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After') || '60');
    await sleep(Math.max(retryAfter, 60) * 1000);
    return fetchHead2HeadMatches(apiMatchId);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`H2H fetch failed for match ${apiMatchId}: ${response.status} ${text}`);
  }
  const result = await response.json();
  if (!result.success) throw new Error(`H2H fetch unsuccessful for match ${apiMatchId}`);
  const matches = result.data?.matches;
  return Array.isArray(matches) ? matches : [];
}

export type HydrateGwOptions = {
  /** When set, read fixtures from app_season_fixtures for that season. */
  seasonId?: string | null;
};

/** Rate-limited H2H hydrate for every fixture in the GW that has an api_match_id. */
export async function fetchAndStoreH2HForGw(
  gw: number,
  onProgress?: (done: number, total: number) => void,
  opts?: HydrateGwOptions
): Promise<number> {
  let fixtures: any[] | null = null;
  let error: { message: string } | null = null;

  if (opts?.seasonId) {
    const res = await supabase
      .from('app_season_fixtures')
      .select('fixture_index, api_match_id, home_code, away_code')
      .eq('season_id', opts.seasonId)
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });
    fixtures = res.data;
    error = res.error;
  } else {
    const res = await supabase
      .from('app_fixtures')
      .select('fixture_index, api_match_id, home_code, away_code')
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });
    fixtures = res.data;
    error = res.error;
  }
  if (error) throw error;

  const withMatchId = (fixtures || []).filter((f: any) => Number(f.api_match_id) > 0);
  if ((fixtures || []).length > 0 && withMatchId.length === 0) {
    throw new Error('These fixtures have no API match id, so head-to-head could not be pulled. Nothing was published.');
  }
  const rows = withMatchId;
  let stored = 0;
  const failed: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const f = rows[i] as any;
    const apiMatchId = Number(f.api_match_id);
    const homeCode = String(f.home_code || '').toUpperCase();
    const awayCode = String(f.away_code || '').toUpperCase();
    onProgress?.(i, rows.length);

    try {
      const matches = await fetchHead2HeadMatches(apiMatchId);
      const h2h = computePlH2HFromMatches({
        matches,
        homeCode,
        awayCode,
      });

      const { error: upsertError } = await supabase.from('app_fixture_h2h').upsert(
        {
          gw,
          api_match_id: apiMatchId,
          home_code: homeCode || null,
          away_code: awayCode || null,
          home_wins: h2h.homeWins,
          draws: h2h.draws,
          away_wins: h2h.awayWins,
          number_of_matches: h2h.numberOfMatches,
        },
        { onConflict: 'gw,api_match_id', ignoreDuplicates: false }
      );
      if (upsertError) throw upsertError;
      stored += 1;
    } catch (err) {
      console.error(`[predictionCardStats] H2H failed for match ${apiMatchId}:`, err);
      failed.push(apiMatchId);
    }

    onProgress?.(i + 1, rows.length);
    if (i < rows.length - 1) await sleep(H2H_GAP_MS);
  }

  if (failed.length > 0) {
    throw new Error(
      `Head-to-head failed for ${failed.length} of ${rows.length} fixtures. Nothing was published. Hit Publish again to retry.`
    );
  }

  return stored;
}

/**
 * Full hydrate for a GW: standings (1 call) then H2H (1/fixture, spaced).
 * Call this BEFORE flipping current_gw / sending the “predictions ready” push.
 */
export async function hydratePredictionCardStatsForGw(
  gw: number,
  onProgress?: (p: HydrateProgress) => void,
  opts?: HydrateGwOptions
): Promise<{ formsCount: number; h2hCount: number }> {
  onProgress?.({ phase: 'forms', message: `Fetching standings for GW ${gw}…` });
  const formsCount = await fetchAndStoreTeamFormsForGw(gw);
  if (formsCount === 0) {
    throw new Error(`No team forms stored for GW ${gw} — aborting before publish`);
  }
  onProgress?.({
    phase: 'h2h',
    message: `Stored ${formsCount} team forms. Fetching H2H (~6s between fixtures)…`,
    h2hDone: 0,
    h2hTotal: 0,
  });

  const h2hCount = await fetchAndStoreH2HForGw(
    gw,
    (done, total) => {
      onProgress?.({
        phase: 'h2h',
        message: `H2H ${done}/${total}…`,
        h2hDone: done,
        h2hTotal: total,
      });
    },
    opts
  );

  onProgress?.({
    phase: 'done',
    message: `Card stats ready for GW ${gw}: ${formsCount} forms, ${h2hCount} H2H.`,
  });
  return { formsCount, h2hCount };
}
