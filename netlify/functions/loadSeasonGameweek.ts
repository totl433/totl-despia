/**
 * Season stack admin API (Pile B only — never touches legacy app_meta / app_fixtures).
 *
 * POST /.netlify/functions/loadSeasonGameweek
 * Authorization: Bearer <supabase access token>
 * Body:
 *   { action: 'list' }
 *   { action: 'ensureSeason', label, yearStart, yearEnd, footballDataSeason, status? }
 *   { action: 'load', label?, seasonId?, yearStart?, yearEnd?, footballDataSeason?, gw, replace? }
 *   { action: 'open', seasonId | label, gw }
 *   { action: 'setTester', userId, seasonId | label, useSeasonStack, viewingGw? }
 *
 * Open season updates app_season_runtime ONLY (hard switch for folder-aware clients).
 * Load writes fixtures into app_season_fixtures only.
 */
import type { Handler } from '@netlify/functions';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ADMIN_USER_IDS = new Set([
  '4542c037-5b38-40d0-b189-847b8f17c222',
  '36f31625-6d6c-4aa4-815a-1493a812841b',
]);

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY?.trim() || '';
const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

type FdMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: {
    shortName?: string;
    name?: string;
    tla?: string;
    crest?: string;
  };
  awayTeam: {
    shortName?: string;
    name?: string;
    tla?: string;
    crest?: string;
  };
};

type Body = {
  action?: string;
  label?: string;
  seasonId?: string;
  yearStart?: number;
  yearEnd?: number;
  footballDataSeason?: number;
  status?: string;
  gw?: number;
  replace?: boolean;
  userId?: string;
  useSeasonStack?: boolean;
  viewingGw?: number;
};

function adminClient(): SupabaseClient {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireAdmin(event: { headers: Record<string, string | undefined> }) {
  const auth =
    event.headers.authorization ||
    event.headers.Authorization ||
    '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return { error: json(401, { error: 'Missing Authorization Bearer token' }) };
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const anon = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anon) {
    return { error: json(500, { error: 'Missing Supabase anon credentials' }) };
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return { error: json(401, { error: 'Invalid session' }) };
  }
  if (!ADMIN_USER_IDS.has(data.user.id)) {
    return { error: json(403, { error: 'Admin only' }) };
  }
  return { userId: data.user.id };
}

async function ensureSeason(
  sb: SupabaseClient,
  opts: {
    label: string;
    yearStart: number;
    yearEnd: number;
    footballDataSeason: number;
    status?: string;
  }
) {
  const status = opts.status || 'draft';
  const { data: existing, error: findErr } = await sb
    .from('app_seasons')
    .select('*')
    .eq('label', opts.label)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: createErr } = await sb
    .from('app_seasons')
    .insert({
      label: opts.label,
      year_start: opts.yearStart,
      year_end: opts.yearEnd,
      football_data_season: opts.footballDataSeason,
      status,
    })
    .select('*')
    .single();
  if (createErr) throw createErr;
  return created;
}

