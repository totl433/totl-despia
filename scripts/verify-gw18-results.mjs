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

const GW = 18;

async function verifyGW18Results() {
  console.log(`\n=== Verifying GW${GW} Results ===\n`);

  // Get fixtures with match details
  const { data: fixtures, error: fixturesError } = await supabase
    .from('app_fixtures')
    .select('fixture_index, home_team, away_team, kickoff_time')
    .eq('gw', GW)
    .order('fixture_index');

  if (fixturesError) {
    console.error('Error fetching fixtures:', fixturesError);
    return;
  }

  // Get results
  const { data: results, error: resultsError } = await supabase
    .from('app_gw_results')
    .select('fixture_index, result')
    .eq('gw', GW)
    .order('fixture_index');

  if (resultsError) {
    console.error('Error fetching results:', resultsError);
    return;
  }

  // Get live scores to see actual final scores
  const { data: liveScores, error: liveScoresError } = await supabase
    .from('live_scores')
    .select('fixture_index, home_score, away_score, status, gw')
    .eq('gw', GW)
    .order('fixture_index');

  if (liveScoresError) {
    console.error('Error fetching live scores:', liveScoresError);
  }

  console.log('Match Results Breakdown:\n');
  
  fixtures?.forEach(fixture => {
    const result = results?.find(r => r.fixture_index === fixture.fixture_index);
    const liveScore = liveScores?.find(ls => ls.fixture_index === fixture.fixture_index);
    
    const homeTeam = fixture.home_team;
    const awayTeam = fixture.away_team;
    const resultValue = result?.result || 'NULL';
    
    // Derive result from live scores if available
    let derivedResult = null;
    if (liveScore && liveScore.home_score !== null && liveScore.away_score !== null) {
      if (liveScore.home_score > liveScore.away_score) {
        derivedResult = 'H';
      } else if (liveScore.home_score < liveScore.away_score) {
        derivedResult = 'A';
      } else {
        derivedResult = 'D';
      }
    }
    
    const scoreDisplay = liveScore 
      ? `${liveScore.home_score}-${liveScore.away_score} (${liveScore.status || 'UNKNOWN'})`
      : 'No live score';
    
    const match = `${homeTeam} vs ${awayTeam}`;
    console.log(`${fixture.fixture_index}. ${match}`);
    console.log(`   Score: ${scoreDisplay}`);
    console.log(`   Stored result: ${resultValue}`);
    if (derivedResult && derivedResult !== resultValue) {
      console.log(`   ⚠ MISMATCH! Derived from score: ${derivedResult}`);
    }
    console.log();
  });

  // Check for any discrepancies
  console.log('=== Checking for Discrepancies ===\n');
  let hasMismatch = false;
  
  if (liveScores && results) {
    liveScores.forEach(ls => {
      if (ls.status === 'FINISHED' && ls.home_score !== null && ls.away_score !== null) {
        let derivedResult = null;
        if (ls.home_score > ls.away_score) {
          derivedResult = 'H';
        } else if (ls.home_score < ls.away_score) {
          derivedResult = 'A';
        } else {
          derivedResult = 'D';
        }
        
        const storedResult = results.find(r => r.fixture_index === ls.fixture_index);
        if (storedResult && storedResult.result !== derivedResult) {
          hasMismatch = true;
          const fixture = fixtures?.find(f => f.fixture_index === ls.fixture_index);
          console.log(`⚠ MISMATCH for ${fixture?.home_team} vs ${fixture?.away_team}:`);
          console.log(`   Live score: ${ls.home_score}-${ls.away_score} → ${derivedResult}`);
          console.log(`   Stored result: ${storedResult.result}`);
          console.log();
        }
      }
    });
  }
  
  if (!hasMismatch) {
    console.log('✓ All results match live scores');
  }
}

verifyGW18Results().catch(console.error);





