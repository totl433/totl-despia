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

async function checkGw15() {
  console.log('🔍 Checking GW15 picks and scores...\n');
  
  const gw = 15;
  
  // Get fixtures
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
  
  // Get picks
  const { data: picks } = await supabase
    .from('app_picks')
    .select('user_id, fixture_index, pick, users(name)')
    .eq('gw', gw)
    .order('user_id')
    .order('fixture_index');
  
  console.log(`📊 GW${gw} data:`);
  console.log(`   Fixtures: ${fixtures?.length || 0}`);
  console.log(`   Results: ${results?.length || 0}`);
  console.log(`   Picks: ${picks?.length || 0}`);
  
  if (!picks || picks.length === 0) {
    console.log('\n⚠️  NO PICKS FOUND for GW15!');
    console.log('   This explains why scores are wrong - the view can\'t calculate scores without picks');
    console.log('   GW15 picks might have been deleted when we ran fix-app-picks-from-web-picks.mjs');
    return;
  }
  
  // Get scores from view
  const { data: viewScores } = await supabase
    .from('app_v_gw_points')
    .select('user_id, gw, points, users(name)')
    .eq('gw', gw)
    .order('points', { ascending: false });
  
  console.log(`\n📊 Scores from view: ${viewScores?.length || 0} users`);
  viewScores?.slice(0, 10).forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.users?.name || 'Unknown'}: ${s.points} points`);
  });
  
  // Manually calculate scores for a few users to verify
  console.log('\n🔍 Manually calculating scores to verify view:');
  
  const userScores = new Map();
  picks.forEach(pick => {
    const result = results?.find(r => r.fixture_index === pick.fixture_index);
    if (result && pick.pick === result.result) {
      const current = userScores.get(pick.user_id) || 0;
      userScores.set(pick.user_id, current + 1);
    }
  });
  
  // Compare with view
  const mismatches = [];
  viewScores?.forEach(viewScore => {
    const manualScore = userScores.get(viewScore.user_id) || 0;
    if (viewScore.points !== manualScore) {
      mismatches.push({
        name: viewScore.users?.name || 'Unknown',
        viewScore: viewScore.points,
        manualScore: manualScore
      });
    }
  });
  
  if (mismatches.length > 0) {
    console.log(`\n❌ Found ${mismatches.length} mismatches:`);
    mismatches.forEach(m => {
      console.log(`   ${m.name}: View=${m.viewScore}, Manual=${m.manualScore}`);
    });
    console.log('\n   This means the view is joining picks and results incorrectly');
    console.log('   Likely cause: Results have wrong fixture_index values');
  } else {
    console.log('✅ All scores match!');
  }
  
  // Check fixture alignment
  console.log('\n🔍 Checking if results match fixtures:');
  fixtures?.forEach(fix => {
    const result = results?.find(r => r.fixture_index === fix.fixture_index);
    if (result) {
      console.log(`   Index ${fix.fixture_index}: ${fix.home_name} vs ${fix.away_name} = ${result.result}`);
    } else {
      console.log(`   Index ${fix.fixture_index}: ${fix.home_name} vs ${fix.away_name} = NO RESULT`);
    }
  });
}

checkGw15().catch(console.error);
