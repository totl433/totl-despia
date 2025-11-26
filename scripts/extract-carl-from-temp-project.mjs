import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// MAIN project (where we'll restore to)
const mainSupabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// TEMP project (where backup was restored)
// USER NEEDS TO PROVIDE THESE FROM THE TEMP PROJECT
const TEMP_PROJECT_URL = process.env.TEMP_SUPABASE_URL || '';
const TEMP_PROJECT_KEY = process.env.TEMP_SUPABASE_ANON_KEY || '';

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

async function extractCarlFromTempProject() {
  console.log('🚨 Extracting ALL Carl data from temporary restored project...\n');

  if (!TEMP_PROJECT_URL || !TEMP_PROJECT_KEY) {
    console.error('❌ Missing temporary project credentials!');
    console.log('\n📋 INSTRUCTIONS:');
    console.log('   1. In Supabase Dashboard, use "Restore to new project"');
    console.log('   2. Restore the backup to a temporary project');
    console.log('   3. Get the project URL and anon key from that project');
    console.log('   4. Set environment variables:');
    console.log('      TEMP_SUPABASE_URL=<temp-project-url>');
    console.log('      TEMP_SUPABASE_ANON_KEY=<temp-project-anon-key>');
    console.log('   5. Run this script again\n');
    return;
  }

  const tempSupabase = createClient(TEMP_PROJECT_URL, TEMP_PROJECT_KEY);

  console.log('🔍 Extracting data from temporary project...\n');

  const carlData = {
    user: null,
    picks: [],
    submissions: [],
    leagueMembers: [],
    pushSubscriptions: [],
  };

  // Extract user
  console.log('   Fetching user...');
  const { data: user, error: userError } = await tempSupabase
    .from('users')
    .select('*')
    .eq('id', CARL_USER_ID)
    .single();

  if (userError) {
    console.error('   ❌ Error fetching user:', userError.message);
  } else if (user) {
    carlData.user = user;
    console.log(`   ✅ Found user: ${user.name}`);
  }

  // Extract picks
  console.log('   Fetching picks...');
  const { data: picks, error: picksError } = await tempSupabase
    .from('picks')
    .select('*')
    .eq('user_id', CARL_USER_ID);

  if (picksError) {
    console.error('   ❌ Error fetching picks:', picksError.message);
  } else if (picks) {
    carlData.picks = picks;
    console.log(`   ✅ Found ${picks.length} picks`);
  }

  // Extract submissions
  console.log('   Fetching submissions...');
  const { data: submissions, error: subsError } = await tempSupabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', CARL_USER_ID);

  if (subsError) {
    console.error('   ❌ Error fetching submissions:', subsError.message);
  } else if (submissions) {
    carlData.submissions = submissions;
    console.log(`   ✅ Found ${submissions.length} submissions`);
  }

  // Extract league members
  console.log('   Fetching league memberships...');
  const { data: leagueMembers, error: leagueError } = await tempSupabase
    .from('league_members')
    .select('*')
    .eq('user_id', CARL_USER_ID);

  if (leagueError) {
    console.error('   ❌ Error fetching league members:', leagueError.message);
  } else if (leagueMembers) {
    carlData.leagueMembers = leagueMembers;
    console.log(`   ✅ Found ${leagueMembers.length} league memberships`);
  }

  // Extract push subscriptions
  console.log('   Fetching push subscriptions...');
  const { data: pushSubs, error: pushError } = await tempSupabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', CARL_USER_ID);

  if (pushError) {
    console.error('   ❌ Error fetching push subscriptions:', pushError.message);
  } else if (pushSubs) {
    carlData.pushSubscriptions = pushSubs;
    console.log(`   ✅ Found ${pushSubs.length} push subscriptions`);
  }

  console.log('\n📊 Extracted:');
  console.log(`   User: ${carlData.user ? 'Yes' : 'No'}`);
  console.log(`   Picks: ${carlData.picks.length}`);
  console.log(`   Submissions: ${carlData.submissions.length}`);
  console.log(`   League Memberships: ${carlData.leagueMembers.length}`);
  console.log(`   Push Subscriptions: ${carlData.pushSubscriptions.length}\n`);

  if (!carlData.user) {
    console.error('❌ No user found! Cannot proceed.');
    return;
  }

  // Restore to main database
  console.log('🔄 Restoring to main database...\n');

  // Restore user
  const { error: restoreUserError } = await mainSupabase
    .from('users')
    .upsert(carlData.user, { onConflict: 'id' });

  if (restoreUserError) {
    console.error('❌ Error restoring user:', restoreUserError.message);
  } else {
    console.log(`✅ Restored user: ${carlData.user.name}`);
  }

  // Restore picks in batches
  if (carlData.picks.length > 0) {
    for (let i = 0; i < carlData.picks.length; i += 100) {
      const chunk = carlData.picks.slice(i, i + 100);
      const { error } = await mainSupabase
        .from('picks')
        .upsert(chunk, { onConflict: 'user_id,gw,fixture_index' });
      
      if (error) {
        console.error(`❌ Error restoring picks chunk ${i}-${i + chunk.length}:`, error.message);
      }
    }
    console.log(`✅ Restored ${carlData.picks.length} picks`);
  }

  // Restore submissions
  if (carlData.submissions.length > 0) {
    const { error } = await mainSupabase
      .from('gw_submissions')
      .upsert(carlData.submissions, { onConflict: 'user_id,gw' });
    
    if (error) {
      console.error('❌ Error restoring submissions:', error.message);
    } else {
      console.log(`✅ Restored ${carlData.submissions.length} submissions`);
    }
  }

  // Restore league members
  if (carlData.leagueMembers.length > 0) {
    const { error } = await mainSupabase
      .from('league_members')
      .upsert(carlData.leagueMembers, { onConflict: 'league_id,user_id' });
    
    if (error) {
      console.error('❌ Error restoring league memberships:', error.message);
    } else {
      console.log(`✅ Restored ${carlData.leagueMembers.length} league memberships`);
    }
  }

  // Restore push subscriptions
  if (carlData.pushSubscriptions.length > 0) {
    const { error } = await mainSupabase
      .from('push_subscriptions')
      .upsert(carlData.pushSubscriptions, { onConflict: 'user_id,player_id' });
    
    if (error) {
      console.error('❌ Error restoring push subscriptions:', error.message);
    } else {
      console.log(`✅ Restored ${carlData.pushSubscriptions.length} push subscriptions`);
    }
  }

  console.log('\n✅ DONE! All Carl data restored to main database.\n');
}

extractCarlFromTempProject().catch(console.error);

