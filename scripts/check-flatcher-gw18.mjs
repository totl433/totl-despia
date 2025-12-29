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

async function investigateFlatcherGW18() {
  console.log(`\n=== Investigating Flatcher's GW${GW} Score ===\n`);

  // 1. Get Flatcher's user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', FLATCHER_USER_ID)
    .single();

  if (userError || !user) {
    console.error('Error fetching user:', userError);
    return;
  }

  console.log(`User: ${user.name} (${user.id})\n`);

  // 2. Get Flatcher's picks for GW18
  const { data: picks, error: picksError } = await supabase
    .from('app_picks')
    .select('fixture_index, pick')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .order('fixture_index');

  if (picksError) {
    console.error('Error fetching picks:', picksError);
    return;
  }

  console.log(`Flatcher's picks for GW${GW}:`);
  console.log(`Total picks: ${picks?.length || 0}`);
  if (picks && picks.length > 0) {
    picks.forEach(p => {
      console.log(`  Fixture ${p.fixture_index}: ${p.pick}`);
    });
  } else {
    console.log('  No picks found!');
  }
  console.log();

  // 3. Get results for GW18
  const { data: results, error: resultsError } = await supabase
    .from('app_gw_results')
    .select('fixture_index, result')
    .eq('gw', GW)
    .order('fixture_index');

  if (resultsError) {
    console.error('Error fetching results:', resultsError);
    return;
  }

  console.log(`Results for GW${GW}:`);
  console.log(`Total results: ${results?.length || 0}`);
  if (results && results.length > 0) {
    results.forEach(r => {
      console.log(`  Fixture ${r.fixture_index}: ${r.result}`);
    });
  } else {
    console.log('  No results found!');
  }
  console.log();

  // 4. Get fixtures for GW18 to see match details
  const { data: fixtures, error: fixturesError } = await supabase
    .from('app_fixtures')
    .select('fixture_index, home_team, away_team')
    .eq('gw', GW)
    .order('fixture_index');

  if (fixturesError) {
    console.error('Error fetching fixtures:', fixturesError);
  }

  // 5. Calculate score manually
  console.log('=== Manual Score Calculation ===');
  let correctCount = 0;
  const matchDetails = [];

  if (picks && results && fixtures) {
    picks.forEach(pick => {
      const result = results.find(r => r.fixture_index === pick.fixture_index);
      const fixture = fixtures.find(f => f.fixture_index === pick.fixture_index);
      
      const isCorrect = result && pick.pick === result.result;
      if (isCorrect) correctCount++;

      matchDetails.push({
        fixture_index: pick.fixture_index,
        match: fixture ? `${fixture.home_team} vs ${fixture.away_team}` : 'Unknown',
        pick: pick.pick,
        result: result?.result || 'NULL',
        correct: isCorrect ? '✓' : '✗'
      });
    });
  }

  console.log('\nMatch-by-match breakdown:');
  matchDetails.forEach(m => {
    console.log(`  ${m.fixture_index}. ${m.match}`);
    console.log(`     Pick: ${m.pick}, Result: ${m.result}, ${m.correct}`);
  });

  console.log(`\nManual calculated score: ${correctCount}`);

  // 6. Get score from view
  const { data: viewScore, error: viewError } = await supabase
    .from('app_v_gw_points')
    .select('points')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  if (viewError) {
    console.error('Error fetching view score:', viewError);
  } else {
    console.log(`Score from app_v_gw_points view: ${viewScore?.points ?? 'NULL'}`);
  }

  // 7. Compare
  console.log('\n=== Comparison ===');
  if (viewScore) {
    if (viewScore.points === correctCount) {
      console.log('✓ Scores match!');
    } else {
      console.log(`✗ MISMATCH! View shows ${viewScore.points}, but manual calculation shows ${correctCount}`);
      console.log(`  Difference: ${viewScore.points - correctCount}`);
    }
  } else {
    console.log('⚠ No score found in view');
  }

  // 8. Check if there are any duplicate picks
  console.log('\n=== Checking for duplicate picks ===');
  const pickIndices = picks?.map(p => p.fixture_index) || [];
  const uniqueIndices = new Set(pickIndices);
  if (pickIndices.length !== uniqueIndices.size) {
    console.log('⚠ DUPLICATE PICKS FOUND!');
    const duplicates = pickIndices.filter((idx, i) => pickIndices.indexOf(idx) !== i);
    console.log('  Duplicate fixture indices:', duplicates);
  } else {
    console.log('✓ No duplicate picks');
  }

  // 9. Check if all picks have matching results
  console.log('\n=== Checking pick-result alignment ===');
  if (picks && results) {
    const missingResults = picks.filter(p => !results.find(r => r.fixture_index === p.fixture_index));
    if (missingResults.length > 0) {
      console.log('⚠ Picks without matching results:');
      missingResults.forEach(p => {
        console.log(`  Fixture ${p.fixture_index}: Pick = ${p.pick}, but no result found`);
      });
    } else {
      console.log('✓ All picks have matching results');
    }
  }
}

investigateFlatcherGW18().catch(console.error);

