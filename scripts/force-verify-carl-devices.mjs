import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.error('Missing OneSignal environment variables');
  console.error('This script needs OneSignal credentials to verify subscription status');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

// Check if a Player ID is subscribed in OneSignal
async function isSubscribed(playerId, appId, restKey) {
  const OS_BASE = 'https://onesignal.com/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${restKey}`,
  };

  try {
    const url = `${OS_BASE}/players/${playerId}?app_id=${appId}`;
    const r = await fetch(url, { headers });
    
    if (!r.ok) {
      const errorText = await r.text().catch(() => 'Unknown error');
      return { subscribed: false, player: null, error: `HTTP ${r.status}: ${errorText}` };
    }

    const player = await r.json();
    const hasToken = !!player.identifier;
    const notInvalid = !player.invalid_identifier;
    const notificationTypes = player.notification_types;
    
    const explicitlySubscribed = notificationTypes === 1;
    const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
    const stillInitializing = (notificationTypes === null || notificationTypes === undefined) && hasToken && notInvalid;
    
    const subscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);

    return { subscribed, player, error: null };
  } catch (e) {
    console.error(`Error checking subscription for ${playerId}:`, e);
    return { subscribed: false, player: null, error: e.message };
  }
}

async function forceVerifyCarlDevices() {
  console.log('🔧 Force verifying all of Carl\'s devices against OneSignal...\n');
  console.log(`User ID: ${CARL_USER_ID}\n`);

  try {
    // Get all Carl's subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', CARL_USER_ID)
      .order('created_at', { ascending: false });

    if (subsError) {
      console.error('❌ Error fetching subscriptions:', subsError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('❌ No subscriptions found. Carl needs to register his device via the app.');
      return;
    }

    console.log(`Found ${subscriptions.length} device(s)\n`);

    const results = [];
    let activeSubscribedDevice = null;

    // Check each device against OneSignal
    for (const sub of subscriptions) {
      console.log(`Checking device: ${sub.player_id?.slice(0, 30)}...`);
      console.log(`  Platform: ${sub.platform || 'unknown'}`);
      console.log(`  Created: ${sub.created_at}`);
      console.log(`  Current DB status: is_active=${sub.is_active}, subscribed=${sub.subscribed}`);

      const { subscribed, player, error } = await isSubscribed(
        sub.player_id,
        ONESIGNAL_APP_ID,
        ONESIGNAL_REST_API_KEY
      );

      if (error) {
        console.log(`  ❌ Error checking OneSignal: ${error}`);
        results.push({
          player_id: sub.player_id,
          error,
          updated: false,
        });
        continue;
      }

      const hasToken = !!player?.identifier;
      const isInvalid = player?.invalid_identifier || false;
      const notificationTypes = player?.notification_types;
      const lastActive = player?.last_active ? new Date(player.last_active * 1000).toISOString() : null;

      console.log(`  OneSignal status: ${subscribed ? '✅ SUBSCRIBED' : '❌ NOT SUBSCRIBED'}`);
      console.log(`  - Has token: ${hasToken ? '✅' : '❌'}`);
      console.log(`  - Invalid: ${isInvalid ? '⚠️  YES' : '✅ No'}`);
      console.log(`  - Notification types: ${notificationTypes ?? 'null'}`);
      if (lastActive) {
        console.log(`  - Last active: ${lastActive}`);
      }

      // Determine if device should be active
      // Device should be active if: subscribed AND not invalid
      const shouldBeActive = subscribed && !isInvalid;

      // Check if update is needed
      const needsUpdate = 
        sub.is_active !== shouldBeActive ||
        sub.subscribed !== subscribed ||
        sub.invalid !== isInvalid;

      if (needsUpdate) {
        console.log(`  🔄 Updating database:`);
        console.log(`     is_active: ${sub.is_active} → ${shouldBeActive}`);
        console.log(`     subscribed: ${sub.subscribed} → ${subscribed}`);
        console.log(`     invalid: ${sub.invalid} → ${isInvalid}`);

        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({
            is_active: shouldBeActive,
            subscribed: subscribed,
            invalid: isInvalid,
            last_checked_at: new Date().toISOString(),
            last_active_at: lastActive,
            os_payload: player || null,
          })
          .eq('id', sub.id);

        if (updateError) {
          console.error(`  ❌ Failed to update:`, updateError);
          results.push({
            player_id: sub.player_id,
            subscribed,
            shouldBeActive,
            updated: false,
            error: updateError.message,
          });
        } else {
          console.log(`  ✅ Updated successfully`);
          results.push({
            player_id: sub.player_id,
            subscribed,
            shouldBeActive,
            updated: true,
          });

          // Track the most recent subscribed device
          if (shouldBeActive && !activeSubscribedDevice) {
            activeSubscribedDevice = {
              ...sub,
              is_active: shouldBeActive,
              subscribed: subscribed,
            };
          }
        }
      } else {
        console.log(`  ✅ Status is correct, no update needed`);
        results.push({
          player_id: sub.player_id,
          subscribed,
          shouldBeActive,
          updated: false,
          alreadyCorrect: true,
        });

        // Track the most recent subscribed device
        if (shouldBeActive && !activeSubscribedDevice) {
          activeSubscribedDevice = {
            ...sub,
            is_active: shouldBeActive,
            subscribed: subscribed,
          };
        }
      }

      console.log('');
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`  Total devices checked: ${subscriptions.length}`);
    const updated = results.filter(r => r.updated).length;
    const alreadyCorrect = results.filter(r => r.alreadyCorrect).length;
    const errors = results.filter(r => r.error).length;
    const subscribed = results.filter(r => r.subscribed).length;
    const active = results.filter(r => r.shouldBeActive).length;

    console.log(`  Updated: ${updated}`);
    console.log(`  Already correct: ${alreadyCorrect}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Subscribed in OneSignal: ${subscribed}`);
    console.log(`  Active & subscribed: ${active}`);

    if (activeSubscribedDevice) {
      console.log(`\n✅ Found active subscribed device:`);
      console.log(`   Player ID: ${activeSubscribedDevice.player_id?.slice(0, 30)}...`);
      console.log(`   Carl should receive notifications on this device.`);
    } else {
      console.log(`\n⚠️  WARNING: No active subscribed devices found!`);
      console.log(`   Carl will NOT receive notifications until:`);
      console.log(`   1. He enables notifications in iOS Settings → Notifications → TotL`);
      console.log(`   2. The app re-registers his device (happens automatically on next login)`);
      console.log(`   3. OneSignal confirms the device is subscribed`);
    }

    // Show any errors
    if (errors > 0) {
      console.log(`\n❌ Errors encountered:`);
      results.filter(r => r.error).forEach(r => {
        console.log(`   ${r.player_id?.slice(0, 20)}...: ${r.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

forceVerifyCarlDevices().catch(console.error);

