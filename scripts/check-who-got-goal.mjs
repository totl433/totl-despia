#!/usr/bin/env node
/**
 * Check who got the recent goal notification
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWhoGotGoal() {
  console.log('🔍 Checking who got the recent goal notification\n');
  console.log('='.repeat(70));

  // Get recent goal-scored notifications (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: recentLogs } = await supabase
    .from('notification_send_log')
    .select('user_id, result, created_at, event_id')
    .eq('notification_key', 'goal-scored')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false });

  if (!recentLogs || recentLogs.length === 0) {
    console.log('No recent goal notifications found');
    return;
  }

  // Group by user (keep most recent per user)
  const byUser = {};
  recentLogs.forEach(log => {
    if (!byUser[log.user_id] || new Date(log.created_at) > new Date(byUser[log.user_id].created_at)) {
      byUser[log.user_id] = log;
    }
  });

  console.log('\n👥 APP USERS - GOAL NOTIFICATION STATUS:');
  console.log('-'.repeat(70));

  const gotIt = [];
  const didntGetIt = [];
  const noAttempt = [];

  APP_USERS.forEach(user => {
    const log = byUser[user.id];
    if (!log) {
      noAttempt.push(user.name);
      console.log(`  ❓ ${user.name}: No notification attempt found`);
    } else {
      const emoji = log.result === 'accepted' ? '✅' : '⏸️';
      const time = new Date(log.created_at).toLocaleTimeString();
      if (log.result === 'accepted') {
        gotIt.push(user.name);
        console.log(`  ${emoji} ${user.name}: GOT IT [${time}]`);
      } else {
        didntGetIt.push(user.name);
        console.log(`  ${emoji} ${user.name}: ${log.result} [${time}]`);
      }
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY:');
  console.log(`  ✅ Got it: ${gotIt.length}/${APP_USERS.length} - ${gotIt.join(', ') || 'none'}`);
  console.log(`  ⏸️  Didn't get it: ${didntGetIt.length}/${APP_USERS.length} - ${didntGetIt.join(', ') || 'none'}`);
  if (noAttempt.length > 0) {
    console.log(`  ❓ No attempt: ${noAttempt.length}/${APP_USERS.length} - ${noAttempt.join(', ')}`);
  }

  // Show all users who got it
  console.log('\n\n✅ ALL USERS WHO GOT IT:');
  console.log('-'.repeat(70));
  const allAccepted = recentLogs.filter(l => l.result === 'accepted');
  console.log(`Total: ${allAccepted.length} users received the notification`);
  
  // Try to get user names
  const userIds = [...new Set(allAccepted.map(l => l.user_id))];
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds.slice(0, 30)); // Limit to 30

    if (users) {
      const nameMap = {};
      users.forEach(u => { nameMap[u.id] = u.name; });
      
      // Group by event_id to show which goal
      const byEvent = {};
      allAccepted.forEach(log => {
        if (!byEvent[log.event_id]) {
          byEvent[log.event_id] = [];
        }
        byEvent[log.event_id].push(log);
      });

      Object.keys(byEvent).forEach(eventId => {
        const logs = byEvent[eventId];
        const firstLog = logs[0];
        const time = new Date(firstLog.created_at).toLocaleTimeString();
        console.log(`\n  Goal Event ${eventId.slice(0, 8)}... [${time}]:`);
        logs.forEach(log => {
          const name = nameMap[log.user_id] || log.user_id.slice(0, 8) + '...';
          console.log(`    ✅ ${name}`);
        });
      });
    }
  }

  // Show recent suppressed/failed attempts
  const suppressed = recentLogs.filter(l => l.result !== 'accepted' && l.result !== 'failed');
  if (suppressed.length > 0) {
    console.log('\n\n⏸️  SUPPRESSED/FILTERED:');
    console.log('-'.repeat(70));
    const byResult = {};
    suppressed.forEach(log => {
      if (!byResult[log.result]) {
        byResult[log.result] = 0;
      }
      byResult[log.result]++;
    });
    Object.keys(byResult).forEach(result => {
      console.log(`  ${result}: ${byResult[result]} users`);
    });
  }
}

checkWhoGotGoal();






