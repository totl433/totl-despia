#!/usr/bin/env node
/**
 * Simple check of who is registered - uses database only
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
  { id: '027502c5-1cd7-4922-abd5-f9bcc569bb4d', name: 'cakehurst' },
];

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Need: SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('Need: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRegistration() {
  console.log('🔍 Checking who is registered\n');
  console.log('='.repeat(80));

  // Get all active subscriptions
  const { data: allSubs, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, player_id, subscribed, last_checked_at')
    .eq('is_active', true)
    .order('last_checked_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n📱 TOTAL ACTIVE DEVICES IN DATABASE: ${allSubs?.length || 0}\n`);

  // Check each app user
  console.log('👥 APP USERS STATUS:');
  console.log('-'.repeat(80));

  for (const user of APP_USERS) {
    const sub = allSubs?.find(s => s.user_id === user.id);
    
    if (!sub) {
      console.log(`  ❌ ${user.name}: No active device in database`);
      continue;
    }

    console.log(`  📱 ${user.name}:`);
    console.log(`     Device: ${sub.player_id.slice(0, 16)}...`);
    console.log(`     Subscribed (DB): ${sub.subscribed ? '✅ Yes' : '❌ No'}`);
    console.log(`     Last checked: ${sub.last_checked_at ? new Date(sub.last_checked_at).toLocaleString() : 'Never'}`);
  }

  // Check recent notification results
  console.log('\n\n📨 RECENT HALF-TIME NOTIFICATION RESULTS:');
  console.log('-'.repeat(80));
  
  const { data: recentLogs } = await supabase
    .from('notification_send_log')
    .select('user_id, result, created_at')
    .eq('notification_key', 'half-time')
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (recentLogs) {
    // Group by user
    const byUser = {};
    recentLogs.forEach(log => {
      if (!byUser[log.user_id]) {
        byUser[log.user_id] = log;
      }
    });

    APP_USERS.forEach(user => {
      const log = byUser[user.id];
      if (log) {
        const emoji = log.result === 'accepted' ? '✅' : log.result === 'failed' ? '❌' : '⏸️';
        const time = new Date(log.created_at).toLocaleTimeString();
        console.log(`  ${emoji} ${user.name}: ${log.result} [${time}]`);
      } else {
        console.log(`  ❓ ${user.name}: No notification attempt found`);
      }
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY:');
  
  const withDevice = APP_USERS.filter(user => allSubs?.some(s => s.user_id === user.id)).length;
  const gotNotification = APP_USERS.filter(user => {
    const log = recentLogs?.find(l => l.user_id === user.id && l.result === 'accepted');
    return !!log;
  }).length;

  console.log(`  📱 Have active device: ${withDevice}/${APP_USERS.length}`);
  console.log(`  ✅ Got half-time notification: ${gotNotification}/${APP_USERS.length}`);
  console.log(`  ❌ Did NOT get notification: ${APP_USERS.length - gotNotification}/${APP_USERS.length}`);
}

checkRegistration();

