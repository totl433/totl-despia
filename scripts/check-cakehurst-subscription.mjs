import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

async function checkOneSignalSubscription(playerId) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return { subscribed: false, error: 'OneSignal credentials not configured' };
  }

  try {
    const url = `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
    });

    if (!response.ok) {
      return { subscribed: false, error: `OneSignal API error: ${response.status}` };
    }

    const player = await response.json();
    const hasToken = !!player.identifier;
    const notInvalid = !player.invalid_identifier;
    const notificationTypes = player.notification_types;
    
    const explicitlySubscribed = notificationTypes === 1;
    const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
    const stillInitializing = (notificationTypes === null || notificationTypes === undefined) && hasToken && notInvalid;
    
    const subscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);
    
    return {
      subscribed,
      player: {
        identifier: player.identifier,
        invalid_identifier: player.invalid_identifier,
        notification_types: player.notification_types,
        last_active: player.last_active,
      },
    };
  } catch (error) {
    return { subscribed: false, error: error.message };
  }
}

async function main() {
  // Find Cakehurst's user ID
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%cakehurst%');

  if (userError) {
    console.error('Error finding user:', userError);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('❌ No user found with name containing "cakehurst"');
    console.log('   Trying case-insensitive search...');
    
    // Try case-insensitive search
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, name')
      .limit(1000);
    
    const matches = allUsers?.filter(u => 
      u.name?.toLowerCase().includes('cakehurst')
    );
    
    if (matches && matches.length > 0) {
      console.log('\n✅ Found matching users:');
      matches.forEach(u => {
        console.log(`   ID: ${u.id}`);
        console.log(`   Name: ${u.name}\n`);
      });
    } else {
      console.log('   No matches found');
    }
    process.exit(1);
  }

  console.log('✅ Found user(s):');
  users.forEach(u => {
    console.log(`   ID: ${u.id}`);
    console.log(`   Name: ${u.name}\n`);
  });

  const userId = users[0].id;

  // Get their subscriptions
  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (subsError) {
    console.error('❌ Error fetching subscriptions:', subsError);
    process.exit(1);
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('❌ No subscriptions found for this user');
    console.log('   Recommendation: User needs to register their device via the app');
    process.exit(0);
  }

  console.log(`\n📱 Found ${subscriptions.length} subscription(s):\n`);

  for (const sub of subscriptions) {
    console.log(`Player ID: ${sub.player_id?.slice(0, 30)}...`);
    console.log(`Platform: ${sub.platform || 'unknown'}`);
    console.log(`Is Active: ${sub.is_active}`);
    console.log(`Created: ${sub.created_at}`);

    // Check OneSignal subscription status
    if (sub.player_id && ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      console.log('\n🔍 Checking OneSignal subscription status...');
      const result = await checkOneSignalSubscription(sub.player_id);
      
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   Subscribed in OneSignal: ${result.subscribed ? '✅ YES' : '❌ NO'}`);
        if (result.player) {
          console.log(`   Has Token: ${result.player.identifier ? '✅' : '❌'}`);
          console.log(`   Invalid Identifier: ${result.player.invalid_identifier ? '❌ YES' : '✅ NO'}`);
          console.log(`   Notification Types: ${result.player.notification_types ?? 'null/undefined (still initializing?)'}`);
          if (result.player.last_active) {
            console.log(`   Last Active: ${new Date(result.player.last_active * 1000).toISOString()}`);
          }
        }
      }
    } else {
      console.log('   ⚠️  Cannot check OneSignal (missing credentials or player_id)');
    }

    console.log('\n' + '─'.repeat(60) + '\n');
  }

  const activeSubs = subscriptions.filter(s => s.is_active);
  const subscribedInOneSignal = [];

  // Check all active subscriptions
  if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
    for (const sub of activeSubs) {
      if (sub.player_id) {
        const result = await checkOneSignalSubscription(sub.player_id);
        if (result.subscribed) {
          subscribedInOneSignal.push(sub);
        }
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total subscriptions: ${subscriptions.length}`);
  console.log(`   Active subscriptions: ${activeSubs.length}`);
  console.log(`   Subscribed in OneSignal: ${subscribedInOneSignal.length}`);

  if (activeSubs.length === 0) {
    console.log('\n❌ Recommendation: No active devices. User needs to re-register their device via the app.');
  } else if (subscribedInOneSignal.length === 0) {
    console.log('\n❌ Recommendation: Devices are registered but not subscribed in OneSignal.');
    console.log('   User may need to enable notifications in iOS Settings.');
  } else {
    console.log('\n✅ User should receive notifications on active subscribed devices.');
  }
}

main().catch(console.error);
