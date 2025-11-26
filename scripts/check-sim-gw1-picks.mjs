import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSimGw1Picks() {
  console.log('Checking Sim\'s GW1 picks in database...');
  
  // Get Sim's user ID
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'Sim')
    .single();
  
  if (!user) {
    console.log('Sim not found');
    return;
  }
  
  console.log('Sim ID:', user.id);
  
  // Get Sim's GW1 picks
  const { data: picks } = await supabase
    .from('picks')
    .select('fixture_index, pick')
    .eq('user_id', user.id)
    .eq('gw', 1)
    .order('fixture_index');
  
  if (!picks) {
    console.log('No GW1 picks found for Sim');
    return;
  }
  
  console.log('\nSim\'s GW1 picks in database:');
  picks.forEach(p => console.log(`Fixture ${p.fixture_index}: ${p.pick}`));
  
  console.log('\nExpected from CSV:');
  console.log('Fixture 0: H (Liverpool Win)');
  console.log('Fixture 1: H (Aston Villa Win)');
  console.log('Fixture 2: H (Brighton Win)');
  console.log('Fixture 3: A (West Ham Win)');
  console.log('Fixture 4: H (Tottenham Win)');
  console.log('Fixture 5: H (Man City Win)');
  console.log('Fixture 6: H (Chelsea Win)');
  console.log('Fixture 7: H (Forest Win)');
  console.log('Fixture 8: A (Arsenal Win)');
  console.log('Fixture 9: A (Everton Win)');
}

checkSimGw1Picks().catch(console.error);

