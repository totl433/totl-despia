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

async function checkMismatch() {
  console.log('🔍 Checking if PB\'s pick is at the wrong index...\n');
  
  const pbUserId = 'f09b62e6-792c-4fe1-a6ba-583d802781df';
  const gw = 16;
  
  // Get all fixtures in order
  const { data: webFixtures } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('📊 Web fixtures order (as stored in database):');
  webFixtures?.forEach((f, i) => {
    const humanIndex = i + 1;
    const isSunNew = (f.home_code === 'SUN' && f.away_code === 'NEW') || 
                     (f.home_code === 'NEW' && f.away_code === 'SUN');
    const marker = isSunNew ? ' ⭐ SUN v NEW (7th in list)' : '';
    console.log(`   Index ${i} (${humanIndex}th): ${f.home_code} vs ${f.away_code}${marker}`);
  });
  
  // Get PB's picks
  const { data: pbPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', pbUserId)
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('\n📋 PB\'s picks mapped to fixtures:');
  pbPicks?.forEach(p => {
    const fix = webFixtures?.find(f => f.fixture_index === p.fixture_index);
    const humanIndex = p.fixture_index + 1;
    const isSunNew = fix && ((fix.home_code === 'SUN' && fix.away_code === 'NEW') || 
                              (fix.home_code === 'NEW' && fix.away_code === 'SUN'));
    const marker = isSunNew ? ' ⭐ PB\'s SUN v NEW pick' : '';
    console.log(`   Index ${p.fixture_index} (${humanIndex}th): ${fix?.home_code || '?'} vs ${fix?.away_code || '?'} = ${p.pick}${marker}`);
  });
  
  // Check if PB has a pick at index 7 instead of index 6
  const pickAt6 = pbPicks?.find(p => p.fixture_index === 6);
  const pickAt7 = pbPicks?.find(p => p.fixture_index === 7);
  
  const fixtureAt6 = webFixtures?.find(f => f.fixture_index === 6);
  const fixtureAt7 = webFixtures?.find(f => f.fixture_index === 7);
  
  console.log('\n🔍 Detailed check:');
  console.log(`   Index 6 (7th in list): ${fixtureAt6?.home_code} vs ${fixtureAt6?.away_code}`);
  console.log(`   PB's pick at index 6: ${pickAt6?.pick || 'NOT FOUND'}`);
  console.log(`   Index 7 (8th in list): ${fixtureAt7?.home_code} vs ${fixtureAt7?.away_code}`);
  console.log(`   PB's pick at index 7: ${pickAt7?.pick || 'NOT FOUND'}`);
  
  // Check if maybe PB's pick for SUN v NEW is at index 7 instead
  if (fixtureAt7 && ((fixtureAt7.home_code === 'SUN' && fixtureAt7.away_code === 'NEW') || 
                      (fixtureAt7.home_code === 'NEW' && fixtureAt7.away_code === 'SUN'))) {
    console.log('\n   ⚠️  SUN v NEW is at index 7, not index 6!');
    console.log(`   PB's pick at index 7: ${pickAt7?.pick || 'NOT FOUND'}`);
  }
  
  // Check all fixtures to find where SUN v NEW actually is
  console.log('\n🔍 Finding SUN v NEW fixture:');
  webFixtures?.forEach((f, i) => {
    if ((f.home_code === 'SUN' && f.away_code === 'NEW') || 
        (f.home_code === 'NEW' && f.away_code === 'SUN')) {
      const humanIndex = i + 1;
      const pbPick = pbPicks?.find(p => p.fixture_index === i);
      console.log(`   Found at index ${i} (${humanIndex}th in list)`);
      console.log(`   PB's pick: ${pbPick?.pick || 'NOT FOUND'}`);
    }
  });
  
  // Check if there's a mismatch - maybe PB's pick is at the wrong index
  console.log('\n📝 Analysis:');
  console.log('   PB says he picked Sunderland (H) for the 7th game');
  console.log('   In 0-based indexing, 7th game = index 6');
  console.log('   Current pick at index 6: ' + (pickAt6?.pick || 'NOT FOUND'));
  console.log('   If PB\'s pick is wrong, it might be:');
  console.log('   1. At the wrong index (maybe index 7?)');
  console.log('   2. The wrong value (maybe H is stored as A?)');
  console.log('   3. PB actually picked Newcastle but thinks he picked Sunderland');
}

checkMismatch().catch(console.error);
