/**
 * Dual-stack helpers for live score polling and score notifications.
 * Legacy: app_meta + app_fixtures + app_gw_results + app_picks
 * Pile B: app_season_runtime + app_season_fixtures + app_season_results + app_season_picks
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type StackSource = 'legacy' | 'season';

export type FixtureSourceRef = {
  stack: StackSource;
  seasonId?: string;
  gw: number;
  fixture_index: number;
};

export type PollFixture = {
  api_match_id: number;
  fixture_index: number;
  home_team: string | null;
  away_team: string | null;
  kickoff_time: string | null;
  /** GW written to live_scores (prefer season when present) */
  gw: number;
  sources: FixtureSourceRef[];
};

export type ResolvedRuntime = {
  legacyGw: number | null;
  seasonId: string | null;
  seasonGw: number | null;
};

/**
 * Resolve current GWs for both stacks (service-role client).
 */
export async function resolveDualStackRuntime(
  sb: SupabaseClient
): Promise<ResolvedRuntime> {
  const [metaRes, runtimeRes] = await Promise.all([
    sb.from('app_meta').select('current_gw').eq('id', 1).maybeSingle(),
    sb
      .from('app_season_runtime')
      .select('current_season_id, current_gw')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const legacyGw =
    metaRes.error || !metaRes.data
      ? null
      : ((metaRes.data as { current_gw?: number | null }).current_gw ?? null);

  let seasonId: string | null = null;
  let seasonGw: number | null = null;
  if (!runtimeRes.error && runtimeRes.data) {
    const rt = runtimeRes.data as {
      current_season_id?: string | null;
      current_gw?: number | null;
    };
    seasonId = rt.current_season_id ?? null;
    seasonGw = rt.current_gw ?? null;
  }

  return {
    legacyGw: typeof legacyGw === 'number' ? legacyGw : null,
    seasonId,
    seasonGw: typeof seasonGw === 'number' ? seasonGw : null,
  };
}

/**
 * Load fixtures to poll from both stacks (current GW … current+5).
 * Dedupes by api_match_id; keeps source refs for result writes to both tables.
 */
export async function loadDualStackFixturesToPoll(
  sb: SupabaseClient,
  runtime: ResolvedRuntime
): Promise<{ fixtures: PollFixture[]; debug: string[] }> {
  const debug: string[] = [];
  const byMatch = new Map<number, PollFixture>();

  const merge = (
    row: {
      api_match_id: number | null;
      fixture_index: number;
      home_team?: string | null;
      away_team?: string | null;
      kickoff_time?: string | null;
      gw: number;
    },
    source: FixtureSourceRef
  ) => {
    if (!row.api_match_id) return;
    const existing = byMatch.get(row.api_match_id);
    if (!existing) {
      byMatch.set(row.api_match_id, {
        api_match_id: row.api_match_id,
        fixture_index: row.fixture_index,
        home_team: row.home_team ?? null,
        away_team: row.away_team ?? null,
        kickoff_time: row.kickoff_time ?? null,
        // Prefer season stack GW/index for live_scores when both present
        gw: source.stack === 'season' ? source.gw : row.gw,
        sources: [source],
      });
      return;
    }
    existing.sources.push(source);
    if (source.stack === 'season') {
      existing.gw = source.gw;
      existing.fixture_index = source.fixture_index;
    }
    if (!existing.kickoff_time && row.kickoff_time) {
      existing.kickoff_time = row.kickoff_time;
    }
  };

  // Legacy: app_fixtures (+ optional web fixtures for current GW only)
  if (runtime.legacyGw != null && runtime.legacyGw > 0) {
    const gw = runtime.legacyGw;
    const [regular, app] = await Promise.all([
      sb
        .from('fixtures')
        .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, gw')
        .eq('gw', gw)
        .not('api_match_id', 'is', null),
      sb
        .from('app_fixtures')
        .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, gw')
        .gte('gw', gw)
        .lte('gw', gw + 5)
        .not('api_match_id', 'is', null)
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true }),
    ]);

    if (regular.error) {
      debug.push(`legacy fixtures error: ${regular.error.message}`);
    }
    if (app.error) {
      debug.push(`app_fixtures error: ${app.error.message}`);
    }

    ((regular.data || []) as any[]).forEach((f) => {
      merge(
        { ...f, gw: f.gw || gw },
        { stack: 'legacy', gw: f.gw || gw, fixture_index: f.fixture_index }
      );
    });
    ((app.data || []) as any[]).forEach((f) => {
      merge(
        { ...f, gw: f.gw || gw },
        { stack: 'legacy', gw: f.gw || gw, fixture_index: f.fixture_index }
      );
    });

    debug.push(
      `legacy GW ${gw}: ${(regular.data || []).length} web fixtures, ${(app.data || []).length} app_fixtures`
    );
  } else {
    debug.push('legacy stack: no current_gw in app_meta');
  }

  // Season (Pile B)
  if (runtime.seasonId && runtime.seasonGw != null && runtime.seasonGw > 0) {
    const seasonId = runtime.seasonId;
    const gw = runtime.seasonGw;
    const { data, error } = await sb
      .from('app_season_fixtures')
      .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, gw, season_id')
      .eq('season_id', seasonId)
      .gte('gw', gw)
      .lte('gw', gw + 5)
      .not('api_match_id', 'is', null)
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true });

    if (error) {
      debug.push(`app_season_fixtures error: ${error.message}`);
    } else {
      ((data || []) as any[]).forEach((f) => {
        merge(
          { ...f, gw: f.gw || gw },
          {
            stack: 'season',
            seasonId,
            gw: f.gw || gw,
            fixture_index: f.fixture_index,
          }
        );
      });
      debug.push(
        `season ${seasonId.slice(0, 8)}… GW ${gw}: ${(data || []).length} app_season_fixtures`
      );
    }
  } else {
    debug.push('season stack: no active season/gw in app_season_runtime');
  }

  return { fixtures: Array.from(byMatch.values()), debug };
}

