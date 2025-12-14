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

async function findLostPicks() {
  console.log('🔍 Finding Sim\'s lost picks...\n');
  
  const simUserId = 'c94f9804-ba11-4cd2-8892-49657aa6412c';
  const gw = 16;
  
  // Check app_gw_submissions
  const { data: submissions } = await supabase
    .from('app_gw_submissions')
    .select('user_id, gw, submitted_at, users(name)')
    .eq('gw', gw);
  
  console.log(`📅 Users who submitted GW16:`);
  submissions?.forEach(s => {
    const marker = s.user_id === simUserId ? ' ⭐ SIM' : '';
    console.log(`   ${s.users?.name || 'Unknown'}: ${s.submitted_at}${marker}`);
  });
  
  // Check who has picks in picks table (web users)
  const { data: webPicks } = await supabase
    .from('picks')
    .select('user_id, users(name)')
    .eq('gw', gw);
  
  const webUserIds = new Set(webPicks?.map(p => p.user_id) || []);
  console.log(`\n📊 Web users (have picks in picks table): ${webUserIds.size}`);
  
  // Check who has picks in app_picks NOW
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('user_id, users(name)')
    .eq('gw', gw);
  
  const appUserIds = new Set(appPicks?.map(p => p.user_id) || []);
  console.log(`📊 App users (have picks in app_picks NOW): ${appUserIds.size}`);
  
  // Find app-only users who submitted but lost picks
  console.log(`\n🔍 App-only users who lost picks:`);
  const appOnlyUsers = [];
  
  submissions?.forEach(sub => {
    const userId = sub.user_id;
    const userName = sub.users?.name || 'Unknown';
    const isWebUser = webUserIds.has(userId);
    const hasAppPicks = appUserIds.has(userId);
    
    if (!isWebUser && !hasAppPicks) {
      console.log(`   ❌ ${userName}: Submitted but NO picks (app-only user)`);
      appOnlyUsers.push({ userId, userName, submittedAt: sub.submitted_at });
    }
  });
  
  if (appOnlyUsers.length === 0) {
    console.log(`   ✅ No app-only users lost picks`);
  } else {
    console.log(`\n⚠️  ${appOnlyUsers.length} app-only user(s) lost their picks!`);
    console.log(`   Our script deleted ALL app_picks and only restored web users' picks`);
    console.log(`   App-only users' picks were deleted and NOT restored\n`);
    
    // Check if Sim is in the list
    const sim = appOnlyUsers.find(u => u.userId === simUserId);
    if (sim) {
      console.log(`   ⭐ Sim is affected!`);
      console.log(`   Sim submitted at: ${sim.submittedAt}`);
      console.log(`   But his picks were deleted by our script`);
    }
  }
  
  // Check if we can recover from app_picks backups or if Sim needs to resubmit
  console.log(`\n💡 Recovery options:`);
  console.log(`   1. Sim needs to resubmit his picks (if deadline hasn't passed)`);
  console.log(`   2. Check if there's a database backup with Sim's picks`);
  console.log(`   3. Check if Sim's picks are in any other table`);
  
  // Check if Sim has picks in other GWs to see the pattern
  const { data: simOtherPicks } = await supabase
    .from('app_picks')
    .select('gw, fixture_index, pick')
    .eq('user_id', simUserId)
    .order('gw')
    .order('fixture_index');
  
  if (simOtherPicks && simOtherPicks.length > 0) {
    const byGw = {};
    simOtherPicks.forEach(p => {
      if (!byGw[p.gw]) byGw[p.gw] = [];
      byGw[p.gw].push(p);
    });
    console.log(`\n📊 Sim has picks for ${Object.keys(byGw).length} other gameweeks:`);
    Object.keys(byGw).sort((a, b) => a - b).forEach(gw => {
      console.log(`   GW${gw}: ${byGw[gw].length} picks`);
    });
  }
}

findLostPicks().catch(console.error);
