#!/usr/bin/env node
/**
 * Clear Global page cache and check if data needs refreshing
 * 
 * The Global page caches leaderboard data in localStorage.
 * After fixing picks, the cache might be stale.
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

async function checkAndClear() {
  console.log('🔍 Checking GW16 data and cache...\n');
  
  const gw = 16;
  
  // Check if picks exist
  const { data: picksCount } = await supabase
    .from('app_picks')
    .select('user_id', { count: 'exact', head: true })
    .eq('gw', gw);
  
  console.log(`📊 app_picks for GW${gw}: ${picksCount || 'Unknown count'}`);
  
  // Check if results exist
  const { data: resultsCount } = await supabase
    .from('app_gw_results')
    .select('gw', { count: 'exact', head: true })
    .eq('gw', gw);
  
  console.log(`📊 app_gw_results for GW${gw}: ${resultsCount || 'Unknown count'}`);
  
  // Check view scores
  const { data: viewScores } = await supabase
    .from('app_v_gw_points')
    .select('user_id, gw, points, users(name)')
    .eq('gw', gw)
    .order('points', { ascending: false })
    .limit(20);
  
  console.log(`\n📊 Scores from app_v_gw_points view (top 20):`);
  if (viewScores && viewScores.length > 0) {
    viewScores.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.users?.name || 'Unknown'}: ${s.points} points`);
    });
  } else {
    console.log('   ⚠️  No scores found in view');
  }
  
  console.log('\n💡 To fix the Global page:');
  console.log('   1. Open browser DevTools (F12)');
  console.log('   2. Go to Application/Storage tab');
  console.log('   3. Find localStorage');
  console.log('   4. Delete key: "global:leaderboard"');
  console.log('   5. Refresh the page');
  console.log('\n   OR:');
  console.log('   Open browser console and run:');
  console.log('   localStorage.removeItem("global:leaderboard");');
  console.log('   location.reload();');
  
  // Check if views need refreshing
  console.log('\n🔍 The views (app_v_gw_points, app_v_ocp_overall) should automatically recalculate');
  console.log('   when picks or results change. If scores are still wrong:');
  console.log('   1. Check if app_gw_results has correct fixture_index values');
  console.log('   2. Check if app_picks has correct fixture_index values');
  console.log('   3. The view joins on fixture_index, so they must match');
}

checkAndClear().catch(console.error);
