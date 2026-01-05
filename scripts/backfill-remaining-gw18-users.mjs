// scripts/backfill-remaining-gw18-users.mjs
// SAFE BACKFILL: Jonathan Keira Knightly Kinnersley and Sham G GW18 picks and submission from app to web
// EXTREMELY CAREFUL - Only touches these 2 users' GW18 data, nothing else

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// STRICT CONSTANTS - Only these 2 users, Only GW18
const USERS_TO_BACKFILL = [
  {
    id: 'bdf4f650-641e-46a2-b98d-788295ce2c36',
    name: 'Jonathan Keira Knightly Kinnersley'
  },
  {
    id: 'df9a65d1-c13b-4d3f-bb6c-bda2ed4a88d9',
    name: 'Sham G'
  }
];
const GW = 18;

async function backfillUser(userId, userName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔒 BACKFILLING: ${userName}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`User ID: ${userId}`);
  console.log(`Gameweek: ${GW}\n`);

  try {
    // Step 1: Verify app data exists
    console.log('📋 Step 1: Verifying app data...');
    const { data: appPicks, error: appPicksError } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', GW)
      .order('fixture_index');

    if (appPicksError) throw appPicksError;

    if (!appPicks || appPicks.length === 0) {
      console.log(`❌ No app picks found for ${userName} GW18 - skipping`);
      return { success: false, reason: 'no_picks' };
    }

    console.log(`✅ Found ${appPicks.length} app picks`);

    const { data: appSubmission, error: appSubError } = await supabase
      .from('app_gw_submissions')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', GW)
      .maybeSingle();

    if (appSubError) throw appSubError;

    if (!appSubmission) {
      console.log(`❌ No app submission found for ${userName} GW18 - skipping`);
      return { success: false, reason: 'no_submission' };
    }

    console.log(`✅ Found app submission: ${appSubmission.submitted_at}\n`);

    // Step 2: Get fixtures for matching
    console.log('📋 Step 2: Loading fixtures for matching...');
    const { data: appFixtures, error: appFixturesError } = await supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', GW)
      .order('fixture_index');

    const { data: webFixtures, error: webFixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', GW)
      .order('fixture_index');

    if (appFixturesError) throw appFixturesError;
    if (webFixturesError) throw webFixturesError;

    console.log(`✅ Loaded ${appFixtures.length} app fixtures and ${webFixtures.length} web fixtures\n`);

    // Step 3: Match fixtures and prepare picks for insertion
    console.log('📋 Step 3: Matching fixtures and preparing picks...');
    const picksToInsert = [];

    for (const appPick of appPicks) {
      const appFixture = appFixtures.find(f => f.fixture_index === appPick.fixture_index);
      
      if (!appFixture) {
        console.log(`⚠️  Warning: Could not find app fixture ${appPick.fixture_index}`);
        continue;
      }

      // Normalize codes (NOT -> NFO) - same logic as trigger
      const appHomeCodeNorm = appFixture.home_code === 'NOT' ? 'NFO' : appFixture.home_code;
      const appAwayCodeNorm = appFixture.away_code === 'NOT' ? 'NFO' : appFixture.away_code;

      // Find matching web fixture
      const matchingWebFixture = webFixtures.find(f => {
        // Match by codes
        if (f.home_code && f.away_code && appHomeCodeNorm && appAwayCodeNorm) {
          return (f.home_code === appHomeCodeNorm && f.away_code === appAwayCodeNorm) ||
                 (f.home_code === appAwayCodeNorm && f.away_code === appHomeCodeNorm);
        }
        // Fall back to names
        if (f.home_name && f.away_name && appFixture.home_name && appFixture.away_name) {
          return (f.home_name.toLowerCase() === appFixture.home_name.toLowerCase() &&
                  f.away_name.toLowerCase() === appFixture.away_name.toLowerCase()) ||
                 (f.home_name.toLowerCase() === appFixture.away_name.toLowerCase() &&
                  f.away_name.toLowerCase() === appFixture.home_name.toLowerCase());
        }
        return false;
      });

      if (!matchingWebFixture) {
        // Fallback to same fixture_index
        console.log(`⚠️  Warning: No match for fixture ${appPick.fixture_index}, using same index`);
        picksToInsert.push({
          user_id: userId,
          gw: GW,
          fixture_index: appPick.fixture_index,
          pick: appPick.pick
        });
      } else {
        picksToInsert.push({
          user_id: userId,
          gw: GW,
          fixture_index: matchingWebFixture.fixture_index,
          pick: appPick.pick
        });
      }
    }

    console.log(`✅ Prepared ${picksToInsert.length} picks for insertion\n`);

    // Step 4: Check what currently exists in web (for verification)
    console.log('📋 Step 4: Checking existing web data...');
    const { data: existingWebPicks, error: existingPicksError } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', GW);

    const { data: existingWebSubmission, error: existingSubError } = await supabase
      .from('gw_submissions')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', GW)
      .maybeSingle();

    if (existingPicksError) throw existingPicksError;
    if (existingSubError) throw existingSubError;

    console.log(`   Existing web picks: ${existingWebPicks?.length || 0}`);
    console.log(`   Existing web submission: ${existingWebSubmission ? 'YES' : 'NO'}\n`);

    // Step 5: Show what will be inserted
    console.log('📋 Step 5: What will be inserted:\n');
    console.log(`PICKS TO INSERT: ${picksToInsert.length} picks`);
    picksToInsert.slice(0, 3).forEach((pick, idx) => {
      const appFixture = appFixtures.find(f => f.fixture_index === appPicks[idx].fixture_index);
      console.log(`   ${idx + 1}. ${appFixture?.home_name || 'Unknown'} vs ${appFixture?.away_name || 'Unknown'} → Pick: ${pick.pick}`);
    });
    if (picksToInsert.length > 3) {
      console.log(`   ... and ${picksToInsert.length - 3} more picks`);
    }

    console.log(`\nSUBMISSION TO INSERT:`);
    console.log(`   Submitted At: ${appSubmission.submitted_at}\n`);

    // Step 6: Insert picks
    console.log('📋 Step 6: Inserting picks...');
    const { error: insertPicksError } = await supabase
      .from('picks')
      .upsert(picksToInsert, { onConflict: 'user_id,gw,fixture_index' });

    if (insertPicksError) throw insertPicksError;
    console.log('✅ Picks inserted successfully\n');

    // Step 7: Insert submission
    console.log('📋 Step 7: Inserting submission...');
    const { error: insertSubError } = await supabase
      .from('gw_submissions')
      .upsert({
        user_id: userId,
        gw: GW,
        submitted_at: appSubmission.submitted_at
      }, { onConflict: 'user_id,gw' });

    if (insertSubError) throw insertSubError;
    console.log('✅ Submission inserted successfully\n');

    // Step 8: Verify
    console.log('📋 Step 8: Verifying insertion...');
    const { data: verifyPicks, error: verifyPicksError } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', GW);

    const { data: verifySub, error: verifySubError } = await supabase
      .from('gw_submissions')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', GW)
      .maybeSingle();

    if (verifyPicksError) throw verifyPicksError;
    if (verifySubError) throw verifySubError;

    console.log(`✅ Verification: ${verifyPicks.length} picks and ${verifySub ? '1' : '0'} submission in web table`);
    console.log(`\n✅ ${userName} BACKFILL COMPLETE!\n`);

    return { success: true, picksInserted: verifyPicks.length, submissionInserted: verifySub ? 1 : 0 };

  } catch (error) {
    console.error(`❌ Error backfilling ${userName}:`, error);
    return { success: false, error: error.message };
  }
}

async function backfillAllUsers() {
  console.log('🔒 SAFE BACKFILL: Remaining GW18 Users Only\n');
  console.log(`Users to backfill: ${USERS_TO_BACKFILL.length}`);
  USERS_TO_BACKFILL.forEach((user, idx) => {
    console.log(`   ${idx + 1}. ${user.name} (${user.id})`);
  });
  console.log(`Gameweek: ${GW}`);
  console.log('⚠️  This will ONLY touch these users\' GW18 data, nothing else\n');

  const results = [];

  for (const user of USERS_TO_BACKFILL) {
    const result = await backfillUser(user.id, user.name);
    results.push({ user: user.name, ...result });
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.user}: ${result.picksInserted} picks, ${result.submissionInserted} submission`);
    } else {
      console.log(`❌ ${result.user}: ${result.reason || result.error || 'Failed'}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Successfully backfilled: ${successCount}/${USERS_TO_BACKFILL.length} users\n`);
}

backfillAllUsers();








