#!/usr/bin/env node
/**
 * Directly fix Jof's external_user_id using OneSignal API
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
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

if (!supabaseUrl || !supabaseKey || !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.error('❌ Missing environment variables');
  console.error('Need: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixJofDirect() {
  console.log('🔧 Directly fixing Jof\'s external_user_id via OneSignal API\n');
  console.log(`User ID: ${JOF_USER_ID}\n`);

  try {
    // Get Jof's active device
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', JOF_USER_ID)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }

    if (!subscription) {
      console.error('❌ No active subscription found for Jof');
      process.exit(1);
    }

    const playerId = subscription.player_id;
    console.log(`Found active device: ${playerId}`);
    console.log(`Subscribed: ${subscription.subscribed ? '✅' : '❌'}\n`);

    if (!subscription.subscribed) {
      console.error('❌ Device is not subscribed in OneSignal');
      process.exit(1);
    }

    // Set external_user_id directly via OneSignal API
    console.log('Setting external_user_id in OneSignal...\n');
    
    const OS_BASE = 'https://onesignal.com/api/v1';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
    };

    const url = `${OS_BASE}/players/${playerId}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        external_user_id: JOF_USER_ID,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ Failed to set external_user_id:', response.status, errorBody);
      process.exit(1);
    }

    console.log('✅ external_user_id set, verifying...\n');

    // Verify it was set
    const verifyUrl = `${OS_BASE}/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;
    const verifyResponse = await fetch(verifyUrl, { headers });

    if (!verifyResponse.ok) {
      console.error('❌ Failed to verify:', verifyResponse.status);
      process.exit(1);
    }

    const player = await verifyResponse.json();
    const actualExternalUserId = player.external_user_id;

    if (!actualExternalUserId) {
      console.error('❌ Verification failed: external_user_id is not set');
      process.exit(1);
    }

    if (actualExternalUserId !== JOF_USER_ID) {
      console.error(`❌ Verification failed: expected ${JOF_USER_ID}, got ${actualExternalUserId}`);
      process.exit(1);
    }

    console.log('✅ SUCCESS! external_user_id is now set and verified');
    console.log(`   Player ID: ${playerId}`);
    console.log(`   External User ID: ${actualExternalUserId}`);
    console.log('\n🎉 Next notification should work!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

fixJofDirect();