export type FinishedResultRow = {
  stack: StackSource;
  seasonId?: string;
  gw: number;
  fixture_index: number;
  result: 'H' | 'A' | 'D';
  home_score: number;
  away_score: number;
  api_match_id: number;
};

/**
 * Upsert finished outcomes into legacy and/or season results tables.
 */
export async function upsertDualStackResults(
  sb: SupabaseClient,
  rows: FinishedResultRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const legacy = rows
    .filter((r) => r.stack === 'legacy')
    .map((r) => ({
      gw: r.gw,
      fixture_index: r.fixture_index,
      result: r.result,
    }));

  // Dedupe legacy by gw+index
  const legacyMap = new Map<string, (typeof legacy)[0]>();
  legacy.forEach((r) => legacyMap.set(`${r.gw}:${r.fixture_index}`, r));
  const legacyUnique = Array.from(legacyMap.values());

  if (legacyUnique.length > 0) {
    const { error } = await sb
      .from('app_gw_results')
      .upsert(legacyUnique, { onConflict: 'gw,fixture_index' });
    if (error) {
      console.error('[seasonStackPoll] Error upserting app_gw_results:', error);
    } else {
      console.log(`[seasonStackPoll] Upserted ${legacyUnique.length} rows into app_gw_results`);
    }
  }

  const season = rows
    .filter((r) => r.stack === 'season' && r.seasonId)
    .map((r) => ({
      season_id: r.seasonId!,
      gw: r.gw,
      fixture_index: r.fixture_index,
      result: r.result,
      home_score: r.home_score,
      away_score: r.away_score,
      api_match_id: r.api_match_id,
    }));

  const seasonMap = new Map<string, (typeof season)[0]>();
  season.forEach((r) =>
    seasonMap.set(`${r.season_id}:${r.gw}:${r.fixture_index}`, r)
  );
  const seasonUnique = Array.from(seasonMap.values());

  if (seasonUnique.length > 0) {
    const { error } = await sb
      .from('app_season_results')
      .upsert(seasonUnique, { onConflict: 'season_id,gw,fixture_index' });
    if (error) {
      console.error('[seasonStackPoll] Error upserting app_season_results:', error);
    } else {
      console.log(
        `[seasonStackPoll] Upserted ${seasonUnique.length} rows into app_season_results`
      );
    }
  }
}

