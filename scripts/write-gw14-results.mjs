import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials. Check .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function writeGw14Results() {
  console.log('🚀 Writing GW14 results to app_gw_results...\n');
  
  const gw = 14;
  
  // 1. Get all fixtures for GW14
  console.log(`📋 Fetching fixtures for GW ${gw}...`);
  const { data: fixtures, error: fixturesError } = await supabase
    .from('app_fixtures')
    .select('fixture_index, api_match_id')
    .eq('gw', gw)
    .order('fixture_index', { ascending: true });
  
  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError);
    return;
  }
  
  if (!fixtures || fixtures.length === 0) {
    console.error(`❌ No fixtures found for GW ${gw}`);
    return;
  }
  
  console.log(`✅ Found ${fixtures.length} fixtures for GW ${gw}`);
  
  // 2. Get api_match_ids
  const apiMatchIds = fixtures
    .map((f) => f.api_match_id)
    .filter((id) => id != null);
  
  if (apiMatchIds.length === 0) {
    console.error('❌ No fixtures with api_match_id found');
    return;
  }
  
  console.log(`📊 Fetching live_scores for ${apiMatchIds.length} fixtures...`);
  
  // 3. Get live_scores for these fixtures
  const { data: liveScores, error: scoresError } = await supabase
    .from('live_scores')
    .select('api_match_id, home_score, away_score, status')
    .in('api_match_id', apiMatchIds);
  
  if (scoresError) {
    console.error('❌ Error fetching live_scores:', scoresError);
    return;
  }
  
  if (!liveScores || liveScores.length === 0) {
    console.error('❌ No live_scores found');
    return;
  }
  
  console.log(`✅ Found ${liveScores.length} live_scores`);
  
  // 4. Create map of api_match_id -> result (H/D/A)
  const liveScoresMap = new Map();
  liveScores.forEach((score) => {
    if (score.status === 'FINISHED' || score.status === 'FT') {
      const homeScore = score.home_score ?? 0;
      const awayScore = score.away_score ?? 0;
      let result;
      if (homeScore > awayScore) {
        result = 'H';
      } else if (awayScore > homeScore) {
        result = 'A';
      } else {
        result = 'D';
      }
      liveScoresMap.set(score.api_match_id, result);
      console.log(`  Fixture ${score.api_match_id}: ${homeScore}-${awayScore} → ${result}`);
    }
  });
  
  // 5. Build results array
  const resultsToInsert = [];
  const fixturesWithoutScores = [];
  
  fixtures.forEach((fixture) => {
    if (fixture.api_match_id && liveScoresMap.has(fixture.api_match_id)) {
      resultsToInsert.push({
        gw: gw,
        fixture_index: fixture.fixture_index,
        result: liveScoresMap.get(fixture.api_match_id),
      });
    } else {
      fixturesWithoutScores.push(fixture.fixture_index);
    }
  });
  
  if (fixturesWithoutScores.length > 0) {
    console.log(`\n⚠️  Warning: ${fixturesWithoutScores.length} fixtures don't have finished scores:`);
    fixturesWithoutScores.forEach(idx => console.log(`  - Fixture index ${idx}`));
  }
  
  if (resultsToInsert.length === 0) {
    console.error('\n❌ No results to write (no finished games found)');
    return;
  }
  
  console.log(`\n📝 Writing ${resultsToInsert.length} results to app_gw_results...`);
  console.log('Results:', resultsToInsert.map(r => `${r.fixture_index}:${r.result}`).join(', '));
  
  // 6. Delete existing results for GW14 (if any)
  const { error: deleteError } = await supabase
    .from('app_gw_results')
    .delete()
    .eq('gw', gw);
  
  if (deleteError) {
    console.error('❌ Error deleting existing results:', deleteError);
    return;
  }
  
  // 7. Insert new results
  const { error: insertError } = await supabase
    .from('app_gw_results')
    .insert(resultsToInsert);
  
  if (insertError) {
    console.error('❌ Error inserting results:', insertError);
    return;
  }
  
  console.log(`\n✅ Successfully wrote ${resultsToInsert.length} results to app_gw_results for GW ${gw}!`);
  console.log('\n🎉 Home page and Global leaderboards should now update automatically!');
}

writeGw14Results().catch(console.error);

