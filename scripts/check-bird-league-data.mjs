import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkBirdLeagueData() {
  const birdLeagueMembers = [
    'ThomasJamesBird',
    'Matthew Bird',
    'Sim',
    'David Bird',
    'Jolly Joel',
    'Jessica',
    'EB',
    'BoobyBomBom'
  ];
  
  console.log('=== THE BIRD LEAGUE MEMBERS DATA ===\n');
  
  for (const userName of birdLeagueMembers) {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('name', userName)
      .single();
    
    if (!user) {
      console.log(`${userName}: Not found`);
      continue;
    }
    
    // Get all their picks
    const { data: picks } = await supabase
      .from('picks')
      .select('gw')
      .eq('user_id', user.id)
      .order('gw');
    
    const gws = [...new Set(picks?.map(p => p.gw) || [])];
    console.log(`${userName.padEnd(20)}: GWs ${gws.join(', ')}`);
  }
  
  console.log('\n=== RECOMMENDATION ===');
  console.log('The 4 new members (Jolly Joel, Jessica, EB, BoobyBomBom) only have GW7 data.');
  console.log('The Bird league should start from GW7 so all members can participate.');
}

checkBirdLeagueData().catch(console.error);


