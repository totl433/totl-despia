import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Correct results based on the result images you provided
const correctResults = {
  gw1: ['H', 'H', 'H', 'A', 'H', 'A', 'H', 'H', 'A', 'H'], // Liverpool 2-0 Bournemouth (H), Villa 2-1 Newcastle (H), Brighton 2-1 Fulham (H), Sunderland 1-2 West Ham (A), Tottenham 2-1 Burnley (H), Wolves 1-3 Man City (A), Chelsea 2-1 Palace (H), Forest 1-0 Brentford (H), Man Utd 1-2 Arsenal (A), Leeds 2-1 Everton (H)
  gw2: ['A', 'A', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A'], // West Ham 2-1 Chelsea (A), Man City 3-1 Tottenham (A), Bournemouth 2-1 Wolves (H), Brentford 2-1 Villa (H), Burnley 1-0 Sunderland (H), Arsenal 3-0 Leeds (H), Palace 1-1 Forest (D), Everton 2-1 Brighton (H), Fulham 1-1 Man Utd (D), Newcastle 1-2 Liverpool (A)
  gw3: ['H', 'H', 'H', 'A', 'A', 'D', 'H', 'A', 'H', 'A'], // Chelsea 2-0 Fulham (H), Man Utd 3-2 Burnley (H), Sunderland 2-1 Brentford (H), Tottenham 0-1 Bournemouth (A), Wolves 2-3 Everton (A), Leeds 0-0 Newcastle (D), Brighton 2-1 Man City (H), Forest 0-3 West Ham (A), Liverpool 1-0 Arsenal (H), Villa 0-3 Palace (A)
  gw4: ['H', 'D', 'H', 'D', 'H', 'H', 'A', 'D', 'A', 'H'], // Arsenal 3-0 Forest (H), Everton 0-0 Villa (D), Bournemouth 2-1 Brighton (H), Palace 0-0 Sunderland (D), Fulham 1-0 Leeds (H), Newcastle 1-0 Wolves (H), West Ham 0-3 Tottenham (A), Brentford 2-2 Chelsea (D), Burnley 0-1 Liverpool (A), Man City 3-0 Man Utd (H)
  gw5: ['H', 'D', 'D', 'A', 'A', 'H', 'H', 'D', 'D', 'D'], // Liverpool 2-1 Everton (H), Brighton 2-2 Tottenham (D), Burnley 1-1 Forest (D), West Ham 1-2 Palace (A), Wolves 1-3 Leeds (A), Man Utd 2-1 Chelsea (H), Fulham 3-1 Brentford (H), Bournemouth 0-0 Newcastle (D), Sunderland 1-1 Villa (D), Arsenal 1-1 Man City (D)
  gw6: ['H', 'A', 'H', 'D', 'H', 'A', 'D', 'H', 'A', 'D'], // Brentford 3-1 Man Utd (H), Chelsea 1-3 Brighton (A), Palace 2-1 Liverpool (H), Leeds 2-2 Bournemouth (D), Man City 5-1 Burnley (H), Forest 0-1 Sunderland (A), Tottenham 1-1 Wolves (D), Villa 3-1 Fulham (H), Newcastle 1-2 Arsenal (A), Everton 1-1 West Ham (D)
  gw7: ['H', 'A', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'A']  // Bournemouth 3-1 Fulham (H), Leeds 1-2 Tottenham (A), Arsenal 2-0 West Ham (H), Man Utd 2-0 Sunderland (H), Chelsea 2-1 Liverpool (H), Villa 2-1 Burnley (H), Everton 2-1 Palace (H), Newcastle 2-0 Forest (H), Wolves 1-1 Brighton (D), Brentford 0-1 Man City (A)
};

async function fixResultsFinal() {
  console.log('Fixing results with correct data from result images...');
  
  for (const [gwKey, results] of Object.entries(correctResults)) {
    const gwNumber = parseInt(gwKey.replace('gw', ''));
    console.log(`\nFixing GW${gwNumber} results...`);
    console.log('Correct results:', results);
    
    // Delete existing results for the GW
    const { error: deleteError } = await supabase
      .from('gw_results')
      .delete()
      .eq('gw', gwNumber);
    
    if (deleteError) {
      console.error(`Error deleting GW${gwNumber} results:`, deleteError);
      continue;
    }
    
    // Insert new results
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
    
    console.log(`GW${gwNumber} results fixed successfully`);
  }
  
  console.log('\nAll results have been corrected with the proper data from result images!');
}

fixResultsFinal().catch(console.error);

