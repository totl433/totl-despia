import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// We need service role key for admin operations
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   These are needed for admin operations to restore data.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// User IDs from the deletion (we saved these!)
const CARL_USER_IDS = [
  { id: '8f52b4eb-dc80-4a74-a30f-cc1b8e27e7db', name: 'carls' },
  { id: '39ab58d2-6db1-400a-8094-fd2499a74376', name: 'carlss' },
  { id: '184d8634-549b-4be6-9513-92fc1c9c90e3', name: 'carl.' },
  { id: 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', name: 'Carl' }, // This is the main one!
];

async function restoreCarlUsers() {
  console.log('🚨 URGENT: Attempting to restore Carl users...\n');
  console.log('⚠️  NOTE: If Supabase has point-in-time recovery enabled,');
  console.log('   you should restore from the Supabase dashboard FIRST!\n');
  console.log('   Go to: Supabase Dashboard > Database > Backups > Point-in-time Recovery\n');

  // First, check if users still exist (maybe they weren't fully deleted?)
  console.log('🔍 Checking if users still exist in auth.users...');
  for (const user of CARL_USER_IDS) {
    try {
      const { data: authUser, error } = await admin.auth.admin.getUserById(user.id);
      if (!error && authUser?.user) {
        console.log(`✅ ${user.name} (${user.id}) - Auth user still exists!`);
      } else {
        console.log(`❌ ${user.name} (${user.id}) - Auth user deleted`);
      }
    } catch (e) {
      console.log(`❌ ${user.name} (${user.id}) - Cannot check auth user: ${e.message}`);
    }
  }

  console.log('\n📋 Attempting to restore users table entries...');
  
  // Try to restore users - we'll need to recreate them
  // But first check if we can find any traces in other tables
  console.log('\n🔍 Searching for traces of Carl users in other tables...');
  
  for (const user of CARL_USER_IDS) {
    // Check picks table
    const { data: picks } = await admin
      .from('picks')
      .select('*')
      .eq('user_id', user.id)
      .limit(1);
    
    if (picks && picks.length > 0) {
      console.log(`⚠️  Found ${picks.length} picks still referencing ${user.name} - data may be orphaned`);
    }

    // Check league_members
    const { data: leagueMembers } = await admin
      .from('league_members')
      .select('*')
      .eq('user_id', user.id)
      .limit(1);
    
    if (leagueMembers && leagueMembers.length > 0) {
      console.log(`⚠️  Found ${leagueMembers.length} league memberships still referencing ${user.name}`);
    }
  }

  console.log('\n💡 RECOMMENDED ACTION:');
  console.log('   1. Go to Supabase Dashboard immediately');
  console.log('   2. Navigate to: Database > Backups');
  console.log('   3. Look for "Point-in-time Recovery" or "Daily Backups"');
  console.log('   4. Restore to a point BEFORE the deletion');
  console.log('   5. This will restore ALL data including users, picks, submissions, etc.');
  console.log('\n   If PITR is not available, we may need to manually recreate the users');
  console.log('   but their picks and submissions will be lost.\n');

  // Check if we can at least see what leagues Carl was in
  const mainCarlId = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';
  console.log(`\n🔍 Checking for any remaining references to main Carl (${mainCarlId})...`);
  
  // Try to find any foreign key references that might still exist
  const { data: allPicks } = await admin
    .from('picks')
    .select('gw, fixture_index, pick')
    .eq('user_id', mainCarlId)
    .limit(10);
  
  if (allPicks && allPicks.length > 0) {
    console.log(`✅ Found ${allPicks.length} picks still in database for main Carl!`);
    console.log('   This means the picks table might not have been fully cleaned.');
  } else {
    console.log('❌ No picks found - they were deleted');
  }
}

restoreCarlUsers().catch(console.error);

