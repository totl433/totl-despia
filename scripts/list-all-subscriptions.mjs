#!/usr/bin/env node
/**
 * List all users with push subscriptions and their OneSignal status
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

async function checkOneSignalSubscription(playerId) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return null; // Skip OneSignal check if credentials not available
  }

  try {
    const url = `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;
    const resp = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
    });

    if (!resp.ok) {
      return { subscribed: false, error: `HTTP ${resp.status}` };
    }

    const player = await resp.json();
    const hasToken = !!player.identifier;
    const notInvalid = !player.invalid_identifier;
    const notificationTypes = player.notification_types;
    
    const explicitlySubscribed = notificationTypes === 1;
    const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
    const stillInitializing = (notificationTypes === null || notificationTypes === undefined) && hasToken && notInvalid;
    
    const subscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);

    return {
      subscribed,
      notification_types: notificationTypes,
      invalid_identifier: player.invalid_identifier,
      last_active: player.last_active ? new Date(player.last_active * 1000).toISOString() : null,
      device_type: player.device_type,
    };
  } catch (e) {
    return { subscribed: false, error: e.message };
  }
}

async function main() {
  console.log('📱 Fetching all push subscriptions...\n');

  // Get all subscriptions
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, player_id, platform, is_active, subscribed, last_checked_at, last_active_at, invalid')
    .order('last_active_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('❌ Error fetching subscriptions:', error);
    process.exit(1);
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('📭 No subscriptions found');
    return;
  }

  console.log(`Found ${subscriptions.length} total subscription(s)\n`);

  // Get user info for all user IDs
  const userIds = [...new Set(subscriptions.map(s => s.user_id).filter(Boolean))];
  console.log(`Fetching user info for ${userIds.length} users...`);
  
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .in('id', userIds);

  if (userError) {
    console.warn('⚠️  Error fetching user info:', userError);
  }

  const userMap = new Map();
  if (users) {
    users.forEach(u => userMap.set(u.id, u));
    console.log(`Found ${users.length} users\n`);
  } else {
    console.warn('⚠️  No users found\n');
  }

  // Check OneSignal status for each (if credentials available)
  const results = [];
  console.log('Checking OneSignal subscription status...\n');
  
  for (const sub of subscriptions) {
    let oneSignalStatus = null;
    if (sub.player_id && ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      oneSignalStatus = await checkOneSignalSubscription(sub.player_id);
    }

    const user = userMap.get(sub.user_id);

    results.push({
      user: user?.name || 'Unknown',
      user_id: sub.user_id,
      player_id: sub.player_id ? sub.player_id.slice(0, 20) + '...' : null,
      platform: sub.platform,
      is_active: sub.is_active,
      subscribed_db: sub.subscribed,
      subscribed_onesignal: oneSignalStatus?.subscribed ?? null,
      last_active_at: sub.last_active_at,
      oneSignalStatus,
    });
  }

  // Group by user
  const byUser = new Map();
  results.forEach(r => {
    if (!byUser.has(r.user_id)) {
      byUser.set(r.user_id, []);
    }
    byUser.get(r.user_id).push(r);
  });

  // Print summary
  const subscribed = results.filter(r => r.subscribed_onesignal === true);
  const active = results.filter(r => r.is_active);
  
  console.log('📊 SUMMARY:');
  console.log(`   Total subscriptions: ${results.length}`);
  console.log(`   Active (DB): ${active.length}`);
  console.log(`   Subscribed (OneSignal): ${subscribed.length}`);
  console.log(`   Unique users: ${byUser.size}\n`);

  // Print by user
  console.log('👥 SUBSCRIPTIONS BY USER:\n');
  for (const [userId, devices] of byUser.entries()) {
    const user = devices[0];
    const subscribedDevices = devices.filter(d => d.subscribed_onesignal === true);
    
    console.log(`📱 ${user.user}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Devices: ${devices.length} (${subscribedDevices.length} subscribed)`);
    
    devices.forEach((device, idx) => {
      let status = '❓';
      if (device.subscribed_onesignal === true) {
        status = '✅';
      } else if (device.subscribed_onesignal === false) {
        status = '❌';
      } else if (device.is_active) {
        status = '🟢'; // Active in DB but OneSignal status unknown
      }
      
      console.log(`   ${idx + 1}. ${status} ${device.platform || 'unknown'} - ${device.player_id || 'no player ID'}`);
      console.log(`      Active (DB): ${device.is_active ? 'Yes' : 'No'}, Subscribed (DB): ${device.subscribed_db ? 'Yes' : 'No'}`);
      if (device.last_active_at) {
        console.log(`      Last active: ${device.last_active_at}`);
      }
      if (device.oneSignalStatus?.error) {
        console.log(`      OneSignal error: ${device.oneSignalStatus.error}`);
      } else if (device.subscribed_onesignal === true) {
        console.log(`      ✅ Subscribed in OneSignal`);
      } else if (device.subscribed_onesignal === false) {
        console.log(`      ❌ Not subscribed in OneSignal`);
      }
    });
    console.log('');
  }

  // Print subscribed users only
  if (subscribed.length > 0) {
    console.log('\n✅ CURRENTLY SUBSCRIBED USERS:\n');
    const subscribedUsers = new Set();
    subscribed.forEach(s => subscribedUsers.add(s.user));
    subscribedUsers.forEach(user => {
      const userDevices = results.filter(r => r.user === user && r.subscribed_onesignal === true);
      console.log(`   ✅ ${user} (${userDevices.length} device${userDevices.length > 1 ? 's' : ''})`);
    });
  }
}

main().catch(console.error);
