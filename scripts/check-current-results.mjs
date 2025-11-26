import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkCurrentResults() {
  console.log('Checking current results in database...');
  
  for (let gw = 1; gw <= 7; gw++) {
    console.log(`\n=== GW${gw} Results ===`);
    
    const { data: results } = await supabase
      .from('gw_results')
      .select('fixture_index, result')
      .eq('gw', gw)
      .order('fixture_index');
    
    if (results) {
      results.forEach(r => {
        console.log(`Fixture ${r.fixture_index}: ${r.result}`);
      });
    } else {
      console.log('No results found');
    }
  }
}

checkCurrentResults().catch(console.error);

