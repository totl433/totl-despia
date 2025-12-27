#!/usr/bin/env node
/**
 * Manually fix Jof's external_user_id right now
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixJofNow() {
  console.log('🔧 Manually fixing Jof\'s external_user_id\n');
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

    console.log(`Found active device: ${subscription.player_id}`);
    console.log(`Subscribed: ${subscription.subscribed ? '✅' : '❌'}\n`);

    if (!subscription.subscribed) {
      console.error('❌ Device is not subscribed in OneSignal');
      process.exit(1);
    }

    // Import the helper functions
    const { setExternalUserId, verifyExternalUserId } = await import('../netlify/functions/utils/notificationHelpers.ts');

    console.log('Setting external_user_id in OneSignal...\n');
    
    // Set external_user_id
    const setResult = await setExternalUserId(
      subscription.player_id,
      JOF_USER_ID,
      ONESIGNAL_APP_ID,
      ONESIGNAL_REST_API_KEY
    );

    if (!setResult.success) {
      console.error('❌ Failed to set external_user_id:', setResult.error);
      process.exit(1);
    }

    console.log('✅ external_user_id set, verifying...\n');

    // Verify it was set
    const verifyResult = await verifyExternalUserId(
      subscription.player_id,
      JOF_USER_ID,
      ONESIGNAL_APP_ID,
      ONESIGNAL_REST_API_KEY
    );

    if (verifyResult.verified) {
      console.log('✅ SUCCESS! external_user_id is now set and verified');
      console.log('\nNext notification should work! 🎉');
    } else {
      console.error('❌ Verification failed:', verifyResult.error);
      console.error(`Expected: ${JOF_USER_ID}`);
      console.error(`Got: ${verifyResult.actualExternalUserId || 'none'}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

fixJofNow();

