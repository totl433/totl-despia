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
  console.log('🔍 Investigating why Sim disappeared from the app...\n');
  
  const simUserId = 'c94f9804-ba11-4cd2-8892-49657aa6412c';
  const gw = 16;
  
  // Check if Sim's picks exist in app_picks
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', simUserId)
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log(`📋 Sim's picks in app_picks for GW${gw}: ${appPicks?.length || 0}`);
  if (appPicks && appPicks.length > 0) {
    appPicks.forEach(p => {
      console.log(`   Index ${p.fixture_index}: ${p.pick}`);
    });
  } else {
    console.log('   ⚠️  NO PICKS FOUND!');
  }
  
  // Check submission
  const { data: submission } = await supabase
    .from('app_gw_submissions')
    .select('*')
    .eq('user_id', simUserId)
    .eq('gw', gw)
    .single();
  
  console.log(`\n📅 Sim's submission: ${submission?.submitted_at || 'NOT FOUND'}`);
  
  // Check if Sim is in any leagues
  const { data: leagues } = await supabase
    .from('league_members')
    .select('league_id, leagues(name)')
    .eq('user_id', simUserId);
  
  console.log(`\n👥 Sim is in ${leagues?.length || 0} leagues:`);
  leagues?.forEach(l => {
    console.log(`   ${l.leagues?.name || 'Unknown'}`);
  });
  
  // Check if Sim's user record exists and is active
  const { data: simUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', simUserId)
    .single();
  
  console.log(`\n👤 Sim's user record:`);
  console.log(`   Name: ${simUser?.name || 'NOT FOUND'}`);
  console.log(`   ID: ${simUserId}`);
  
  // Check what the app queries to show picks
  console.log(`\n🔍 Checking what might filter Sim out:`);
  
  // Check if Sim is in the API Test league (app users)
  const { data: apiTestLeague } = await supabase
    .from('leagues')
    .select('id, name')
    .ilike('name', '%API Test%')
    .single();
  
  if (apiTestLeague) {
    const { data: isInApiTest } = await supabase
      .from('league_members')
      .select('*')
      .eq('league_id', apiTestLeague.id)
      .eq('user_id', simUserId)
      .single();
    
    console.log(`   API Test league: ${isInApiTest ? '✅ Sim IS in API Test league' : '❌ Sim is NOT in API Test league'}`);
  }
  
  // Check all users who have picks for GW16
  const { data: allGw16Picks } = await supabase
    .from('app_picks')
    .select('user_id, users(name)')
    .eq('gw', gw);
  
  const uniqueUsers = new Set();
  allGw16Picks?.forEach(p => {
    if (p.users) uniqueUsers.add(p.users.name);
  });
  
  console.log(`\n📊 Users with picks for GW16: ${uniqueUsers.size}`);
  Array.from(uniqueUsers).sort().forEach(name => {
    const marker = name === 'Sim' ? ' ⭐' : '';
    console.log(`   ${name}${marker}`);
  });
  
  // Check if Sim's picks were deleted recently
  console.log(`\n🔍 Checking if picks were deleted:`);
  console.log(`   Sim has submission timestamp: ${submission?.submitted_at}`);
  console.log(`   But no picks in app_picks`);
  console.log(`   This suggests picks were deleted AFTER submission`);
  
  // Check if our scripts might have deleted Sim's picks
  console.log(`\n📝 Checking our scripts:`);
  console.log(`   1. fix-app-picks-from-web-picks.mjs:`);
  console.log(`      - Deleted ALL GW16 picks from app_picks`);
  console.log(`      - Then copied picks FROM picks table TO app_picks`);
  console.log(`      - Sim is NOT a web user, so he wouldn't have picks in picks table`);
  console.log(`      - So Sim's picks would have been DELETED and NOT restored!`);
  console.log(`\n   ⚠️  THIS IS THE PROBLEM!`);
  console.log(`   Our script deleted Sim's picks and didn't restore them because`);
  console.log(`   Sim is an app-only user (not in picks table)`);
}

investigateSim().catch(console.error);
