#!/usr/bin/env node
/**
 * Investigate why web picks (correct) didn't mirror correctly to app_picks
 * Web has: Sunderland=H, Forest=D (CORRECT)
 * App has: Sunderland=D, Forest=H (WRONG)
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
  console.log('🔍 Investigating mirror bug...\n');
  console.log('CORRECT: Web table (picks) - Sunderland=H, Forest=D');
  console.log('WRONG: App table (app_picks) - Sunderland=D, Forest=H\n');
  
  // Find David Bird
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (!user) {
    console.log('❌ David Bird not found');
    return;
  }
  
  console.log(`User: ${user.name} (ID: ${user.id})\n`);
  
  // Get all GW16 picks from both tables
  const { data: webPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  console.log('📊 WEB PICKS (picks) - CORRECT:');
  webPicks?.forEach(p => {
    console.log(`   Fixture ${p.fixture_index}: ${p.pick} (created: ${p.created_at})`);
  });
  
  console.log('\n📊 APP PICKS (app_picks) - WRONG:');
  appPicks?.forEach(p => {
    console.log(`   Fixture ${p.fixture_index}: ${p.pick} (created: ${p.created_at})`);
  });
  
  // Find mismatches
  console.log('\n🔍 MISMATCHES:');
  const webPicksMap = new Map(webPicks?.map(p => [p.fixture_index, p.pick]) || []);
  const appPicksMap = new Map(appPicks?.map(p => [p.fixture_index, p.pick]) || []);
  
  const mismatches = [];
  webPicksMap.forEach((webPick, fixtureIndex) => {
    const appPick = appPicksMap.get(fixtureIndex);
    if (appPick && webPick !== appPick) {
      mismatches.push({ fixtureIndex, web: webPick, app: appPick });
      console.log(`   ❌ Fixture ${fixtureIndex}: Web="${webPick}", App="${appPick}"`);
    }
  });
  
  // Check timestamps
  console.log('\n📅 TIMESTAMP ANALYSIS:');
  const sunderlandWeb = webPicks?.find(p => p.fixture_index === 4);
  const sunderlandApp = appPicks?.find(p => p.fixture_index === 4);
  const forestWeb = webPicks?.find(p => p.fixture_index === 6);
  const forestApp = appPicks?.find(p => p.fixture_index === 6);
  
  if (sunderlandWeb && sunderlandApp) {
    const webTime = new Date(sunderlandWeb.created_at);
    const appTime = new Date(sunderlandApp.created_at);
    const diff = Math.abs(appTime - webTime);
    console.log(`   Sunderland:`);
    console.log(`     Web created: ${sunderlandWeb.created_at}`);
    console.log(`     App created: ${sunderlandApp.created_at}`);
    console.log(`     Time difference: ${diff}ms`);
    if (appTime < webTime) {
      console.log(`     ⚠️  App pick was created BEFORE web pick!`);
    }
  }
  
  if (forestWeb && forestApp) {
    const webTime = new Date(forestWeb.created_at);
    const appTime = new Date(forestApp.created_at);
    const diff = Math.abs(appTime - webTime);
    console.log(`   Forest:`);
    console.log(`     Web created: ${forestWeb.created_at}`);
    console.log(`     App created: ${forestApp.created_at}`);
    console.log(`     Time difference: ${diff}ms`);
    if (appTime < webTime) {
      console.log(`     ⚠️  App pick was created BEFORE web pick!`);
    }
  }
  
  // Check if app_picks were updated after creation
  console.log('\n🔍 UPDATE ANALYSIS:');
  appPicks?.forEach(p => {
    const created = new Date(p.created_at);
    const updated = new Date(p.updated_at);
    if (created.getTime() !== updated.getTime()) {
      console.log(`   ⚠️  Fixture ${p.fixture_index} was UPDATED after creation:`);
      console.log(`      Created: ${p.created_at}`);
      console.log(`      Updated: ${p.updated_at}`);
    }
  });
  
  // Check submission time
  const { data: submission } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .maybeSingle();
  
  console.log('\n📝 SUBMISSION TIMING:');
  if (submission) {
    console.log(`   Submitted at: ${submission.submitted_at}`);
    const submissionTime = new Date(submission.submitted_at);
    
    appPicks?.forEach(p => {
      const pickTime = new Date(p.created_at);
      if (pickTime > submissionTime) {
        console.log(`   ⚠️  Fixture ${p.fixture_index} was created AFTER submission!`);
      }
    });
  }
  
  console.log('\n💡 POSSIBLE BUGS:');
  console.log('   1. Mirror trigger copied picks in wrong order or swapped them');
  console.log('   2. App_picks were updated by API/script after mirroring');
  console.log('   3. Race condition: picks were changed in app_picks before mirror completed');
  console.log('   4. Mirror trigger has a bug that checks existing picks incorrectly');
  console.log('   5. Fixture indices got mixed up during mirroring');
  
  // Check if there are other users with similar issues
  console.log('\n🔍 Checking other users for similar patterns...');
  const { data: allWebPicks } = await supabase
    .from('picks')
    .select('user_id, fixture_index, pick')
    .eq('gw', 16)
    .in('fixture_index', [4, 6]);
  
  const { data: allAppPicks } = await supabase
    .from('app_picks')
    .select('user_id, fixture_index, pick')
    .eq('gw', 16)
    .in('fixture_index', [4, 6]);
  
  const webMap = new Map();
  allWebPicks?.forEach(p => {
    const key = `${p.user_id}:${p.fixture_index}`;
    webMap.set(key, p.pick);
  });
  
  const appMap = new Map();
  allAppPicks?.forEach(p => {
    const key = `${p.user_id}:${p.fixture_index}`;
    appMap.set(key, p.pick);
  });
  
  const allMismatches = [];
  webMap.forEach((webPick, key) => {
    const appPick = appMap.get(key);
    if (appPick && webPick !== appPick) {
      allMismatches.push({ key, web: webPick, app: appPick });
    }
  });
  
  if (allMismatches.length > 0) {
    console.log(`\n⚠️  Found ${allMismatches.length} user(s) with mismatched picks:`);
    for (const m of allMismatches) {
      const [userId, fixtureIdx] = m.key.split(':');
      const { data: u } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .maybeSingle();
      const userName = u?.name || userId;
      console.log(`   ${userName} (fixture ${fixtureIdx}): Web="${m.web}", App="${m.app}"`);
    }
  } else {
    console.log('\n✅ No other users have mismatched picks');
  }
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('   1. Check mirror trigger function for bugs');
  console.log('   2. Check if any scripts/APIs update app_picks directly');
  console.log('   3. Check if fixture indices are being used correctly');
  console.log('   4. Look for any code that might swap or reorder picks');
}

investigate().catch(console.error);
