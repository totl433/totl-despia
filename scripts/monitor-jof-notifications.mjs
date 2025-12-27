#!/usr/bin/env node
/**
 * Monitor Jof's notifications in real-time
 * 
 * Usage:
 *   node scripts/monitor-jof-notifications.mjs
 * 
 * This script checks:
 * - Push subscription status
 * - Notification preferences
 * - Recent notification send logs
 * - Failed/suppressed notifications
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function monitorJofNotifications() {
  console.log('🔍 Monitoring notifications for Jof\n');
  console.log(`User ID: ${JOF_USER_ID}\n`);
  console.log('=' .repeat(60));

  try {
    // 1. Check push subscription status
    console.log('\n📱 PUSH SUBSCRIPTION STATUS:');
    console.log('-'.repeat(60));
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', JOF_USER_ID)
      .order('created_at', { ascending: false });

    if (subError) {
      console.error('❌ Error:', subError);
    } else if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️  No push subscriptions found');
    } else {
      subscriptions.forEach((sub, i) => {
        console.log(`\nDevice ${i + 1}:`);
        console.log(`  Player ID: ${sub.player_id?.slice(0, 16)}...`);
        console.log(`  Platform: ${sub.platform}`);
        console.log(`  Active: ${sub.is_active ? '✅' : '❌'}`);
        console.log(`  Subscribed: ${sub.subscribed ? '✅' : '❌'}`);
        console.log(`  Last checked: ${sub.last_checked_at || 'Never'}`);
        console.log(`  Last active: ${sub.last_active_at || 'Never'}`);
        console.log(`  Invalid: ${sub.invalid ? '⚠️  YES' : '✅ No'}`);
      });
    }

    // 2. Check notification preferences
    console.log('\n\n⚙️  NOTIFICATION PREFERENCES:');
    console.log('-'.repeat(60));
    const { data: prefs, error: prefsError } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', JOF_USER_ID)
      .maybeSingle();

    if (prefsError) {
      console.error('❌ Error:', prefsError);
    } else if (!prefs) {
      console.log('ℹ️  No preferences set (using defaults)');
    } else {
      console.log('Preferences:', JSON.stringify(prefs.preferences, null, 2));
      console.log(`Updated: ${prefs.updated_at}`);
    }

    // 3. Recent notification send logs (last 24 hours)
    console.log('\n\n📨 RECENT NOTIFICATIONS (Last 24 hours):');
    console.log('-'.repeat(60));
    const { data: logs, error: logsError } = await supabase
      .from('notification_send_log')
      .select('*')
      .eq('user_id', JOF_USER_ID)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (logsError) {
      console.error('❌ Error:', logsError);
    } else if (!logs || logs.length === 0) {
      console.log('ℹ️  No notifications sent in the last 24 hours');
    } else {
      console.log(`Found ${logs.length} notification attempts:\n`);
      
      // Group by result
      const byResult = logs.reduce((acc, log) => {
        const result = log.result || 'unknown';
        if (!acc[result]) acc[result] = [];
        acc[result].push(log);
        return acc;
      }, {});

      Object.entries(byResult).forEach(([result, resultLogs]) => {
        const emoji = result === 'accepted' ? '✅' : result === 'failed' ? '❌' : result.startsWith('suppressed') ? '⏸️' : '❓';
        console.log(`${emoji} ${result}: ${resultLogs.length} notifications`);
      });

      console.log('\n📋 Recent notifications:');
      logs.slice(0, 10).forEach((log) => {
        const emoji = log.result === 'accepted' ? '✅' : log.result === 'failed' ? '❌' : log.result?.startsWith('suppressed') ? '⏸️' : '❓';
        const time = new Date(log.created_at).toLocaleTimeString();
        console.log(`  ${emoji} [${time}] ${log.notification_key} (${log.event_id?.slice(0, 8)}...) - ${log.result}`);
        if (log.error) {
          console.log(`     Error: ${JSON.stringify(log.error).slice(0, 100)}...`);
        }
      });
    }

    // 4. Summary statistics
    console.log('\n\n📊 SUMMARY (Last 24 hours):');
    console.log('-'.repeat(60));
    const { data: summary, error: summaryError } = await supabase
      .from('notification_send_log')
      .select('result')
      .eq('user_id', JOF_USER_ID)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!summaryError && summary) {
      const counts = summary.reduce((acc, log) => {
        const result = log.result || 'unknown';
        acc[result] = (acc[result] || 0) + 1;
        return acc;
      }, {});

      Object.entries(counts).forEach(([result, count]) => {
        const emoji = result === 'accepted' ? '✅' : result === 'failed' ? '❌' : result.startsWith('suppressed') ? '⏸️' : '❓';
        console.log(`  ${emoji} ${result}: ${count}`);
      });
    }

    // 5. Failed/suppressed notifications with details
    console.log('\n\n⚠️  FAILED/SUPPRESSED NOTIFICATIONS (Last 24 hours):');
    console.log('-'.repeat(60));
    const { data: failures, error: failuresError } = await supabase
      .from('notification_send_log')
      .select('*')
      .eq('user_id', JOF_USER_ID)
      .in('result', ['failed', 'suppressed_unsubscribed', 'suppressed_preference', 'suppressed_cooldown'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (failuresError) {
      console.error('❌ Error:', failuresError);
    } else if (!failures || failures.length === 0) {
      console.log('✅ No failed/suppressed notifications');
    } else {
      failures.forEach((log) => {
        const time = new Date(log.created_at).toLocaleString();
        console.log(`\n  [${time}] ${log.notification_key}`);
        console.log(`  Result: ${log.result}`);
        if (log.error) {
          console.log(`  Error: ${JSON.stringify(log.error)}`);
        }
        if (log.targeting_summary) {
          console.log(`  Targeting: ${JSON.stringify(log.targeting_summary)}`);
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 Tip: Run this script again after a realtime update to see new notifications');
    console.log('   Example: watch -n 5 node scripts/monitor-jof-notifications.mjs\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

monitorJofNotifications();

