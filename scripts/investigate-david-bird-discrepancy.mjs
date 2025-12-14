#!/usr/bin/env node
/**
 * Investigate discrepancy between web and app tables for David Bird
 * Web shows: Sunderland=H, Forest=D
 * App shows: Sunderland=D, Forest=H
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

async function investigate() {
  console.log('🔍 Investigating David Bird\'s pick discrepancy...\n');
  
  // Find David Bird
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (!user) {
    console.log('❌ David Bird not found');
    return;
  }
  
  console.log(`User: ${user.name} (ID: ${user.id})\n`);
  
  // Get GW16 fixtures
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  const sunderlandFixture = fixtures?.find(f => 
    f.home_name?.includes('Sunderland') && f.away_name?.includes('Newcastle')
  );
  const forestFixture = fixtures?.find(f => 
    f.home_name?.includes('Forest') && f.away_name?.includes('Tottenham')
  );
  
  if (!sunderlandFixture || !forestFixture) {
    console.log('❌ Could not find fixtures');
    return;
  }
  
  console.log('📅 Fixtures:');
  console.log(`   Sunderland vs Newcastle: fixture_index ${sunderlandFixture.fixture_index}`);
  console.log(`   Forest vs Spurs: fixture_index ${forestFixture.fixture_index}\n`);
  
  // Get picks from WEB table (picks)
  const { data: sunderlandWeb } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', sunderlandFixture.fixture_index)
    .maybeSingle();
  
  const { data: forestWeb } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', forestFixture.fixture_index)
    .maybeSingle();
  
  // Get picks from APP table (app_picks)
  const { data: sunderlandApp } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', sunderlandFixture.fixture_index)
    .maybeSingle();
  
  const { data: forestApp } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', forestFixture.fixture_index)
    .maybeSingle();
  
  console.log('📊 WEB TABLE (picks) - What web interface shows:');
  console.log(`   Sunderland vs Newcastle: ${sunderlandWeb?.pick || 'NOT FOUND'}`);
  console.log(`   Forest vs Spurs: ${forestWeb?.pick || 'NOT FOUND'}`);
  
  console.log('\n📊 APP TABLE (app_picks) - What app interface shows:');
  console.log(`   Sunderland vs Newcastle: ${sunderlandApp?.pick || 'NOT FOUND'}`);
  console.log(`   Forest vs Spurs: ${forestApp?.pick || 'NOT FOUND'}`);
  
  console.log('\n🔍 DISCREPANCY ANALYSIS:');
  
  if (sunderlandWeb?.pick !== sunderlandApp?.pick) {
    console.log(`\n❌ Sunderland vs Newcastle MISMATCH:`);
    console.log(`   Web (picks): ${sunderlandWeb?.pick}`);
    console.log(`   App (app_picks): ${sunderlandApp?.pick}`);
    console.log(`   Web shows: ${sunderlandWeb?.pick === 'H' ? 'Home Win' : sunderlandWeb?.pick === 'A' ? 'Away Win' : 'Draw'}`);
    console.log(`   App shows: ${sunderlandApp?.pick === 'H' ? 'Home Win' : sunderlandApp?.pick === 'A' ? 'Away Win' : 'Draw'}`);
  }
  
  if (forestWeb?.pick !== forestApp?.pick) {
    console.log(`\n❌ Forest vs Spurs MISMATCH:`);
    console.log(`   Web (picks): ${forestWeb?.pick}`);
    console.log(`   App (app_picks): ${forestApp?.pick}`);
    console.log(`   Web shows: ${forestWeb?.pick === 'H' ? 'Home Win' : forestWeb?.pick === 'A' ? 'Away Win' : 'Draw'}`);
    console.log(`   App shows: ${forestApp?.pick === 'H' ? 'Home Win' : forestApp?.pick === 'A' ? 'Away Win' : 'Draw'}`);
  }
  
  // Check if there are multiple entries or timestamps
  console.log('\n📅 TIMESTAMPS (if available):');
  if (sunderlandWeb) {
    console.log(`   Web Sunderland: ${JSON.stringify(sunderlandWeb)}`);
  }
  if (sunderlandApp) {
    console.log(`   App Sunderland: ${JSON.stringify(sunderlandApp)}`);
  }
  if (forestWeb) {
    console.log(`   Web Forest: ${JSON.stringify(forestWeb)}`);
  }
  if (forestApp) {
    console.log(`   App Forest: ${JSON.stringify(forestApp)}`);
  }
  
  // Check all GW16 picks to see the full picture
  console.log('\n📊 ALL GW16 PICKS FROM WEB TABLE:');
  const { data: allWebPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  allWebPicks?.forEach(p => {
    const fixture = fixtures?.find(f => f.fixture_index === p.fixture_index);
    const matchName = fixture 
      ? `${fixture.home_name} vs ${fixture.away_name}`
      : `Fixture ${p.fixture_index}`;
    console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick}`);
  });
  
  console.log('\n📊 ALL GW16 PICKS FROM APP TABLE:');
  const { data: allAppPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  allAppPicks?.forEach(p => {
    const fixture = fixtures?.find(f => f.fixture_index === p.fixture_index);
    const matchName = fixture 
      ? `${fixture.home_name} vs ${fixture.away_name}`
      : `Fixture ${p.fixture_index}`;
    console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick}`);
  });
  
  // Check for any differences across all picks
  console.log('\n🔍 FULL COMPARISON:');
  const webPicksMap = new Map(allWebPicks?.map(p => [p.fixture_index, p.pick]) || []);
  const appPicksMap = new Map(allAppPicks?.map(p => [p.fixture_index, p.pick]) || []);
  
  const allIndices = [...new Set([...webPicksMap.keys(), ...appPicksMap.keys()])].sort((a, b) => a - b);
  
  const mismatches = [];
  allIndices.forEach(idx => {
    const webPick = webPicksMap.get(idx);
    const appPick = appPicksMap.get(idx);
    if (webPick !== appPick) {
      mismatches.push({ idx, web: webPick, app: appPick });
    }
  });
  
  if (mismatches.length > 0) {
    console.log(`\n❌ Found ${mismatches.length} mismatch(es):`);
    mismatches.forEach(m => {
      const fixture = fixtures?.find(f => f.fixture_index === m.idx);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${m.idx}`;
      console.log(`   ${m.idx}. ${matchName}: Web="${m.web}", App="${m.app}"`);
    });
  } else {
    console.log('\n✅ All picks match between web and app tables');
  }
  
  console.log('\n💡 POSSIBLE CAUSES:');
  console.log('   1. Mirror trigger may have failed or not run');
  console.log('   2. Picks were updated in web table after mirroring');
  console.log('   3. Manual data entry or script updated one table but not the other');
  console.log('   4. App table was updated directly, bypassing the mirror trigger');
  console.log('   5. Race condition where picks were changed before trigger fired');
}

investigate().catch(console.error);
