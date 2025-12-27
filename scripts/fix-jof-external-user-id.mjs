#!/usr/bin/env node
/**
 * Fix Jof's external_user_id
 * 
 * This will ensure Jof's active device has external_user_id set in OneSignal
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

async function fixJofExternalUserId() {
  console.log('🔧 Fixing external_user_id for Jof\n');
  console.log(`User ID: ${JOF_USER_ID}\n`);

  try {
    // Get active device
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', JOF_USER_ID)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }

    if (!subscriptions) {
      console.error('❌ No active subscription found');
      process.exit(1);
    }

    console.log(`Found active device: ${subscriptions.player_id.slice(0, 16)}...`);
    console.log(`Subscribed: ${subscriptions.subscribed ? '✅' : '❌'}\n`);

    if (!subscriptions.subscribed) {
      console.error('❌ Device is not subscribed in OneSignal - cannot set external_user_id');
      process.exit(1);
    }

    // Call the fix function
    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = isDev ? 'http://localhost:8888' : 'https://totl-staging.netlify.app';
    
    console.log(`Calling fixExternalUserIds for user ${JOF_USER_ID}...\n`);
    
    const response = await fetch(`${baseUrl}/.netlify/functions/fixExternalUserIds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: JOF_USER_ID,
        limit: 1,
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Result:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Error:', result);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

fixJofExternalUserId();

