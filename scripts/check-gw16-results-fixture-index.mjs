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

async function checkResults() {
  console.log('🔍 Checking GW16 results fixture_index alignment...\n');
  
  const gw = 16;
  
  // Get fixtures (correct order - we fixed this)
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
  
  if (!results || results.length === 0) {
    console.log('⚠️  No results found in app_gw_results for GW16');
    console.log('   The Global page might be showing cached scores from a previous GW');
    return;
  }
  
  console.log('📊 Checking if results match fixtures:\n');
  
  // Check each result
  results.forEach(result => {
    const fixture = fixtures?.find(f => f.fixture_index === result.fixture_index);
    if (fixture) {
      console.log(`   Index ${result.fixture_index}: ${fixture.home_name} vs ${fixture.away_name} = ${result.result} ✅`);
    } else {
      console.log(`   Index ${result.fixture_index}: NO FIXTURE FOUND ❌`);
    }
  });
  
  // Check if results are at wrong indices
  console.log('\n🔍 Checking for misaligned results:');
  
  // For each fixture, check if the result matches
  fixtures?.forEach(fix => {
    const result = results.find(r => r.fixture_index === fix.fixture_index);
    if (!result) {
      console.log(`   ⚠️  Fixture index ${fix.fixture_index} (${fix.home_name} vs ${fix.away_name}) has NO result`);
    }
  });
  
  // Actually, let's check if results are in the wrong order
  // Get web results to compare
  const { data: webResults } = await supabase
    .from('gw_results')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  if (webResults && webResults.length > 0) {
    console.log(`\n📊 Comparing with web results (gw_results table):`);
    webResults.forEach(webResult => {
      const appResult = results.find(r => r.fixture_index === webResult.fixture_index);
      const fix = fixtures?.find(f => f.fixture_index === webResult.fixture_index);
      if (appResult) {
        const match = appResult.result === webResult.result ? '✅' : '❌';
        console.log(`   Index ${webResult.fixture_index}: Web=${webResult.result}, App=${appResult.result} ${match}`);
        if (appResult.result !== webResult.result) {
          console.log(`      ⚠️  MISMATCH at index ${webResult.fixture_index} (${fix?.home_name} vs ${fix?.away_name})`);
        }
      }
    });
  }
  
  // The problem: if app_gw_results has results at wrong fixture_index values,
  // the view will join picks (at correct indices) with results (at wrong indices)
  // giving wrong scores
  
  console.log('\n💡 The issue:');
  console.log('   The view (app_v_gw_points) joins app_picks and app_gw_results on fixture_index');
  console.log('   If app_gw_results has results at wrong fixture_index values,');
  console.log('   picks will be matched to wrong results, giving wrong scores');
  console.log('\n   Example:');
  console.log('   - Pick at index 6: Sunderland vs Newcastle = A (correct)');
  console.log('   - Result at index 6: But maybe this result is for a different game?');
  console.log('   - View joins them: Pick A matches Result? → Wrong score');
}

checkResults().catch(console.error);
