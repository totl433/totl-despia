#!/usr/bin/env node
/**
 * Script to update app_meta.current_gw
 * Usage: node scripts/update-app-meta-gw.mjs [gw_number]
 * Example: node scripts/update-app-meta-gw.mjs 16
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAppMetaGw(gw) {
  console.log(`\n🔄 Updating app_meta.current_gw to ${gw}...\n`);

  try {
    // First check current value
    const { data: currentMeta, error: checkError } = await supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking current app_meta:', checkError);
      process.exit(1);
    }

    if (currentMeta) {
      console.log(`📊 Current app_meta.current_gw: ${currentMeta.current_gw}`);
    } else {
      console.log('📊 app_meta record does not exist, will create it');
    }

    // Update or insert
    const { data: updatedMeta, error: updateError } = await supabase
      .from('app_meta')
      .upsert({ id: 1, current_gw: gw }, { onConflict: 'id' })
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating app_meta:', updateError);
      process.exit(1);
    }

    console.log(`✅ Successfully updated app_meta.current_gw to ${updatedMeta.current_gw}`);

    // Verify fixtures exist for this GW
    const { count, error: countError } = await supabase
      .from('app_fixtures')
      .select('*', { count: 'exact', head: true })
      .eq('gw', gw);

    if (countError) {
      console.warn(`⚠️  Could not check fixtures for GW ${gw}:`, countError.message);
    } else {
      console.log(`📋 Found ${count || 0} fixtures for GW ${gw}`);
      if (count === 0) {
        console.warn(`⚠️  Warning: No fixtures found for GW ${gw}`);
      }
    }

    console.log('\n✅ Done! The app should now show GW', gw);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Get GW from command line argument
const gwArg = process.argv[2];
if (!gwArg) {
  console.error('❌ Please provide a gameweek number');
  console.error('Usage: node scripts/update-app-meta-gw.mjs [gw_number]');
  console.error('Example: node scripts/update-app-meta-gw.mjs 16');
  process.exit(1);
}

const gw = parseInt(gwArg, 10);
if (isNaN(gw) || gw < 1) {
  console.error('❌ Invalid gameweek number:', gwArg);
  process.exit(1);
}

updateAppMetaGw(gw);
