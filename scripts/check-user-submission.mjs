import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkUserSubmission() {
  console.log('🔍 Checking user submission status...\n');

  const userName = 'gregrory'; // Try both spellings
  const gw = 14;

  try {
    // Step 1: Find the user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .or(`name.ilike.%${userName}%,name.ilike.%gregory%`);

    if (userError) throw userError;

    if (!users || users.length === 0) {
      console.log(`❌ User "${userName}" not found`);
      return;
    }

    const user = users[0];
    console.log(`✅ Found user: ${user.name} (${user.id})\n`);

    // Step 2: Check Web submission
    console.log('📊 Checking Web submission...');
    const { data: webSubmission, error: webSubError } = await supabase
      .from('gw_submissions')
      .select('user_id, gw, submitted_at')
      .eq('user_id', user.id)
      .eq('gw', gw)
      .maybeSingle();

    if (webSubError) throw webSubError;

    if (webSubmission) {
      console.log(`   ✅ Web submission found: ${webSubmission.submitted_at}`);
    } else {
      console.log(`   ❌ No Web submission found for GW${gw}`);
    }

    // Step 3: Check App submission
    console.log('\n📊 Checking App submission...');
    const { data: appSubmission, error: appSubError } = await supabase
      .from('app_gw_submissions')
      .select('user_id, gw, submitted_at')
      .eq('user_id', user.id)
      .eq('gw', gw)
      .maybeSingle();

    if (appSubError) throw appSubError;

    if (appSubmission) {
      console.log(`   ✅ App submission found: ${appSubmission.submitted_at}`);
    } else {
      console.log(`   ❌ No App submission found for GW${gw}`);
    }

    // Step 4: Check Web picks
    console.log('\n📊 Checking Web picks...');
    const { data: webPicks, error: webPicksError } = await supabase
      .from('picks')
      .select('fixture_index, pick')
      .eq('user_id', user.id)
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (webPicksError) throw webPicksError;

    if (webPicks && webPicks.length > 0) {
      console.log(`   ✅ Found ${webPicks.length} Web picks`);
      console.log(`   Picks: ${webPicks.map(p => `${p.fixture_index}:${p.pick}`).join(', ')}`);
    } else {
      console.log(`   ❌ No Web picks found for GW${gw}`);
    }

    // Step 5: Check App picks
    console.log('\n📊 Checking App picks...');
    const { data: appPicks, error: appPicksError } = await supabase
      .from('app_picks')
      .select('fixture_index, pick')
      .eq('user_id', user.id)
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (appPicksError) throw appPicksError;

    if (appPicks && appPicks.length > 0) {
      console.log(`   ✅ Found ${appPicks.length} App picks`);
      console.log(`   Picks: ${appPicks.map(p => `${p.fixture_index}:${p.pick}`).join(', ')}`);
    } else {
      console.log(`   ❌ No App picks found for GW${gw}`);
    }

    // Step 6: Summary
    console.log('\n📋 Summary:');
    console.log('================================================================================');
    if (webSubmission && !appSubmission) {
      console.log('⚠️  ISSUE: User has submitted on Web but NOT mirrored to App!');
      console.log('   Run: node scripts/mirror-gw14-web-to-app.mjs');
    } else if (webSubmission && appSubmission) {
      console.log('✅ User submission is mirrored correctly');
    } else if (!webSubmission && appSubmission) {
      console.log('ℹ️  User has App submission but no Web submission (App-native user)');
    } else {
      console.log('❌ User has not submitted on either Web or App');
    }

    if (webPicks && webPicks.length > 0 && (!appPicks || appPicks.length === 0)) {
      console.log('⚠️  ISSUE: User has picks on Web but NOT mirrored to App!');
      console.log('   Run: node scripts/mirror-gw14-web-to-app.mjs');
    } else if (webPicks && webPicks.length > 0 && appPicks && appPicks.length > 0) {
      console.log('✅ User picks are mirrored correctly');
    }

  } catch (error) {
    console.error('❌ Error checking user submission:', error.message || error);
    process.exit(1);
  }
}

checkUserSubmission();

