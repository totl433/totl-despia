#!/usr/bin/env node
/**
 * Check David Bird's GW16 picks from web table
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDavidBirdGw16Picks() {
  console.log('🔍 Checking David Bird\'s GW16 picks from WEB table...\n');
  
  // Find David Bird's user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (userError) {
    console.error('❌ Error finding user:', userError);
    return;
  }
  
  if (!user) {
    console.log('❌ David Bird not found in users table');
    return;
  }
  
  console.log(`✅ Found user: ${user.name} (ID: ${user.id})\n`);
  
  // Get GW16 fixtures from both tables
  const { data: webFixtures, error: webFixturesError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  const { data: appFixtures, error: appFixturesError } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  // Use app fixtures if web fixtures don't have names
  const fixtures = (webFixtures?.some(f => f.home_name) ? webFixtures : appFixtures) || webFixtures || appFixtures;
  
  if (webFixturesError || appFixturesError) {
    console.error('❌ Error fetching fixtures:', webFixturesError || appFixturesError);
    return;
  }
  
  console.log(`📅 GW16 Fixtures (${fixtures?.length || 0}):`);
  fixtures?.forEach((f, idx) => {
    console.log(`   ${f.fixture_index}. ${f.home_name} vs ${f.away_name}`);
  });
  
  // Get David Bird's GW16 picks from WEB table (picks)
  const { data: webPicks, error: webPicksError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (webPicksError) {
    console.error('❌ Error fetching web picks:', webPicksError);
    return;
  }
  
  console.log(`\n📊 WEB PICKS (picks table) - ${webPicks?.length || 0} picks:`);
  if (!webPicks || webPicks.length === 0) {
    console.log('   ❌ No picks found in web table');
  } else {
    webPicks.forEach(pick => {
      const fixture = fixtures?.find(f => f.fixture_index === pick.fixture_index);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${pick.fixture_index}`;
      console.log(`   ${pick.fixture_index}. ${matchName}: ${pick.pick}`);
    });
  }
  
  // Get David Bird's GW16 picks from APP table (app_picks)
  const { data: appPicks, error: appPicksError } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (appPicksError) {
    console.error('❌ Error fetching app picks:', appPicksError);
    return;
  }
  
  console.log(`\n📊 APP PICKS (app_picks table) - ${appPicks?.length || 0} picks:`);
  if (!appPicks || appPicks.length === 0) {
    console.log('   ❌ No picks found in app table');
  } else {
    appPicks.forEach(pick => {
      const fixture = fixtures?.find(f => f.fixture_index === pick.fixture_index);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${pick.fixture_index}`;
      console.log(`   ${pick.fixture_index}. ${matchName}: ${pick.pick}`);
    });
  }
  
  // Compare
  console.log('\n🔍 COMPARISON:');
  
  const webPicksMap = new Map(webPicks?.map(p => [p.fixture_index, p.pick]) || []);
  const appPicksMap = new Map(appPicks?.map(p => [p.fixture_index, p.pick]) || []);
  
  const allFixtureIndices = [...new Set([
    ...(webPicks?.map(p => p.fixture_index) || []),
    ...(appPicks?.map(p => p.fixture_index) || [])
  ])].sort((a, b) => a - b);
  
  const missingInApp = [];
  const missingInWeb = [];
  const different = [];
  const matching = [];
  
  allFixtureIndices.forEach(fixtureIndex => {
    const webPick = webPicksMap.get(fixtureIndex);
    const appPick = appPicksMap.get(fixtureIndex);
    
    if (webPick && !appPick) {
      missingInApp.push(fixtureIndex);
    } else if (!webPick && appPick) {
      missingInWeb.push(fixtureIndex);
    } else if (webPick && appPick && webPick !== appPick) {
      different.push(fixtureIndex);
    } else if (webPick && appPick && webPick === appPick) {
      matching.push(fixtureIndex);
    }
  });
  
  if (missingInApp.length > 0) {
    console.log(`\n❌ MISSING IN APP (${missingInApp.length}):`);
    missingInApp.forEach(fixtureIndex => {
      const webPick = webPicksMap.get(fixtureIndex);
      const fixture = fixtures?.find(f => f.fixture_index === fixtureIndex);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${fixtureIndex}`;
      console.log(`   ${fixtureIndex}. ${matchName}: Web has "${webPick}", but NOT in app_picks`);
    });
  }
  
  if (missingInWeb.length > 0) {
    console.log(`\n⚠️  IN APP BUT NOT IN WEB (${missingInWeb.length}):`);
    missingInWeb.forEach(fixtureIndex => {
      const appPick = appPicksMap.get(fixtureIndex);
      const fixture = fixtures?.find(f => f.fixture_index === fixtureIndex);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${fixtureIndex}`;
      console.log(`   ${fixtureIndex}. ${matchName}: App has "${appPick}", but NOT in picks`);
    });
  }
  
  if (different.length > 0) {
    console.log(`\n⚠️  DIFFERENT VALUES (${different.length}):`);
    different.forEach(fixtureIndex => {
      const webPick = webPicksMap.get(fixtureIndex);
      const appPick = appPicksMap.get(fixtureIndex);
      const fixture = fixtures?.find(f => f.fixture_index === fixtureIndex);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${fixtureIndex}`;
      console.log(`   ${fixtureIndex}. ${matchName}: Web="${webPick}", App="${appPick}"`);
    });
  }
  
  if (matching.length > 0) {
    console.log(`\n✅ MATCHING (${matching.length}):`);
    matching.forEach(fixtureIndex => {
      const pick = webPicksMap.get(fixtureIndex);
      const fixture = fixtures?.find(f => f.fixture_index === fixtureIndex);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${fixtureIndex}`;
      console.log(`   ${fixtureIndex}. ${matchName}: "${pick}"`);
    });
  }
  
  if (missingInApp.length === 0 && missingInWeb.length === 0 && different.length === 0) {
    console.log('\n✅ All picks are properly mirrored!');
  } else {
    console.log(`\n❌ ISSUE: ${missingInApp.length} pick(s) missing in app table`);
  }
}

checkDavidBirdGw16Picks().catch(console.error);
