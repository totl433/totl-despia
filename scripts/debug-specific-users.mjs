import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const correctResults = {
  1: ['H', 'D', 'D', 'H', 'H', 'A', 'D', 'H', 'A', 'H'],
  2: ['A', 'A', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A'],
  3: ['H', 'H', 'H', 'A', 'A', 'D', 'H', 'A', 'H', 'A'],
  4: ['H', 'H', 'D', 'D', 'H', 'H', 'A', 'D', 'A', 'H'],
  5: ['H', 'D', 'D', 'A', 'A', 'H', 'H', 'D', 'D', 'D'],
  6: ['H', 'A', 'H', 'D', 'H', 'A', 'D', 'H', 'A', 'D'],
  7: ['H', 'A', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'A']
};

async function debugUser(userName) {
  // Get user ID
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', userName);
  
  if (!users || users.length === 0) {
    console.log(`User ${userName} not found`);
    return;
  }
  
  const userId = users[0].id;
  
  // Get all picks
  const { data: picks } = await supabase
    .from('picks')
    .select('gw, fixture_index, pick')
    .eq('user_id', userId)
    .lte('gw', 7)
    .order('gw')
    .order('fixture_index');
  
  console.log(`\n=== ${userName} ===`);
  
  let totalCorrect = 0;
  
  for (let gw = 1; gw <= 7; gw++) {
    const gwPicks = picks.filter(p => p.gw === gw);
    const gwResults = correctResults[gw];
    
    let gwCorrect = 0;
    const details = [];
    
    for (let i = 0; i < 10; i++) {
      const pick = gwPicks.find(p => p.fixture_index === i);
      const result = gwResults[i];
      
      if (pick && pick.pick === result) {
        gwCorrect++;
        details.push(`✓`);
      } else {
        details.push(`✗(${pick?.pick || '?'}≠${result})`);
      }
    }
    
    totalCorrect += gwCorrect;
    console.log(`GW${gw}: ${gwCorrect}/10  ${details.join(' ')}`);
  }
  
  console.log(`\nTotal: ${totalCorrect}/70`);
}

async function main() {
  await debugUser('Sim');
  await debugUser('Carl');
  await debugUser('Jof');
  await debugUser('Ben New');
}

main().catch(console.error);

