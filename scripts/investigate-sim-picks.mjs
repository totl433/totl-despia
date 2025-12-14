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

async function investigateSim() {
  console.log('🔍 Investigating SIM\'s picks...\n');
  
  const simUserId = 'c94f9804-ba11-4cd2-8892-49657aa6412c';
  const gw = 16;
  
  // Check all submissions
  console.log('📅 Checking submissions:');
  const { data: appSubmissions } = await supabase
    .from('app_gw_submissions')
    .select('*')
    .eq('user_id', simUserId)
    .order('gw', { ascending: false });
  
  console.log(`   App submissions: ${appSubmissions?.length || 0}`);
  appSubmissions?.forEach(s => {
    console.log(`      GW${s.gw}: ${s.submitted_at}`);
  });
  
  const { data: webSubmissions } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', simUserId)
    .order('gw', { ascending: false });
  
  console.log(`   Web submissions: ${webSubmissions?.length || 0}`);
  webSubmissions?.forEach(s => {
    console.log(`      GW${s.gw}: ${s.submitted_at}`);
  });
  
  // Check picks across all GWs
  console.log('\n📋 Checking picks across all gameweeks:');
  const { data: allAppPicks } = await supabase
    .from('app_picks')
    .select('gw, fixture_index, pick')
    .eq('user_id', simUserId)
    .order('gw', { ascending: false })
    .order('fixture_index');
  
  if (allAppPicks && allAppPicks.length > 0) {
    const byGw = {};
    allAppPicks.forEach(p => {
      if (!byGw[p.gw]) byGw[p.gw] = [];
      byGw[p.gw].push(p);
    });
    console.log(`   Found picks in app_picks for ${Object.keys(byGw).length} gameweeks:`);
    Object.keys(byGw).sort((a, b) => b - a).forEach(gw => {
      console.log(`      GW${gw}: ${byGw[gw].length} picks`);
    });
  } else {
    console.log('   ⚠️  No picks found in app_picks for any gameweek');
  }
  
  // Check specifically for GW16
  console.log('\n🔍 Detailed check for GW16:');
  
  // Check if picks exist but maybe with wrong gw
  const { data: allPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', simUserId);
  
  console.log(`   Total picks in app_picks: ${allPicks?.length || 0}`);
  if (allPicks && allPicks.length > 0) {
    const gwCounts = {};
    allPicks.forEach(p => {
      gwCounts[p.gw] = (gwCounts[p.gw] || 0) + 1;
    });
    console.log(`   Picks by GW:`, gwCounts);
  }
  
  // Check if there are any picks with similar user_id (typo?)
  const { data: similarPicks } = await supabase
    .from('app_picks')
    .select('user_id, gw, COUNT(*)')
    .eq('gw', gw)
    .limit(100);
  
  // Check app_fixtures to see what fixtures exist for GW16
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('fixture_index, home_name, away_name, home_code, away_code')
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log(`\n📊 GW16 has ${fixtures?.length || 0} fixtures`);
  
  // Check if SIM is in the 4 test users list (should mirror to web)
  const testUserIds = [
    '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
    '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
  ];
  
  const isTestUser = testUserIds.includes(simUserId);
  console.log(`\n👤 SIM is ${isTestUser ? 'a test user' : 'NOT a test user'} (app-only users mirror to web)`);
  console.log(`   Test users get their picks mirrored from app_picks → picks`);
  console.log(`   Regular app users do NOT get mirrored to web`);
  
  // Check if there's a submission but picks were deleted
  if (appSubmissions?.find(s => s.gw === gw)) {
    console.log(`\n⚠️  SIM has a submission for GW${gw} but no picks!`);
    console.log(`   This suggests:`);
    console.log(`   1. Picks were submitted but failed to save`);
    console.log(`   2. Picks were saved but then deleted`);
    console.log(`   3. Submission was created but picks weren't saved yet`);
  }
}

investigateSim().catch(console.error);
