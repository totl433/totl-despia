#!/usr/bin/env node
/**
 * Check notifications for specific users
 * 
 * Usage:
 *   node scripts/check-specific-users-notifications.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const JOF_USER_ID = '4542c037-5b38-40d0-b189-847b8f17c222';
const THOMAS_USER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'; // Update with actual ID

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificUsers() {
  console.log('🔍 Checking notifications for Jof and ThomasJamesBird\n');
  console.log('='.repeat(60));

  try {
    // Get recent half-time notifications (last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: recentLogs, error: logsError } = await supabase
      .from('notification_send_log')
      .select('*')
      .eq('notification_key', 'half-time')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('❌ Error fetching logs:', logsError);
      return;
    }

    if (!recentLogs || recentLogs.length === 0) {
      console.log('ℹ️  No half-time notifications found in last 30 minutes');
      return;
    }

    console.log(`\n📨 Found ${recentLogs.length} half-time notification attempts\n`);

    // Check Jof
    const jofLogs = recentLogs.filter(log => log.user_id === JOF_USER_ID);
    console.log('👤 JOF:');
    console.log('-'.repeat(60));
    if (jofLogs.length === 0) {
      console.log('❌ No half-time notifications found for Jof');
    } else {
      jofLogs.forEach(log => {
        const time = new Date(log.created_at).toLocaleString();
        const emoji = log.result === 'accepted' ? '✅' : log.result === 'failed' ? '❌' : log.result?.startsWith('suppressed') ? '⏸️' : '❓';
        console.log(`  ${emoji} [${time}] Result: ${log.result}`);
        if (log.error) {
          console.log(`     Error: ${JSON.stringify(log.error)}`);
        }
        if (log.reason) {
          console.log(`     Reason: ${log.reason}`);
        }
        if (log.targeting_summary) {
          console.log(`     Targeting: ${JSON.stringify(log.targeting_summary)}`);
        }
      });
    }

    // Check ThomasJamesBird - first find their user ID
    console.log('\n\n👤 THOMASJAMESBIRD:');
    console.log('-'.repeat(60));
    
    // Try to find ThomasJamesBird's user ID
    const { data: thomasUser, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', '%thomas%bird%')
      .limit(5);

    if (userError) {
      console.error('❌ Error finding Thomas:', userError);
    } else if (thomasUser && thomasUser.length > 0) {
      console.log(`Found user: ${thomasUser[0].name} (${thomasUser[0].id})`);
      
      const thomasLogs = recentLogs.filter(log => log.user_id === thomasUser[0].id);
      if (thomasLogs.length === 0) {
        console.log('❌ No half-time notifications found for ThomasJamesBird');
      } else {
        thomasLogs.forEach(log => {
          const time = new Date(log.created_at).toLocaleString();
          const emoji = log.result === 'accepted' ? '✅' : log.result === 'failed' ? '❌' : log.result?.startsWith('suppressed') ? '⏸️' : '❓';
          console.log(`  ${emoji} [${time}] Result: ${log.result}`);
          if (log.error) {
            console.log(`     Error: ${JSON.stringify(log.error)}`);
          }
          if (log.reason) {
            console.log(`     Reason: ${log.reason}`);
          }
          if (log.targeting_summary) {
            console.log(`     Targeting: ${JSON.stringify(log.targeting_summary)}`);
          }
        });
      }
    } else {
      console.log('⚠️  Could not find ThomasJamesBird user');
    }

    // Show all recent half-time notifications for comparison
    console.log('\n\n📋 ALL RECENT HALF-TIME NOTIFICATIONS:');
    console.log('-'.repeat(60));
    recentLogs.slice(0, 20).forEach((log) => {
      const time = new Date(log.created_at).toLocaleTimeString();
      const emoji = log.result === 'accepted' ? '✅' : log.result === 'failed' ? '❌' : log.result?.startsWith('suppressed') ? '⏸️' : '❓';
      const isJof = log.user_id === JOF_USER_ID;
      const marker = isJof ? '👤 JOF' : '  ';
      console.log(`${marker} ${emoji} [${time}] User ${log.user_id.slice(0, 8)}... - ${log.result}`);
      if (log.error) {
        console.log(`     Error: ${JSON.stringify(log.error).slice(0, 150)}...`);
      }
    });

    // Summary
    console.log('\n\n📊 SUMMARY:');
    console.log('-'.repeat(60));
    const accepted = recentLogs.filter(l => l.result === 'accepted').length;
    const failed = recentLogs.filter(l => l.result === 'failed').length;
    const suppressed = recentLogs.filter(l => l.result?.startsWith('suppressed')).length;
    console.log(`Total attempts: ${recentLogs.length}`);
    console.log(`✅ Accepted: ${accepted}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏸️  Suppressed: ${suppressed}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

checkSpecificUsers();