/**
 * Fixture resolution for webhooks: may exist on one or both stacks.
 */
export type WebhookFixtureInfo = {
  fixture_index: number;
  gw: number;
  home_team: string;
  away_team: string;
  kickoff_time: string | null;
  isTestFixture: boolean;
  isAppFixture: boolean;
  isSeasonFixture: boolean;
  seasonId: string | null;
  testGwForPicks: number | null;
  /** All source GWs/indices for dual writes */
  sources: FixtureSourceRef[];
};

export async function fetchWebhookFixtureInfo(
  sb: SupabaseClient,
  apiMatchId: number
): Promise<WebhookFixtureInfo | null> {
  const [regularFixture, testFixture, appFixture, seasonFixture] = await Promise.all([
    sb
      .from('fixtures')
      .select('fixture_index, gw, home_team, away_team, kickoff_time')
      .eq('api_match_id', apiMatchId)
      .maybeSingle(),
    sb
      .from('test_api_fixtures')
      .select('fixture_index, test_gw, home_team, away_team, kickoff_time')
      .eq('api_match_id', apiMatchId)
      .maybeSingle(),
    sb
      .from('app_fixtures')
      .select('fixture_index, gw, home_team, away_team, kickoff_time')
      .eq('api_match_id', apiMatchId)
      .maybeSingle(),
    sb
      .from('app_season_fixtures')
      .select('fixture_index, gw, home_team, away_team, kickoff_time, season_id')
      .eq('api_match_id', apiMatchId)
      .maybeSingle(),
  ]);

  const sources: FixtureSourceRef[] = [];
  if (appFixture.data) {
    const f = appFixture.data as any;
    sources.push({
      stack: 'legacy',
      gw: f.gw,
      fixture_index: f.fixture_index,
    });
  }
  if (seasonFixture.data) {
    const f = seasonFixture.data as any;
    sources.push({
      stack: 'season',
      seasonId: f.season_id,
      gw: f.gw,
      fixture_index: f.fixture_index,
    });
  }

  // Prefer season > app > test > regular for display fields
  const primary =
    seasonFixture.data || appFixture.data || testFixture.data || regularFixture.data;
  if (!primary) return null;

  const isTestFixture = !!testFixture.data;
  const isAppFixture = !!appFixture.data;
  const isSeasonFixture = !!seasonFixture.data;
  const fixtureGw =
    (primary as any).gw || (primary as any).test_gw || 1;
  const testGwForPicks =
    (testFixture.data as any)?.test_gw || (isTestFixture ? 1 : null);

  // Prefer season for GW/index (new clients)
  const gw =
    (seasonFixture.data as any)?.gw ??
    (appFixture.data as any)?.gw ??
    fixtureGw;
  const fixture_index =
    (seasonFixture.data as any)?.fixture_index ??
    (appFixture.data as any)?.fixture_index ??
    (primary as any).fixture_index;

  return {
    fixture_index,
    gw,
    home_team: (primary as any).home_team,
    away_team: (primary as any).away_team,
    kickoff_time: (primary as any).kickoff_time ?? null,
    isTestFixture,
    isAppFixture,
    isSeasonFixture,
    seasonId: (seasonFixture.data as any)?.season_id ?? null,
    testGwForPicks,
    sources:
      sources.length > 0
        ? sources
        : [
            {
              stack: 'legacy',
              gw,
              fixture_index,
            },
          ],
  };
}

/**
 * Users with picks for a fixture across legacy and/or season tables.
 */
