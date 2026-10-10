import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  buildGwDeadlinesFromFixtures,
  computeOpeningUnicornWinRate,
} from '../../src/lib/openingUnicornWinRate';
import type { LeagueScoringPick, LeagueScoringResultRow } from '../../src/lib/leagueScoring';
import { resolveDualStackRuntime } from './lib/seasonStackPoll';

const CACHE_MAX_AGE_SEC = 3600;

function json(statusCode: number, body: unknown, cache = false) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      ...(cache ? { 'Cache-Control': `public, max-age=${CACHE_MAX_AGE_SEC}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

type StackKind = 'legacy' | 'season';

async function loadStackData(
  admin: ReturnType<typeof createClient>,
  kind: StackKind,
  seasonId: string | null
) {
  if (kind === 'season' && seasonId) {
    const [fixturesRes, resultsRes, picksRes] = await Promise.all([
      admin
        .from('app_season_fixtures')
        .select('gw, fixture_index, kickoff_time')
        .eq('season_id', seasonId)
        .is('api_match_id', null),
      admin
        .from('app_season_results')
        .select('gw, fixture_index, result, home_goals, away_goals')
        .eq('season_id', seasonId),
      admin
        .from('app_season_picks')
        .select('user_id, gw, fixture_index, pick')
        .eq('season_id', seasonId),
    ]);

    return {
      fixtures: fixturesRes.data ?? [],
      results: (resultsRes.data ?? []) as LeagueScoringResultRow[],
      picks: (picksRes.data ?? []) as LeagueScoringPick[],
      useSeasonStack: true,
      label: 'season',
    };
  }

  const [fixturesRes, resultsRes, picksRes] = await Promise.all([
    admin.from('app_fixtures').select('gw, fixture_index, kickoff_time').is('api_match_id', null),
    admin.from('app_gw_results').select('gw, fixture_index, result, home_goals, away_goals'),
    admin.from('app_picks').select('user_id, gw, fixture_index, pick'),
  ]);

  return {
    fixtures: fixturesRes.data ?? [],
    results: (resultsRes.data ?? []) as LeagueScoringResultRow[],
    picks: (picksRes.data ?? []) as LeagueScoringPick[],
    useSeasonStack: false,
    label: 'legacy',
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, null);
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return json(500, { error: 'Server configuration missing' });
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const [leaguesRes, membersRes, runtime] = await Promise.all([
      admin.from('leagues').select('id, name, created_at, start_gw'),
      admin.from('league_members').select('league_id, user_id'),
      resolveDualStackRuntime(admin),
    ]);

    if (leaguesRes.error) throw leaguesRes.error;
    if (membersRes.error) throw membersRes.error;

    const stacks: StackKind[] = [];
    if (runtime.seasonId) stacks.push('season');
    stacks.push('legacy');

    const seenEvents = new Set<string>();
    let wins = 0;
    let total = 0;
    const stacksUsed: string[] = [];

    for (const kind of stacks) {
      const data = await loadStackData(admin, kind, runtime.seasonId);
      if (data.fixtures.length === 0 || data.results.length === 0) continue;

      const gwDeadlines = buildGwDeadlinesFromFixtures(data.fixtures);
      const result = computeOpeningUnicornWinRate({
        leagues: leaguesRes.data ?? [],
        members: membersRes.data ?? [],
        fixtures: data.fixtures,
        picks: data.picks,
        results: data.results,
        gwDeadlines,
        leagueStartOptions: {
          useSeasonStack: data.useSeasonStack,
          seasonId: runtime.seasonId,
        },
      });

      if (result.total > 0) {
        stacksUsed.push(data.label);
      }

      for (const ev of result.events) {
        const key = `${ev.leagueId}:${ev.gw}`;
        if (seenEvents.has(key)) continue;
        seenEvents.add(key);
        total += 1;
        if (ev.wonGw) wins += 1;
      }
    }

    const winRatePercent =
      total > 0 ? Math.round((wins / total) * 10000) / 100 : null;

    return json(
      200,
      {
        winRatePercent,
        wins,
        total,
        stacksUsed,
        description:
          'Share of mini-league gameweeks where the player who scored a unicorn on the opening fixture (solo Friday or Sat 12:30) went on to win that gameweek in the league (including shared wins on ties).',
      },
      true
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to compute stat';
    console.error('[openingUnicornWinRate]', e);
    return json(500, { error: message });
  }
};
