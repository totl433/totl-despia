import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updatePick() {
  const testGw = 2; // GW T2
  const fixtureIndex = 0; // Sunderland v Bournemouth
  
  // Get the pick from command line argument
  const newPick = process.argv[2]?.toUpperCase();
  
  if (!newPick || !['H', 'D', 'A'].includes(newPick)) {
    console.log('Usage: node update-pick-gw-t2.mjs <H|D|A>');
    console.log('Example: node update-pick-gw-t2.mjs H');
    process.exit(1);
  }
  
  // Get all users to find Jof
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, name')
    .ilike('name', '%jof%');
  
  if (userError) {
    console.error('Error fetching users:', userError);
    process.exit(1);
  }
  
  if (!users || users.length === 0) {
    console.log('User "Jof" not found. Available users:');
    const { data: allUsers } = await supabase.from('profiles').select('id, name').limit(20);
    allUsers?.forEach(u => console.log(`  - ${u.name} (${u.id})`));
    process.exit(1);
  }
  
  const userId = users[0].id;
  console.log(`Found user: ${users[0].name} (${userId})`);
  
  // Get current pick
  const { data: currentPick } = await supabase
    .from('test_api_picks')
    .select('pick')
    .eq('user_id', userId)
    .eq('matchday', testGw)
    .eq('fixture_index', fixtureIndex)
    .maybeSingle();
  
  console.log(`Current pick: ${currentPick?.pick || 'No pick yet'}`);
  console.log(`Updating to: ${newPick}`);
  
  // Upsert the pick
  const { error: upsertError } = await supabase
    .from('test_api_picks')
    .upsert({
      user_id: userId,
      matchday: testGw,
      fixture_index: fixtureIndex,
      pick: newPick
    }, {
      onConflict: 'user_id,matchday,fixture_index'
    });
  
  if (upsertError) {
    console.error('Error updating pick:', upsertError);
    process.exit(1);
  }
  
  console.log('✅ Pick updated successfully!');
  
  // Verify
  const { data: updatedPick } = await supabase
    .from('test_api_picks')
    .select('pick')
    .eq('user_id', userId)
    .eq('matchday', testGw)
    .eq('fixture_index', fixtureIndex)
    .single();
  
  console.log(`Verified pick: ${updatedPick?.pick}`);
}

updatePick().catch(console.error);

