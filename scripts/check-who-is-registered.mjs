#!/usr/bin/env node
/**
 * Check who is currently registered and ready to receive notifications
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

async function checkWhoIsRegistered() {
  console.log('🔍 Checking who is currently registered\n');
  console.log('='.repeat(80));

  const results = {
    ready: [],
    notReady: [],
    noDevice: [],
  };

  for (const user of APP_USERS) {
    // Get active device from database
    const { data: subscription } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!subscription) {
      results.noDevice.push(user);
      continue;
    }

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
          results.notReady.push({
            name: user.name,
            id: user.id,
            reason: `Device ${subscription.player_id.slice(0, 8)}... not found in OneSignal (404)`,
          });
        } else {
          results.notReady.push({
            name: user.name,
            id: user.id,
            reason: `OneSignal error: ${response.status}`,
          });
        }
        continue;
      }

      const player = await response.json();
      const hasExternalId = !!player.external_user_id;
      const externalIdMatches = player.external_user_id === user.id;
      const isSubscribed = player.notification_types === 1;

      if (hasExternalId && externalIdMatches && isSubscribed) {
        results.ready.push(user);
      } else {
        const reasons = [];
        if (!hasExternalId) reasons.push('external_user_id not set');
        if (hasExternalId && !externalIdMatches) reasons.push(`external_user_id wrong (${player.external_user_id})`);
        if (!isSubscribed) reasons.push('not subscribed in OneSignal');
        
        results.notReady.push({
          name: user.name,
          id: user.id,
          reason: reasons.join(', '),
        });
      }
    } catch (error) {
      results.notReady.push({
        name: user.name,
        id: user.id,
        reason: `Error: ${error.message}`,
      });
    }
  }

  // Print results
  console.log('\n✅ READY TO RECEIVE NOTIFICATIONS:');
  console.log('-'.repeat(80));
  if (results.ready.length === 0) {
    console.log('  None');
  } else {
    results.ready.forEach(user => {
      console.log(`  ✅ ${user.name}`);
    });
  }

  console.log('\n❌ NOT READY (will get suppressed_unsubscribed):');
  console.log('-'.repeat(80));
  if (results.notReady.length === 0) {
    console.log('  None');
  } else {
    results.notReady.forEach(({ name, reason }) => {
      console.log(`  ❌ ${name}: ${reason}`);
    });
  }

  console.log('\n📱 NO ACTIVE DEVICE IN DATABASE:');
  console.log('-'.repeat(80));
  if (results.noDevice.length === 0) {
    console.log('  None');
  } else {
    results.noDevice.forEach(user => {
      console.log(`  ⚠️  ${user.name}: Need to open app to register device`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY:');
  console.log(`  ✅ Ready: ${results.ready.length}/7`);
  console.log(`  ❌ Not ready: ${results.notReady.length}/7`);
  console.log(`  📱 No device: ${results.noDevice.length}/7`);

  // Check recent notification results
  console.log('\n📨 RECENT HALF-TIME NOTIFICATION RESULTS:');
  console.log('-'.repeat(80));
  const { data: recentLogs } = await supabase
    .from('notification_send_log')
    .select('user_id, result')
    .eq('notification_key', 'half-time')
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

  if (recentLogs) {
    APP_USERS.forEach(user => {
      const log = recentLogs.find(l => l.user_id === user.id);
      if (log) {
        const emoji = log.result === 'accepted' ? '✅' : '⏸️';
        console.log(`  ${emoji} ${user.name}: ${log.result}`);
      } else {
        console.log(`  ❓ ${user.name}: No notification attempt found`);
      }
    });
  }
}

checkWhoIsRegistered();

