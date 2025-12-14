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

async function checkAffected() {
  console.log('🔍 Checking which app-only users were affected...\n');
  
  const gw = 16;
  
  // Get all users who submitted GW16 in app_gw_submissions
  const { data: appSubmissions } = await supabase
    .from('app_gw_submissions')
    .select('user_id, users(name)')
    .eq('gw', gw);
  
  // Get all users who have picks in picks table (web users)
  const { data: webPicks } = await supabase
    .from('picks')
    .select('user_id')
    .eq('gw', gw);
  
  const webUserIds = new Set(webPicks?.map(p => p.user_id) || []);
  
  // Get all users who have picks in app_picks NOW
  const { data: currentAppPicks } = await supabase
    .from('app_picks')
    .select('user_id, users(name)')
    .eq('gw', gw);
  
  const currentAppUserIds = new Set(currentAppPicks?.map(p => p.user_id) || []);
  
  console.log('📊 Analysis:');
  console.log(`   Users who submitted GW16 (app): ${appSubmissions?.length || 0}`);
  console.log(`   Users with picks in picks table (web): ${webUserIds.size}`);
  console.log(`   Users with picks in app_picks NOW: ${currentAppUserIds.size}\n`);
  
  console.log('👥 Users who submitted but might have lost picks:');
  const affectedUsers = [];
  
  appSubmissions?.forEach(sub => {
    const userId = sub.user_id;
    const userName = sub.users?.name || 'Unknown';
    const hasWebPicks = webUserIds.has(userId);
    const hasAppPicks = currentAppUserIds.has(userId);
    
    if (!hasWebPicks && !hasAppPicks) {
      console.log(`   ❌ ${userName} (${userId.slice(0, 8)}...): Submitted but NO picks found!`);
      affectedUsers.push({ userId, userName });
    } else if (!hasWebPicks && hasAppPicks) {
      console.log(`   ✅ ${userName}: App-only user, picks restored`);
    } else if (hasWebPicks) {
      console.log(`   ✅ ${userName}: Web user, picks should be restored`);
    }
  });
  
  if (affectedUsers.length > 0) {
    console.log(`\n⚠️  ${affectedUsers.length} user(s) lost their picks:`);
    affectedUsers.forEach(u => {
      console.log(`   - ${u.userName} (${u.userId})`);
    });
    console.log(`\n   These are app-only users who had picks in app_picks`);
    console.log(`   Our script deleted ALL app_picks and only restored web users' picks`);
    console.log(`   App-only users' picks were lost!`);
  } else {
    console.log(`\n✅ All users have picks restored`);
  }
  
  // Check the 4 test users
  const testUserIds = [
    '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
    '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
  ];
  
  console.log(`\n🔍 Checking 4 test users:`);
  testUserIds.forEach(id => {
    const hasWebPicks = webUserIds.has(id);
    const hasAppPicks = currentAppUserIds.has(id);
    const submission = appSubmissions?.find(s => s.user_id === id);
    const userName = submission?.users?.name || 'Unknown';
    
    if (hasWebPicks && hasAppPicks) {
      console.log(`   ✅ ${userName}: Has picks in both tables (restored)`);
    } else if (hasAppPicks) {
      console.log(`   ⚠️  ${userName}: Only in app_picks (should be in both)`);
    } else {
      console.log(`   ❌ ${userName}: NO picks found!`);
    }
  });
}

checkAffected().catch(console.error);
