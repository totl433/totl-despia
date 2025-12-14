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

async function checkAlignment() {
  console.log('🔍 Checking GW16 results alignment...\n');
  
  const gw = 16;
  
  // Get fixtures (correct order)
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  // Get results
  const { data: results } = await supabase
    .from('app_gw_results')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('📊 app_fixtures order (correct):');
  fixtures?.forEach((f, i) => {
    console.log(`   Index ${i}: ${f.home_name || f.home_code} vs ${f.away_name || f.away_code}`);
  });
  
  console.log('\n📊 app_gw_results:');
  if (!results || results.length === 0) {
    console.log('   ⚠️  No results found for GW16');
    console.log('   Results need to be published for scores to show');
    return;
  }
  
  results.forEach(r => {
    const fix = fixtures?.find(f => f.fixture_index === r.fixture_index);
    console.log(`   Index ${r.fixture_index}: ${fix?.home_name || fix?.home_code || '?'} vs ${fix?.away_name || fix?.away_code || '?'} = ${r.result}`);
  });
  
  // Check if results match fixtures
  console.log('\n🔍 Checking alignment:');
  let misaligned = 0;
  fixtures?.forEach(fix => {
    const result = results?.find(r => r.fixture_index === fix.fixture_index);
    if (!result) {
      console.log(`   ⚠️  Fixture index ${fix.fixture_index} (${fix.home_name} vs ${fix.away_name}) has NO result`);
      misaligned++;
    } else {
      // Verify the result matches the fixture
      console.log(`   ✅ Index ${fix.fixture_index}: ${fix.home_name} vs ${fix.away_name} = ${result.result}`);
    }
  });
  
  if (misaligned === 0 && results.length === fixtures.length) {
    console.log('\n✅ All results are aligned correctly!');
  } else {
    console.log(`\n⚠️  Found ${misaligned} misaligned results`);
    console.log('   The view calculates scores by joining picks and results on fixture_index');
    console.log('   If fixture_index values don\'t match, scores will be wrong');
  }
  
  // Check a specific user's picks vs results
  console.log('\n🔍 Checking a user\'s picks alignment:');
  const { data: testPicks } = await supabase
    .from('app_picks')
    .select('user_id, fixture_index, pick, users(name)')
    .eq('gw', gw)
    .limit(10);
  
  if (testPicks && testPicks.length > 0) {
    const testUser = testPicks[0];
    console.log(`   Testing with: ${testUser.users?.name || 'Unknown'}`);
    
    const userPicks = testPicks.filter(p => p.user_id === testUser.user_id);
    console.log(`   Their picks:`);
    userPicks.forEach(p => {
      const fix = fixtures?.find(f => f.fixture_index === p.fixture_index);
      const result = results?.find(r => r.fixture_index === p.fixture_index);
      const match = result && p.pick === result.result ? '✅' : '❌';
      console.log(`      Index ${p.fixture_index}: ${fix?.home_name || '?'} vs ${fix?.away_name || '?'} = ${p.pick}, Result = ${result?.result || 'N/A'} ${match}`);
    });
  }
}

checkAlignment().catch(console.error);
