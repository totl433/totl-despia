#!/usr/bin/env node
/**
 * Check Phil Bolton's picks to verify the fix
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

async function checkPhilBoltonPicks() {
  console.log('🔍 Checking Phil Bolton\'s picks...\n');
  
  // Find Phil Bolton
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%Phil Bolton%')
    .maybeSingle();
  
  if (!user) {
    console.log('❌ Phil Bolton not found');
    return;
  }
  
  console.log(`Phil Bolton User ID: ${user.id}\n`);
  
  // Get picks from picks table (web - correct source)
  const { data: webPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  // Get picks from app_picks table (app - what we fixed)
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  // Get fixtures
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  console.log('📊 Picks from picks table (WEB - correct source):');
  webPicks?.forEach(p => {
    const fixture = appFixtures?.find(f => f.fixture_index === p.fixture_index);
    console.log(`   Index ${p.fixture_index}: ${fixture?.home_name || '?'} vs ${fixture?.away_name || '?'} = ${p.pick}`);
  });
  
  console.log('\n📊 Picks from app_picks table (APP - after fix):');
  appPicks?.forEach(p => {
    const fixture = appFixtures?.find(f => f.fixture_index === p.fixture_index);
    console.log(`   Index ${p.fixture_index}: ${fixture?.home_name || '?'} vs ${fixture?.away_name || '?'} = ${p.pick}`);
  });
  
  // Check specific games
  console.log('\n🔍 Checking specific games:');
  
  // CRY v MCI - should be at web index 4
  const cryWebPick = webPicks?.find(p => p.fixture_index === 4);
  const cryAppFixture = appFixtures?.find(f => 
    f.home_name?.includes('Crystal Palace') && f.away_name?.includes('Manchester City')
  );
  const cryAppPick = appPicks?.find(p => p.fixture_index === cryAppFixture?.fixture_index);
  
  console.log(`\n   CRY v MCI:`);
  console.log(`   Web index 4 pick: ${cryWebPick?.pick || 'NOT FOUND'}`);
  console.log(`   App fixture index: ${cryAppFixture?.fixture_index}`);
  console.log(`   App pick: ${cryAppPick?.pick || 'NOT FOUND'}`);
  console.log(`   Expected: CRY WIN (H)`);
  
  // SUN v NEW - should be at web index 6
  const sunWebPick = webPicks?.find(p => p.fixture_index === 6);
  const sunAppFixture = appFixtures?.find(f => 
    f.home_name?.includes('Sunderland') && f.away_name?.includes('Newcastle')
  );
  const sunAppPick = appPicks?.find(p => p.fixture_index === sunAppFixture?.fixture_index);
  
  console.log(`\n   SUN v NEW:`);
  console.log(`   Web index 6 pick: ${sunWebPick?.pick || 'NOT FOUND'}`);
  console.log(`   App fixture index: ${sunAppFixture?.fixture_index}`);
  console.log(`   App pick: ${sunAppPick?.pick || 'NOT FOUND'}`);
  console.log(`   Expected: NEW WIN (A)`);
  
  if (cryWebPick && cryAppPick) {
    if (cryWebPick.pick === cryAppPick.pick && cryAppFixture?.fixture_index === 4) {
      console.log(`\n   ✅ CRY v MCI pick is correct`);
    } else {
      console.log(`\n   ❌ CRY v MCI pick is WRONG`);
      console.log(`      Web has: ${cryWebPick.pick} at index 4`);
      console.log(`      App has: ${cryAppPick.pick} at index ${cryAppFixture?.fixture_index}`);
    }
  }
  
  if (sunWebPick && sunAppPick) {
    if (sunWebPick.pick === sunAppPick.pick && sunAppFixture?.fixture_index === 6) {
      console.log(`\n   ✅ SUN v NEW pick is correct`);
    } else {
      console.log(`\n   ❌ SUN v NEW pick is WRONG`);
      console.log(`      Web has: ${sunWebPick.pick} at index 6`);
      console.log(`      App has: ${sunAppPick.pick} at index ${sunAppFixture?.fixture_index}`);
    }
  }
}

checkPhilBoltonPicks().catch(console.error);
