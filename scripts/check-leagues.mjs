import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkLeagues() {
  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, name, created_at')
    .order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('All leagues in database:');
  console.log('========================');
  for (const league of leagues) {
    // Get member count
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', league.id);
    
    console.log(`\n${league.name}`);
    console.log(`  ID: ${league.id}`);
    console.log(`  Members: ${members?.length || 0}`);
    console.log(`  Created: ${new Date(league.created_at).toLocaleDateString()}`);
  }
  
  console.log(`\n\nTotal: ${leagues.length} leagues`);
  
  // Check specifically for "The Bird league"
  const birdLeague = leagues.find(l => l.name.toLowerCase().includes('bird'));
  if (birdLeague) {
    console.log('\n=== THE BIRD LEAGUE FOUND ===');
    console.log(`Name: ${birdLeague.name}`);
    console.log(`ID: ${birdLeague.id}`);
    
    // Get members
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id, users(name)')
      .eq('league_id', birdLeague.id);
    
    console.log('\nMembers:');
    members?.forEach(m => {
      console.log(`  - ${m.users.name}`);
    });
  } else {
    console.log('\n⚠️  No league with "Bird" in the name found');
  }
}

checkLeagues().catch(console.error);


