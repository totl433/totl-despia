#!/usr/bin/env node
/**
 * Investigate why most web users don't have blue edges
 * Should be ALL users except 4 test users
 * But only 3 have it: Will Middleton, Dan13, errorofways
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
  console.log('🔍 Investigating blue edge bug...\n');
  console.log('Expected: ALL users should have blue edge (except 4 test users)\n');
  console.log('Actual: Only 3 users have it (Will Middleton, Dan13, errorofways)\n');
  
  // Test user IDs
  const appTestUserIds = new Set([
    '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
    '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
  ]);
  
  // Get ALL users
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('id, name')
    .order('name', { ascending: true });
  
  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }
  
  console.log(`📊 Total users in database: ${allUsers?.length || 0}`);
  
  // Get users who have picks in "picks" table
  const { data: webPicks, error: webPicksError } = await supabase
    .from('picks')
    .select('user_id')
    .limit(10000);
  
  if (webPicksError) {
    console.error('❌ Error fetching web picks:', webPicksError);
    return;
  }
  
  const webPicksUserIds = new Set((webPicks || []).map(p => p.user_id));
  console.log(`📊 Users with picks in "picks" table: ${webPicksUserIds.size}`);
  
  // Filter out test users
  const webUserIds = new Set(
    Array.from(webPicksUserIds).filter(id => !appTestUserIds.has(id))
  );
  console.log(`📊 Web users (excluding test users): ${webUserIds.size}\n`);
  
  // Check which users SHOULD have blue edge (all except test users)
  const shouldHaveBlueEdge = (allUsers || []).filter(u => !appTestUserIds.has(u.id));
  console.log(`📊 Users who SHOULD have blue edge: ${shouldHaveBlueEdge.length}`);
  
  // Check which users ACTUALLY have blue edge (have picks in picks table)
  const actuallyHaveBlueEdge = shouldHaveBlueEdge.filter(u => webUserIds.has(u.id));
  console.log(`📊 Users who ACTUALLY have blue edge: ${actuallyHaveBlueEdge.length}\n`);
  
  // Find users who SHOULD have blue edge but DON'T
  const missingBlueEdge = shouldHaveBlueEdge.filter(u => !webUserIds.has(u.id));
  console.log(`❌ Users missing blue edge: ${missingBlueEdge.length}\n`);
  
  if (missingBlueEdge.length > 0) {
    console.log('📋 Users who SHOULD have blue edge but DON\'T:');
    for (const user of missingBlueEdge.slice(0, 20)) {
      // Check if they have picks in app_picks
      const { data: appPicks } = await supabase
        .from('app_picks')
        .select('user_id')
        .eq('user_id', user.id)
        .limit(1);
      
      const hasAppPicks = appPicks && appPicks.length > 0;
      console.log(`   ${user.name || user.id}: ${hasAppPicks ? 'Has app_picks but NO picks table' : 'No picks in either table'}`);
    }
    if (missingBlueEdge.length > 20) {
      console.log(`   ... and ${missingBlueEdge.length - 20} more`);
    }
  }
  
  // Check the 3 users who DO have blue edge
  console.log('\n✅ Users who DO have blue edge:');
  for (const user of actuallyHaveBlueEdge) {
    console.log(`   ${user.name || user.id}`);
  }
  
  // Check specific users mentioned
  console.log('\n🎯 Checking specific users mentioned:');
  const mentionedUsers = ['Will Middleton', 'Dan13', 'errorofways', 'David Bird'];
  for (const name of mentionedUsers) {
    const user = allUsers?.find(u => u.name === name);
    if (user) {
      const hasPicksInWeb = webPicksUserIds.has(user.id);
      const isTestUser = appTestUserIds.has(user.id);
      const shouldHave = !isTestUser;
      const actuallyHas = webUserIds.has(user.id);
      console.log(`   ${name}:`);
      console.log(`     Should have blue edge: ${shouldHave ? 'YES' : 'NO (test user)'}`);
      console.log(`     Actually has blue edge: ${actuallyHas ? '✅ YES' : '❌ NO'}`);
      console.log(`     Has picks in "picks" table: ${hasPicksInWeb ? 'YES' : 'NO'}`);
    } else {
      console.log(`   ${name}: NOT FOUND in users table`);
    }
  }
  
  // Check if there's filtering by league members
  console.log('\n🔍 Checking if filtering by league members is the issue...');
  console.log('   The code filters webUserIds to only include league members:');
  console.log('   webUserIds: Array.from(memberIds.filter(id => webUserIds.has(id)))');
  console.log('   This means if a user is not in ANY league, they won\'t show up!');
  
  // Get all league members
  const { data: leagueMembers, error: leagueMembersError } = await supabase
    .from('league_members')
    .select('user_id');
  
  if (leagueMembersError) {
    console.error('❌ Error fetching league members:', leagueMembersError);
  } else {
    const allLeagueMemberIds = new Set((leagueMembers || []).map(lm => lm.user_id));
    console.log(`   Total unique users in leagues: ${allLeagueMemberIds.size}`);
    
    // Check if missing users are in leagues
    const missingInLeagues = missingBlueEdge.filter(u => allLeagueMemberIds.has(u.id));
    const missingNotInLeagues = missingBlueEdge.filter(u => !allLeagueMemberIds.has(u.id));
    
    console.log(`   Missing blue edge users who ARE in leagues: ${missingInLeagues.length}`);
    console.log(`   Missing blue edge users who are NOT in leagues: ${missingNotInLeagues.length}`);
    
    if (missingInLeagues.length > 0) {
      console.log('\n   ⚠️  These users ARE in leagues but still missing blue edge:');
      for (const user of missingInLeagues.slice(0, 10)) {
        console.log(`      ${user.name || user.id}`);
      }
    }
  }
  
  console.log('\n💡 POSSIBLE CAUSES:');
  console.log('   1. Picks were deleted from "picks" table (by script or manual deletion)');
  console.log('   2. Users never had picks in "picks" table (only in app_picks)');
  console.log('   3. Mirror trigger failed to copy picks from web to app, then picks were deleted');
  console.log('   4. Script overwrote picks table with wrong data');
  console.log('   5. Filtering by league members is excluding users not in leagues');
}

investigate().catch(console.error);
