#!/usr/bin/env node
/**
 * Script to diagnose why kickoff notifications aren't being sent for GW16
 * Checks:
 * 1. If fixtures exist in app_fixtures for GW16
 * 2. If users have picks in app_picks for GW16
 * 3. If users have active push subscriptions
 * 4. If subscriptions are valid in OneSignal
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

async function checkKickoffNotifications() {
  console.log('\n🔍 Diagnosing GW16 Kickoff Notifications...\n');

  const gw = 16;

  try {
    // 1. Check if fixtures exist in app_fixtures for GW16
    console.log('1️⃣ Checking app_fixtures for GW16...');
    const { data: fixtures, error: fixturesError } = await supabase
      .from('app_fixtures')
      .select('fixture_index, home_team, away_team, api_match_id, kickoff_time')
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (fixturesError) {
      console.error('❌ Error fetching fixtures:', fixturesError);
      return;
    }

    console.log(`✅ Found ${fixtures?.length || 0} fixtures for GW16\n`);

    if (!fixtures || fixtures.length === 0) {
      console.log('⚠️  No fixtures found for GW16 in app_fixtures');
      return;
    }

    // 2. Check if users have picks in app_picks for GW16
    console.log('2️⃣ Checking app_picks for GW16...');
    const { data: picks, error: picksError } = await supabase
      .from('app_picks')
      .select('user_id, fixture_index, pick')
      .eq('gw', gw);

    if (picksError) {
      console.error('❌ Error fetching picks:', picksError);
      return;
    }

    const uniqueUserIds = [...new Set((picks || []).map(p => p.user_id))];
    console.log(`✅ Found ${picks?.length || 0} picks from ${uniqueUserIds.length} unique users\n`);

    if (uniqueUserIds.length === 0) {
      console.log('⚠️  No users have picks for GW16 in app_picks');
      console.log('   This is why kickoff notifications aren\'t being sent!\n');
      return;
    }

    // 3. Check if users have active push subscriptions
    console.log('3️⃣ Checking push_subscriptions...');
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, player_id, is_active')
      .in('user_id', uniqueUserIds)
      .eq('is_active', true);

    if (subsError) {
      console.error('❌ Error fetching subscriptions:', subsError);
      return;
    }

    const usersWithSubs = [...new Set((subscriptions || []).map(s => s.user_id))];
    console.log(`✅ Found ${subscriptions?.length || 0} active subscriptions for ${usersWithSubs.length} users\n`);

    if (usersWithSubs.length === 0) {
      console.log('⚠️  No active push subscriptions found for users with picks');
      console.log('   Users need to enable notifications in the app!\n');
      return;
    }

    // 4. Check OneSignal subscription status (if credentials available)
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      console.log('4️⃣ Checking OneSignal subscription status...');
      const playerIds = (subscriptions || []).map(s => s.player_id).filter(Boolean);
      console.log(`   Checking ${playerIds.length} player IDs...\n`);

      let subscribedCount = 0;
      let unsubscribedCount = 0;
      let errorCount = 0;

      for (const playerId of playerIds.slice(0, 10)) { // Check first 10 to avoid rate limits
        try {
          const url = `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;
          const resp = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
          });

          if (resp.ok) {
            const player = await resp.json();
            const notificationTypes = player.notification_types;
            const hasToken = !!player.identifier;
            const notInvalid = !player.invalid_identifier;
            const isSubscribed = notificationTypes === 1 || (hasToken && notInvalid && notificationTypes !== -2 && notificationTypes !== 0);
            
            if (isSubscribed) {
              subscribedCount++;
            } else {
              unsubscribedCount++;
              console.log(`   ⚠️  Player ${playerId.slice(0, 20)}... not subscribed (notification_types: ${notificationTypes}, hasToken: ${hasToken}, invalid: ${player.invalid_identifier})`);
            }
          } else {
            errorCount++;
            console.log(`   ❌ Error checking player ${playerId.slice(0, 20)}...: ${resp.status}`);
          }
        } catch (e) {
          errorCount++;
          console.log(`   ❌ Error checking player ${playerId.slice(0, 20)}...:`, e.message);
        }
      }

      console.log(`\n   Results: ${subscribedCount} subscribed, ${unsubscribedCount} unsubscribed, ${errorCount} errors`);
      if (unsubscribedCount > 0) {
        console.log('   ⚠️  Some devices are not subscribed in OneSignal - they won\'t receive notifications!\n');
      }
    } else {
      console.log('4️⃣ Skipping OneSignal check (credentials not available)\n');
    }

    // 5. Summary
    console.log('📊 Summary:');
    console.log(`   - Fixtures: ${fixtures.length}`);
    console.log(`   - Users with picks: ${uniqueUserIds.length}`);
    console.log(`   - Users with subscriptions: ${usersWithSubs.length}`);
    console.log(`   - Active subscriptions: ${subscriptions?.length || 0}`);
    
    if (usersWithSubs.length < uniqueUserIds.length) {
      const missing = uniqueUserIds.length - usersWithSubs.length;
      console.log(`\n   ⚠️  ${missing} user(s) have picks but no active subscriptions`);
    }

    // 6. Check a specific fixture
    if (fixtures.length > 0) {
      const firstFixture = fixtures[0];
      console.log(`\n6️⃣ Checking first fixture (index ${firstFixture.fixture_index}):`);
      const fixturePicks = (picks || []).filter(p => p.fixture_index === firstFixture.fixture_index);
      const fixtureUserIds = [...new Set(fixturePicks.map(p => p.user_id))];
      const fixtureSubs = (subscriptions || []).filter(s => fixtureUserIds.includes(s.user_id));
      
      console.log(`   - Users with picks: ${fixtureUserIds.length}`);
      console.log(`   - Users with subscriptions: ${fixtureSubs.length}`);
      console.log(`   - Total subscriptions: ${fixtureSubs.length}`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

checkKickoffNotifications();
