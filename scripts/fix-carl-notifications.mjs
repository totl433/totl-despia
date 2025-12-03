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
      return { subscribed: false, player: null };
    }

    const player = await r.json();
    const hasToken = !!player.identifier;
    const notInvalid = !player.invalid_identifier;
    const notificationTypes = player.notification_types;
    
    const explicitlySubscribed = notificationTypes === 1;
    const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
    const stillInitializing = (notificationTypes === null || notificationTypes === undefined) && hasToken && notInvalid;
    
    const subscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);

    return { subscribed, player };
  } catch (e) {
    console.error(`Error checking subscription for ${playerId}:`, e);
    return { subscribed: false, player: null };
  }
}

async function fixCarlNotifications() {
  console.log('🔧 Fixing Carl\'s notification setup...\n');
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

    // Check each device's OneSignal subscription status
    let activeCount = 0;
    let subscribedCount = 0;

    for (const sub of subscriptions) {
      console.log(`Checking device: ${sub.player_id?.slice(0, 20)}...`);
      console.log(`  Current status: is_active=${sub.is_active}, subscribed=${sub.subscribed}`);

      if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
        const { subscribed, player } = await isSubscribed(
          sub.player_id,
          ONESIGNAL_APP_ID,
          ONESIGNAL_REST_API_KEY
        );

        console.log(`  OneSignal status: ${subscribed ? '✅ SUBSCRIBED' : '❌ NOT SUBSCRIBED'}`);
        
        if (player) {
          console.log(`  - Has token: ${!!player.identifier}`);
          console.log(`  - Invalid: ${player.invalid_identifier ? '⚠️  YES' : '✅ No'}`);
          console.log(`  - Notification types: ${player.notification_types ?? 'null'}`);
        }

        // Update subscription status in database
        const shouldBeActive = subscribed && !player?.invalid_identifier;
        
        if (sub.is_active !== shouldBeActive || sub.subscribed !== subscribed) {
          console.log(`  🔄 Updating: is_active=${shouldBeActive}, subscribed=${subscribed}`);
          
          const { error: updateError } = await supabase
            .from('push_subscriptions')
            .update({
              is_active: shouldBeActive,
              subscribed: subscribed,
              last_checked_at: new Date().toISOString(),
              invalid: player ? !!player.invalid_identifier : false,
              os_payload: player || null,
            })
            .eq('id', sub.id);

          if (updateError) {
            console.error(`  ❌ Failed to update:`, updateError);
          } else {
            console.log(`  ✅ Updated successfully`);
            if (shouldBeActive) activeCount++;
            if (subscribed) subscribedCount++;
          }
        } else {
          console.log(`  ✅ Status is correct`);
          if (sub.is_active) activeCount++;
          if (sub.subscribed) subscribedCount++;
        }
      } else {
        console.log(`  ⚠️  Cannot check OneSignal (missing credentials)`);
        // Just mark the most recent as active if we can't check
        if (sub === subscriptions[0] && !sub.is_active) {
          console.log(`  🔄 Marking most recent device as active`);
          const { error: updateError } = await supabase
            .from('push_subscriptions')
            .update({ is_active: true })
            .eq('id', sub.id);
          
          if (!updateError) {
            activeCount++;
            console.log(`  ✅ Marked as active`);
          }
        }
      }
      
      console.log('');
    }

    console.log(`\n📊 Summary:`);
    console.log(`  - Total devices: ${subscriptions.length}`);
    console.log(`  - Active devices: ${activeCount}`);
    console.log(`  - Subscribed devices: ${subscribedCount}`);

    if (activeCount === 0) {
      console.log(`\n⚠️  WARNING: No active devices found!`);
      console.log(`   Carl needs to:`);
      console.log(`   1. Open the app`);
      console.log(`   2. Ensure he's signed in`);
      console.log(`   3. The app should automatically re-register his device`);
    } else {
      console.log(`\n✅ Carl should now receive notifications on ${activeCount} device(s)`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixCarlNotifications().catch(console.error);

