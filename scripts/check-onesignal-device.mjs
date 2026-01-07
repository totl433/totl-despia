#!/usr/bin/env node
/**
 * Check device status in OneSignal
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || process.env.VITE_ONESIGNAL_REST_API_KEY;
const jofUserId = '4542c037-5b38-40d0-b189-847b8f17c222';
const playerId = 'f704dbd2-1d5e-476e-81cc-72f4bd';

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.error('❌ Missing OneSignal credentials');
  process.exit(1);
}

try {
  const url = `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    console.error('❌ OneSignal API error:', res.status, error);
    process.exit(1);
  }

  const player = await res.json();

  console.log('\n=== DEVICE STATUS IN ONESIGNAL ===');
  console.log('Player ID:', player.id?.slice(0, 30) + '...');
  console.log('External User ID:', player.external_user_id || '❌ NOT SET');
  console.log('Subscribed:', player.subscription?.enabled !== false && !player.invalid_identifier);
  console.log('Invalid Identifier:', player.invalid_identifier);
  console.log('Has Token:', !!player.identifier);
  console.log('Notification Types:', player.notification_types);
  console.log('Last Active:', player.last_active ? new Date(player.last_active * 1000).toLocaleString() : 'Never');
  
  console.log('\n=== EXPECTED ===');
  console.log('External User ID should be:', jofUserId);
  
  console.log('\n=== DIAGNOSIS ===');
  let issues = [];
  
  if (player.external_user_id !== jofUserId) {
    issues.push('❌ External User ID is NOT set correctly!');
    issues.push(`   Expected: ${jofUserId}`);
    issues.push(`   Actual: ${player.external_user_id || 'NOT SET'}`);
  } else {
    console.log('✅ External User ID is set correctly');
  }
  
  if (player.invalid_identifier) {
    issues.push('❌ Device identifier is invalid');
  }
  
  if (!player.identifier) {
    issues.push('❌ Device has no push token (APNs/FCM)');
  }
  
  if (player.subscription?.enabled === false) {
    issues.push('❌ Device subscription is explicitly disabled');
  }
  
  if (player.notification_types === -2) {
    issues.push('❌ User unsubscribed from notifications');
  }
  
  if (player.notification_types === 0) {
    issues.push('❌ Notifications disabled');
  }
  
  if (issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:');
    issues.forEach(issue => console.log(issue));
  } else {
    console.log('\n✅ Device appears to be properly configured');
  }
  
  // Check last active time
  if (player.last_active) {
    const lastActive = new Date(player.last_active * 1000);
    const minutesAgo = Math.floor((Date.now() - lastActive.getTime()) / 1000 / 60);
    console.log(`\n📱 Last active: ${minutesAgo} minutes ago`);
    if (minutesAgo > 30) {
      console.log('⚠️  Device has been inactive for a while - OneSignal may have unsubscribed it');
    }
  }
  
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}