async function resolveSeason(
  sb: SupabaseClient,
  body: Body
): Promise<{ id: string; label: string; football_data_season: number; year_start: number; year_end: number }> {
  if (body.seasonId) {
    const { data, error } = await sb
      .from('app_seasons')
      .select('*')
      .eq('id', body.seasonId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Season not found: ${body.seasonId}`);
    return data;
  }

  if (body.label) {
    const yearStart = body.yearStart ?? parseInt(body.label.split('/')[0], 10);
    const yearEnd =
      body.yearEnd ??
      (body.label.includes('/')
        ? 2000 + parseInt(body.label.split('/')[1], 10)
        : yearStart + 1);
    // 2026/27 => football_data_season 2026
    const fd =
      body.footballDataSeason ??
      yearStart;

    const season = await ensureSeason(sb, {
      label: body.label,
      yearStart,
      yearEnd: yearEnd < 100 ? 2000 + yearEnd : yearEnd,
      footballDataSeason: fd,
    });
    return season;
  }

  throw new Error('Provide seasonId or label');
}

function mapMatchesToFixtures(seasonId: string, gw: number, matches: FdMatch[]) {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
  return sorted.map((match, index) => ({
    season_id: seasonId,
    gw,
    fixture_index: index,
    home_team: match.homeTeam.shortName || match.homeTeam.name || 'Home',
    away_team: match.awayTeam.shortName || match.awayTeam.name || 'Away',
    home_code: match.homeTeam.tla || null,
    away_code: match.awayTeam.tla || null,
    home_name: match.homeTeam.name || null,
    away_name: match.awayTeam.name || null,
    home_crest: match.homeTeam.crest || null,
    away_crest: match.awayTeam.crest || null,
    kickoff_time: match.utcDate,
    api_match_id: match.id,
    status: match.status || null,
  }));
}

async function fetchMatchday(footballDataSeason: number, gw: number): Promise<FdMatch[]> {
  const apiUrl =
    `${FOOTBALL_DATA_BASE_URL}/competitions/PL/matches` +
    `?season=${footballDataSeason}&matchday=${gw}`;
  const response = await fetch(apiUrl, {
    headers: {
      'X-Auth-Token': FOOTBALL_DATA_API_KEY,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Football Data API ${response.status}: ${text.slice(0, 300)}`);
  }
  const payload = (await response.json()) as { matches?: FdMatch[] };
  return payload.matches || [];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  try {
    const auth = await requireAdmin(event);
    if ('error' in auth && auth.error) return auth.error;

    const sb = adminClient();
    let body: Body = {};
    try {
      body = event.body ? (JSON.parse(event.body) as Body) : {};
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }

    const action = body.action || 'load';

    if (action === 'list') {
      const { data: seasons, error: sErr } = await sb
        .from('app_seasons')
        .select('*')
        .order('year_start', { ascending: true });
      if (sErr) {
        if (sErr.code === 'PGRST205' || sErr.message?.includes('app_seasons')) {
          return json(409, {
            error: 'Pile B schema not installed',
            hint: 'Run supabase/sql/app_seasons_pile_b.sql in Supabase SQL Editor first.',
          });
        }
        throw sErr;
      }

      const { data: runtime, error: rErr } = await sb
        .from('app_season_runtime')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (rErr) throw rErr;

      const fixtureCounts: Record<string, number> = {};
      for (const season of seasons || []) {
        const { count, error: cErr } = await sb
          .from('app_season_fixtures')
          .select('*', { count: 'exact', head: true })
          .eq('season_id', season.id);
        if (cErr) throw cErr;
        fixtureCounts[season.id] = count ?? 0;
      }

      const { data: legacyMeta } = await sb
        .from('app_meta')
        .select('current_gw')
        .eq('id', 1)
        .maybeSingle();

      return json(200, {
        success: true,
        seasons: seasons || [],
        runtime,
        fixtureCounts,
        legacy: {
          note: 'Legacy pile used by current App Store / old web — do not change for seasons',
          current_gw: legacyMeta?.current_gw ?? null,
        },
      });
    }

    if (action === 'ensureSeason') {
      if (!body.label || body.yearStart == null || body.yearEnd == null || body.footballDataSeason == null) {
        return json(400, {
          error: 'ensureSeason requires label, yearStart, yearEnd, footballDataSeason',
        });
      }
      const season = await ensureSeason(sb, {
        label: body.label,
        yearStart: body.yearStart,
        yearEnd: body.yearEnd,
        footballDataSeason: body.footballDataSeason,
        status: body.status,
      });
      return json(200, { success: true, season });
    }

    if (action === 'load') {
      if (!body.gw || body.gw < 1 || body.gw > 40) {
        return json(400, { error: 'load requires gw (1–40)' });
      }
      if (!FOOTBALL_DATA_API_KEY) {
        return json(500, { error: 'Live-score provider is not configured' });
      }
      const season = await resolveSeason(sb, body);
      const matches = await fetchMatchday(season.football_data_season, body.gw);
      if (!matches.length) {
        return json(404, {
          error: `No matches from Football Data for season=${season.football_data_season} matchday=${body.gw}`,
        });
      }

      if (body.replace !== false) {
        const { error: delErr } = await sb
          .from('app_season_fixtures')
          .delete()
          .eq('season_id', season.id)
          .eq('gw', body.gw);
        if (delErr) throw delErr;
      }

      const rows = mapMatchesToFixtures(season.id, body.gw, matches);
      const { data: inserted, error: insErr } = await sb
        .from('app_season_fixtures')
        .insert(rows)
        .select('fixture_index, home_team, away_team, home_code, away_code, kickoff_time, api_match_id, status');
      if (insErr) throw insErr;

      return json(200, {
        success: true,
        season: {
          id: season.id,
          label: season.label,
          football_data_season: season.football_data_season,
        },
        gw: body.gw,
        fixtureCount: rows.length,
        fixtures: inserted,
        legacyUntouched: true,
      });
    }

    if (action === 'open') {
      if (!body.gw || body.gw < 1) {
        return json(400, { error: 'open requires gw' });
      }
      const season = await resolveSeason(sb, body);

      // Mark previous active closed if different
      const { data: previousActive } = await sb
        .from('app_seasons')
        .select('id')
        .eq('status', 'active');
      for (const prev of previousActive || []) {
        if (prev.id !== season.id) {
          await sb.from('app_seasons').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', prev.id);
        }
      }

      const { error: stErr } = await sb
        .from('app_seasons')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', season.id);
      if (stErr) throw stErr;

      const { data: runtime, error: rtErr } = await sb
        .from('app_season_runtime')
        .upsert(
          {
            id: 1,
            current_season_id: season.id,
            current_gw: body.gw,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();
      if (rtErr) throw rtErr;

      return json(200, {
        success: true,
        opened: {
          seasonId: season.id,
          label: season.label,
          gw: body.gw,
        },
        runtime,
        warning:
          'Hard switch for folder-aware clients only. Legacy app_meta.current_gw was NOT changed.',
      });
    }

    if (action === 'setTester') {
      if (!body.userId) return json(400, { error: 'setTester requires userId' });
      const season = body.useSeasonStack === false ? null : await resolveSeason(sb, body);

      const patch: Record<string, unknown> = {
        use_season_stack: !!body.useSeasonStack,
        current_viewing_season_id: season?.id ?? null,
      };
      if (body.viewingGw != null) {
        patch.current_viewing_gw = body.viewingGw;
      }

      const { data, error } = await sb
        .from('user_notification_preferences')
        .update(patch)
        .eq('user_id', body.userId)
        .select('user_id, use_season_stack, current_viewing_season_id, current_viewing_gw')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return json(404, {
          error: 'user_notification_preferences row missing for that user',
          patch,
        });
      }
      return json(200, { success: true, prefs: data, season: season || null });
    }

    return json(400, { error: `Unknown action: ${action}` });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[loadSeasonGameweek]', message);
    if (message.includes('app_seasons') || message.includes('schema cache')) {
      return json(409, {
        error: message,
        hint: 'Run supabase/sql/app_seasons_pile_b.sql in Supabase SQL Editor first.',
      });
    }
    return json(500, { error: message });
  }
};
