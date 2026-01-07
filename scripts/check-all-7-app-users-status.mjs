#!/usr/bin/env node
/**
 * Check status of all 7 app users - see who has external_user_id set
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const APP_USERS = [
  { id: '4542c037-5b38-40d0-b189-847b8f17c222', name: 'Jof' },
  { id: 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', name: 'Carl' },
  { id: '9c0bcf50-370d-412d-8826-95371a72b4fe', name: 'SP' },
  { id: '36f31625-6d6c-4aa4-815a-1493a812841b', name: 'ThomasJamesBird' },
  { id: 'c94f9804-ba11-4cd2-8892-49657aa6412c', name: 'Sim' },
  { id: '42b48136-040e-42a3-9b0a-dc9550dd1cae', name: 'Will Middleton' },
  { id: 'd2cbeca9-7dae-4be1-88fb-706911d67256', name: 'David Bird' },
];

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

if (!supabaseUrl || !supabaseKey || !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllUsers() {
  console.log('🔍 Checking all 7 app users status\n');
  console.log('='.repeat(70));

  for (const user of APP_USERS) {
    console.log(`\n👤 ${user.name} (${user.id.slice(0, 8)}...)`);
    console.log('-'.repeat(70));

    // Get active device from database
    const { data: subscription } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!subscription) {
      console.log('  ❌ No active device in database');
      continue;
    }

    console.log(`  📱 Device: ${subscription.player_id.slice(0, 16)}...`);
    console.log(`  ✅ Active: ${subscription.is_active ? 'Yes' : 'No'}`);
    console.log(`  ✅ Subscribed (DB): ${subscription.subscribed ? 'Yes' : 'No'}`);

    // Check OneSignal
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
          console.log('  ❌ Device NOT FOUND in OneSignal (404)');
          console.log('     → This is the problem! Device in DB doesn\'t exist in OneSignal');
        } else {
          console.log(`  ❌ OneSignal error: ${response.status}`);
        }
        continue;
      }

      const player = await response.json();
      const hasExternalId = !!player.external_user_id;
      const externalIdMatches = player.external_user_id === user.id;
      const isSubscribed = player.notification_types === 1;

      console.log(`  📡 OneSignal Status:`);
      console.log(`     Subscribed: ${isSubscribed ? '✅ Yes' : '❌ No'}`);
      console.log(`     External User ID: ${hasExternalId ? (externalIdMatches ? '✅ Set correctly' : `⚠️  Set to ${player.external_user_id}`) : '❌ NOT SET'}`);

      if (!hasExternalId || !externalIdMatches) {
        console.log(`     ⚠️  PROBLEM: external_user_id ${!hasExternalId ? 'not set' : 'doesn\'t match'}`);
      } else if (!isSubscribed) {
        console.log(`     ⚠️  PROBLEM: Device not subscribed in OneSignal`);
      } else {
        console.log(`     ✅ All good! Should receive notifications`);
      }

      // Check recent notification result
      const { data: recentLog } = await supabase
        .from('notification_send_log')
        .select('result, error, created_at')
        .eq('user_id', user.id)
        .eq('notification_key', 'half-time')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentLog) {
        const time = new Date(recentLog.created_at).toLocaleTimeString();
        const emoji = recentLog.result === 'accepted' ? '✅' : recentLog.result === 'failed' ? '❌' : '⏸️';
        console.log(`  📨 Last half-time notification: ${emoji} ${recentLog.result} [${time}]`);
        if (recentLog.error) {
          console.log(`     Error: ${JSON.stringify(recentLog.error).slice(0, 100)}...`);
        }
      }

    } catch (error) {
      console.error(`  ❌ Error checking OneSignal: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 Summary: Users with ❌ external_user_id NOT SET need to be fixed');
}

checkAllUsers();













