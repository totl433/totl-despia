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

async function checkHistory() {
  console.log('🔍 Checking PB\'s pick history and potential issues...\n');
  
  const pbUserId = 'f09b62e6-792c-4fe1-a6ba-583d802781df';
  const gw = 16;
  const fixtureIndex = 6; // SUN v NEW
  
  // Get PB's current pick
  const { data: currentPick } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', pbUserId)
    .eq('gw', gw)
    .eq('fixture_index', fixtureIndex)
    .single();
  
  console.log('📋 Current pick in picks table:');
  console.log(`   Index ${fixtureIndex}: ${currentPick?.pick || 'NOT FOUND'}`);
  if (currentPick) {
    console.log(`   Created at: ${currentPick.created_at || 'N/A'}`);
    console.log(`   Updated at: ${currentPick.updated_at || 'N/A'}`);
  }
  
  // Get fixture details
  const { data: webFixture } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', gw)
    .eq('fixture_index', fixtureIndex)
    .single();
  
  console.log(`\n📊 Fixture at index ${fixtureIndex}:`);
  console.log(`   ${webFixture?.home_code} vs ${webFixture?.away_code}`);
  console.log(`   Home: ${webFixture?.home_code} (Sunderland)`);
  console.log(`   Away: ${webFixture?.away_code} (Newcastle)`);
  console.log(`   Current pick: ${currentPick?.pick}`);
  console.log(`   ${currentPick?.pick === 'H' ? 'HOME WIN (Sunderland)' : currentPick?.pick === 'A' ? 'AWAY WIN (Newcastle)' : 'DRAW'}`);
  
  // Check if there are any other picks for PB at different indices that might be SUN v NEW
  const { data: allPBPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', pbUserId)
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('\n📋 All of PB\'s GW16 picks:');
  const { data: allFixtures } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  allPBPicks?.forEach(p => {
    const fix = allFixtures?.find(f => f.fixture_index === p.fixture_index);
    const isSunNew = (fix?.home_code === 'SUN' && fix?.away_code === 'NEW') || 
                     (fix?.home_code === 'NEW' && fix?.away_code === 'SUN');
    const marker = isSunNew ? ' ⭐ (SUN v NEW)' : '';
    console.log(`   Index ${p.fixture_index}: ${fix?.home_code || '?'} vs ${fix?.away_code || '?'} = ${p.pick}${marker}`);
  });
  
  // Check if maybe the pick was at a different index before
  console.log('\n🔍 Analysis:');
  console.log('   PB says he picked Sunderland to win (H)');
  console.log(`   Current pick at index 6: ${currentPick?.pick || 'NOT FOUND'}`);
  console.log(`   Index 6 fixture: ${webFixture?.home_code} vs ${webFixture?.away_code}`);
  
  if (currentPick?.pick === 'A') {
    console.log('\n   ⚠️  Current pick is A (Newcastle win), but PB says he picked H (Sunderland win)');
    console.log('   Possible explanations:');
    console.log('   1. Pick was wrong BEFORE we ran scripts (we didn\'t modify PB\'s picks)');
    console.log('   2. PB submitted when fixtures were in different order');
    console.log('   3. Something else changed it (trigger, manual edit, etc.)');
  }
  
  // Check if PB is a web user or app user
  const { data: pbUser } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', pbUserId)
    .single();
  
  console.log(`\n👤 PB is: ${pbUser?.name || 'Unknown'}`);
  console.log('   Web users submit to picks table');
  console.log('   App users submit to app_picks table');
  console.log('   PB has picks in picks table, so he\'s a web user');
  
  // Check submission time
  const { data: submission } = await supabase
    .from('gw_submissions')
    .select('submitted_at')
    .eq('user_id', pbUserId)
    .eq('gw', gw)
    .single();
  
  console.log(`\n📅 PB submitted GW16 at: ${submission?.submitted_at || 'NOT FOUND'}`);
  if (currentPick?.created_at) {
    console.log(`   Pick created at: ${currentPick.created_at}`);
  }
  if (currentPick?.updated_at && currentPick.updated_at !== currentPick.created_at) {
    console.log(`   ⚠️  Pick was UPDATED at: ${currentPick.updated_at}`);
    console.log(`   This suggests the pick was changed after initial creation!`);
  } else if (currentPick?.updated_at) {
    console.log(`   Pick was never updated (same as created_at)`);
  }
}

checkHistory().catch(console.error);
