#!/usr/bin/env node
/**
 * Check Jof's registration status - see if registerPlayer was called and what happened
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

async function checkJofRegistration() {
  console.log('🔍 Checking Jof\'s registration status\n');
  console.log(`User ID: ${JOF_USER_ID}\n`);
  console.log('='.repeat(60));

  try {
    // Get Jof's active device from database
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', JOF_USER_ID)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!subscription) {
      console.error('❌ No active subscription found');
      return;
    }

    console.log('📱 DATABASE STATUS:');
    console.log('-'.repeat(60));
    console.log(`Player ID: ${subscription.player_id}`);
    console.log(`Platform: ${subscription.platform}`);
    console.log(`Active: ${subscription.is_active ? '✅' : '❌'}`);
    console.log(`Subscribed: ${subscription.subscribed ? '✅' : '❌'}`);
    console.log(`Last checked: ${subscription.last_checked_at || 'Never'}`);
    console.log(`Last active: ${subscription.last_active_at || 'Never'}`);

    // Check OneSignal directly
    console.log('\n\n📡 ONESIGNAL STATUS:');
    console.log('-'.repeat(60));
    
    const OS_BASE = 'https://onesignal.com/api/v1';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
    };

    const url = `${OS_BASE}/players/${subscription.player_id}?app_id=${ONESIGNAL_APP_ID}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('❌ Device NOT FOUND in OneSignal');
        console.log(`   This means the player_id ${subscription.player_id} doesn't exist in OneSignal`);
        console.log(`   This is the problem - the device in the database doesn't match OneSignal`);
      } else {
        const errorBody = await response.text();
        console.error(`❌ Error checking OneSignal: ${response.status}`, errorBody);
      }
      return;
    }

    const player = await response.json();
    console.log(`✅ Device found in OneSignal`);
    console.log(`External User ID: ${player.external_user_id || '❌ NOT SET'}`);
    console.log(`Subscribed: ${player.notification_types === 1 ? '✅' : '❌'}`);
    console.log(`Last Active: ${player.last_active ? new Date(player.last_active * 1000).toISOString() : 'Never'}`);

    if (!player.external_user_id) {
      console.log('\n❌ PROBLEM FOUND: external_user_id is NOT set in OneSignal');
      console.log('   This is why notifications are failing!');
    } else if (player.external_user_id !== JOF_USER_ID) {
      console.log(`\n⚠️  PROBLEM: external_user_id is set to ${player.external_user_id}, expected ${JOF_USER_ID}`);
    } else {
      console.log('\n✅ external_user_id is correctly set!');
      console.log('   If notifications still fail, check user preferences or cooldown settings');
    }

    // Check recent registration attempts (if we had logs)
    console.log('\n\n📋 RECENT NOTIFICATION ATTEMPTS:');
    console.log('-'.repeat(60));
    const { data: recentLogs } = await supabase
      .from('notification_send_log')
      .select('*')
      .eq('user_id', JOF_USER_ID)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentLogs && recentLogs.length > 0) {
      recentLogs.forEach(log => {
        const time = new Date(log.created_at).toLocaleString();
        const emoji = log.result === 'accepted' ? '✅' : log.result === 'failed' ? '❌' : '⏸️';
        console.log(`${emoji} [${time}] ${log.notification_key} - ${log.result}`);
        if (log.error) {
          console.log(`   Error: ${JSON.stringify(log.error).slice(0, 100)}...`);
        }
      });
    } else {
      console.log('No recent notification attempts found');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkJofRegistration();













