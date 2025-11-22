import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkBurnleyChelseaLive() {
  // Get current GW
  const { data: meta } = await supabase
    .from('meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();

  const currentGw = meta?.current_gw || 12;
  console.log('Current GW:', currentGw);
  console.log('\nSearching for Burnley v Chelsea...\n');

  // Get all fixtures for current GW
  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', currentGw);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Find Burnley v Chelsea
  const match = fixtures?.find(f => {
    const home = (f.home_team || f.home_name || '').toLowerCase();
    const away = (f.away_team || f.away_name || '').toLowerCase();
    return (home.includes('burnley') || away.includes('burnley')) &&
           (home.includes('chelsea') || away.includes('chelsea'));
  });

  if (!match) {
    console.log('❌ Burnley v Chelsea not found in GW', currentGw);
    return;
  }

  console.log('✅ Found fixture:');
  console.log({
    id: match.id,
    gw: match.gw,
    fixture_index: match.fixture_index,
    home_team: match.home_team || match.home_name,
    away_team: match.away_team || match.away_name,
    kickoff_time: match.kickoff_time,
  });

  // Check for api_match_id (might be in different column)
  const apiMatchId = match.api_match_id || match.apiMatchId || match.api_matchId;
  console.log('\nAPI Match ID:', apiMatchId || '❌ MISSING');

  if (!apiMatchId) {
    console.log('\n❌ No api_match_id - cannot poll this fixture!');
    return;
  }

  // Check live_scores
  const { data: liveScore, error: liveError } = await supabase
    .from('live_scores')
    .select('*')
    .eq('api_match_id', apiMatchId)
    .maybeSingle();

  if (liveError) {
    console.error('\n❌ Error fetching live score:', liveError);
  } else if (liveScore) {
    console.log('\n📊 Live score data:');
    console.log({
      status: liveScore.status,
      home_score: liveScore.home_score,
      away_score: liveScore.away_score,
      minute: liveScore.minute,
      updated_at: liveScore.updated_at,
    });
    
    const now = new Date();
    const updated = new Date(liveScore.updated_at);
    const minutesAgo = Math.floor((now - updated) / 1000 / 60);
    console.log(`\n⏰ Last updated: ${minutesAgo} minutes ago`);
    
    if (liveScore.status === 'TIMED') {
      console.log('\n⚠️  Status is TIMED (not started yet)');
    } else if (liveScore.status === 'IN_PLAY') {
      console.log('\n✅ Status is IN_PLAY - should be showing as live!');
    }
  } else {
    console.log('\n⚠️  No live score data in live_scores table');
  }

  // Check if it should be polled
  const now = new Date();
  const kickoff = new Date(match.kickoff_time);
  const hasKickedOff = kickoff <= now;
  
  console.log('\n⏰ Timing:');
  console.log('Kickoff:', match.kickoff_time);
  console.log('Now:', now.toISOString());
  console.log('Has kicked off?', hasKickedOff);
  console.log('In current GW?', match.gw === currentGw);
  console.log('Should be polled?', apiMatchId && match.gw === currentGw && hasKickedOff);
}

checkBurnleyChelseaLive().catch(console.error);

