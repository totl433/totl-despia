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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

async function activateCarlDevice() {
  console.log('🔧 Activating Carl\'s most recent device...\n');
  console.log(`User ID: ${CARL_USER_ID}\n`);

  try {
    // Get all Carl's subscriptions, ordered by most recent
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

    // Find the most recent device that shows as subscribed
    const mostRecentSubscribed = subscriptions.find(s => s.subscribed === true);
    
    if (!mostRecentSubscribed) {
      console.log('⚠️  No subscribed devices found. Carl needs to re-register his device.');
      return;
    }

    console.log(`Most recent subscribed device:`);
    console.log(`  Player ID: ${mostRecentSubscribed.player_id?.slice(0, 30)}...`);
    console.log(`  Platform: ${mostRecentSubscribed.platform || 'unknown'}`);
    console.log(`  Created: ${mostRecentSubscribed.created_at}`);
    console.log(`  Current is_active: ${mostRecentSubscribed.is_active}\n`);

    if (mostRecentSubscribed.is_active) {
      console.log('✅ Device is already active. No changes needed.');
      return;
    }

    // Activate this device
    console.log('🔄 Activating device...');
    const { error: updateError } = await supabase
      .from('push_subscriptions')
      .update({
        is_active: true,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', mostRecentSubscribed.id);

    if (updateError) {
      console.error('❌ Failed to activate device:', updateError);
      return;
    }

    console.log('✅ Device activated successfully!\n');

    // Optionally, deactivate old devices to clean up
    const oldDevices = subscriptions.filter(s => 
      s.id !== mostRecentSubscribed.id && 
      s.is_active === true
    );

    if (oldDevices.length > 0) {
      console.log(`Deactivating ${oldDevices.length} old device(s)...`);
      for (const oldDevice of oldDevices) {
        const { error: deactivateError } = await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', oldDevice.id);
        
        if (!deactivateError) {
          console.log(`  ✅ Deactivated: ${oldDevice.player_id?.slice(0, 20)}...`);
        }
      }
    }

    console.log('\n✅ Carl\'s notification setup is now fixed!');
    console.log('   He should receive notifications on his most recent device.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

activateCarlDevice().catch(console.error);

