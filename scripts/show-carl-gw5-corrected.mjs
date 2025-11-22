import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';
const GW = 5;

async function showCarlGW5Corrected() {
  console.log(`📊 Carl's Picks for GW${GW} (Corrected)\n`);

  // Get fixtures for GW5
  const { data: fixtures, error: fixturesError } = await supabase
    .from('fixtures')
    .select('fixture_index, home_team, away_team')
    .eq('gw', GW)
    .order('fixture_index', { ascending: true });

  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError.message);
    return;
  }

  // Get ALL of Carl's picks for GW5
  const { data: allPicks, error: picksError } = await supabase
    .from('picks')
    .select('fixture_index, pick')
    .eq('user_id', CARL_USER_ID)
    .eq('gw', GW);

  if (picksError) {
    console.error('❌ Error fetching picks:', picksError.message);
    return;
  }

  // Get results for GW5
  const { data: results, error: resultsError } = await supabase
    .from('gw_results')
    .select('fixture_index, result')
    .eq('gw', GW)
    .order('fixture_index', { ascending: true });

  if (resultsError) {
    console.error('❌ Error fetching results:', resultsError.message);
    return;
  }

  // Create maps
  const picksMap = new Map();
  allPicks.forEach(p => {
    // Handle null fixture_index - it's likely fixture 0
    const fixIdx = p.fixture_index === null ? 0 : p.fixture_index;
    picksMap.set(fixIdx, p.pick);
  });

  const resultsMap = new Map();
  results.forEach(r => resultsMap.set(r.fixture_index, r.result));

  // Display picks
  console.log('='.repeat(80));
  console.log(`Fixture | Home vs Away | Carl's Pick | Result | Status`);
  console.log('='.repeat(80));

  let correct = 0;
  let total = 0;

  fixtures.forEach(fixture => {
    total++;
    const pick = picksMap.get(fixture.fixture_index);
    const result = resultsMap.get(fixture.fixture_index);
    
    const homeTeam = (fixture.home_team || 'TBD').substring(0, 20);
    const awayTeam = (fixture.away_team || 'TBD').substring(0, 20);
    const pickStr = pick || 'MISSING';
    const resultStr = result || 'Pending';
    
    const isCorrect = pick && result && pick === result;
    const status = isCorrect ? '✅ CORRECT' : (result ? '❌ Wrong' : '⏳ Pending');
    
    if (isCorrect) correct++;

    console.log(`   ${String(fixture.fixture_index).padStart(2)}   | ${homeTeam.padEnd(20)} vs ${awayTeam.padEnd(20)} | ${pickStr.padEnd(11)} | ${resultStr.padEnd(6)} | ${status}`);
  });

  console.log('='.repeat(80));
  console.log(`\n📊 Summary for GW${GW}:`);
  console.log(`   Correct: ${correct}/${total}`);
  console.log(`   Accuracy: ${total > 0 ? ((correct / total) * 100).toFixed(1) : 0}%\n`);
}

showCarlGW5Corrected().catch(console.error);