export async function fetchDualStackFixturePicks(
  sb: SupabaseClient,
  fixture: Pick<
    WebhookFixtureInfo,
    | 'gw'
    | 'fixture_index'
    | 'isAppFixture'
    | 'isSeasonFixture'
    | 'isTestFixture'
    | 'seasonId'
    | 'testGwForPicks'
    | 'sources'
  >,
  includePick: boolean = false
): Promise<{ userId: string; pick?: string }[]> {
  const selectFields = includePick ? 'user_id, pick' : 'user_id';
  const byUser = new Map<string, { userId: string; pick?: string }>();

  const addRows = (rows: any[] | null) => {
    (rows || []).forEach((p) => {
      if (!p.user_id) return;
      if (!byUser.has(p.user_id) || includePick) {
        byUser.set(p.user_id, { userId: p.user_id, pick: p.pick });
      }
    });
  };

  const hasLegacy =
    fixture.isAppFixture ||
    fixture.sources.some((s) => s.stack === 'legacy');
  const seasonSources = fixture.sources.filter((s) => s.stack === 'season' && s.seasonId);

  const tasks: Promise<void>[] = [];

  if (hasLegacy) {
    const legGw =
      fixture.sources.find((s) => s.stack === 'legacy')?.gw ?? fixture.gw;
    const legIdx =
      fixture.sources.find((s) => s.stack === 'legacy')?.fixture_index ??
      fixture.fixture_index;
    tasks.push(
      sb
        .from('app_picks')
        .select(selectFields)
        .eq('gw', legGw)
        .eq('fixture_index', legIdx)
        .then(({ data }) => addRows(data as any[]))
    );
  }

  for (const src of seasonSources) {
    tasks.push(
      sb
        .from('app_season_picks')
        .select(selectFields)
        .eq('season_id', src.seasonId!)
        .eq('gw', src.gw)
        .eq('fixture_index', src.fixture_index)
        .then(({ data }) => addRows(data as any[]))
    );
  }

  // Single season fixture without legacy (sources only season, or isSeasonFixture)
  if (
    fixture.isSeasonFixture &&
    seasonSources.length === 0 &&
    fixture.seasonId
  ) {
    tasks.push(
      sb
        .from('app_season_picks')
        .select(selectFields)
        .eq('season_id', fixture.seasonId)
        .eq('gw', fixture.gw)
        .eq('fixture_index', fixture.fixture_index)
        .then(({ data }) => addRows(data as any[]))
    );
  }

  if (fixture.isTestFixture && fixture.testGwForPicks) {
    tasks.push(
      sb
        .from('test_api_picks')
        .select(selectFields)
        .eq('matchday', fixture.testGwForPicks)
        .eq('fixture_index', fixture.fixture_index)
        .then(({ data }) => addRows(data as any[]))
    );
  }

  // Pure web fixtures (no app/season)
  if (
    !fixture.isAppFixture &&
    !fixture.isSeasonFixture &&
    !fixture.isTestFixture
  ) {
    tasks.push(
      sb
        .from('picks')
        .select(selectFields)
        .eq('gw', fixture.gw)
        .eq('fixture_index', fixture.fixture_index)
        .then(({ data }) => addRows(data as any[]))
    );
  }

  await Promise.all(tasks);
  return Array.from(byUser.values());
}

/**
 * After FT: ensure results rows exist for every stack source; detect all-GW finished.
 */
