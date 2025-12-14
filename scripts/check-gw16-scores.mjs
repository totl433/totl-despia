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

async function checkScores() {
  console.log('🔍 Checking GW16 scores from views...\n');
  
  const gw = 16;
  
  // Get scores from view
  const { data: viewScores } = await supabase
    .from('app_v_gw_points')
    .select('user_id, gw, points, users(name)')
    .eq('gw', gw)
    .order('points', { ascending: false });
  
  console.log('📊 Scores from app_v_gw_points view:');
  viewScores?.forEach(s => {
    console.log(`   ${s.users?.name || 'Unknown'}: ${s.points} points`);
  });
  
  // Manually calculate scores to verify
  console.log('\n🔍 Manually calculating scores to verify...\n');
  
  // Get results
  const { data: results } = await supabase
    .from('app_gw_results')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log(`📊 Results for GW${gw}:`);
  results?.forEach(r => {
    console.log(`   Index ${r.fixture_index}: ${r.result}`);
  });
  
  // Get picks for a few users
  const { data: allPicks } = await supabase
    .from('app_picks')
    .select('user_id, fixture_index, pick, users(name)')
    .eq('gw', gw)
    .order('user_id')
    .order('fixture_index');
  
  // Calculate scores manually
  const manualScores = new Map();
  
  allPicks?.forEach(pick => {
    const result = results?.find(r => r.fixture_index === pick.fixture_index);
    if (result && pick.pick === result.result) {
      const current = manualScores.get(pick.user_id) || 0;
      manualScores.set(pick.user_id, current + 1);
    }
  });
  
  console.log('\n📊 Manually calculated scores:');
  const manualScoresArray = Array.from(manualScores.entries())
    .map(([userId, points]) => {
      const user = allPicks?.find(p => p.user_id === userId);
      return { userId, name: user?.users?.name || 'Unknown', points };
    })
    .sort((a, b) => b.points - a.points);
  
  manualScoresArray.forEach(s => {
    const viewScore = viewScores?.find(v => v.user_id === s.userId);
    const match = viewScore?.points === s.points ? '✅' : '❌';
    console.log(`   ${match} ${s.name}: Manual=${s.points}, View=${viewScore?.points || 0}`);
  });
  
  // Check if there's a mismatch
  const mismatches = manualScoresArray.filter(s => {
    const viewScore = viewScores?.find(v => v.user_id === s.userId);
    return viewScore?.points !== s.points;
  });
  
  if (mismatches.length > 0) {
    console.log(`\n⚠️  Found ${mismatches.length} mismatches!`);
    console.log('   The view might be using wrong fixture_index values');
    console.log('   Or picks/results are misaligned');
  } else {
    console.log('\n✅ All scores match!');
  }
  
  // Check fixture alignment
  console.log('\n🔍 Checking fixture alignment:');
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log(`   app_fixtures has ${fixtures?.length || 0} fixtures`);
  console.log(`   app_gw_results has ${results?.length || 0} results`);
  console.log(`   app_picks has ${allPicks?.length || 0} picks`);
  
  // Check if results match fixtures
  if (fixtures && results) {
    let misaligned = 0;
    fixtures.forEach(fix => {
      const result = results.find(r => r.fixture_index === fix.fixture_index);
      if (!result) {
        console.log(`   ⚠️  Fixture index ${fix.fixture_index} has no result`);
        misaligned++;
      }
    });
    if (misaligned === 0) {
      console.log('   ✅ All fixtures have results');
    }
  }
}

checkScores().catch(console.error);
