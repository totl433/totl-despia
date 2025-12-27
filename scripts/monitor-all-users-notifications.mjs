#!/usr/bin/env node
/**
 * Monitor notifications for all users (especially the 8 app users)
 * 
 * Usage:
 *   node scripts/monitor-all-users-notifications.mjs
 * 
 * This shows recent notification attempts for all users, with special focus on app users
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// The 8 app users (from APP_ONLY_USER_IDS)
const APP_USER_IDS = [
  '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
  '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
  '36f31625-6d6c-4aa4-815a-1493a812841b', // ThomasJamesBird
  'c94f9804-ba11-4cd2-8892-49657aa6412c', // Sim
  '42b48136-040e-42a3-9b0a-dc9550dd1cae', // Will Middleton
  'd2cbeca9-7dae-4be1-88fb-706911d67256', // David Bird
  '027502c5-1cd7-4922-abd5-f9bcc569bb4d', // cakehurst
];

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function monitorAllUsersNotifications() {
  console.log('🔍 Monitoring notifications for all users\n');
  console.log('='.repeat(60));

  try {
    // Get recent notifications (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: recentLogs, error: logsError } = await supabase
      .from('notification_send_log')
      .select('*')
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(200);

    if (logsError) {
      console.error('❌ Error fetching logs:', logsError);
      return;
    }

    if (!recentLogs || recentLogs.length === 0) {
      console.log('ℹ️  No notifications sent in the last 10 minutes');
      return;
    }

    console.log(`\n📨 Found ${recentLogs.length} notification attempts in last 10 minutes\n`);

    // Group by notification type
    const byType = recentLogs.reduce((acc, log) => {
      const type = log.notification_key || 'unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push(log);
      return acc;
    }, {});

    console.log('📊 By notification type:');
    Object.entries(byType).forEach(([type, logs]) => {
      const accepted = logs.filter(l => l.result === 'accepted').length;
      const failed = logs.filter(l => l.result === 'failed').length;
      const suppressed = logs.filter(l => l.result?.startsWith('suppressed')).length;
      console.log(`  ${type}: ${logs.length} total (${accepted} ✅, ${failed} ❌, ${suppressed} ⏸️)`);
    });

    // Group by result
    const byResult = recentLogs.reduce((acc, log) => {
      const result = log.result || 'unknown';
      if (!acc[result]) acc[result] = [];
      acc[result].push(log);
      return acc;
    }, {});

    console.log('\n📊 By result:');
    Object.entries(byResult).forEach(([result, logs]) => {
      const emoji = result === 'accepted' ? '✅' : result === 'failed' ? '❌' : result?.startsWith('suppressed') ? '⏸️' : '❓';
      console.log(`  ${emoji} ${result}: ${logs.length}`);
    });

    // Check app users specifically
    console.log('\n\n👥 APP USERS STATUS:');
    console.log('-'.repeat(60));
    
    const appUserLogs = recentLogs.filter(log => APP_USER_IDS.includes(log.user_id));
    
    if (appUserLogs.length === 0) {
      console.log('ℹ️  No notifications for app users in last 10 minutes');
    } else {
      // Group by user
      const byUser = appUserLogs.reduce((acc, log) => {
        if (!acc[log.user_id]) acc[log.user_id] = [];
        acc[log.user_id].push(log);
        return acc;
      }, {});

      Object.entries(byUser).forEach(([userId, logs]) => {
        const accepted = logs.filter(l => l.result === 'accepted').length;
        const failed = logs.filter(l => l.result === 'failed').length;
        const suppressed = logs.filter(l => l.result?.startsWith('suppressed')).length;
        
        const userName = userId === '4542c037-5b38-40d0-b189-847b8f17c222' ? 'Jof' :
                        userId === 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2' ? 'Carl' : 'Unknown';
        
        console.log(`\n${userName} (${userId.slice(0, 8)}...):`);
        console.log(`  Total: ${logs.length} notifications`);
        console.log(`  ✅ Accepted: ${accepted}`);
        console.log(`  ❌ Failed: ${failed}`);
        console.log(`  ⏸️  Suppressed: ${suppressed}`);
        
        // Show recent notifications
        logs.slice(0, 5).forEach(log => {
          const time = new Date(log.created_at).toLocaleTimeString();
          const emoji = log.result === 'accepted' ? '✅' : log.result === 'failed' ? '❌' : '⏸️';
          console.log(`    ${emoji} [${time}] ${log.notification_key} - ${log.result}`);
          if (log.error) {
            console.log(`       Error: ${JSON.stringify(log.error).slice(0, 100)}...`);
          }
        });
      });
    }

    // Show most recent notifications overall
    console.log('\n\n📋 MOST RECENT NOTIFICATIONS:');
    console.log('-'.repeat(60));
    recentLogs.slice(0, 20).forEach((log) => {
      const time = new Date(log.created_at).toLocaleTimeString();
      const emoji = log.result === 'accepted' ? '✅' : log.result === 'failed' ? '❌' : log.result?.startsWith('suppressed') ? '⏸️' : '❓';
      const isAppUser = APP_USER_IDS.includes(log.user_id);
      const marker = isAppUser ? '👤' : '  ';
      console.log(`${marker} ${emoji} [${time}] ${log.notification_key} - User ${log.user_id.slice(0, 8)}... - ${log.result}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 Run this script again after half-time to see who got notifications');
    console.log('   Example: watch -n 5 node scripts/monitor-all-users-notifications.mjs\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

monitorAllUsersNotifications();

