#!/usr/bin/env node
/**
 * Check who got the full-time notification
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

async function checkWhoGotFullTime() {
  console.log('🔍 Checking who got the full-time notification\n');
  console.log('='.repeat(70));

  // Get recent final-whistle notifications (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: recentLogs } = await supabase
    .from('notification_send_log')
    .select('user_id, result, created_at, event_id, payload_summary')
    .eq('notification_key', 'final-whistle')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false });

  if (!recentLogs || recentLogs.length === 0) {
    console.log('No recent full-time notifications found');
    return;
  }

  // Group by event_id (match)
  const byEvent = {};
  recentLogs.forEach(log => {
    const eventId = log.event_id;
    if (!byEvent[eventId]) {
      byEvent[eventId] = [];
    }
    byEvent[eventId].push(log);
  });

  Object.keys(byEvent).forEach(eventId => {
    const logs = byEvent[eventId];
    const firstLog = logs[0];
    const time = new Date(firstLog.created_at).toLocaleTimeString();
    const matchId = eventId.split(':')[1] || 'unknown';
    
    console.log(`\n📊 Full-Time - Match ${matchId} [${time}]:`);
    console.log('-'.repeat(70));

    const appUserResults = {};
    logs.forEach(log => {
      const name = APP_USERS.find(u => u.id === log.user_id)?.name || 'Other';
      if (!appUserResults[name] || log.result === 'accepted') {
        appUserResults[name] = log.result;
      }
    });

    const gotIt = [];
    const didntGetIt = [];
    const noAttempt = [];

    APP_USERS.forEach(user => {
      const result = appUserResults[user.name] || 'no attempt';
      const emoji = result === 'accepted' ? '✅' : result === 'suppressed_unsubscribed' ? '⏸️' : '❓';
      
      if (result === 'accepted') {
        gotIt.push(user.name);
        console.log(`  ${emoji} ${user.name}: GOT IT`);
      } else if (result === 'no attempt') {
        noAttempt.push(user.name);
        console.log(`  ${emoji} ${user.name}: No notification attempt`);
      } else {
        didntGetIt.push(user.name);
        console.log(`  ${emoji} ${user.name}: ${result}`);
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 SUMMARY:`);
    console.log(`  ✅ Got it: ${gotIt.length}/${APP_USERS.length} - ${gotIt.join(', ') || 'none'}`);
    if (didntGetIt.length > 0) {
      console.log(`  ⏸️  Didn't get it: ${didntGetIt.length}/${APP_USERS.length} - ${didntGetIt.join(', ')}`);
    }
    if (noAttempt.length > 0) {
      console.log(`  ❓ No attempt: ${noAttempt.length}/${APP_USERS.length} - ${noAttempt.join(', ')}`);
    }
  });
}

checkWhoGotFullTime();