export async function finalizeFixtureResultsDualStack(
  sb: SupabaseClient,
  fixture: WebhookFixtureInfo,
  live: {
    api_match_id: number;
    home_score: number;
    away_score: number;
    status: string;
  }
): Promise<{ allFinishedLegacy: boolean; allFinishedSeason: boolean }> {
  let result: 'H' | 'A' | 'D';
  if (live.home_score > live.away_score) result = 'H';
  else if (live.away_score > live.home_score) result = 'A';
  else result = 'D';

  const finishedRows: FinishedResultRow[] = fixture.sources.map((src) => ({
    stack: src.stack,
    seasonId: src.seasonId,
    gw: src.gw,
    fixture_index: src.fixture_index,
    result,
    home_score: live.home_score,
    away_score: live.away_score,
    api_match_id: live.api_match_id,
  }));

  // If only test/web sources with empty sources array was defaulted to legacy — still OK
  await upsertDualStackResults(sb, finishedRows);

  let allFinishedLegacy = false;
  let allFinishedSeason = false;

  const legacySrc = fixture.sources.find((s) => s.stack === 'legacy');
  if (legacySrc) {
    allFinishedLegacy = await isGwAllFinished(
      sb,
      'legacy',
      legacySrc.gw,
      undefined
    );
  }

  const seasonSrc = fixture.sources.find((s) => s.stack === 'season' && s.seasonId);
  if (seasonSrc?.seasonId) {
    allFinishedSeason = await isGwAllFinished(
      sb,
      'season',
      seasonSrc.gw,
      seasonSrc.seasonId
    );
  }

  return { allFinishedLegacy, allFinishedSeason };
}

export async function isGwAllFinished(
  sb: SupabaseClient,
  stack: StackSource,
  gw: number,
  seasonId?: string
): Promise<boolean> {
  let fixtures: { api_match_id: number | null }[] | null = null;

  if (stack === 'legacy') {
    const { data } = await sb
      .from('app_fixtures')
      .select('api_match_id')
      .eq('gw', gw)
      .not('api_match_id', 'is', null);
    fixtures = data as any[];
  } else if (seasonId) {
    const { data } = await sb
      .from('app_season_fixtures')
      .select('api_match_id')
      .eq('season_id', seasonId)
      .eq('gw', gw)
      .not('api_match_id', 'is', null);
    fixtures = data as any[];
  }

  if (!fixtures || fixtures.length === 0) return false;

  const apiMatchIds = fixtures
    .map((f) => f.api_match_id)
    .filter((id): id is number => id != null);

  if (apiMatchIds.length === 0) return false;

  const { data: liveScores } = await sb
    .from('live_scores')
    .select('api_match_id, status')
    .in('api_match_id', apiMatchIds);

  const finished = new Set(
    (liveScores || [])
      .filter((s: any) => s.status === 'FINISHED' || s.status === 'FT')
      .map((s: any) => s.api_match_id)
  );

  return apiMatchIds.every((id) => finished.has(id));
}

/**
 * User IDs who played a GW (submissions, paginated; picks as fallback).
 */
async function fetchDistinctUserIds(
  sb: SupabaseClient,
  table: string,
  applyFilters: (query: any) => any
): Promise<string[]> {
  const ids = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await applyFilters(sb.from(table).select('user_id')).range(from, to);
    if (error) throw error;
    const page = data ?? [];
    for (const row of page as Array<{ user_id?: string | null }>) {
      if (row.user_id) ids.add(row.user_id);
    }
    if (page.length < pageSize) break;
  }
  return [...ids];
}

export async function fetchGwPickerUserIds(
  sb: SupabaseClient,
  stack: StackSource,
  gw: number,
  seasonId?: string | null
): Promise<string[]> {
  if (stack === 'season' && seasonId) {
    const fromSubmissions = await fetchDistinctUserIds(sb, 'app_season_submissions', (q) =>
      q.eq('season_id', seasonId).eq('gw', gw).not('submitted_at', 'is', null)
    );
    if (fromSubmissions.length > 0) return fromSubmissions;
    return fetchDistinctUserIds(sb, 'app_season_picks', (q) => q.eq('season_id', seasonId).eq('gw', gw));
  }

  const fromSubmissions = await fetchDistinctUserIds(sb, 'app_gw_submissions', (q) =>
    q.eq('gw', gw).not('submitted_at', 'is', null)
  );
  if (fromSubmissions.length > 0) return fromSubmissions;
  return fetchDistinctUserIds(sb, 'app_picks', (q) => q.eq('gw', gw));
}
