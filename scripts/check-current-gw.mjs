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

async function checkCurrentGw() {
  console.log('🔍 Checking current_gw in app_meta...\n');
  
  // Check app_meta
  const { data: appMeta, error: appMetaError } = await supabase
    .from('app_meta')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  
  if (appMetaError) {
    console.error('❌ Error fetching app_meta:', appMetaError);
    return;
  }
  
  console.log('📊 app_meta:', JSON.stringify(appMeta, null, 2));
  console.log(`\n✅ Current GW in app_meta: ${appMeta?.current_gw ?? 'NULL'}\n`);
  
  // Check meta table too (for comparison)
  const { data: meta, error: metaError } = await supabase
    .from('meta')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  
  if (!metaError && meta) {
    console.log('📊 meta table:', JSON.stringify(meta, null, 2));
    console.log(`\n✅ Current GW in meta: ${meta?.current_gw ?? 'NULL'}\n`);
  }
  
  // Check fixtures for GW17
  const currentGw = appMeta?.current_gw ?? 17;
  console.log(`🔍 Checking fixtures for GW ${currentGw}...\n`);
  
  const { data: fixtures, error: fixturesError, count } = await supabase
    .from('app_fixtures')
    .select('*', { count: 'exact' })
    .eq('gw', currentGw);
  
  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError);
    return;
  }
  
  console.log(`✅ Found ${count ?? 0} fixtures for GW ${currentGw}`);
  if (fixtures && fixtures.length > 0) {
    console.log('\n📋 First 3 fixtures:');
    fixtures.slice(0, 3).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.home_team} vs ${f.away_team} (fixture_index: ${f.fixture_index})`);
    });
  }
  
  // Check fixtures for GW16 for comparison
  console.log(`\n🔍 Checking fixtures for GW 16 (for comparison)...\n`);
  const { data: fixtures16, error: fixtures16Error, count: count16 } = await supabase
    .from('app_fixtures')
    .select('*', { count: 'exact' })
    .eq('gw', 16);
  
  if (!fixtures16Error) {
    console.log(`✅ Found ${count16 ?? 0} fixtures for GW 16`);
  }
}

checkCurrentGw().catch(console.error);
