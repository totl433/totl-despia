#!/usr/bin/env node
/**
 * Check which users are identified as "web users" (should have blue edge)
 * This checks if they have picks in the "picks" table
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

async function checkWebUsers() {
  console.log('🔍 Checking which users are identified as "web users"...\n');
  console.log('Web users = users who have picks in "picks" table (excluding test users)\n');
  
  // Test user IDs (these are excluded from web users)
  const appTestUserIds = new Set([
    '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
    '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
  ]);
  
  // Get all users who have picks in "picks" table
  const { data: webPicks, error: webPicksError } = await supabase
    .from('picks')
    .select('user_id')
    .limit(10000);
  
  if (webPicksError) {
    console.error('❌ Error fetching web picks:', webPicksError);
    return;
  }
  
  const webPicksUserIds = new Set((webPicks || []).map(p => p.user_id));
  
  // Filter out test users
  const webUserIds = new Set(
    Array.from(webPicksUserIds).filter(
      (id) => !appTestUserIds.has(id)
    )
  );
  
  console.log(`📊 Total users with picks in "picks" table: ${webPicksUserIds.size}`);
  console.log(`📊 Test users excluded: ${Array.from(webPicksUserIds).filter(id => appTestUserIds.has(id)).length}`);
  console.log(`📊 Final web users (should have blue edge): ${webUserIds.size}\n`);
  
  // Check David Bird specifically
  const { data: davidBird } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (davidBird) {
    const hasPicksInWeb = webPicksUserIds.has(davidBird.id);
    const isTestUser = appTestUserIds.has(davidBird.id);
    const isWebUser = webUserIds.has(davidBird.id);
    
    console.log(`🎯 David Bird (${davidBird.id}):`);
    console.log(`   Has picks in "picks" table: ${hasPicksInWeb ? '✅ YES' : '❌ NO'}`);
    console.log(`   Is test user: ${isTestUser ? 'YES' : 'NO'}`);
    console.log(`   Identified as web user (should have blue edge): ${isWebUser ? '✅ YES' : '❌ NO'}`);
    
    if (!hasPicksInWeb) {
      console.log(`\n   ⚠️  PROBLEM: David Bird has NO picks in "picks" table!`);
      console.log(`   This means he won't be identified as a web user, so no blue edge.`);
      
      // Check if he has picks in app_picks
      const { data: appPicks } = await supabase
        .from('app_picks')
        .select('user_id')
        .eq('user_id', davidBird.id)
        .limit(1);
      
      if (appPicks && appPicks.length > 0) {
        console.log(`   He DOES have picks in "app_picks" table.`);
        console.log(`   This suggests his picks were deleted from "picks" table or never mirrored correctly.`);
      }
    }
  }
  
  // Check a few other users to see the pattern
  console.log('\n📋 Sample of web users (first 10):');
  const sampleWebUserIds = Array.from(webUserIds).slice(0, 10);
  for (const userId of sampleWebUserIds) {
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .maybeSingle();
    console.log(`   ${user?.name || userId}: ✅ Web user (should have blue edge)`);
  }
  
  console.log('\n💡 HOW IT WORKS:');
  console.log('   1. Check "picks" table for all user_ids');
  console.log('   2. Exclude test users (Jof, Carl, SP, ThomasJamesBird)');
  console.log('   3. Remaining users = "web users" who should have blue edge');
  console.log('   4. If a user has picks in "app_picks" but NOT in "picks", they won\'t get blue edge');
  console.log('\n🎯 BUG: If picks were deleted/overwritten in "picks" table, users lose their blue edge!');
}

checkWebUsers().catch(console.error);
