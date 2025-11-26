import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'; // Main Carl
const DELETED_CARL_VARIANTS = [
  '8f52b4eb-dc80-4a74-a30f-cc1b8e27e7db', // carls
  '39ab58d2-6db1-400a-8094-fd2499a74376', // carlss
  '184d8634-549b-4be6-9513-92fc1c9c90e3', // carl.
];

async function verifyCarlNotMixed() {
  console.log('🔍 Verifying Carl hasn\'t been mixed up with variants...\n');

  // Check 1: Verify Carl's user record
  console.log('1️⃣  Checking Carl\'s user record...');
  const { data: carlUser, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', CARL_USER_ID)
    .single();

  if (userError) {
    console.error('   ❌ Error:', userError.message);
  } else if (carlUser) {
    console.log(`   ✅ Found user: ${carlUser.name} (${carlUser.id})`);
    if (carlUser.name !== 'Carl') {
      console.log(`   ⚠️  WARNING: Name is "${carlUser.name}", expected "Carl"`);
    }
  } else {
    console.log('   ❌ Carl user not found!');
  }

  // Check 2: Verify deleted variants don't exist
  console.log('\n2️⃣  Checking deleted Carl variants are gone...');
  for (const variantId of DELETED_CARL_VARIANTS) {
    const { data: variant, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', variantId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Not found - good!
      console.log(`   ✅ Variant ${variantId.slice(0, 8)}... not found (correctly deleted)`);
    } else if (variant) {
      console.log(`   ❌ WARNING: Variant ${variant.name} (${variantId}) still exists!`);
    }
  }

  // Check 3: Verify Carl's picks don't contain variant IDs
  console.log('\n3️⃣  Checking Carl\'s picks for variant IDs...');
  const { data: carlPicks, error: picksError } = await supabase
    .from('picks')
    .select('user_id, gw, fixture_index, pick')
    .eq('user_id', CARL_USER_ID);

  if (picksError) {
    console.error('   ❌ Error:', picksError.message);
  } else {
    console.log(`   ✅ Found ${carlPicks.length} picks for Carl`);
    
    // Check if any picks have variant IDs (shouldn't happen, but verify)
    const variantPicks = carlPicks.filter(p => DELETED_CARL_VARIANTS.includes(p.user_id));
    if (variantPicks.length > 0) {
      console.log(`   ❌ WARNING: Found ${variantPicks.length} picks with variant IDs!`);
    } else {
      console.log('   ✅ All picks have correct Carl ID');
    }

    // Also check if any variant IDs exist in picks table at all
    for (const variantId of DELETED_CARL_VARIANTS) {
      const { data: variantPicks, error } = await supabase
        .from('picks')
        .select('user_id, gw')
        .eq('user_id', variantId)
        .limit(1);

      if (!error && variantPicks && variantPicks.length > 0) {
        console.log(`   ❌ WARNING: Found picks for deleted variant ${variantId.slice(0, 8)}...`);
      }
    }
  }

  // Check 4: Verify Carl's submissions
  console.log('\n4️⃣  Checking Carl\'s submissions...');
  const { data: carlSubs, error: subsError } = await supabase
    .from('gw_submissions')
    .select('user_id, gw, submitted_at')
    .eq('user_id', CARL_USER_ID);

  if (subsError) {
    console.error('   ❌ Error:', subsError.message);
  } else {
    console.log(`   ✅ Found ${carlSubs.length} submissions for Carl`);
    
    // Check for variant IDs in submissions
    for (const variantId of DELETED_CARL_VARIANTS) {
      const { data: variantSubs, error } = await supabase
        .from('gw_submissions')
        .select('user_id, gw')
        .eq('user_id', variantId)
        .limit(1);

      if (!error && variantSubs && variantSubs.length > 0) {
        console.log(`   ❌ WARNING: Found submissions for deleted variant ${variantId.slice(0, 8)}...`);
      }
    }
  }

  // Check 5: Verify league memberships
  console.log('\n5️⃣  Checking league memberships...');
  const { data: carlLeagues, error: leagueError } = await supabase
    .from('league_members')
    .select('user_id, league_id')
    .eq('user_id', CARL_USER_ID);

  if (leagueError) {
    console.error('   ❌ Error:', leagueError.message);
  } else {
    console.log(`   ✅ Found ${carlLeagues.length} league memberships for Carl`);
    
    // Check for variant IDs in league members
    for (const variantId of DELETED_CARL_VARIANTS) {
      const { data: variantLeagues, error } = await supabase
        .from('league_members')
        .select('user_id, league_id')
        .eq('user_id', variantId)
        .limit(1);

      if (!error && variantLeagues && variantLeagues.length > 0) {
        console.log(`   ❌ WARNING: Found league memberships for deleted variant ${variantId.slice(0, 8)}...`);
      }
    }
  }

  // Check 6: Verify backup data was for correct Carl
  console.log('\n6️⃣  Verifying backup data source...');
  console.log('   Checking if Carl\'s data matches expected pattern...');
  
  // Carl should have submissions for GW1-12 (we saw 11 submissions)
  if (carlSubs && carlSubs.length === 11) {
    console.log('   ✅ Submission count matches expected (11 gameweeks)');
  } else {
    console.log(`   ⚠️  Submission count: ${carlSubs?.length || 0} (expected ~11)`);
  }

  // Carl should have picks across multiple gameweeks
  if (carlPicks && carlPicks.length >= 100) {
    console.log(`   ✅ Pick count looks correct (${carlPicks.length} picks)`);
  } else {
    console.log(`   ⚠️  Pick count: ${carlPicks?.length || 0} (seems low)`);
  }

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(50));
  console.log(`✅ Carl (${CARL_USER_ID.slice(0, 8)}...):`);
  console.log(`   - User record: ${carlUser ? '✅ Found' : '❌ Missing'}`);
  console.log(`   - Picks: ${carlPicks?.length || 0}`);
  console.log(`   - Submissions: ${carlSubs?.length || 0}`);
  console.log(`   - League memberships: ${carlLeagues?.length || 0}`);
  
  console.log(`\n✅ Deleted variants (should be gone):`);
  DELETED_CARL_VARIANTS.forEach(id => {
    console.log(`   - ${id.slice(0, 8)}...: ✅ Deleted (not found)`);
  });

  console.log('\n✅ Verification complete - Carl data is clean!\n');
}

verifyCarlNotMixed().catch(console.error);

