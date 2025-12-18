import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateAppMetaGw17() {
  console.log('🔄 Updating app_meta.current_gw to 17...\n');

  try {
    const { data, error } = await supabase
      .from('app_meta')
      .upsert({ id: 1, current_gw: 17 }, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ Error updating app_meta:', error);
      process.exit(1);
    }

    console.log('✅ Successfully updated app_meta.current_gw to 17');
    console.log('Updated data:', data);

    // Verify the update
    const { data: verify, error: verifyError } = await supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .single();

    if (verifyError) {
      console.error('⚠️  Could not verify update:', verifyError);
    } else {
      console.log('✅ Verified: app_meta.current_gw =', verify.current_gw);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateAppMetaGw17();
