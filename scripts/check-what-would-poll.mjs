// Check which games would be polled if pollLiveScores ran right now
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkWhatWouldPoll() {
  console.log('🔍 Checking which games would be polled right now...\n');

  // Get current GW
  const { data: metaData, error: metaError } = await supabase
    .from('meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();

  if (metaError || !metaData) {
    console.error('❌ Failed to get current GW:', metaError);
    return;
  }

  const currentGw = metaData?.current_gw ?? 1;
  console.log(`📅 Current GW: ${currentGw}\n`);

  // Get all fixtures for current GW
  const [regularFixtures, testFixtures] = await Promise.all([
    supabase
      .from('fixtures')
      .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, gw')
      .eq('gw', currentGw)
      .not('api_match_id', 'is', null),
    supabase
      .from('test_api_fixtures')
      .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, test_gw')
      .not('api_match_id', 'is', null),
  ]);

  const allFixtures = [
    ...(regularFixtures.data || []).map(f => ({ ...f, gw: f.gw || currentGw })),
    ...(testFixtures.data || []).map(f => ({ 
      ...f, 
      gw: f.test_gw || currentGw, 
      fixture_index: f.fixture_index 
    })),
  ];

  if (allFixtures.length === 0) {
    console.log('⚠️  No fixtures found');
    return;
  }

  console.log(`📋 Total fixtures: ${allFixtures.length}\n`);

  // Check finished games
  const apiMatchIds = allFixtures.map(f => f.api_match_id);
  const { data: existingScores } = await supabase
    .from('live_scores')
    .select('api_match_id, status')
    .in('api_match_id', apiMatchIds);

  const finishedMatchIds = new Set();
  (existingScores || []).forEach((score) => {
    if (score.status === 'FINISHED') {
      finishedMatchIds.add(score.api_match_id);
    }
  });

  // Filter based on kickoff time
  const now = Date.now();
  const fixturesToPoll = allFixtures.filter(f => {
    // Skip if already finished
    if (finishedMatchIds.has(f.api_match_id)) {
      return false;
    }
    
    // If we have a kickoff time, only poll if the game has started
    if (f.kickoff_time) {
      try {
        const kickoffTime = new Date(f.kickoff_time).getTime();
        const hasStarted = now >= kickoffTime;
        return hasStarted;
      } catch (e) {
        return true; // Include if we can't parse
      }
    }
    
    // If no kickoff time, check existing status
    const existingScore = (existingScores || []).find((s) => s.api_match_id === f.api_match_id);
    if (existingScore) {
      return existingScore.status !== 'FINISHED';
    }
    
    return true; // Include if no info
  });

  console.log(`✅ Games that WOULD be polled: ${fixturesToPoll.length}\n`);
  
  if (fixturesToPoll.length > 0) {
    console.log('📊 Games to poll:');
    fixturesToPoll.forEach(f => {
      const kickoff = f.kickoff_time ? new Date(f.kickoff_time).toLocaleString() : 'No kickoff time';
      const existingScore = (existingScores || []).find((s) => s.api_match_id === f.api_match_id);
      const status = existingScore ? existingScore.status : 'No status yet';
      console.log(`  • ${f.home_team} vs ${f.away_team}`);
      console.log(`    Kickoff: ${kickoff}`);
      console.log(`    Current status: ${status}`);
      console.log(`    API Match ID: ${f.api_match_id}`);
      console.log('');
    });
  }

  const skippedCount = allFixtures.length - fixturesToPoll.length;
  const finishedCount = Array.from(finishedMatchIds).length;
  const notStartedCount = skippedCount - finishedCount;

  console.log(`\n📊 Summary:`);
  console.log(`  Total fixtures: ${allFixtures.length}`);
  console.log(`  Would poll: ${fixturesToPoll.length}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`    - Finished: ${finishedCount}`);
  console.log(`    - Not started yet: ${notStartedCount}`);
}

checkWhatWouldPoll().catch(console.error);

