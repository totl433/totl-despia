import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateCurrentGw() {
  const NEW_GW = 15;
  console.log(`🚀 Updating app_meta.current_gw to ${NEW_GW}...`);

  const { data, error } = await supabase
    .from('app_meta')
    .upsert({ id: 1, current_gw: NEW_GW }, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('❌ Error updating app_meta:', error);
    return;
  }

  console.log(`✅ Successfully updated app_meta.current_gw to ${NEW_GW}!`);
  console.log('Updated data:', data);
}

updateCurrentGw().catch(console.error);

