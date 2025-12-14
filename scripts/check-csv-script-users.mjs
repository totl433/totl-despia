#!/usr/bin/env node
/**
 * Check which users are in CSV-based update scripts
 * These scripts delete picks and reinsert from CSV
 * If a user is NOT in the CSV, their picks get deleted but never reinserted!
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

async function checkCSVScripts() {
  console.log('🔍 Checking which users are in CSV-based update scripts...\n');
  console.log('These scripts DELETE picks and reinsert from CSV files.\n');
  console.log('If a user is NOT in the CSV, their picks get DELETED but never reinserted!\n');
  
  // Check FINAL-complete-update.mjs user mapping
  const finalCompleteUpdateUsers = [
    'Jof', 'Thomas Bird', 'william middleton', 'CarlIos', 'Gregory', 'Ben',
    'SP', 'Phil Bolton', 'Paul', 'David70', 'Sim', 'Matthew Bird'
  ];
  
  // Check import-with-outcomes.mjs user mapping
  const importWithOutcomesUsers = [
    'David Bird', 'David70', 'Sim', 'Matthew Bird', 'Thomas Bird', 'william middleton',
    'CarlIos', 'Gregory', 'Ben', 'SP', 'Phil Bolton', 'Paul'
  ];
  
  console.log('📋 Users in FINAL-complete-update.mjs:');
  finalCompleteUpdateUsers.forEach(u => console.log(`   ${u}`));
  
  console.log('\n📋 Users in import-with-outcomes.mjs:');
  importWithOutcomesUsers.forEach(u => console.log(`   ${u}`));
  
  // Get all users from database
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
  
  // Get users with picks in app_picks
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('user_id')
    .limit(10000);
  
  const appPicksUserIds = new Set((appPicks || []).map(p => p.user_id));
  
  console.log('\n🔍 ANALYSIS:');
  console.log(`   Total users in database: ${allUsers?.length || 0}`);
  console.log(`   Users with picks in "picks" table: ${webPicksUserIds.size}`);
  console.log(`   Users with picks in "app_picks" table: ${appPicksUserIds.size}`);
  
  // Find users who have app_picks but NOT picks
  const missingFromPicks = Array.from(appPicksUserIds).filter(id => !webPicksUserIds.has(id));
  console.log(`   Users missing from "picks" table: ${missingFromPicks.length}\n`);
  
  console.log('💡 THE PROBLEM:');
  console.log('   CSV-based scripts (FINAL-complete-update.mjs, import-with-outcomes.mjs, etc.)');
  console.log('   only update users listed in their CSV files.');
  console.log('   If a user is NOT in the CSV:');
  console.log('   1. Their picks might have been deleted by a previous script run');
  console.log('   2. OR they were never in the CSV, so their picks were never inserted');
  console.log('   3. Result: They have picks in app_picks (from mirroring) but NOT in picks');
  console.log('   4. Result: They don\'t get blue edge because blue edge requires picks in picks table');
  
  console.log('\n🎯 ROOT CAUSE:');
  console.log('   Scripts that update picks from CSV files only update users in the CSV.');
  console.log('   Users not in CSV lose their picks in "picks" table.');
  console.log('   But their picks remain in "app_picks" (from mirroring or direct insertion).');
  console.log('   This creates the mismatch: app_picks has data, picks table doesn\'t.');
}

checkCSVScripts().catch(console.error);
