// scripts/create-api-test-league.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// User mapping (name to user_id) - same 4 users from Prem Predictions
const userMapping = {
  'Jof': '4542c037-5b38-40d0-b189-847b8f17c222',
  'Carl': 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2',
  'SP': '9c0bcf50-370d-412d-8826-95371a72b4fe',
  'ThomasJamesBird': '36f31625-6d6c-4aa4-815a-1493a812841b',
};

async function createApiTestLeague() {
  console.log('🏆 Creating "API Test" Mini League...\n');

  try {
    // Step 1: Check if league already exists
    console.log('📋 Checking if "API Test" league already exists...');
    const { data: existingLeagues, error: checkError } = await supabase
      .from('leagues')
      .select('*')
      .eq('name', 'API Test');
    
    if (checkError) throw checkError;
    
    let apiTestLeagueId;
    if (existingLeagues && existingLeagues.length > 0) {
      apiTestLeagueId = existingLeagues[0].id;
      console.log(`ℹ️  "API Test" league already exists (ID: ${apiTestLeagueId})`);
    } else {
      // Step 2: Create the league
      console.log('🆕 Creating "API Test" league...');
      const { data: newLeague, error: createError } = await supabase
        .from('leagues')
        .insert({
          name: 'API Test',
          code: 'api-test'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      apiTestLeagueId = newLeague.id;
      console.log(`✅ Created "API Test" league (ID: ${apiTestLeagueId})`);
    }

    // Step 3: Add the 4 users to the league
    console.log('\n👥 Adding users to "API Test" league...');
    
    const usersToAdd = ['Jof', 'Carl', 'SP', 'ThomasJamesBird'];
    
    for (const userName of usersToAdd) {
      const userId = userMapping[userName];
      
      if (!userId) {
        console.log(`⚠️  Skipping ${userName} - no user ID found`);
        continue;
      }

      // Check if user is already a member
      const { data: existingMember, error: checkMemberError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', apiTestLeagueId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checkMemberError) {
        console.error(`❌ Error checking membership for ${userName}:`, checkMemberError);
        continue;
      }

      if (existingMember) {
        console.log(`ℹ️  ${userName} is already a member`);
        continue;
      }

      // Add user to league
      const { error: addError } = await supabase
        .from('league_members')
        .insert({
          league_id: apiTestLeagueId,
          user_id: userId
        });

      if (addError) {
        console.error(`❌ Error adding ${userName}:`, addError);
      } else {
        console.log(`✅ Added ${userName} to "API Test" league`);
      }
    }

    console.log('\n✅ "API Test" league setup complete!');
    console.log(`   League ID: ${apiTestLeagueId}`);
    console.log(`   Members: ${usersToAdd.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createApiTestLeague();








