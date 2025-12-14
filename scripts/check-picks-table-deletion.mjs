#!/usr/bin/env node
/**
 * Check if picks were deleted from picks table
 * 54 users are missing picks in picks table but have them in app_picks
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

async function checkDeletion() {
  console.log('🔍 Checking if picks were deleted from picks table...\n');
  
  // Get all users
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name')
    .order('name', { ascending: true });
  
  // Get users with picks in picks table
  const { data: webPicks } = await supabase
    .from('picks')
    .select('user_id')
    .limit(10000);
  
  const webPicksUserIds = new Set((webPicks || []).map(p => p.user_id));
  
  // Get users with picks in app_picks table
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('user_id')
    .limit(10000);
  
  const appPicksUserIds = new Set((appPicks || []).map(p => p.user_id));
  
  console.log(`📊 Users with picks in "picks" table: ${webPicksUserIds.size}`);
  console.log(`📊 Users with picks in "app_picks" table: ${appPicksUserIds.size}\n`);
  
  // Find users who have app_picks but NOT picks
  const missingFromPicks = Array.from(appPicksUserIds).filter(id => !webPicksUserIds.has(id));
  console.log(`❌ Users with app_picks but NO picks table: ${missingFromPicks.length}\n`);
  
  // Check a few specific users
  console.log('📋 Sample users missing from picks table:');
  for (const userId of missingFromPicks.slice(0, 10)) {
    const user = allUsers?.find(u => u.id === userId);
    const name = user?.name || userId;
    
    // Check how many picks they have in each table
    const { data: webPicksCount } = await supabase
      .from('picks')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const { data: appPicksCount } = await supabase
      .from('app_picks')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    console.log(`   ${name}:`);
    console.log(`     Picks in "picks" table: ${webPicksCount || 0}`);
    console.log(`     Picks in "app_picks" table: ${appPicksCount || 0}`);
  }
  
  // Check if there's a pattern - maybe picks were deleted for specific GWs?
  console.log('\n🔍 Checking which GWs have picks in picks table...');
  const { data: gwPicks } = await supabase
    .from('picks')
    .select('gw')
    .order('gw', { ascending: true });
  
  const gwsInPicks = new Set((gwPicks || []).map(p => p.gw));
  console.log(`   GWs with picks in "picks" table: ${Array.from(gwsInPicks).sort((a, b) => a - b).join(', ')}`);
  
  // Check app_picks GWs
  const { data: gwAppPicks } = await supabase
    .from('app_picks')
    .select('gw')
    .order('gw', { ascending: true });
  
  const gwsInAppPicks = new Set((gwAppPicks || []).map(p => p.gw));
  console.log(`   GWs with picks in "app_picks" table: ${Array.from(gwsInAppPicks).sort((a, b) => a - b).join(', ')}`);
  
  console.log('\n💡 ANALYSIS:');
  console.log('   If users have picks in app_picks but NOT in picks, it means:');
  console.log('   1. Picks were deleted from picks table');
  console.log('   2. OR picks were never in picks table (only mirrored to app_picks)');
  console.log('   3. OR a script overwrote picks table and only kept some users');
}

checkDeletion().catch(console.error);
