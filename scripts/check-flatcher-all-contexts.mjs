import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const FLATCHER_USER_ID = 'fb5a55b1-5039-4f41-82ae-0429ec78a544';
const GW = 18;

async function checkFlatcherAllContexts() {
  console.log(`\n=== Checking Flatcher's GW${GW} Score in All Contexts ===\n`);

  // 1. Check app_v_gw_points view
  const { data: viewScore, error: viewError } = await supabase
    .from('app_v_gw_points')
    .select('points')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  console.log('1. app_v_gw_points view:');
  if (viewError) {
    console.log(`   Error: ${viewError.message}`);
  } else {
    console.log(`   Score: ${viewScore?.points ?? 'NULL'}`);
  }
  console.log();

  // 2. Check if there are any league-specific calculations
  const { data: leagues, error: leaguesError } = await supabase
    .from('league_members')
    .select('league_id, leagues!inner(name, start_gw)')
    .eq('user_id', FLATCHER_USER_ID);

  console.log('2. Leagues Flatcher is in:');
  if (leaguesError) {
    console.log(`   Error: ${leaguesError.message}`);
  } else if (leagues && leagues.length > 0) {
    leagues.forEach(l => {
      const league = l.leagues;
      console.log(`   - ${league.name} (start_gw: ${league.start_gw})`);
      if (league.start_gw > GW) {
        console.log(`     ⚠ League started after GW${GW}, so GW${GW} wouldn't count`);
      }
    });
  } else {
    console.log('   No leagues found');
  }
  console.log();

  // 3. Check if there are any submissions (maybe he didn't submit?)
  const { data: submission, error: subError } = await supabase
    .from('app_submissions')
    .select('*')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  console.log('3. Submission status:');
  if (subError) {
    console.log(`   Error: ${subError.message}`);
  } else if (submission) {
    console.log(`   ✓ Submitted at: ${submission.submitted_at}`);
  } else {
    console.log(`   ⚠ No submission found for GW${GW}`);
  }
  console.log();

  // 4. Check picks count vs expected fixtures
  const { data: picks } = await supabase
    .from('app_picks')
    .select('fixture_index')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW);

  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('fixture_index')
    .eq('gw', GW);

  console.log('4. Picks vs Fixtures:');
  console.log(`   Picks made: ${picks?.length || 0}`);
  console.log(`   Total fixtures: ${fixtures?.length || 0}`);
  if (picks && fixtures && picks.length !== fixtures.length) {
    console.log(`   ⚠ Mismatch! Missing ${fixtures.length - picks.length} picks`);
  }
  console.log();

  // 5. Check if there's a different score in the old web tables
  const { data: webScore, error: webError } = await supabase
    .from('v_gw_points')
    .select('points')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  console.log('5. Old web view (v_gw_points):');
  if (webError) {
    console.log(`   Error (might not exist): ${webError.message}`);
  } else {
    console.log(`   Score: ${webScore?.points ?? 'NULL'}`);
    if (webScore && viewScore && webScore.points !== viewScore.points) {
      console.log(`   ⚠ MISMATCH between app and web views!`);
    }
  }
  console.log();

  // 6. Manual recalculation with detailed breakdown
  console.log('6. Detailed Manual Calculation:');
  const { data: allPicks } = await supabase
    .from('app_picks')
    .select('fixture_index, pick')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .order('fixture_index');

  const { data: allResults } = await supabase
    .from('app_gw_results')
    .select('fixture_index, result')
    .eq('gw', GW)
    .order('fixture_index');

  const { data: allFixtures } = await supabase
    .from('app_fixtures')
    .select('fixture_index, home_team, away_team')
    .eq('gw', GW)
    .order('fixture_index');

  if (allPicks && allResults && allFixtures) {
    let correct = 0;
    let incorrect = 0;
    let missing = 0;

    allFixtures.forEach(fixture => {
      const pick = allPicks.find(p => p.fixture_index === fixture.fixture_index);
      const result = allResults.find(r => r.fixture_index === fixture.fixture_index);

      if (!pick) {
        missing++;
        console.log(`   ${fixture.fixture_index}. ${fixture.home_team} vs ${fixture.away_team}: NO PICK`);
      } else if (!result) {
        console.log(`   ${fixture.fixture_index}. ${fixture.home_team} vs ${fixture.away_team}: Pick=${pick.pick}, NO RESULT`);
      } else if (pick.pick === result.result) {
        correct++;
        console.log(`   ${fixture.fixture_index}. ${fixture.home_team} vs ${fixture.away_team}: Pick=${pick.pick}, Result=${result.result} ✓`);
      } else {
        incorrect++;
        console.log(`   ${fixture.fixture_index}. ${fixture.home_team} vs ${fixture.away_team}: Pick=${pick.pick}, Result=${result.result} ✗`);
      }
    });

    console.log(`\n   Summary: ${correct} correct, ${incorrect} incorrect, ${missing} missing`);
    console.log(`   Total score should be: ${correct}`);
  }
}

checkFlatcherAllContexts().catch(console.error);










