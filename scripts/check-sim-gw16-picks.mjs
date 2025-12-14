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

async function checkSimPicks() {
  console.log('🔍 Checking SIM\'s GW16 picks...\n');
  
  const gw = 16;
  
  // Find SIM's user ID
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%SIM%');
  
  if (userErr) {
    console.error('❌ Error finding user:', userErr);
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('❌ No user found matching "SIM"');
    return;
  }
  
  console.log('👤 Found users:');
  users.forEach(u => {
    console.log(`   ${u.name}: ${u.id}`);
  });
  
  // Check for exact match "SIM" or "Sim"
  const simUser = users.find(u => u.name.toUpperCase() === 'SIM' || u.name === 'Sim' || u.name === 'SIM');
  
  if (!simUser) {
    console.log('\n⚠️  No exact match for "SIM", checking all matches...');
  }
  
  // Check picks for all matching users
  for (const user of users) {
    console.log(`\n📋 Checking picks for ${user.name} (${user.id}):`);
    
    // Check app_picks
    const { data: appPicks, error: appErr } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', user.id)
      .eq('gw', gw)
      .order('fixture_index');
    
    if (appErr) {
      console.error(`   ❌ Error checking app_picks:`, appErr);
      continue;
    }
    
    if (!appPicks || appPicks.length === 0) {
      console.log(`   ⚠️  No picks found in app_picks for GW${gw}`);
    } else {
      console.log(`   ✅ Found ${appPicks.length} picks in app_picks:`);
      appPicks.forEach(p => {
        console.log(`      Index ${p.fixture_index}: ${p.pick}`);
      });
    }
    
    // Check picks (web table)
    const { data: webPicks, error: webErr } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', user.id)
      .eq('gw', gw)
      .order('fixture_index');
    
    if (webErr) {
      console.error(`   ❌ Error checking picks:`, webErr);
      continue;
    }
    
    if (!webPicks || webPicks.length === 0) {
      console.log(`   ⚠️  No picks found in picks (web) for GW${gw}`);
    } else {
      console.log(`   ✅ Found ${webPicks.length} picks in picks (web):`);
      webPicks.forEach(p => {
        console.log(`      Index ${p.fixture_index}: ${p.pick}`);
      });
    }
    
    // Check submissions
    const { data: appSubmission } = await supabase
      .from('app_gw_submissions')
      .select('submitted_at')
      .eq('user_id', user.id)
      .eq('gw', gw)
      .single();
    
    const { data: webSubmission } = await supabase
      .from('gw_submissions')
      .select('submitted_at')
      .eq('user_id', user.id)
      .eq('gw', gw)
      .single();
    
    console.log(`   📅 App submission: ${appSubmission?.submitted_at || 'Not submitted'}`);
    console.log(`   📅 Web submission: ${webSubmission?.submitted_at || 'Not submitted'}`);
  }
  
  // Get fixtures to show what picks correspond to
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  if (appFixtures && appFixtures.length > 0 && users.length > 0) {
    const mainUser = simUser || users[0];
    const { data: userPicks } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', mainUser.id)
      .eq('gw', gw)
      .order('fixture_index');
    
    if (userPicks && userPicks.length > 0) {
      console.log(`\n📊 ${mainUser.name}'s picks with fixture details:`);
      appFixtures.forEach(fix => {
        const pick = userPicks.find(p => p.fixture_index === fix.fixture_index);
        const pickStr = pick ? pick.pick : 'No pick';
        console.log(`   ${fix.fixture_index}. ${fix.home_name || fix.home_code} vs ${fix.away_name || fix.away_code}: ${pickStr}`);
      });
    }
  }
}

checkSimPicks().catch(console.error);
