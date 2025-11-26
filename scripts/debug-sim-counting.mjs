import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugSimCounting() {
  console.log('Debugging Sim\'s score counting...');
  
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
  
  // Get all of Sim's picks
  const { data: picks } = await supabase
    .from('picks')
    .select('gw, fixture_index, pick')
    .eq('user_id', user.id)
    .order('gw')
    .order('fixture_index');
  
  if (!picks) {
    console.log('No picks found for Sim');
    return;
  }
  
  // Get all results
  const { data: results } = await supabase
    .from('gw_results')
    .select('gw, fixture_index, result')
    .order('gw')
    .order('fixture_index');
  
  if (!results) {
    console.log('No results found');
    return;
  }
  
  // Calculate Sim's score with detailed counting
  let correctPicks = 0;
  let totalPicks = 0;
  let gwCounts = {};
  
  console.log('\n--- Detailed Score Calculation ---');
  for (const pick of picks) {
    const correspondingResult = results.find(
      r => r.gw === pick.gw && r.fixture_index === pick.fixture_index
    );
    
    if (correspondingResult) {
      totalPicks++;
      if (pick.pick === correspondingResult.result) {
        console.log(`✓ GW${pick.gw} Fixture ${pick.fixture_index}: ${pick.pick} = ${correspondingResult.result} (CORRECT)`);
        correctPicks++;
        
        // Count by gameweek
        if (!gwCounts[pick.gw]) {
          gwCounts[pick.gw] = { correct: 0, total: 0 };
        }
        gwCounts[pick.gw].correct++;
      } else {
        console.log(`✗ GW${pick.gw} Fixture ${pick.fixture_index}: ${pick.pick} ≠ ${correspondingResult.result} (WRONG)`);
      }
      
      // Count total by gameweek
      if (!gwCounts[pick.gw]) {
        gwCounts[pick.gw] = { correct: 0, total: 0 };
      }
      gwCounts[pick.gw].total++;
    } else {
      console.log(`- GW${pick.gw} Fixture ${pick.fixture_index}: No result found`);
    }
  }
  
  console.log('\n--- Summary by Gameweek ---');
  for (const [gw, counts] of Object.entries(gwCounts)) {
    console.log(`GW${gw}: ${counts.correct}/${counts.total} correct`);
  }
  
  console.log(`\nSim's calculated score: ${correctPicks}`);
  console.log(`Total picks: ${totalPicks}`);
  console.log(`Expected score: 35`);
  
  if (correctPicks === 35) {
    console.log('✅ Sim\'s score is correct!');
  } else {
    console.log('❌ Sim\'s score is incorrect');
  }
}

debugSimCounting().catch(console.error);

