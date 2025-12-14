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

async function diagnose() {
  console.log('🔍 Diagnosing Global page issue...\n');
  
  // Check what latest GW is
  const { data: latestResult } = await supabase
    .from('app_gw_results')
    .select('gw')
    .order('gw', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const latestGw = latestResult?.gw || null;
  console.log(`📊 Latest GW with results: ${latestGw || 'None'}`);
  
  // Check current GW from meta
  const { data: meta } = await supabase
    .from('app_meta')
    .select('current_gw')
    .eq('id', 1)
    .single();
  
  const currentGw = meta?.current_gw || null;
  console.log(`📊 Current GW from meta: ${currentGw || 'None'}`);
  
  // The "lastgw" tab shows the latest GW with results
  const displayGw = latestGw || currentGw || 16;
  console.log(`\n📊 Global page "lastgw" tab is showing: GW${displayGw}\n`);
  
  // Get scores from view for that GW
  const { data: viewScores } = await supabase
    .from('app_v_gw_points')
    .select('user_id, gw, points, users(name)')
    .eq('gw', displayGw)
    .order('points', { ascending: false })
    .limit(20);
  
  console.log(`📊 Scores from app_v_gw_points view for GW${displayGw}:`);
  if (viewScores && viewScores.length > 0) {
    viewScores.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.users?.name || 'Unknown'}: ${s.points} points`);
    });
  } else {
    console.log('   ⚠️  No scores found');
  }
  
  // Check if picks exist for this GW
  const { data: picksSample } = await supabase
    .from('app_picks')
    .select('user_id, fixture_index, pick, users(name)')
    .eq('gw', displayGw)
    .limit(5);
  
  console.log(`\n📊 Sample picks for GW${displayGw}: ${picksSample?.length || 0} found`);
  
  // Check if results exist for this GW
  const { data: resultsSample } = await supabase
    .from('app_gw_results')
    .select('*')
    .eq('gw', displayGw)
    .limit(5);
  
  console.log(`📊 Results for GW${displayGw}: ${resultsSample?.length || 0} found`);
  
  if (resultsSample && resultsSample.length > 0) {
    console.log('\n📊 Results:');
    resultsSample.forEach(r => {
      console.log(`   Index ${r.fixture_index}: ${r.result}`);
    });
  }
  
  // The issue: The view calculates scores by joining picks and results on fixture_index
  // If results are at wrong fixture_index values, scores will be wrong
  
  console.log('\n💡 The Global page reads from app_v_gw_points view');
  console.log('   This view joins app_picks and app_gw_results on fixture_index');
  console.log('   If results have wrong fixture_index values, scores will be wrong');
  console.log('\n   To fix:');
  console.log('   1. Check if app_gw_results has correct fixture_index values');
  console.log('   2. If not, fix app_gw_results to match app_fixtures order');
  console.log('   3. Clear browser cache: localStorage.removeItem("global:leaderboard")');
}

diagnose().catch(console.error);
