import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const CAKEHURST_USER_ID = '027502c5-1cd7-4922-abd5-f9bcc569bb4d';

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.error('Missing OneSignal credentials');
  process.exit(1);
}

async function findPlayerByExternalUserId() {
  console.log(`🔍 Searching for Cakehurst's device in OneSignal...`);
  console.log(`   User ID: ${CAKEHURST_USER_ID}\n`);

  try {
    // OneSignal API: Get players by external_user_id
    // Note: This endpoint might not exist, but let's try
    const url = `https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=100`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ OneSignal API error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`   Response: ${text.substring(0, 200)}`);
      return;
    }

    const data = await response.json();
    
    if (!data.players || data.players.length === 0) {
      console.log('❌ No players found in OneSignal');
      return;
    }

    console.log(`✅ Found ${data.players.length} players in OneSignal\n`);

    // Search for players with Cakehurst's external_user_id
    const cakehurstPlayers = data.players.filter(p => 
      p.external_user_id === CAKEHURST_USER_ID
    );

    if (cakehurstPlayers.length > 0) {
      console.log(`✅ Found ${cakehurstPlayers.length} device(s) for Cakehurst:\n`);
      cakehurstPlayers.forEach((player, i) => {
        console.log(`Device ${i + 1}:`);
        console.log(`  Player ID: ${player.id}`);
        console.log(`  Subscribed: ${player.notification_types === 1 ? '✅ YES' : '❌ NO'}`);
        console.log(`  Platform: ${player.device_type || 'unknown'}`);
        console.log(`  Last Active: ${player.last_active ? new Date(player.last_active * 1000).toISOString() : 'Never'}`);
        console.log(`  Invalid: ${player.invalid_identifier ? '❌ YES' : '✅ NO'}`);
        console.log('');
      });
    } else {
      console.log('❌ No devices found with Cakehurst\'s user ID as external_user_id');
      console.log('   This means the device was never registered, or external_user_id was never set\n');
      
      // Show recent players (might help identify Cakehurst's device)
      console.log('📱 Recent players (last 20):');
      const recentPlayers = data.players
        .sort((a, b) => (b.last_active || 0) - (a.last_active || 0))
        .slice(0, 20);
      
      recentPlayers.forEach((player, i) => {
        console.log(`  ${i + 1}. Player ID: ${player.id?.slice(0, 30)}...`);
        console.log(`     External User ID: ${player.external_user_id || '(not set)'}`);
        console.log(`     Last Active: ${player.last_active ? new Date(player.last_active * 1000).toISOString() : 'Never'}`);
        console.log(`     Subscribed: ${player.notification_types === 1 ? '✅' : '❌'}`);
        console.log('');
      });
    }

    console.log('\n💡 To manually register Cakehurst:');
    console.log('   1. Find their Player ID from OneSignal dashboard (Audience → All Users)');
    console.log('   2. Use the forceUserRegistration function:');
    console.log(`      curl -X POST https://totl-staging.netlify.app/.netlify/functions/forceUserRegistration \\`);
    console.log(`        -H 'Content-Type: application/json' \\`);
    console.log(`        -d '{"userId": "${CAKEHURST_USER_ID}", "playerId": "<PLAYER_ID_FROM_ONESIGNAL>"}'`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Note: OneSignal API might not support listing all players
// Alternative: Check OneSignal dashboard manually
console.log('⚠️  Note: OneSignal API may not support listing all players.');
console.log('   You may need to check the OneSignal dashboard manually:\n');
console.log('   1. Go to OneSignal Dashboard → Audience → All Users');
console.log('   2. Search for devices subscribed recently (around when Cakehurst signed up)');
console.log('   3. Look for devices with external_user_id matching Cakehurst\'s user ID');
console.log('   4. Or find devices that are subscribed but not in our database\n');

findPlayerByExternalUserId().catch(console.error);
