import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Find both users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name, created_at')
    .in('name', ['Sim', 'sim', 'cakehurst', 'Cakehurst']);

  if (userError) {
    console.error('Error finding users:', userError);
    process.exit(1);
  }

  console.log('Found users:');
  users?.forEach(u => {
    console.log(`  ${u.name}: ${u.id} (created: ${u.created_at})`);
  });

  const simUser = users?.find(u => u.name?.toLowerCase() === 'sim');
  const cakehurstUser = users?.find(u => u.name?.toLowerCase() === 'cakehurst');

  if (!simUser) {
    console.log('\n❌ Sim user not found');
  } else {
    console.log(`\n📱 Sim's subscriptions:`);
    const { data: simSubs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', simUser.id)
      .order('created_at', { ascending: false });
    
    console.log(`  Total: ${simSubs?.length || 0}`);
    simSubs?.forEach((sub, i) => {
      console.log(`  ${i + 1}. Player ID: ${sub.player_id?.slice(0, 30)}...`);
      console.log(`     Platform: ${sub.platform}`);
      console.log(`     Active: ${sub.is_active}`);
      console.log(`     Created: ${sub.created_at}`);
    });
  }

  if (!cakehurstUser) {
    console.log('\n❌ Cakehurst user not found');
  } else {
    console.log(`\n📱 Cakehurst's subscriptions:`);
    const { data: cakehurstSubs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', cakehurstUser.id)
      .order('created_at', { ascending: false });
    
    console.log(`  Total: ${cakehurstSubs?.length || 0}`);
    if (cakehurstSubs && cakehurstSubs.length > 0) {
      cakehurstSubs.forEach((sub, i) => {
        console.log(`  ${i + 1}. Player ID: ${sub.player_id?.slice(0, 30)}...`);
        console.log(`     Platform: ${sub.platform}`);
        console.log(`     Active: ${sub.is_active}`);
        console.log(`     Created: ${sub.created_at}`);
      });
    } else {
      console.log('  ❌ No subscriptions found');
    }
  }

  // Check if there are any registration errors or issues
  console.log('\n🔍 Checking for any differences...');
  
  if (simUser && cakehurstUser) {
    const simCreated = new Date(simUser.created_at);
    const cakehurstCreated = new Date(cakehurstUser.created_at);
    console.log(`  Sim created: ${simCreated.toISOString()}`);
    console.log(`  Cakehurst created: ${cakehurstCreated.toISOString()}`);
    console.log(`  Time difference: ${Math.abs(cakehurstCreated - simCreated) / 1000} seconds`);
  }
}

main().catch(console.error);
