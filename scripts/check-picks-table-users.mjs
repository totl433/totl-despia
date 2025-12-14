#!/usr/bin/env node
/**
 * Check which users are in the picks table
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

async function checkPicksTableUsers() {
  console.log('🔍 Checking which users are in picks table...\n');
  
  // Get all unique user_ids from picks table
  const { data: picksData, error: picksError } = await supabase
    .from('picks')
    .select('user_id')
    .order('user_id');
  
  if (picksError) {
    console.error('❌ Error fetching picks:', picksError);
    return;
  }
  
  const uniqueUserIds = [...new Set(picksData.map(p => p.user_id))];
  console.log(`📊 Total unique users in picks table: ${uniqueUserIds.length}\n`);
  
  // Get user names
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name')
    .in('id', uniqueUserIds);
  
  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }
  
  const userMap = new Map(users.map(u => [u.id, u.name]));
  
  console.log('👥 Users in picks table:');
  uniqueUserIds.forEach((userId, index) => {
    const userName = userMap.get(userId) || 'Unknown';
    console.log(`   ${index + 1}. ${userName} (${userId})`);
  });
  
  // Check if David Bird is in picks table
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (dbUser) {
    const dbInPicks = uniqueUserIds.includes(dbUser.id);
    console.log(`\n🔍 David Bird status:`);
    console.log(`   User ID: ${dbUser.id}`);
    console.log(`   In picks table: ${dbInPicks ? '✅ YES' : '❌ NO'}`);
    
    if (!dbInPicks) {
      console.log(`\n⚠️  David Bird is NOT in picks table!`);
      console.log(`   This means web should NOT be showing his picks from picks table.`);
      console.log(`   Web must be reading from somewhere else, or showing cached data.`);
    }
  }
  
  // Compare with app_picks
  console.log(`\n📊 Comparing with app_picks table...`);
  const { data: appPicksData, error: appPicksError } = await supabase
    .from('app_picks')
    .select('user_id')
    .order('user_id');
  
  if (appPicksError) {
    console.error('❌ Error fetching app_picks:', appPicksError);
    return;
  }
  
  const uniqueAppUserIds = [...new Set(appPicksData.map(p => p.user_id))];
  console.log(`📊 Total unique users in app_picks table: ${uniqueAppUserIds.length}`);
  
  const usersOnlyInPicks = uniqueUserIds.filter(id => !uniqueAppUserIds.includes(id));
  const usersOnlyInAppPicks = uniqueAppUserIds.filter(id => !uniqueUserIds.includes(id));
  const usersInBoth = uniqueUserIds.filter(id => uniqueAppUserIds.includes(id));
  
  console.log(`\n📊 Comparison:`);
  console.log(`   Users in BOTH tables: ${usersInBoth.length}`);
  console.log(`   Users ONLY in picks: ${usersOnlyInPicks.length}`);
  console.log(`   Users ONLY in app_picks: ${usersOnlyInAppPicks.length}`);
  
  if (usersOnlyInAppPicks.length > 0) {
    console.log(`\n⚠️  Users missing from picks table:`);
    const { data: missingUsers } = await supabase
      .from('users')
      .select('id, name')
      .in('id', usersOnlyInAppPicks.slice(0, 20)); // Limit to first 20
    
    if (missingUsers) {
      missingUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.name} (${u.id})`);
      });
      if (usersOnlyInAppPicks.length > 20) {
        console.log(`   ... and ${usersOnlyInAppPicks.length - 20} more`);
      }
    }
  }
}

checkPicksTableUsers().catch(console.error);
