// Quick script to check what's in the live_scores table for a specific game
// Usage: node check-live-score.mjs [api_match_id]

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '.env.local') });
dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function checkLiveScore() {
  // First, find the Santos v Palmeiras game in test_api_fixtures
  const { data: testFixtures } = await supabase
    .from('test_api_fixtures')
    .select('api_match_id, home_team, away_team, test_gw, fixture_index')
    .or('home_team.ilike.%Santos%,away_team.ilike.%Santos%')
    .or('home_team.ilike.%Palmeiras%,away_team.ilike.%Palmeiras%');

  console.log('\n🔍 Test fixtures found:');
  console.log(JSON.stringify(testFixtures, null, 2));

  if (!testFixtures || testFixtures.length === 0) {
    console.log('\n❌ No test fixtures found matching Santos/Palmeiras');
    return;
  }

  // Check live_scores for each fixture
  for (const fixture of testFixtures) {
    const apiMatchId = fixture.api_match_id;
    console.log(`\n📊 Checking live_scores for api_match_id: ${apiMatchId}`);
    
    const { data: liveScore, error } = await supabase
      .from('live_scores')
      .select('*')
      .eq('api_match_id', apiMatchId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error:', error);
      continue;
    }

    if (!liveScore) {
      console.log(`⚠️  No live score found in database for api_match_id ${apiMatchId}`);
      console.log(`   This means pollLiveScores hasn't run or didn't find this fixture`);
    } else {
      console.log('✅ Live score found:');
      console.log(JSON.stringify(liveScore, null, 2));
      console.log(`\n   Status: ${liveScore.status}`);
      console.log(`   Score: ${liveScore.home_score} - ${liveScore.away_score}`);
      console.log(`   Minute: ${liveScore.minute ?? 'null'}`);
      console.log(`   Last updated: ${liveScore.updated_at}`);
    }
  }

  // Also check what the API says
  const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
  
  for (const fixture of testFixtures) {
    const apiMatchId = fixture.api_match_id;
    console.log(`\n🌐 Checking API for match ${apiMatchId}...`);
    
    try {
      const response = await fetch(`https://api.football-data.org/v4/matches/${apiMatchId}`, {
        headers: {
          'X-Auth-Token': FOOTBALL_DATA_API_KEY,
        },
      });

      if (!response.ok) {
        console.log(`   ❌ API error: ${response.status} ${response.statusText}`);
        continue;
      }

      const matchData = await response.json();
      const status = matchData.status || 'UNKNOWN';
      const homeScore = matchData.score?.fullTime?.home ?? matchData.score?.halfTime?.home ?? matchData.score?.current?.home ?? 0;
      const awayScore = matchData.score?.fullTime?.away ?? matchData.score?.halfTime?.away ?? matchData.score?.current?.away ?? 0;
      
      console.log(`   ✅ API Status: ${status}`);
      console.log(`   ✅ API Score: ${homeScore} - ${awayScore}`);
      console.log(`   ✅ API Minute: ${matchData.minute ?? 'null'}`);
      
      if (status === 'FINISHED') {
        console.log(`   ✅ Game is FINISHED according to API`);
      } else {
        console.log(`   ⚠️  Game is NOT finished (status: ${status})`);
      }
    } catch (error) {
      console.error(`   ❌ Error fetching from API:`, error);
    }
  }
}

checkLiveScore().catch(console.error);








