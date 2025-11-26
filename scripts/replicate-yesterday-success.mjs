import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// The exact same results I used yesterday that worked perfectly
const correctResults = {
  gw1: ['H', 'D', 'D', 'H', 'H', 'A', 'D', 'H', 'A', 'H'],
  gw2: ['A', 'A', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A'],
  gw3: ['H', 'H', 'H', 'A', 'A', 'D', 'H', 'A', 'H', 'A'],
  gw4: ['H', 'H', 'D', 'D', 'H', 'H', 'A', 'D', 'A', 'H'],
  gw5: ['H', 'D', 'D', 'A', 'A', 'H', 'H', 'D', 'D', 'D'],
  gw6: ['H', 'A', 'H', 'D', 'H', 'A', 'D', 'H', 'A', 'D'],
  gw7: ['H', 'A', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'A']
};

// The exact same picks I used yesterday that worked perfectly
const correctPicks = {
  'Sim': {
    gw1: ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'A', 'A'],
    gw2: ['A', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    gw3: ['H', 'H', 'H', 'H', 'A', 'D', 'H', 'A', 'A', 'A'],
    gw4: ['H', 'D', 'H', 'H', 'A', 'H', 'A', 'H', 'H', 'H'],
    gw5: ['H', 'A', 'A', 'A', 'D', 'H', 'A', 'H', 'H', 'A'],
    gw6: ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'A', 'H'],
    gw7: ['H', 'A', 'H', 'H', 'H', 'H', 'A', 'H', 'H', 'H']
  },
  'Matthew Bird': {
    gw1: ['H', 'H', 'D', 'A', 'H', 'H', 'A', 'H', 'A', 'D'],
    gw2: ['D', 'H', 'D', 'D', 'H', 'H', 'A', 'D', 'D', 'H'],
    gw3: ['H', 'A', 'H', 'A', 'D', 'A', 'H', 'D', 'A', 'A'],
    gw4: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    gw5: ['H', 'A', 'A', 'A', 'A', 'H', 'H', 'H', 'H', 'A'],
    gw6: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'A', 'H'],
    gw7: ['H', 'A', 'H', 'D', 'H', 'D', 'A', 'H', 'D', 'A']
  },
  'David Bird': {
    gw1: ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'A', 'A'],
    gw2: ['A', 'H', 'H', 'H', 'H', 'H', 'D', 'D', 'D', 'H'],
    gw3: ['H', 'H', 'H', 'H', 'A', 'A', 'H', 'A', 'H', 'A'],
    gw4: ['H', 'H', 'H', 'H', 'H', 'H', 'D', 'H', 'H', 'H'],
    gw5: ['H', 'D', 'H', 'A', 'D', 'H', 'H', 'H', 'H', 'A'],
    gw6: ['H', 'H', 'A', 'D', 'H', 'D', 'H', 'H', 'A', 'H'],
    gw7: ['H', 'A', 'H', 'D', 'D', 'H', 'D', 'H', 'H', 'A']
  }
};

