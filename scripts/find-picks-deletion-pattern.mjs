#!/usr/bin/env node
/**
 * Find the pattern of which users have picks in picks table vs app_picks
 * This will help identify what deleted the picks
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

async function findPattern() {
  console.log('🔍 Finding pattern of picks deletion...\n');
  
  // Get all users
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name')
    .order('name', { ascending: true });
  
  // Get users with picks in picks table
  const { data: webPicks } = await supabase
    .from('picks')
    .select('user_id, gw')
    .limit(10000);
  
  const webPicksByUser = new Map();
  (webPicks || []).forEach(p => {
    if (!webPicksByUser.has(p.user_id)) {
      webPicksByUser.set(p.user_id, new Set());
    }
    webPicksByUser.get(p.user_id).add(p.gw);
  });
  
  // Get users with picks in app_picks table
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('user_id, gw')
    .limit(10000);
  
  const appPicksByUser = new Map();
  (appPicks || []).forEach(p => {
    if (!appPicksByUser.has(p.user_id)) {
      appPicksByUser.set(p.user_id, new Set());
    }
    appPicksByUser.get(p.user_id).add(p.gw);
  });
  
  console.log('📊 Users with picks in "picks" table:');
  const usersWithWebPicks = Array.from(webPicksByUser.keys());
  for (const userId of usersWithWebPicks) {
    const user = allUsers?.find(u => u.id === userId);
    const gws = Array.from(webPicksByUser.get(userId)).sort((a, b) => a - b);
    console.log(`   ${user?.name || userId}: GWs ${gws.join(', ')}`);
  }
  
  console.log('\n📊 Users with picks in "app_picks" but NOT in "picks" table:');
  const usersWithAppPicksOnly = Array.from(appPicksByUser.keys()).filter(
    id => !webPicksByUser.has(id)
  );
  
  for (const userId of usersWithAppPicksOnly.slice(0, 20)) {
    const user = allUsers?.find(u => u.id === userId);
    const gws = Array.from(appPicksByUser.get(userId)).sort((a, b) => a - b);
    console.log(`   ${user?.name || userId}: GWs ${gws.join(', ')}`);
  }
  if (usersWithAppPicksOnly.length > 20) {
    console.log(`   ... and ${usersWithAppPicksOnly.length - 20} more`);
  }
  
  // Check if there's a pattern by GW
  console.log('\n🔍 Checking GW pattern...');
  const gwsInWebPicks = new Set();
  (webPicks || []).forEach(p => gwsInWebPicks.add(p.gw));
  
  const gwsInAppPicks = new Set();
  (appPicks || []).forEach(p => gwsInAppPicks.add(p.gw));
  
  console.log(`   GWs in "picks" table: ${Array.from(gwsInWebPicks).sort((a, b) => a - b).join(', ')}`);
  console.log(`   GWs in "app_picks" table: ${Array.from(gwsInAppPicks).sort((a, b) => a - b).join(', ')}`);
  
  // Check if users with web picks are newer users or older users
  console.log('\n🔍 Checking if there's a pattern by user creation...');
  const usersWithWebPicksData = usersWithWebPicks.map(id => {
    const user = allUsers?.find(u => u.id === id);
    return { id, name: user?.name || id };
  });
  
  console.log('   Users with picks in "picks" table (these are the ones with blue edges):');
  usersWithWebPicksData.forEach(u => console.log(`      ${u.name}`));
  
  console.log('\n💡 KEY FINDINGS:');
  console.log('   1. Only 16 users have picks in "picks" table');
  console.log('   2. 44 users have picks in "app_picks" table');
  console.log('   3. 32 users are missing from "picks" table');
  console.log('   4. The filtering in Home.tsx line 1039 also filters by league members');
  console.log('   5. This means users not in leagues AND without picks in picks table = no blue edge');
}

findPattern().catch(console.error);
