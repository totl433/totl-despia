import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '.env.local') });
dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials. Check .env or .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkLiveScores() {
  console.log('Checking Supabase for live scores...\n');
  
  // Match IDs from the console logs
  const matchIds = [535054, 535058];
  
  // First, check if the table exists by trying to query it
  console.log('1. Checking if live_scores table exists...');
  try {
    const { data, error } = await supabase
      .from('live_scores')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table "live_scores" does NOT exist yet!');
        console.log('   → You need to run the SQL migration: supabase/sql/create_live_scores_table.sql\n');
      } else {
        console.error('❌ Error querying live_scores:', error.message, error.code);
      }
      return;
    }
    
    console.log('✅ Table "live_scores" exists!\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    return;
  }
  
  // Check for specific match IDs
  console.log('2. Checking for specific matches...');
  for (const matchId of matchIds) {
    const { data, error } = await supabase
      .from('live_scores')
      .select('*')
      .eq('api_match_id', matchId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`   Match ${matchId}: ❌ Not found in database`);
      } else {
        console.log(`   Match ${matchId}: ❌ Error - ${error.message}`);
      }
    } else if (data) {
      console.log(`   Match ${matchId}: ✅ Found!`);
      console.log(`      Status: ${data.status}`);
      console.log(`      Score: ${data.home_score} - ${data.away_score}`);
      console.log(`      Updated: ${data.updated_at}`);
    }
  }
  
  // Check all records in the table
  console.log('\n3. All records in live_scores table:');
  const { data: allScores, error: allError } = await supabase
    .from('live_scores')
    .select('*')
    .order('updated_at', { ascending: false });
  
  if (allError) {
    console.error('   Error:', allError.message);
  } else {
    if (allScores && allScores.length > 0) {
      console.log(`   Found ${allScores.length} record(s):`);
      allScores.forEach(score => {
        console.log(`   - Match ${score.api_match_id}: ${score.home_score}-${score.away_score} (${score.status})`);
      });
    } else {
      console.log('   No records found in table (scheduled function may not have run yet)');
    }
  }
}

checkLiveScores().catch(console.error);



