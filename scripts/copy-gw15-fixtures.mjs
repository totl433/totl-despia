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

async function copyGw15Fixtures() {
  console.log('🔍 Checking for GW15 fixtures...\n');
  
  // Check web fixtures table
  const { data: webFixtures, error: webError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', 15)
    .order('fixture_index', { ascending: true });
  
  if (webError) {
    console.error('❌ Error checking web fixtures:', webError);
  } else {
    console.log(`Found ${webFixtures?.length || 0} fixtures in 'fixtures' table for GW15`);
  }
  
  // Check app fixtures table
  const { data: appFixtures, error: appError } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 15)
    .order('fixture_index', { ascending: true });
  
  if (appError) {
    console.error('❌ Error checking app fixtures:', appError);
  } else {
    console.log(`Found ${appFixtures?.length || 0} fixtures in 'app_fixtures' table for GW15`);
  }
  
  // If web fixtures exist but app fixtures don't, copy them
  if (webFixtures && webFixtures.length > 0 && (!appFixtures || appFixtures.length === 0)) {
    console.log('\n📋 Copying fixtures from web table to app table...');
    
    const fixturesToInsert = webFixtures.map(f => ({
      gw: f.gw,
      fixture_index: f.fixture_index,
      home_team: f.home_team,
      away_team: f.away_team,
      home_code: f.home_code,
      away_code: f.away_code,
      home_name: f.home_name,
      away_name: f.away_name,
      kickoff_time: f.kickoff_time,
      api_match_id: f.api_match_id || null
    }));
    
    const { data, error } = await supabase
      .from('app_fixtures')
      .upsert(fixturesToInsert, { onConflict: 'gw,fixture_index' })
      .select();
    
    if (error) {
      console.error('❌ Error copying fixtures:', error);
      process.exit(1);
    }
    
    console.log(`✅ Successfully copied ${data?.length || 0} fixtures to app_fixtures!`);
  } else if (appFixtures && appFixtures.length > 0) {
    console.log('\n✅ Fixtures already exist in app_fixtures!');
  } else {
    console.log('\n⚠️  No fixtures found in either table for GW15!');
    console.log('You may need to publish fixtures using the API Admin page.');
  }
}

copyGw15Fixtures().catch(console.error);

