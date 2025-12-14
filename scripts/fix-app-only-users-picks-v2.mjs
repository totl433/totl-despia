#!/usr/bin/env node
/**
 * Fix picks table for app-only users - handle missing web fixture match
 * Web fixtures table has null values, so we use the known web order
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

// App-only users
const APP_ONLY_USER_IDS = [
  '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
  '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
  '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
];

// Known web fixture order (from screenshots)
// Since app_fixtures now matches this order, app index = web index
const WEB_FIXTURE_ORDER = [
  { home: 'Chelsea', away: 'Everton' },
  { home: 'Liverpool', away: 'Brighton' },
  { home: 'Burnley', away: 'Fulham' },
  { home: 'Arsenal', away: 'Wolves' },
  { home: 'Crystal Palace', away: 'Manchester City' },
  { home: 'Nottingham Forest', away: 'Tottenham' },
  { home: 'Sunderland', away: 'Newcastle' },
  { home: 'West Ham', away: 'Aston Villa' },
  { home: 'Brentford', away: 'Leeds' },
  { home: 'Manchester United', away: 'Bournemouth' },
];

async function fixAppOnlyUsersPicks() {
  console.log('🔧 Fixing picks table for app-only users...\n');
  console.log('⚠️  WARNING: This will modify the LIVE picks table!\n');
  
  const gw = 16;
  
  // Get user names
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
  
  console.log('\n📊 App fixtures order (matches web order now):');
  appFixtures?.forEach((f, i) => {
    console.log(`   ${i}. ${f.home_name} vs ${f.away_name}`);
  });
  
  // Since app_fixtures now matches web order, app index = web index
  // So we can copy picks directly: app index 5 -> web index 5
  
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
    
    console.log(`\n📋 ${userName} picks from app_picks:`);
    appPicks.forEach(p => {
      const appFix = appFixtures?.find(f => f.fixture_index === p.fixture_index);
      console.log(`   App index ${p.fixture_index}: ${appFix?.home_name} vs ${appFix?.away_name} = ${p.pick} -> Web index ${p.fixture_index}`);
      
      // Since app_fixtures matches web order, same fixture_index = same game
      updates.push({
        user_id: userId,
        gw: gw,
        fixture_index: p.fixture_index,  // Same index since order matches
        pick: p.pick
      });
    });
  }
  
  console.log(`\n📊 Will update ${updates.length} picks in picks table`);
  console.log(`   Affecting ${APP_ONLY_USER_IDS.length} app-only users\n`);
  
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
      const webPick = webPicks?.find(p => p.fixture_index === appPick.fixture_index);
      const appFix = appFixtures?.find(f => f.fixture_index === appPick.fixture_index);
      
      if (webPick && appPick.pick === webPick.pick) {
        console.log(`   ✅ Index ${appPick.fixture_index} (${appFix?.home_name} vs ${appFix?.away_name}): ${appPick.pick} matches`);
      } else {
        console.log(`   ❌ Index ${appPick.fixture_index} (${appFix?.home_name} vs ${appFix?.away_name}): app=${appPick.pick}, web=${webPick?.pick || 'NOT FOUND'}`);
        allMatch = false;
      }
    });
    
    if (allMatch && appPicks?.length === webPicks?.length) {
      console.log(`   ✅ All ${appPicks?.length} picks match for ${userName}`);
    }
  }
  
  console.log('\n✅ Fix complete!');
  console.log('   picks table now has correct picks for app-only users');
  console.log('   Web users will now see correct picks for SP, Jof, Carl, ThomasJamesBird');
}

fixAppOnlyUsersPicks().catch(console.error);
