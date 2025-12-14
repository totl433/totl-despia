#!/usr/bin/env node
/**
 * Check if picks were mirrored incorrectly - could app picks have been wrong
 * and then somehow written back to web?
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

async function checkMirrorIssue() {
  console.log('🔍 Checking if picks were mirrored incorrectly...\n');
  
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
  
  // Check if David Bird is a test user (would trigger reverse mirror)
  const testUserIds = [
    '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
    '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
  ];
  
  const isTestUser = testUserIds.includes(user.id);
  console.log(`Is test user (would trigger reverse mirror): ${isTestUser ? 'YES ⚠️' : 'NO ✅'}\n`);
  
  // Get current picks
  const { data: sunderlandWeb } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', 4)
    .maybeSingle();
  
  const { data: sunderlandApp } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', 4)
    .maybeSingle();
  
  const { data: forestWeb } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', 6)
    .maybeSingle();
  
  const { data: forestApp } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', 6)
    .maybeSingle();
  
  console.log('📊 CURRENT STATE:');
  console.log(`   Sunderland (fixture_index 4):`);
  console.log(`     Web (picks): ${sunderlandWeb?.pick}`);
  console.log(`     App (app_picks): ${sunderlandApp?.pick}`);
  console.log(`   Forest (fixture_index 6):`);
  console.log(`     Web (picks): ${forestWeb?.pick}`);
  console.log(`     App (app_picks): ${forestApp?.pick}`);
  
  console.log('\n🔍 MIRROR TRIGGER LOGIC ANALYSIS:');
  console.log('\n1. Web → App Mirror (mirror_picks_to_app):');
  console.log('   - Triggered on INSERT/UPDATE to "picks" table');
  console.log('   - Checks if pick exists in app_picks with same value');
  console.log('   - Only updates if value is different or doesn\'t exist');
  console.log('   - This should have copied web picks to app correctly');
  
  console.log('\n2. App → Web Mirror (mirror_picks_to_web):');
  console.log('   - Triggered on INSERT/UPDATE to "app_picks" table');
  console.log('   - ONLY for 4 test users (Jof, Carl, SP, ThomasJamesBird)');
  console.log(`   - David Bird is ${isTestUser ? 'a test user' : 'NOT a test user'}`);
  if (!isTestUser) {
    console.log('   - So reverse mirror should NOT affect David Bird');
  } else {
    console.log('   - ⚠️  Reverse mirror WOULD affect David Bird if app_picks changed');
  }
  
  console.log('\n💡 POSSIBLE SCENARIOS:');
  
  console.log('\nScenario 1: Initial mirror was wrong');
  console.log('   - User submitted on web: Sunderland=H, Forest=D');
  console.log('   - Mirror trigger copied to app_picks: Sunderland=H, Forest=D');
  console.log('   - But somehow app_picks ended up with: Sunderland=D, Forest=H');
  console.log('   - Then... how did web get overwritten? (reverse mirror only for test users)');
  
  console.log('\nScenario 2: Picks were changed in app_picks, then...');
  if (isTestUser) {
    console.log('   - Since David Bird IS a test user, reverse mirror would copy app→web');
    console.log('   - If app_picks had wrong values, they would overwrite web picks');
  } else {
    console.log('   - Since David Bird is NOT a test user, reverse mirror wouldn\'t run');
    console.log('   - But maybe there\'s a bug or the test user list is wrong?');
  }
  
  console.log('\nScenario 3: Race condition');
  console.log('   - User submits picks on web');
  console.log('   - Mirror trigger starts copying to app_picks');
  console.log('   - Before mirror completes, picks are changed in app_picks (by API/script?)');
  console.log('   - Mirror completes with wrong values');
  console.log('   - Or picks are updated in app_picks after mirror, but before web reads');
  
  console.log('\nScenario 4: Picks were updated via API or script');
  console.log('   - Some script/API updated picks in app_picks directly');
  console.log('   - If David Bird was mistakenly treated as test user, reverse mirror ran');
  console.log('   - Or if there\'s a bug in the mirror trigger logic');
  
  // Check if there are any other users with similar issues
  console.log('\n🔍 Checking other users for similar patterns...');
  const { data: allGw16Picks } = await supabase
    .from('picks')
    .select('user_id, fixture_index, pick')
    .eq('gw', 16)
    .in('fixture_index', [4, 6]);
  
  const { data: allGw16AppPicks } = await supabase
    .from('app_picks')
    .select('user_id, fixture_index, pick')
    .eq('gw', 16)
    .in('fixture_index', [4, 6]);
  
  const webPicksMap = new Map();
  allGw16Picks?.forEach(p => {
    const key = `${p.user_id}:${p.fixture_index}`;
    webPicksMap.set(key, p.pick);
  });
  
  const appPicksMap = new Map();
  allGw16AppPicks?.forEach(p => {
    const key = `${p.user_id}:${p.fixture_index}`;
    appPicksMap.set(key, p.pick);
  });
  
  const mismatches = [];
  webPicksMap.forEach((webPick, key) => {
    const appPick = appPicksMap.get(key);
    if (appPick && webPick !== appPick) {
      mismatches.push({ key, web: webPick, app: appPick });
    }
  });
  
  if (mismatches.length > 0) {
    console.log(`\n⚠️  Found ${mismatches.length} user(s) with mismatched picks:`);
    for (const m of mismatches) {
      const [userId, fixtureIdx] = m.key.split(':');
      const { data: u } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .maybeSingle();
      const userName = u?.name || userId;
      const isTest = testUserIds.includes(userId);
      console.log(`   ${userName} (fixture ${fixtureIdx}): Web="${m.web}", App="${m.app}" ${isTest ? '(TEST USER)' : ''}`);
    }
  } else {
    console.log('\n✅ No other users have mismatched picks');
  }
  
  console.log('\n🎯 RECOMMENDATION:');
  console.log('   Check if David Bird was ever added to the test user list');
  console.log('   Or if there\'s a bug in the mirror trigger that allows reverse mirror for non-test users');
  console.log('   Or if picks were updated in app_picks by a script/API that then triggered reverse mirror');
}

checkMirrorIssue().catch(console.error);
