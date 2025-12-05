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

async function checkGw15Fixtures() {
  console.log('🔍 Checking GW15 fixtures...\n');
  
  const { data, error } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 15)
    .order('fixture_index', { ascending: true });
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  console.log(`Found ${data?.length || 0} fixtures for GW15`);
  
  if (data && data.length > 0) {
    console.log('\nFirst 3 fixtures:');
    data.slice(0, 3).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.home_team} vs ${f.away_team} (fixture_index: ${f.fixture_index})`);
    });
  } else {
    console.log('\n⚠️  No fixtures found for GW15!');
  }
  
  // Also check app_meta
  const { data: meta } = await supabase
    .from('app_meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();
  
  console.log(`\napp_meta.current_gw: ${meta?.current_gw || 'null'}`);
}

checkGw15Fixtures().catch(console.error);

