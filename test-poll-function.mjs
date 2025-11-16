// Test script to manually invoke the pollLiveScores function logic
// This simulates what the scheduled function will do

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
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL or VITE_SUPABASE_URL. Check .env');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. This is needed to write to live_scores table.');
  console.error('You can find it in Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchMatchScore(apiMatchId) {
  const apiUrl = `https://api.football-data.org/v4/matches/${apiMatchId}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'X-Auth-Token': FOOTBALL_DATA_API_KEY,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.warn(`Rate limited for match ${apiMatchId}, retry after ${retryAfter}s`);
      return null;
    }
    console.error(`API error for match ${apiMatchId}:`, response.status, response.statusText);
    return null;
  }

  return await response.json();
}

async function testPoll() {
  console.log('Testing pollLiveScores function logic for TEST API GROUP...\n');
  
  // Get current GW
  const { data: metaData } = await supabase
    .from('meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();

  const currentGw = metaData?.current_gw ?? 1;
  console.log(`Current GW: ${currentGw}\n`);

  // For TEST API GROUP, check test_api_fixtures for ANY gameweek that has api_match_id
  // (since test fixtures might be for GW 1 even if current_gw is different)
  let { data: testFixtures } = await supabase
    .from('test_api_fixtures')
    .select('test_gw, api_match_id, fixture_index, home_team, away_team, kickoff_time')
    .not('api_match_id', 'is', null)
    .order('test_gw', { ascending: true });

  if (!testFixtures || testFixtures.length === 0) {
    console.log('No test fixtures with api_match_id found in test_api_fixtures table.');
    console.log('Make sure you have fixtures with api_match_id set in the test_api_fixtures table.');
    return;
  }

  // Use the test_gw from the fixtures (might be different from current_gw)
  const testGw = testFixtures[0].test_gw;
  console.log(`Found ${testFixtures.length} test fixtures for GW ${testGw}\n`);
  
  // Map to include gw field for consistency
  testFixtures = testFixtures.map(f => ({ ...f, gw: testGw }));

  const updates = [];
  
  for (let i = 0; i < testFixtures.length; i++) {
    const fixture = testFixtures[i];
    const apiMatchId = fixture.api_match_id;

    console.log(`[${i + 1}/${testFixtures.length}] Polling match ${apiMatchId} (${fixture.home_team} v ${fixture.away_team})...`);
    
    // Small delay to avoid rate limits
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const matchData = await fetchMatchScore(apiMatchId);
    
    if (!matchData) {
      console.log(`  ⚠️  Skipped (rate limited or error)\n`);
      continue;
    }

    const homeScore = matchData.score?.fullTime?.home ?? matchData.score?.halfTime?.home ?? matchData.score?.current?.home ?? 0;
    const awayScore = matchData.score?.fullTime?.away ?? matchData.score?.halfTime?.away ?? matchData.score?.current?.away ?? 0;
    const status = matchData.status || 'SCHEDULED';
    const minute = matchData.minute ?? null;

    updates.push({
      api_match_id: apiMatchId,
      gw: fixture.gw || testGw,
      fixture_index: fixture.fixture_index,
      home_score: homeScore,
      away_score: awayScore,
      status: status,
      minute: minute,
      home_team: fixture.home_team || matchData.homeTeam?.name,
      away_team: fixture.away_team || matchData.awayTeam?.name,
      kickoff_time: fixture.kickoff_time || matchData.utcDate,
    });

    console.log(`  ✅ ${homeScore}-${awayScore} (${status})${minute ? ` ${minute}'` : ''}\n`);
  }

  // Upsert to Supabase
  if (updates.length > 0) {
    console.log(`\nSaving ${updates.length} scores to Supabase...`);
    const { error: upsertError } = await supabase
      .from('live_scores')
      .upsert(updates, {
        onConflict: 'api_match_id',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('❌ Error saving:', upsertError);
    } else {
      console.log(`✅ Successfully saved ${updates.length} scores to Supabase!`);
      console.log('\nNow refresh your browser - scores should appear!');
    }
  } else {
    console.log('\n⚠️  No scores to save (all were rate limited or had errors)');
  }
}

testPoll().catch(console.error);

