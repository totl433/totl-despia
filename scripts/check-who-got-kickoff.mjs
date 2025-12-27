#!/usr/bin/env node
/**
 * Check who got the recent kickoff notification
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

async function checkWhoGotKickoff() {
  console.log('🔍 Checking who got the kickoff notification\n');
  console.log('='.repeat(70));

  // Get recent kickoff notifications (last 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: recentLogs } = await supabase
    .from('notification_send_log')
    .select('user_id, result, created_at')
    .eq('notification_key', 'kickoff')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false });

  if (!recentLogs || recentLogs.length === 0) {
    console.log('No recent kickoff notifications found');
    return;
  }

  // Group by user
  const byUser = {};
  recentLogs.forEach(log => {
    if (!byUser[log.user_id]) {
      byUser[log.user_id] = log; // Keep most recent
    }
  });

  console.log('\n👥 APP USERS - KICKOFF NOTIFICATION STATUS:');
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
  console.log(`  ✅ Got it: ${gotIt.length}/8 - ${gotIt.join(', ')}`);
  console.log(`  ⏸️  Didn't get it: ${didntGetIt.length}/8 - ${didntGetIt.join(', ')}`);
  if (noAttempt.length > 0) {
    console.log(`  ❓ No attempt: ${noAttempt.length}/8 - ${noAttempt.join(', ')}`);
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
      .in('id', userIds.slice(0, 20)); // Limit to 20

    if (users) {
      const nameMap = {};
      users.forEach(u => { nameMap[u.id] = u.name; });
      
      allAccepted.forEach(log => {
        const name = nameMap[log.user_id] || log.user_id.slice(0, 8) + '...';
        const time = new Date(log.created_at).toLocaleTimeString();
        console.log(`  ✅ ${name} [${time}]`);
      });
    }
  }
}

checkWhoGotKickoff();

