import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY - cannot update app_meta without service role');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function updateMetaToGw18() {
  console.log('🔧 Updating app_meta.current_gw to 18...\n');

  try {
    const { data, error } = await supabase
      .from('app_meta')
      .upsert({ id: 1, current_gw: 18 }, { onConflict: 'id' });

    if (error) {
      console.error('❌ Error updating app_meta:', error);
      process.exit(1);
    }

    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      process.exit(1);
    }

    console.log('✅ Successfully updated app_meta.current_gw to', verifyData?.current_gw);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateMetaToGw18();

