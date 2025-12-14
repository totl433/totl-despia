#!/usr/bin/env node
/**
 * Verify what's actually in the database vs what user sees
 * User says: Web shows Sunderland=H, Forest=D (CORRECT)
 * But database might show different values
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('🔍 Verifying David Bird\'s actual picks...\n');
  
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (!user) {
    console.log('❌ David Bird not found');
    return;
  }
  
  // Get fixtures to identify which is which
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  console.log('📅 GW16 Fixtures:');
  fixtures?.forEach(f => {
    console.log(`   ${f.fixture_index}: ${f.home_name} vs ${f.away_name}`);
  });
  
  // Get picks from WEB
  const { data: webPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  // Get picks from APP
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  console.log('\n📊 WEB PICKS (picks table):');
  webPicks?.forEach(p => {
    const fixture = fixtures?.find(f => f.fixture_index === p.fixture_index);
    const matchName = fixture 
      ? `${fixture.home_name} vs ${fixture.away_name}`
      : `Fixture ${p.fixture_index}`;
    const pickLabel = p.pick === 'H' ? 'Home Win' : p.pick === 'A' ? 'Away Win' : 'Draw';
    console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick} (${pickLabel})`);
  });
  
  console.log('\n📊 APP PICKS (app_picks table):');
  appPicks?.forEach(p => {
    const fixture = fixtures?.find(f => f.fixture_index === p.fixture_index);
    const matchName = fixture 
      ? `${fixture.home_name} vs ${fixture.away_name}`
      : `Fixture ${p.fixture_index}`;
    const pickLabel = p.pick === 'H' ? 'Home Win' : p.pick === 'A' ? 'Away Win' : 'Draw';
    console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick} (${pickLabel})`);
  });
  
  // Find Sunderland and Forest specifically
  const sunderlandFixture = fixtures?.find(f => 
    f.home_name?.includes('Sunderland') && f.away_name?.includes('Newcastle')
  );
  const forestFixture = fixtures?.find(f => 
    f.home_name?.includes('Forest') && f.away_name?.includes('Tottenham')
  );
  
  console.log('\n🎯 KEY PICKS:');
  if (sunderlandFixture) {
    const webPick = webPicks?.find(p => p.fixture_index === sunderlandFixture.fixture_index);
    const appPick = appPicks?.find(p => p.fixture_index === sunderlandFixture.fixture_index);
    console.log(`   Sunderland vs Newcastle (fixture_index ${sunderlandFixture.fixture_index}):`);
    console.log(`     Web: ${webPick?.pick || 'NOT FOUND'} (should be H - Home Win)`);
    console.log(`     App: ${appPick?.pick || 'NOT FOUND'} (should be H - Home Win)`);
    if (webPick?.pick !== 'H') {
      console.log(`     ❌ WEB IS WRONG! Should be H but is ${webPick?.pick}`);
    }
    if (appPick?.pick !== 'H') {
      console.log(`     ❌ APP IS WRONG! Should be H but is ${appPick?.pick}`);
    }
    if (webPick?.pick !== appPick?.pick) {
      console.log(`     ❌ MISMATCH between web and app!`);
    }
  }
  
  if (forestFixture) {
    const webPick = webPicks?.find(p => p.fixture_index === forestFixture.fixture_index);
    const appPick = appPicks?.find(p => p.fixture_index === forestFixture.fixture_index);
    console.log(`   Forest vs Spurs (fixture_index ${forestFixture.fixture_index}):`);
    console.log(`     Web: ${webPick?.pick || 'NOT FOUND'} (should be D - Draw)`);
    console.log(`     App: ${appPick?.pick || 'NOT FOUND'} (should be D - Draw)`);
    if (webPick?.pick !== 'D') {
      console.log(`     ❌ WEB IS WRONG! Should be D but is ${webPick?.pick}`);
    }
    if (appPick?.pick !== 'D') {
      console.log(`     ❌ APP IS WRONG! Should be D but is ${appPick?.pick}`);
    }
    if (webPick?.pick !== appPick?.pick) {
      console.log(`     ❌ MISMATCH between web and app!`);
    }
  }
}

verify().catch(console.error);
