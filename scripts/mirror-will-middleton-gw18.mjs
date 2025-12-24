#!/usr/bin/env node
/**
 * Mirror Will Middleton's GW18 picks from app_picks to picks table
 * This is needed because he's now an app-only user but the triggers haven't been updated yet
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Will Middleton's user ID
const WILL_MIDDLETON_USER_ID = '42b48136-040e-42a3-9b0a-dc9550dd1cae';
const GW = 18;

async function mirrorWillMiddletonGw18() {
  console.log('🔧 Mirroring Will Middleton\'s GW18 picks from app_picks to picks...\n');
  
  // Get Will Middleton's user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', WILL_MIDDLETON_USER_ID)
    .single();
  
  if (userError || !user) {
    console.error('❌ Error fetching user:', userError);
    return;
  }
  
  console.log(`👤 User: ${user.name} (${user.id})\n`);
  
  // Get app fixtures for GW18
  const { data: appFixtures, error: fixturesError } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', GW)
    .order('fixture_index', { ascending: true });
  
  if (fixturesError) {
    console.error('❌ Error fetching app fixtures:', fixturesError);
    return;
  }
  
  if (!appFixtures || appFixtures.length === 0) {
    console.error(`❌ No app fixtures found for GW${GW}`);
    return;
  }
  
  console.log(`📊 Found ${appFixtures.length} fixtures for GW${GW}\n`);
  
  // Get Will Middleton's picks from app_picks
  const { data: appPicks, error: appPicksError } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', WILL_MIDDLETON_USER_ID)
    .eq('gw', GW)
    .order('fixture_index', { ascending: true });
  
  if (appPicksError) {
    console.error('❌ Error fetching app_picks:', appPicksError);
    return;
  }
  
  if (!appPicks || appPicks.length === 0) {
    console.error(`❌ No picks found in app_picks for Will Middleton in GW${GW}`);
    console.log('   Make sure he has submitted his picks on the app first.');
    return;
  }
  
  console.log(`✅ Found ${appPicks.length} picks in app_picks:\n`);
  appPicks.forEach(p => {
    const fixture = appFixtures.find(f => f.fixture_index === p.fixture_index);
    console.log(`   Fixture ${p.fixture_index}: ${fixture?.home_name || '?'} vs ${fixture?.away_name || '?'} = ${p.pick}`);
  });
  
  // Get web fixtures to match by team codes/names
  const { data: webFixtures, error: webFixturesError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', GW)
    .order('fixture_index', { ascending: true });
  
  if (webFixturesError) {
    console.error('❌ Error fetching web fixtures:', webFixturesError);
    return;
  }
  
  if (!webFixtures || webFixtures.length === 0) {
    console.error(`❌ No web fixtures found for GW${GW}`);
    return;
  }
  
  console.log(`\n📊 Found ${webFixtures.length} web fixtures for GW${GW}\n`);
  
  // Map app picks to web picks by matching fixtures
  const picksToInsert = [];
  
  for (const appPick of appPicks) {
    const appFixture = appFixtures.find(f => f.fixture_index === appPick.fixture_index);
    if (!appFixture) {
      console.warn(`⚠️  Could not find app fixture for index ${appPick.fixture_index}`);
      continue;
    }
    
    // Try to find matching web fixture
    // First try by fixture_index (if orders match)
    let webFixtureIndex = appPick.fixture_index;
    let webFixture = webFixtures.find(f => f.fixture_index === webFixtureIndex);
    
    // If fixture_index doesn't match, try matching by team codes/names
    if (!webFixture || 
        (webFixture.home_code && appFixture.home_code && webFixture.home_code !== appFixture.home_code)) {
      // Try matching by codes
      webFixture = webFixtures.find(f => {
        const codesMatch = (
          (f.home_code && f.away_code && appFixture.home_code && appFixture.away_code) &&
          (
            (f.home_code === appFixture.home_code && f.away_code === appFixture.away_code) ||
            (f.home_code === appFixture.away_code && f.away_code === appFixture.home_code)
          )
        );
        
        const namesMatch = (
          (f.home_name && f.away_name && appFixture.home_name && appFixture.away_name) &&
          (
            (f.home_name.toLowerCase() === appFixture.home_name.toLowerCase() && 
             f.away_name.toLowerCase() === appFixture.away_name.toLowerCase()) ||
            (f.home_name.toLowerCase() === appFixture.away_name.toLowerCase() && 
             f.away_name.toLowerCase() === appFixture.home_name.toLowerCase())
          )
        );
        
        return codesMatch || namesMatch;
      });
      
      if (webFixture) {
        webFixtureIndex = webFixture.fixture_index;
      }
    }
    
    if (!webFixture) {
      console.warn(`⚠️  Could not find matching web fixture for app fixture ${appPick.fixture_index} (${appFixture.home_name} vs ${appFixture.away_name})`);
      // Fall back to same fixture_index
      webFixtureIndex = appPick.fixture_index;
    }
    
    picksToInsert.push({
      user_id: WILL_MIDDLETON_USER_ID,
      gw: GW,
      fixture_index: webFixtureIndex,
      pick: appPick.pick
    });
    
    const webFixtureFinal = webFixtures.find(f => f.fixture_index === webFixtureIndex);
    console.log(`   Mapping: App index ${appPick.fixture_index} (${appFixture.home_name} vs ${appFixture.away_name}) -> Web index ${webFixtureIndex} (${webFixtureFinal?.home_team || '?'} vs ${webFixtureFinal?.away_team || '?'}) = ${appPick.pick}`);
  }
  
  if (picksToInsert.length === 0) {
    console.error('❌ No picks to insert after mapping');
    return;
  }
  
  console.log(`\n📊 Will insert ${picksToInsert.length} picks into picks table\n`);
  
  // Check if picks already exist
  const { data: existingPicks, error: existingError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', WILL_MIDDLETON_USER_ID)
    .eq('gw', GW);
  
  if (existingError) {
    console.error('❌ Error checking existing picks:', existingError);
    return;
  }
  
  if (existingPicks && existingPicks.length > 0) {
    console.log(`⚠️  Found ${existingPicks.length} existing picks in picks table for GW${GW}`);
    console.log('   Deleting existing picks first...\n');
    
    const { error: deleteError } = await supabase
      .from('picks')
      .delete()
      .eq('user_id', WILL_MIDDLETON_USER_ID)
      .eq('gw', GW);
    
    if (deleteError) {
      console.error('❌ Error deleting existing picks:', deleteError);
      return;
    }
    
    console.log('✅ Deleted existing picks\n');
  }
  
  // Insert picks
  console.log('➕ Inserting picks...');
  const { error: insertError } = await supabase
    .from('picks')
    .insert(picksToInsert);
  
  if (insertError) {
    console.error('❌ Error inserting picks:', insertError);
    return;
  }
  
  console.log(`✅ Successfully inserted ${picksToInsert.length} picks\n`);
  
  // Check for submission in app_gw_submissions and mirror it
  const { data: appSubmission, error: submissionError } = await supabase
    .from('app_gw_submissions')
    .select('*')
    .eq('user_id', WILL_MIDDLETON_USER_ID)
    .eq('gw', GW)
    .single();
  
  if (submissionError && submissionError.code !== 'PGRST116') { // PGRST116 = not found
    console.error('❌ Error checking app submission:', submissionError);
  } else if (appSubmission) {
    console.log(`📝 Found submission in app_gw_submissions: ${appSubmission.submitted_at}`);
    
    // Upsert submission to gw_submissions
    const { error: upsertError } = await supabase
      .from('gw_submissions')
      .upsert({
        user_id: WILL_MIDDLETON_USER_ID,
        gw: GW,
        submitted_at: appSubmission.submitted_at
      }, { onConflict: 'user_id,gw' });
    
    if (upsertError) {
      console.error('❌ Error upserting submission:', upsertError);
    } else {
      console.log('✅ Successfully mirrored submission to gw_submissions\n');
    }
  } else {
    console.log('⚠️  No submission found in app_gw_submissions (picks were still mirrored)\n');
  }
  
  // Verify
  console.log('🔍 Verifying mirror...');
  const { data: webPicks, error: verifyError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', WILL_MIDDLETON_USER_ID)
    .eq('gw', GW)
    .order('fixture_index', { ascending: true });
  
  if (verifyError) {
    console.error('❌ Error verifying picks:', verifyError);
    return;
  }
  
  console.log(`\n✅ Verification: Found ${webPicks?.length || 0} picks in picks table for GW${GW}`);
  webPicks?.forEach(p => {
    const fixture = webFixtures.find(f => f.fixture_index === p.fixture_index);
    console.log(`   Fixture ${p.fixture_index}: ${fixture?.home_team || '?'} vs ${fixture?.away_team || '?'} = ${p.pick}`);
  });
  
  console.log('\n✅ Mirror complete! Will Middleton\'s GW18 picks are now visible to web users.');
}

mirrorWillMiddletonGw18().catch(console.error);

