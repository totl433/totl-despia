#!/usr/bin/env node
/**
 * Fix picks table for app-only users (SP, Jof, Carl, ThomasJamesBird)
 * Copy their correct picks from app_picks to picks table
 * BE VERY CAREFUL - picks table is LIVE and all web users see it
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

// App-only users (4 test users)
const APP_ONLY_USER_IDS = [
  '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
  '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
  '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
];

function normalizeTeamName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\s+fc\s*/gi, ' ')
    .replace(/\s+&/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchFixture(appFixture, webFixture) {
  const appHome = normalizeTeamName(appFixture.home_name);
  const appAway = normalizeTeamName(appFixture.away_name);
  const webHome = normalizeTeamName(webFixture.home_name);
  const webAway = normalizeTeamName(webFixture.away_name);
  
  return (appHome === webHome || appFixture.home_code === webFixture.home_code) &&
         (appAway === webAway || appFixture.away_code === webFixture.away_code);
}

async function fixAppOnlyUsersPicks() {
  console.log('🔧 Fixing picks table for app-only users...\n');
  console.log('⚠️  WARNING: This will modify the LIVE picks table!\n');
  
  const gw = 16;
  
  // Get user names for display
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .in('id', APP_ONLY_USER_IDS);
  
  console.log('👥 App-only users to fix:');
  users?.forEach(u => {
    console.log(`   ${u.name}: ${u.id}`);
  });
  
  // Get app fixtures (correct order - matches web now)
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index', { ascending: true });
  
  // Get web fixtures (need to find correct fixture_index mapping)
  const { data: webFixtures } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index', { ascending: true });
  
  console.log('\n📊 App fixtures order:');
  appFixtures?.forEach((f, i) => {
    console.log(`   ${i}. ${f.home_name} vs ${f.away_name}`);
  });
  
  // Create mapping: app fixture_index -> web fixture_index
  const fixtureMapping = new Map();
  
  console.log('\n🔍 Creating fixture mapping (app -> web):');
  appFixtures?.forEach((appFix, appIndex) => {
    const webIndex = webFixtures?.findIndex(webFix => matchFixture(appFix, webFix));
    if (webIndex !== undefined && webIndex !== -1) {
      fixtureMapping.set(appIndex, webIndex);
      console.log(`   App index ${appIndex} (${appFix.home_name} vs ${appFix.away_name}) -> Web index ${webIndex}`);
    } else {
      console.log(`   ⚠️  Could not find web match for app index ${appIndex} (${appFix.home_name} vs ${appFix.away_name})`);
    }
  });
  
  // For each app-only user, get their picks from app_picks and map to picks table
  const updates = [];
  
  for (const userId of APP_ONLY_USER_IDS) {
    const userName = users?.find(u => u.id === userId)?.name || userId;
    
    // Get picks from app_picks (correct source)
    const { data: appPicks } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });
    
    if (!appPicks || appPicks.length === 0) {
      console.log(`\n⚠️  No picks found in app_picks for ${userName}`);
      continue;
    }
    
    console.log(`\n📋 ${userName} picks from app_picks (correct):`);
    appPicks.forEach(p => {
      const appFix = appFixtures?.find(f => f.fixture_index === p.fixture_index);
      const webIndex = fixtureMapping.get(p.fixture_index);
      console.log(`   App index ${p.fixture_index}: ${appFix?.home_name} vs ${appFix?.away_name} = ${p.pick} -> Web index ${webIndex}`);
      
      if (webIndex !== undefined) {
        updates.push({
          user_id: userId,
          gw: gw,
          fixture_index: webIndex,  // Use web fixture_index
          pick: p.pick
        });
      }
    });
  }
  
  console.log(`\n📊 Will update ${updates.length} picks in picks table`);
  console.log(`   Affecting ${APP_ONLY_USER_IDS.length} app-only users\n`);
  
  // Show preview
  console.log('📋 Preview of updates:');
  const firstUser = APP_ONLY_USER_IDS[0];
  const firstUserUpdates = updates.filter(u => u.user_id === firstUser);
  const firstName = users?.find(u => u.id === firstUser)?.name || firstUser;
  console.log(`\n   ${firstName}:`);
  firstUserUpdates.forEach(u => {
    const appFix = appFixtures?.find(f => fixtureMapping.get(f.fixture_index) === u.fixture_index);
    console.log(`   Web index ${u.fixture_index}: ${appFix?.home_name} vs ${appFix?.away_name} = ${u.pick}`);
  });
  
  console.log('\n⚠️  READY TO UPDATE LIVE PICKS TABLE');
  console.log('   This will affect the LIVE game that all web users see!');
  console.log('   Only updating 4 app-only users\n');
  
  // Delete existing picks for these users
  console.log('🗑️  Deleting existing picks for app-only users...');
  const { error: deleteErr } = await supabase
    .from('picks')
    .delete()
    .eq('gw', gw)
    .in('user_id', APP_ONLY_USER_IDS);
  
  if (deleteErr) {
    console.error('❌ Error deleting picks:', deleteErr);
    return;
  }
  console.log('✅ Deleted existing picks\n');
  
  // Insert corrected picks
  console.log('➕ Inserting corrected picks...');
  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const { error: insertErr } = await supabase
      .from('picks')
      .insert(batch);
    
    if (insertErr) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertErr);
      return;
    }
  }
  
  console.log(`✅ Inserted ${updates.length} corrected picks\n`);
  
  // Verify
  console.log('🔍 Verifying fix...');
  for (const userId of APP_ONLY_USER_IDS) {
    const userName = users?.find(u => u.id === userId)?.name || userId;
    
    const { data: appPicks } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', gw)
      .order('fixture_index');
    
    const { data: webPicks } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('gw', gw)
      .order('fixture_index');
    
    console.log(`\n   ${userName}:`);
    let allMatch = true;
    appPicks?.forEach(appPick => {
      const webIndex = fixtureMapping.get(appPick.fixture_index);
      const webPick = webPicks?.find(p => p.fixture_index === webIndex);
      const appFix = appFixtures?.find(f => f.fixture_index === appPick.fixture_index);
      
      if (webPick && appPick.pick === webPick.pick) {
        console.log(`   ✅ Index ${webIndex} (${appFix?.home_name} vs ${appFix?.away_name}): ${appPick.pick} matches`);
      } else {
        console.log(`   ❌ Index ${webIndex} (${appFix?.home_name} vs ${appFix?.away_name}): app=${appPick.pick}, web=${webPick?.pick || 'NOT FOUND'}`);
        allMatch = false;
      }
    });
    
    if (allMatch) {
      console.log(`   ✅ All picks match for ${userName}`);
    }
  }
  
  console.log('\n✅ Fix complete!');
  console.log('   picks table now has correct picks for app-only users');
  console.log('   Web users will now see correct picks for SP, Jof, Carl, ThomasJamesBird');
}

fixAppOnlyUsersPicks().catch(console.error);
