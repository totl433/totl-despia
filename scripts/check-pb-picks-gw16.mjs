#!/usr/bin/env node
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

async function checkPBPicks() {
  console.log('🔍 Checking Phil Bolton\'s GW16 picks...\n');
  
  const gw = 16;
  
  // Find PB's user ID
  const { data: pbUser } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%Phil%Bolton%')
    .single();
  
  if (!pbUser) {
    console.error('❌ Phil Bolton not found');
    return;
  }
  
  console.log(`👤 Found: ${pbUser.name} (${pbUser.id})\n`);
  
  // Get fixtures
  const { data: webFixtures } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('📊 Web fixtures order:');
  webFixtures?.forEach((f, i) => {
    console.log(`   ${i}. ${f.home_code || f.home_team} vs ${f.away_code || f.away_team}`);
  });
  
  console.log('\n📊 App fixtures order:');
  appFixtures?.forEach((f, i) => {
    console.log(`   ${i}. ${f.home_name || f.home_code} vs ${f.away_name || f.away_code}`);
  });
  
  // Get PB's picks from picks table (web)
  const { data: webPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', pbUser.id)
    .eq('gw', gw)
    .order('fixture_index');
  
  // Get PB's picks from app_picks table
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', pbUser.id)
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('\n📋 PB\'s picks from picks table (web):');
  if (!webPicks || webPicks.length === 0) {
    console.log('   ⚠️  No picks found!');
  } else {
    webPicks.forEach(p => {
      const fix = webFixtures?.find(f => f.fixture_index === p.fixture_index);
      const pickDesc = p.pick === 'H' ? 'HOME WIN' : p.pick === 'A' ? 'AWAY WIN' : p.pick === 'D' ? 'DRAW' : p.pick;
      console.log(`   Index ${p.fixture_index}: ${fix?.home_code || '?'} vs ${fix?.away_code || '?'} = ${p.pick} (${pickDesc})`);
    });
  }
  
  console.log('\n📋 PB\'s picks from app_picks table:');
  if (!appPicks || appPicks.length === 0) {
    console.log('   ⚠️  No picks found!');
  } else {
    appPicks.forEach(p => {
      const fix = appFixtures?.find(f => f.fixture_index === p.fixture_index);
      const pickDesc = p.pick === 'H' ? 'HOME WIN' : p.pick === 'A' ? 'AWAY WIN' : p.pick === 'D' ? 'DRAW' : p.pick;
      console.log(`   Index ${p.fixture_index}: ${fix?.home_name || fix?.home_code || '?'} vs ${fix?.away_name || fix?.away_code || '?'} = ${p.pick} (${pickDesc})`);
    });
  }
  
  // Check specifically for SUN v NEW (index 6)
  console.log('\n🔍 Checking SUN v NEW (Sunderland vs Newcastle):');
  const sunNewWebFix = webFixtures?.find(f => f.fixture_index === 6);
  const sunNewAppFix = appFixtures?.find(f => f.fixture_index === 6);
  
  console.log(`   Web fixture index 6: ${sunNewWebFix?.home_code} vs ${sunNewWebFix?.away_code}`);
  console.log(`   App fixture index 6: ${sunNewAppFix?.home_name || sunNewAppFix?.home_code} vs ${sunNewAppFix?.away_name || sunNewAppFix?.away_code}`);
  
  const sunNewWebPick = webPicks?.find(p => p.fixture_index === 6);
  const sunNewAppPick = appPicks?.find(p => p.fixture_index === 6);
  
  console.log(`   Web pick (picks table): ${sunNewWebPick?.pick || 'NOT FOUND'}`);
  console.log(`   App pick (app_picks table): ${sunNewAppPick?.pick || 'NOT FOUND'}`);
  
  if (sunNewWebPick) {
    const pickDesc = sunNewWebPick.pick === 'H' ? 'HOME WIN (Sunderland)' : sunNewWebPick.pick === 'A' ? 'AWAY WIN (Newcastle)' : 'DRAW';
    console.log(`   → ${pickDesc}`);
  }
  
  // Check what scripts we ran that modified picks
  console.log('\n📝 Scripts we ran that could have affected picks:');
  console.log('   1. fix-app-picks-from-web-picks.mjs - Copied picks FROM picks table TO app_picks');
  console.log('   2. fix-app-only-users-picks-v2.mjs - Only modified 4 app-only users (SP, Jof, Carl, ThomasJamesBird)');
  console.log('   → We did NOT modify picks table for web users like PB');
  console.log('   → We only copied FROM picks table TO app_picks');
  
  // Check if there are any other fixtures that match SUN v NEW
  console.log('\n🔍 Checking for other fixtures that might match SUN v NEW:');
  webFixtures?.forEach((f, i) => {
    if ((f.home_code === 'SUN' && f.away_code === 'NEW') || (f.home_code === 'NEW' && f.away_code === 'SUN')) {
      const pick = webPicks?.find(p => p.fixture_index === i);
      console.log(`   Found at index ${i}: ${f.home_code} vs ${f.away_code}, pick = ${pick?.pick || 'NOT FOUND'}`);
    }
  });
}

checkPBPicks().catch(console.error);
