#!/usr/bin/env node
/**
 * Check David Bird's specific picks: Sunderland vs Newcastle and Forest vs Spurs
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

async function checkSpecificPicks() {
  console.log('🔍 Checking David Bird\'s picks for Sunderland vs Newcastle and Forest vs Spurs...\n');
  
  // Find David Bird's user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (userError || !user) {
    console.error('❌ Error finding user:', userError);
    return;
  }
  
  console.log(`User: ${user.name} (ID: ${user.id})\n`);
  
  // Get GW16 fixtures
  const { data: fixtures, error: fixturesError } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError);
    return;
  }
  
  // Find the specific fixtures
  const sunderlandFixture = fixtures?.find(f => 
    f.home_name?.includes('Sunderland') && f.away_name?.includes('Newcastle')
  );
  const forestFixture = fixtures?.find(f => 
    (f.home_name?.includes('Forest') || f.home_name?.includes('Nottingham')) && 
    (f.away_name?.includes('Spurs') || f.away_name?.includes('Tottenham'))
  );
  
  // Debug: show all fixtures
  console.log('All GW16 fixtures:');
  fixtures?.forEach(f => {
    console.log(`   ${f.fixture_index}: ${f.home_name} vs ${f.away_name}`);
  });
  console.log('');
  
  console.log('📅 Fixtures:');
  if (sunderlandFixture) {
    console.log(`   Sunderland vs Newcastle: fixture_index ${sunderlandFixture.fixture_index}`);
  }
  if (forestFixture) {
    console.log(`   Forest vs Spurs: fixture_index ${forestFixture.fixture_index}`);
  }
  console.log('');
  
  // Get picks from WEB table
  const webPicks = [];
  if (sunderlandFixture) {
    const { data: pick } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', user.id)
      .eq('gw', 16)
      .eq('fixture_index', sunderlandFixture.fixture_index)
      .maybeSingle();
    if (pick) webPicks.push({ fixture: 'Sunderland vs Newcastle', ...pick });
  }
  if (forestFixture) {
    const { data: pick } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', user.id)
      .eq('gw', 16)
      .eq('fixture_index', forestFixture.fixture_index)
      .maybeSingle();
    if (pick) webPicks.push({ fixture: 'Forest vs Spurs', ...pick });
  }
  
  // Get picks from APP table
  const appPicks = [];
  if (sunderlandFixture) {
    const { data: pick } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', user.id)
      .eq('gw', 16)
      .eq('fixture_index', sunderlandFixture.fixture_index)
      .maybeSingle();
    if (pick) appPicks.push({ fixture: 'Sunderland vs Newcastle', ...pick });
  }
  if (forestFixture) {
    const { data: pick } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', user.id)
      .eq('gw', 16)
      .eq('fixture_index', forestFixture.fixture_index)
      .maybeSingle();
    if (pick) appPicks.push({ fixture: 'Forest vs Spurs', ...pick });
  }
  
  console.log('📊 WEB TABLE (picks):');
  webPicks.forEach(p => {
    const pickLabel = p.pick === 'H' ? 'Home Win' : p.pick === 'A' ? 'Away Win' : 'Draw';
    console.log(`   ${p.fixture}: ${p.pick} (${pickLabel})`);
  });
  if (webPicks.length === 0) {
    console.log('   ❌ No picks found');
  }
  
  console.log('\n📊 APP TABLE (app_picks):');
  appPicks.forEach(p => {
    const pickLabel = p.pick === 'H' ? 'Home Win' : p.pick === 'A' ? 'Away Win' : 'Draw';
    console.log(`   ${p.fixture}: ${p.pick} (${pickLabel})`);
  });
  if (appPicks.length === 0) {
    console.log('   ❌ No picks found');
  }
  
  console.log('\n🔍 COMPARISON:');
  
  // Check Sunderland
  const sunderlandWeb = webPicks.find(p => p.fixture === 'Sunderland vs Newcastle');
  const sunderlandApp = appPicks.find(p => p.fixture === 'Sunderland vs Newcastle');
  
  if (sunderlandWeb && sunderlandApp) {
    if (sunderlandWeb.pick === sunderlandApp.pick) {
      console.log(`   ✅ Sunderland vs Newcastle: Match (${sunderlandWeb.pick})`);
    } else {
      console.log(`   ❌ Sunderland vs Newcastle: MISMATCH! Web=${sunderlandWeb.pick}, App=${sunderlandApp.pick}`);
    }
  } else if (sunderlandWeb && !sunderlandApp) {
    console.log(`   ❌ Sunderland vs Newcastle: In WEB but MISSING in APP! Web=${sunderlandWeb.pick}`);
  } else if (!sunderlandWeb && sunderlandApp) {
    console.log(`   ⚠️  Sunderland vs Newcastle: In APP but MISSING in WEB! App=${sunderlandApp.pick}`);
  }
  
  // Check Forest
  const forestWeb = webPicks.find(p => p.fixture === 'Forest vs Spurs');
  const forestApp = appPicks.find(p => p.fixture === 'Forest vs Spurs');
  
  if (forestWeb && forestApp) {
    if (forestWeb.pick === forestApp.pick) {
      console.log(`   ✅ Forest vs Spurs: Match (${forestWeb.pick})`);
    } else {
      console.log(`   ❌ Forest vs Spurs: MISMATCH! Web=${forestWeb.pick}, App=${forestApp.pick}`);
    }
  } else if (forestWeb && !forestApp) {
    console.log(`   ❌ Forest vs Spurs: In WEB but MISSING in APP! Web=${forestWeb.pick}`);
  } else if (!forestWeb && forestApp) {
    console.log(`   ⚠️  Forest vs Spurs: In APP but MISSING in WEB! App=${forestApp.pick}`);
  }
  
  console.log('\n📱 What you see in the app:');
  console.log('   Sunderland vs Newcastle: DB in Draw column (should be D)');
  console.log('   Forest vs Spurs: DB in Home Win column (should be H)');
  console.log('\n');
}

checkSpecificPicks().catch(console.error);
