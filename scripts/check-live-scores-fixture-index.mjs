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

async function checkLiveScores() {
  console.log('🔍 Checking live scores fixture_index alignment...\n');
  
  const gw = 16;
  
  // Get fixtures (correct order)
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('📊 app_fixtures order (correct):');
  fixtures?.forEach((f, i) => {
    console.log(`   Index ${i}: ${f.home_name} vs ${f.away_name} (api_match_id: ${f.api_match_id || 'N/A'})`);
  });
  
  // Check if there's a live_scores table or view
  const { data: liveScores } = await supabase
    .from('live_scores')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  if (liveScores && liveScores.length > 0) {
    console.log(`\n📊 Live scores from live_scores table:`);
    liveScores.forEach(ls => {
      const fix = fixtures?.find(f => f.fixture_index === ls.fixture_index);
      const match = fix && fix.api_match_id === ls.api_match_id ? '✅' : '❌';
      console.log(`   Index ${ls.fixture_index}: api_match_id=${ls.api_match_id}, status=${ls.status} ${match}`);
      if (fix && fix.api_match_id !== ls.api_match_id) {
        console.log(`      ⚠️  MISMATCH: Live score api_match_id=${ls.api_match_id}, Fixture api_match_id=${fix.api_match_id}`);
      }
    });
  } else {
    console.log('\n⚠️  No live scores found in live_scores table');
  }
  
  // The issue: Live scores come from API and are matched to fixtures by api_match_id
  // Then they get a fixture_index from the fixture
  // If fixtures were reordered, live scores might have wrong fixture_index values
  
  console.log('\n💡 The problem:');
  console.log('   Live scores are matched to fixtures by api_match_id');
  console.log('   Then they get fixture_index from the fixture');
  console.log('   If we reordered app_fixtures, existing live scores might have wrong fixture_index');
  console.log('   The Global page matches picks to live scores by fixture_index');
  console.log('   So wrong fixture_index = wrong scores');
  
  console.log('\n📝 Solution:');
  console.log('   Live scores need to be refreshed/recalculated after fixing fixture order');
  console.log('   Or live scores need to be matched by api_match_id, not fixture_index');
}

checkLiveScores().catch(console.error);
