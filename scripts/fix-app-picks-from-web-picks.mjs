#!/usr/bin/env node
/**
 * Fix app_picks by copying from picks table (web - correct source)
 * Since app_fixtures now matches web order, we can copy picks directly
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

async function fixAppPicksFromWebPicks() {
  console.log('🔧 Fixing app_picks by copying from picks table (web - correct source)...\n');
  
  const gw = 16;
  
  // Get all picks from picks table (web - correct source)
  const { data: webPicks, error: webErr } = await supabase
    .from('picks')
    .select('*')
    .eq('gw', gw);
  
  if (webErr) {
    console.error('❌ Error fetching picks from picks table:', webErr);
    return;
  }
  
  console.log(`📊 Found ${webPicks?.length || 0} picks in picks table (web)`);
  
  // Get app fixtures to verify order
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index', { ascending: true });
  
  console.log('📊 App fixtures order (should match web now):');
  appFixtures?.forEach((f, i) => {
    console.log(`   ${i}. ${f.home_name} vs ${f.away_name}`);
  });
  
  // Since app_fixtures now matches web order, we can copy picks directly
  // Same fixture_index = same game
  
  console.log('\n🔧 Copying picks from picks table to app_picks...');
  
  // Delete all GW16 picks from app_picks
  const { error: deleteErr } = await supabase
    .from('app_picks')
    .delete()
    .eq('gw', gw);
  
  if (deleteErr) {
    console.error('❌ Error deleting app_picks:', deleteErr);
    return;
  }
  console.log('✅ Deleted all GW16 picks from app_picks');
  
  // Copy picks from picks table to app_picks
  const picksToInsert = webPicks?.map(p => ({
    user_id: p.user_id,
    gw: p.gw,
    fixture_index: p.fixture_index,  // Same fixture_index since order now matches
    pick: p.pick
  })) || [];
  
  // Insert in batches
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < picksToInsert.length; i += batchSize) {
    const batch = picksToInsert.slice(i, i + batchSize);
    const { error: insertErr } = await supabase
      .from('app_picks')
      .insert(batch);
    
    if (insertErr) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertErr);
      return;
    }
    inserted += batch.length;
  }
  
  console.log(`✅ Inserted ${inserted} picks from picks table to app_picks\n`);
  
  // Verify Phil Bolton's picks
  const philUserId = 'f09b62e6-792c-4fe1-a6ba-583d802781df';
  const { data: philWebPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', philUserId)
    .eq('gw', gw)
    .order('fixture_index');
  
  const { data: philAppPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', philUserId)
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('🔍 Verifying Phil Bolton\'s picks:');
  console.log('\n   CRY v MCI (index 4):');
  const cryWeb = philWebPicks?.find(p => p.fixture_index === 4);
  const cryApp = philAppPicks?.find(p => p.fixture_index === 4);
  console.log(`   Web: ${cryWeb?.pick || 'NOT FOUND'}`);
  console.log(`   App: ${cryApp?.pick || 'NOT FOUND'}`);
  if (cryWeb && cryApp && cryWeb.pick === cryApp.pick) {
    console.log(`   ✅ Match!`);
  } else {
    console.log(`   ❌ Mismatch!`);
  }
  
  console.log('\n   SUN v NEW (index 6):');
  const sunWeb = philWebPicks?.find(p => p.fixture_index === 6);
  const sunApp = philAppPicks?.find(p => p.fixture_index === 6);
  console.log(`   Web: ${sunWeb?.pick || 'NOT FOUND'}`);
  console.log(`   App: ${sunApp?.pick || 'NOT FOUND'}`);
  if (sunWeb && sunApp && sunWeb.pick === sunApp.pick) {
    console.log(`   ✅ Match!`);
  } else {
    console.log(`   ❌ Mismatch!`);
  }
  
  console.log('\n✅ Fix complete!');
  console.log('   app_picks now contains exact copy of picks table');
  console.log('   Since app_fixtures matches web order, picks are now correct');
}

fixAppPicksFromWebPicks().catch(console.error);