async function replicateYesterdaySuccess() {
  console.log('Replicating yesterday\'s successful approach...\n');

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const userMap = new Map(users.map(u => [u.name, u.id]));

  // First, update all results with the exact same data from yesterday
  console.log('Updating results with yesterday\'s data...');
  for (const [gwKey, results] of Object.entries(correctResults)) {
    const gwNumber = parseInt(gwKey.replace('gw', ''));
    console.log(`Updating GW${gwNumber} results...`);
    
    // Delete existing results for the GW
    const { error: deleteError } = await supabase
      .from('gw_results')
      .delete()
      .eq('gw', gwNumber);
    
    if (deleteError) {
      console.error(`Error deleting GW${gwNumber} results:`, deleteError);
      continue;
    }
    
    // Insert correct results
    for (let i = 0; i < results.length; i++) {
      const { error: insertError } = await supabase
        .from('gw_results')
        .insert({
          gw: gwNumber,
          fixture_index: i,
          result: results[i]
        });
      
      if (insertError) {
        console.error(`Error inserting result ${i} for GW${gwNumber}:`, insertError);
      }
    }
    
    console.log(`GW${gwNumber} results updated: ${results.join(' ')}`);
  }

  // Now update picks for the specific users with yesterday's exact data
  console.log('\nUpdating picks with yesterday\'s data...');
  for (const [userName, userPicks] of Object.entries(correctPicks)) {
    const userId = userMap.get(userName);
    if (!userId) {
      console.log(`User ${userName} not found`);
      continue;
    }

    console.log(`Updating picks for ${userName}...`);
    
    // Update each gameweek
    for (const [gwKey, picks] of Object.entries(userPicks)) {
      const gwNumber = parseInt(gwKey.replace('gw', ''));
      
      // Delete existing picks for the GW
      const { error: deletePicksError } = await supabase
        .from('picks')
        .delete()
        .eq('user_id', userId)
        .eq('gw', gwNumber);
      
      if (deletePicksError) {
        console.error(`Error deleting picks for ${userName} GW${gwNumber}:`, deletePicksError);
        continue;
      }
      
      // Insert new picks
      for (let i = 0; i < picks.length; i++) {
        const { error: pickError } = await supabase
          .from('picks')
          .insert({
            user_id: userId,
            gw: gwNumber,
            fixture_index: i,
            pick: picks[i]
          });
        
        if (pickError) {
          console.error(`Error inserting pick ${i} for ${userName} GW${gwNumber}:`, pickError);
        }
      }
      
      // Update submission
      const { error: submissionError } = await supabase
        .from('gw_submissions')
        .upsert({
          user_id: userId,
          gw: gwNumber,
          submitted_at: new Date().toISOString()
        });
      
      if (submissionError) {
        console.error(`Error updating submission for ${userName} GW${gwNumber}:`, submissionError);
      }
    }
    
    console.log(`${userName} picks updated successfully`);
  }
  
  console.log('\nAll data updated with yesterday\'s exact approach!');
  console.log('Now verifying the scores...');
  
  // Verify the scores
  const expectedScores = {
    'Sim': 35,
    'Matthew Bird': 31,
    'David Bird': 36
  };

  console.log('\n--- VERIFICATION ---');
  let allCorrect = true;
  
  for (const [userName, expectedScore] of Object.entries(expectedScores)) {
    const userId = userMap.get(userName);
    if (!userId) continue;

    // Get all of user's picks up to GW7
    const { data: picks } = await supabase
      .from('picks')
      .select('gw, fixture_index, pick')
      .eq('user_id', userId)
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    // Get all results up to GW7
    const { data: results } = await supabase
      .from('gw_results')
      .select('gw, fixture_index, result')
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    // Calculate correct picks
    let correctPicks = 0;
    const resultsMap = new Map();
    results.forEach(r => {
      if (!resultsMap.has(r.gw)) {
        resultsMap.set(r.gw, new Map());
      }
      resultsMap.get(r.gw).set(r.fixture_index, r.result);
    });

    for (const pick of picks) {
      const correspondingResult = resultsMap.get(pick.gw)?.get(pick.fixture_index);
      if (correspondingResult && pick.pick === correspondingResult) {
        correctPicks++;
      }
    }
    
    const status = correctPicks === expectedScore ? '✅' : '❌';
    if (correctPicks !== expectedScore) allCorrect = false;
    
    console.log(`${userName.padEnd(20)}: ${correctPicks} (expected ${expectedScore}) ${status}`);
  }
  
  console.log('\n--- SUMMARY ---');
  if (allCorrect) {
    console.log('🎉 SUCCESS! Replicated yesterday\'s approach perfectly!');
  } else {
    console.log('❌ Still not matching. Need to check the exact data from yesterday.');
  }
}

replicateYesterdaySuccess().catch(console.error);

