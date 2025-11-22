import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkBurnleyChelsea() {
  console.log('Checking Burnley v Chelsea fixture...\n');

  // 1. Check fixtures table
  const { data: fixtures, error: fixturesError } = await supabase
    .from('fixtures')
    .select('*')
    .or('home_team.ilike.%Burnley%,away_team.ilike.%Burnley%')
    .or('home_team.ilike.%Chelsea%,away_team.ilike.%Chelsea%')
    .order('gw', { ascending: false })
    .limit(5);

  if (fixturesError) {
    console.error('Error fetching fixtures:', fixturesError);
    return;
  }

  console.log('Found fixtures:', fixtures?.length || 0);
  if (fixtures && fixtures.length > 0) {
    const match = fixtures.find(f => 
      (f.home_team?.toLowerCase().includes('burnley') || f.away_team?.toLowerCase().includes('burnley')) &&
      (f.home_team?.toLowerCase().includes('chelsea') || f.away_team?.toLowerCase().includes('chelsea'))
    );

    if (match) {
      console.log('\n✅ Found Burnley v Chelsea fixture:');
      console.log({
        id: match.id,
        gw: match.gw,
        fixture_index: match.fixture_index,
        home_team: match.home_team,
        away_team: match.away_team,
        api_match_id: match.api_match_id,
        kickoff_time: match.kickoff_time,
      });

      // 2. Check live_scores table
      if (match.api_match_id) {
        const { data: liveScore, error: liveError } = await supabase
          .from('live_scores')
          .select('*')
          .eq('api_match_id', match.api_match_id)
          .maybeSingle();

        if (liveError) {
          console.error('\n❌ Error fetching live score:', liveError);
        } else if (liveScore) {
          console.log('\n📊 Live score data:');
          console.log({
            api_match_id: liveScore.api_match_id,
            status: liveScore.status,
            home_score: liveScore.home_score,
            away_score: liveScore.away_score,
            minute: liveScore.minute,
            updated_at: liveScore.updated_at,
          });
        } else {
          console.log('\n⚠️  No live score data found in live_scores table');
        }

        // 3. Check current GW
        const { data: meta } = await supabase
          .from('meta')
          .select('current_gw')
          .eq('id', 1)
          .maybeSingle();

        console.log('\n📅 Current GW:', meta?.current_gw);
        console.log('Match GW:', match.gw);
        console.log('Match in current GW?', match.gw === meta?.current_gw);

        // 4. Check if match should be polled
        const now = new Date();
        const kickoff = new Date(match.kickoff_time);
        const hasKickedOff = kickoff <= now;
        
        console.log('\n⏰ Kickoff check:');
        console.log('Kickoff time:', match.kickoff_time);
        console.log('Current time:', now.toISOString());
        console.log('Has kicked off?', hasKickedOff);
        console.log('Should be polled?', match.api_match_id && match.gw === meta?.current_gw && hasKickedOff);
      } else {
        console.log('\n❌ No api_match_id - this fixture cannot be polled!');
      }
    } else {
      console.log('\n⚠️  No exact Burnley v Chelsea match found in fixtures');
      console.log('Found fixtures:', fixtures.map(f => `${f.home_team} v ${f.away_team} (GW ${f.gw})`));
    }
  } else {
    console.log('\n⚠️  No fixtures found matching Burnley or Chelsea');
  }
}

checkBurnleyChelsea().catch(console.error);

