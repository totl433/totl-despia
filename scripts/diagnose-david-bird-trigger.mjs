// scripts/diagnose-david-bird-trigger.mjs
// Diagnostic: Why isn't David Bird's GW18 picks being mirrored?
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

async function diagnoseDavidBird() {
  const davidBirdId = 'd2cbeca9-7dae-4be1-88fb-706911d67256';
  const gw = 18;

  console.log('🔍 Diagnosing why David Bird\'s GW18 picks aren\'t being mirrored...\n');
  console.log(`David Bird ID: ${davidBirdId}`);
  console.log(`Gameweek: ${gw}\n`);

  try {
    // 1. Check if David Bird has picks in app_picks
    const { data: appPicks, error: appPicksError } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', davidBirdId)
      .eq('gw', gw)
      .order('fixture_index');

    if (appPicksError) throw appPicksError;

    console.log(`📱 App Picks: ${appPicks.length} picks found`);
    if (appPicks.length === 0) {
      console.log('   ⚠️  No app picks found - nothing to mirror!');
      return;
    }

    // 2. Check if David Bird has picks in picks (web)
    const { data: webPicks, error: webPicksError } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', davidBirdId)
      .eq('gw', gw)
      .order('fixture_index');

    if (webPicksError) throw webPicksError;

    console.log(`🌐 Web Picks: ${webPicks.length} picks found\n`);

    // 3. Get all fixtures for matching
    const { data: appFixtures, error: appFixturesError } = await supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', gw)
      .order('fixture_index');

    const { data: webFixtures, error: webFixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', gw)
      .order('fixture_index');

    if (appFixturesError) throw appFixturesError;
    if (webFixturesError) throw webFixturesError;

    console.log(`📋 App Fixtures: ${appFixtures.length}`);
    console.log(`📋 Web Fixtures: ${webFixtures.length}\n`);

    // 4. Check fixture matching for each pick
    console.log('🔍 Checking fixture matching for each app pick:\n');
    
    let matchesFound = 0;
    let matchesNotFound = 0;

    for (const appPick of appPicks) {
      const appFixture = appFixtures.find(f => f.fixture_index === appPick.fixture_index);
      
      if (!appFixture) {
        console.log(`   ⚠️  Fixture ${appPick.fixture_index}: App fixture not found`);
        continue;
      }

      // Normalize codes (NOT -> NFO)
      const appHomeCodeNorm = appFixture.home_code === 'NOT' ? 'NFO' : appFixture.home_code;
      const appAwayCodeNorm = appFixture.away_code === 'NOT' ? 'NFO' : appFixture.away_code;

      // Try to find matching web fixture
      const matchingWebFixture = webFixtures?.find(f => {
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

      if (matchingWebFixture) {
        matchesFound++;
        // Check if pick exists in web
        const webPickExists = webPicks.some(wp => wp.fixture_index === matchingWebFixture.fixture_index);
        
        console.log(`   Fixture ${appPick.fixture_index}: ${appFixture.home_name} vs ${appFixture.away_name}`);
        console.log(`     App codes: ${appFixture.home_code || 'NULL'}/${appFixture.away_code || 'NULL'}`);
        console.log(`     Matched web fixture: ${matchingWebFixture.fixture_index}`);
        console.log(`     Web codes: ${matchingWebFixture.home_code || 'NULL'}/${matchingWebFixture.away_code || 'NULL'}`);
        console.log(`     Pick in web: ${webPickExists ? '✅ YES' : '❌ NO'}`);
        console.log(`     Pick value: ${appPick.pick}\n`);
      } else {
        matchesNotFound++;
        console.log(`   ⚠️  Fixture ${appPick.fixture_index}: ${appFixture.home_name || 'Unknown'} vs ${appFixture.away_name || 'Unknown'}`);
        console.log(`     App codes: ${appFixture.home_code || 'NULL'}/${appFixture.away_code || 'NULL'}`);
        console.log(`     ❌ NO MATCHING WEB FIXTURE FOUND!`);
        console.log(`     Pick value: ${appPick.pick}\n`);
      }
    }

    // 5. Check submission
    const { data: appSubmission, error: appSubError } = await supabase
      .from('app_gw_submissions')
      .select('*')
      .eq('user_id', davidBirdId)
      .eq('gw', gw)
      .maybeSingle();

    const { data: webSubmission, error: webSubError } = await supabase
      .from('gw_submissions')
      .select('*')
      .eq('user_id', davidBirdId)
      .eq('gw', gw)
      .maybeSingle();

    console.log('\n📝 Submission Status:');
    console.log(`   App: ${appSubmission ? appSubmission.submitted_at : '❌ NOT FOUND'}`);
    console.log(`   Web: ${webSubmission ? webSubmission.submitted_at : '❌ NOT FOUND'}\n`);

    // 6. Check if David Bird is in the hardcoded list (verify trigger logic)
    const appOnlyUsers = [
      '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
      'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
      '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
      '36f31625-6d6c-4aa4-815a-1493a812841b', // ThomasJamesBird
      'c94f9804-ba11-4cd2-8892-49657aa6412c', // Sim
      '42b48136-040e-42a3-9b0a-dc9550dd1cae', // Will Middleton
      'd2cbeca9-7dae-4be1-88fb-706911d67256'  // David Bird
    ];

    const isInList = appOnlyUsers.includes(davidBirdId);
    console.log('🔐 Trigger Logic Check:');
    console.log(`   David Bird in app-only list: ${isInList ? '✅ YES' : '❌ NO'}`);
    if (!isInList) {
      console.log('   ⚠️  This is the problem! David Bird is NOT in the trigger\'s hardcoded list!');
    }

    // 7. Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`App picks: ${appPicks.length}`);
    console.log(`Web picks: ${webPicks.length}`);
    console.log(`Missing: ${appPicks.length - webPicks.length}`);
    console.log(`Fixture matches found: ${matchesFound}`);
    console.log(`Fixture matches NOT found: ${matchesNotFound}`);
    
    if (webPicks.length === 0 && appPicks.length > 0) {
      console.log('\n⚠️  ISSUE: David Bird has app picks but NO web picks!');
      console.log('   Possible causes:');
      if (!isInList) {
        console.log('   ❌ David Bird NOT in trigger\'s hardcoded list (but should be!)');
      }
      if (matchesNotFound > 0) {
        console.log(`   ⚠️  ${matchesNotFound} fixture(s) couldn't be matched`);
      }
      console.log('   3. Trigger not running (check if trigger exists in database)');
      console.log('   4. Trigger failed silently');
      console.log('   5. Picks inserted before trigger was created/updated');
    } else if (webPicks.length > 0) {
      console.log('\n✅ Some picks ARE in web - partial mirroring occurred');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseDavidBird();








