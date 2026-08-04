/**
 * Bootstrap Pile B (multi-season stack) without touching legacy unfoldered tables.
 *
 * Prerequisites:
 *   1. Run supabase/sql/app_seasons_pile_b.sql in Supabase SQL Editor once.
 *   2. .env.local has VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * What it does:
 *   - Creates/ensures seasons 2025/26 (archive copy of live pile) + 2026/27 (draft)
 *   - Copies app_fixtures / app_gw_results / app_picks / app_gw_submissions → season tables for 2025/26
 *   - Loads 2026/27 GW1 from scripts/data/season-2026-27-gw1-fixtures.json (or live FD API)
 *   - Points app_season_runtime at 2025/26 GW 38 (does NOT open 26/27 globally)
 *   - Leaves app_meta.current_gw alone
 *
 * Usage:
 *   node scripts/bootstrap-season-stack.mjs
 *   node scripts/bootstrap-season-stack.mjs --from-api   # fetch 26/27 GW1 from Football Data
 *   node scripts/bootstrap-season-stack.mjs --tester-id=UUID  # set use_season_stack for you
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const args = new Set(process.argv.slice(2));
const fromApi = args.has('--from-api');
const testerArg = process.argv.find((a) => a.startsWith('--tester-id='));
const testerId = testerArg ? testerArg.split('=')[1] : null;
const dryRun = args.has('--dry-run');

const FOOTBALL_DATA_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function tableExists(name) {
  const { error } = await sb.from(name).select('*').limit(1);
  if (!error) return true;
  if (error.code === 'PGRST205' || /Could not find the table/i.test(error.message)) {
    return false;
  }
  // other errors (empty table etc) mean table exists
  return true;
}

async function chunkedInsert(table, rows, chunkSize = 400) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    if (dryRun) {
      inserted += slice.length;
      continue;
    }
    const { error } = await sb.from(table).insert(slice);
    if (error) throw new Error(`${table} insert failed @${i}: ${error.message}`);
    inserted += slice.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}`);
  }
  if (rows.length) process.stdout.write('\n');
  return inserted;
}

async function ensureSeason({ label, yearStart, yearEnd, footballDataSeason, status }) {
  const { data: existing, error } = await sb
    .from('app_seasons')
    .select('*')
    .eq('label', label)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    console.log(`  season ${label} already exists (${existing.id})`);
    return existing;
  }
  if (dryRun) {
    console.log(`  [dry-run] would create season ${label}`);
    return { id: 'dry-run', label };
  }
  const { data, error: insErr } = await sb
    .from('app_seasons')
    .insert({
      label,
      year_start: yearStart,
      year_end: yearEnd,
      football_data_season: footballDataSeason,
      status,
    })
    .select('*')
    .single();
  if (insErr) throw insErr;
  console.log(`  created season ${label} (${data.id})`);
  return data;
}

async function copyPileAToSeason2526(seasonId) {
  // Fixtures
  const { count: existingFx } = await sb
    .from('app_season_fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId);
  if ((existingFx ?? 0) > 0) {
    console.log(`  fixtures already present (${existingFx}) — skip copy`);
  } else {
    console.log('  copying fixtures…');
    const { data: fixtures, error } = await sb
      .from('app_fixtures')
      .select(
        'gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,home_crest,away_crest,kickoff_time,api_match_id'
      )
      .order('gw')
      .order('fixture_index');
    if (error) throw error;
    const rows = (fixtures || []).map((f) => ({
      season_id: seasonId,
      gw: f.gw,
      fixture_index: f.fixture_index,
      home_team: f.home_team,
      away_team: f.away_team,
      home_code: f.home_code,
      away_code: f.away_code,
      home_name: f.home_name,
      away_name: f.away_name,
      home_crest: f.home_crest,
      away_crest: f.away_crest,
      kickoff_time: f.kickoff_time,
      api_match_id: f.api_match_id,
      status: null,
    }));
    await chunkedInsert('app_season_fixtures', rows);
  }

  // Results
  const { count: existingRes } = await sb
    .from('app_season_results')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId);
  if ((existingRes ?? 0) > 0) {
    console.log(`  results already present (${existingRes}) — skip copy`);
  } else {
    console.log('  copying results…');
    const { data: results, error } = await sb
      .from('app_gw_results')
      .select('gw,fixture_index,result,decided_at,home_score,away_score,api_match_id');
    if (error) throw error;
    const rows = (results || []).map((r) => ({
      season_id: seasonId,
      gw: r.gw,
      fixture_index: r.fixture_index,
      result: r.result,
      decided_at: r.decided_at,
      home_score: r.home_score,
      away_score: r.away_score,
      api_match_id: r.api_match_id,
    }));
    await chunkedInsert('app_season_results', rows);
  }

  // Picks
  const { count: existingPicks } = await sb
    .from('app_season_picks')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId);
  if ((existingPicks ?? 0) > 0) {
    console.log(`  picks already present (${existingPicks}) — skip copy`);
  } else {
    console.log('  copying picks (this may take a minute)…');
    // paginate
    const pageSize = 1000;
    let from = 0;
    let total = 0;
    for (;;) {
      const { data: picks, error } = await sb
        .from('app_picks')
        .select('user_id,gw,fixture_index,pick,created_at,updated_at')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!picks?.length) break;
      const rows = picks.map((p) => ({
        season_id: seasonId,
        user_id: p.user_id,
        gw: p.gw,
        fixture_index: p.fixture_index,
        pick: p.pick,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
      await chunkedInsert('app_season_picks', rows);
      total += picks.length;
      from += pageSize;
      if (picks.length < pageSize) break;
    }
    console.log(`  picks copied: ${total}`);
  }

  // Submissions
  const { count: existingSubs } = await sb
    .from('app_season_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId);
  if ((existingSubs ?? 0) > 0) {
    console.log(`  submissions already present (${existingSubs}) — skip copy`);
  } else {
    console.log('  copying submissions…');
    const pageSize = 1000;
    let from = 0;
    let total = 0;
    for (;;) {
      const { data: subs, error } = await sb
        .from('app_gw_submissions')
        .select('user_id,gw,submitted_at')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!subs?.length) break;
      const rows = subs.map((s) => ({
        season_id: seasonId,
        user_id: s.user_id,
        gw: s.gw,
        submitted_at: s.submitted_at || new Date().toISOString(),
      }));
      await chunkedInsert('app_season_submissions', rows);
      total += subs.length;
      from += pageSize;
      if (subs.length < pageSize) break;
    }
    console.log(`  submissions copied: ${total}`);
  }
}

async function load2627Gw1(seasonId) {
  const { count } = await sb
    .from('app_season_fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('gw', 1);
  if ((count ?? 0) > 0) {
    console.log(`  2026/27 GW1 already has ${count} fixtures — skip`);
    return;
  }

  let fixtures = [];
  if (fromApi) {
    console.log('  fetching 2026 matchday 1 from Football Data…');
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/PL/matches?season=2026&matchday=1',
      { headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY } }
    );
    if (!res.ok) throw new Error(`FD API ${res.status}: ${await res.text()}`);
    const payload = await res.json();
    const matches = (payload.matches || []).sort(
      (a, b) => new Date(a.utcDate) - new Date(b.utcDate)
    );
    fixtures = matches.map((m, i) => ({
      season_id: seasonId,
      gw: 1,
      fixture_index: i,
      home_team: m.homeTeam.shortName || m.homeTeam.name,
      away_team: m.awayTeam.shortName || m.awayTeam.name,
      home_code: m.homeTeam.tla || null,
      away_code: m.awayTeam.tla || null,
      home_name: m.homeTeam.name || null,
      away_name: m.awayTeam.name || null,
      home_crest: m.homeTeam.crest || null,
      away_crest: m.awayTeam.crest || null,
      kickoff_time: m.utcDate,
      api_match_id: m.id,
      status: m.status || null,
    }));
  } else {
    const jsonPath = path.join(__dirname, 'data/season-2026-27-gw1-fixtures.json');
    console.log(`  loading GW1 from ${jsonPath}`);
    const file = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    fixtures = (file.fixtures || []).map((f) => ({
      season_id: seasonId,
      gw: 1,
      fixture_index: f.fixture_index,
      home_team: f.home_team,
      away_team: f.away_team,
      home_code: f.home_code,
      away_code: f.away_code,
      home_name: f.home_name,
      away_name: f.away_name,
      home_crest: f.home_crest,
      away_crest: f.away_crest,
      kickoff_time: f.kickoff_time,
      api_match_id: f.api_match_id,
      status: f.status || null,
    }));
  }

  if (!fixtures.length) throw new Error('No fixtures to load for 2026/27 GW1');
  await chunkedInsert('app_season_fixtures', fixtures);
  console.log(`  inserted ${fixtures.length} fixtures for 2026/27 GW1`);
}

async function setRuntimeTo2526(season2526, gw = 38) {
  if (dryRun) {
    console.log(`  [dry-run] would set runtime → ${season2526.label} GW ${gw}`);
    return;
  }
  const { error } = await sb.from('app_season_runtime').upsert(
    {
      id: 1,
      current_season_id: season2526.id,
      current_gw: gw,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
  // keep 25/26 as closed/archive archive state until hard switch — still useful pointer
  await sb
    .from('app_seasons')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', season2526.id);
  console.log(`  runtime → ${season2526.label} GW ${gw} (Pile B pointer only)`);
}

async function setTester(userId, season2627) {
  if (dryRun) {
    console.log(`  [dry-run] would set tester ${userId} onto ${season2627.label}`);
    return;
  }
  const { data, error } = await sb
    .from('user_notification_preferences')
    .update({
      use_season_stack: true,
      current_viewing_season_id: season2627.id,
      current_viewing_gw: 1,
    })
    .eq('user_id', userId)
    .select('user_id, use_season_stack, current_viewing_season_id, current_viewing_gw')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    console.warn('  ⚠️ no user_notification_preferences row for tester — create prefs first');
    return;
  }
  console.log('  tester prefs:', data);
}

async function verifyLegacyUntouched() {
  const { data: meta } = await sb.from('app_meta').select('current_gw').eq('id', 1).maybeSingle();
  console.log(`  legacy app_meta.current_gw = ${meta?.current_gw} (must stay 38 until store cutover)`);
  if (meta?.current_gw !== 38) {
    console.warn('  ⚠️ Expected current_gw 38 — double-check live clients');
  }
}

async function main() {
  console.log('\n🗂️  Bootstrap Pile B (multi-season)\n');
  if (dryRun) console.log('(dry-run mode)\n');

  const needed = [
    'app_seasons',
    'app_season_runtime',
    'app_season_fixtures',
    'app_season_results',
    'app_season_picks',
    'app_season_submissions',
  ];
  for (const t of needed) {
    const ok = await tableExists(t);
    console.log(`  ${ok ? '✅' : '❌'} ${t}`);
    if (!ok) {
      console.error(`
Pile B tables missing. In Supabase SQL Editor, run:

  supabase/sql/app_seasons_pile_b.sql

Then re-run:
  node scripts/bootstrap-season-stack.mjs
`);
      process.exit(1);
    }
  }

  console.log('\n1) Ensure seasons');
  const s2526 = await ensureSeason({
    label: '2025/26',
    yearStart: 2025,
    yearEnd: 2026,
    footballDataSeason: 2025,
    status: 'closed',
  });
  const s2627 = await ensureSeason({
    label: '2026/27',
    yearStart: 2026,
    yearEnd: 2027,
    footballDataSeason: 2026,
    status: 'draft',
  });

  console.log('\n2) Copy live unfoldered pile → 2025/26');
  await copyPileAToSeason2526(s2526.id);

  console.log('\n3) Load 2026/27 GW1 into folder only');
  await load2627Gw1(s2627.id);

  console.log('\n4) Runtime pointer stays on 2025/26 (no global hard switch to 26/27)');
  await setRuntimeTo2526(s2526, 38);

  if (testerId) {
    console.log(`\n5) Tester override → ${testerId}`);
    await setTester(testerId, s2627);
  } else {
    console.log('\n5) No --tester-id — skip tester override');
  }

  console.log('\n6) Verify legacy');
  await verifyLegacyUntouched();

  console.log(`
Done.
  2025/26 = full archive copy of current live pile
  2026/27 = GW1 fixtures ready (draft)
  Runtime (Pile B) → 2025/26 GW 38
  Legacy app_meta untouched

Next (when new app + new web ship):
  Api Admin → Open season 2026/27 GW 1
  (updates app_season_runtime only; still never write app_meta until you deliberately retire old clients)
`);
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
