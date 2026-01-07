#!/usr/bin/env node
/**
 * Check if Jof is properly registered after reopening app
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const JOF_USER_ID = '4542c037-5b38-40d0-b189-847b8f17c222';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

if (!supabaseUrl || !supabaseKey || !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJofRegistered() {
  console.log('🔍 Checking if Jof is properly registered\n');
  console.log('='.repeat(70));

  // Get active device from database
  const { data: subscription } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', JOF_USER_ID)
    .eq('is_active', true)
    .maybeSingle();

  if (!subscription) {
    console.log('❌ No active device found in database');
    return;
  }

  console.log('📱 DATABASE STATUS:');
  console.log('-'.repeat(70));
  console.log(`Player ID: ${subscription.player_id}`);
  console.log(`Subscribed (DB): ${subscription.subscribed ? '✅ Yes' : '❌ No'}`);
  console.log(`Last checked: ${subscription.last_checked_at ? new Date(subscription.last_checked_at).toLocaleString() : 'Never'}`);
  console.log(`Last active: ${subscription.last_active_at ? new Date(subscription.last_active_at).toLocaleString() : 'Never'}`);

  // Check OneSignal directly
  console.log('\n📡 ONESIGNAL STATUS:');
  console.log('-'.repeat(70));

  const OS_BASE = 'https://onesignal.com/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
  };

  try {
    const url = `${OS_BASE}/players/${subscription.player_id}?app_id=${ONESIGNAL_APP_ID}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('❌ Device NOT FOUND in OneSignal (404)');
        console.log('   → The player_id in database doesn\'t exist in OneSignal');
        console.log('   → This means registerPlayer couldn\'t set external_user_id');
        console.log('   → You need to re-register your device');
        return;
      } else {
        const errorBody = await response.text();
        console.error(`❌ OneSignal error: ${response.status}`, errorBody);
        return;
      }
    }

    const player = await response.json();
    const hasExternalId = !!player.external_user_id;
    const externalIdMatches = player.external_user_id === JOF_USER_ID;
    const isSubscribed = player.notification_types === 1;

    console.log(`Device exists: ✅ Yes`);
    console.log(`Subscribed: ${isSubscribed ? '✅ Yes' : '❌ No'}`);
    console.log(`External User ID: ${hasExternalId ? player.external_user_id : '❌ NOT SET'}`);
    console.log(`External ID matches: ${externalIdMatches ? '✅ Yes' : '❌ No'}`);

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 REGISTRATION STATUS:');
    console.log('-'.repeat(70));

    if (!hasExternalId) {
      console.log('❌ NOT REGISTERED');
      console.log('   → external_user_id is NOT set in OneSignal');
      console.log('   → registerPlayer may have failed silently');
      console.log('   → Check Netlify logs for registerPlayer errors');
    } else if (!externalIdMatches) {
      console.log('⚠️  PARTIALLY REGISTERED');
      console.log(`   → external_user_id is set to: ${player.external_user_id}`);
      console.log(`   → Expected: ${JOF_USER_ID}`);
      console.log('   → This is wrong - device linked to wrong user');
    } else if (!isSubscribed) {
      console.log('⚠️  REGISTERED BUT NOT SUBSCRIBED');
      console.log('   → external_user_id is set correctly');
      console.log('   → But device is not subscribed in OneSignal');
      console.log('   → Enable notifications in iOS Settings');
    } else {
      console.log('✅ FULLY REGISTERED');
      console.log('   → Device exists in OneSignal ✅');
      console.log('   → external_user_id is set correctly ✅');
      console.log('   → Device is subscribed ✅');
      console.log('   → You should receive notifications! 🎉');
    }

  } catch (error) {
    console.error('❌ Error checking OneSignal:', error.message);
  }
}

checkJofRegistered();













