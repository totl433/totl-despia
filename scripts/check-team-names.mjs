import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTeamNames() {
  // Get current GW
  const { data: meta } = await supabase
    .from('meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();

  const currentGw = meta?.current_gw || 12;
  console.log('Current GW:', currentGw);
  console.log('\nChecking fixtures for GW', currentGw, '...\n');

  // Get all fixtures for current GW
  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('id, gw, fixture_index, home_team, away_team, home_name, away_name, api_match_id, kickoff_time')
    .eq('gw', currentGw)
    .order('fixture_index', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${fixtures?.length || 0} fixtures for GW ${currentGw}:\n`);
  
  if (fixtures && fixtures.length > 0) {
    fixtures.forEach(f => {
      console.log(`Fixture ${f.fixture_index}: ${f.home_team || f.home_name} v ${f.away_team || f.away_name}`);
      console.log(`  - api_match_id: ${f.api_match_id || 'NULL'}`);
      console.log(`  - kickoff: ${f.kickoff_time || 'NULL'}`);
      console.log('');
    });

    // Check for Burnley/Chelsea variations
    const burnleyChelsea = fixtures.find(f => {
      const home = (f.home_team || f.home_name || '').toLowerCase();
      const away = (f.away_team || f.away_name || '').toLowerCase();
      return (home.includes('burnley') || away.includes('burnley')) &&
             (home.includes('chelsea') || away.includes('chelsea'));
    });

    if (burnleyChelsea) {
      console.log('\n✅ Found Burnley v Chelsea!');
      console.log(JSON.stringify(burnleyChelsea, null, 2));
    } else {
      console.log('\n⚠️  Burnley v Chelsea not found in current GW fixtures');
    }
  } else {
    console.log('No fixtures found for current GW');
  }
}

checkTeamNames().catch(console.error);

