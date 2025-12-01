import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function mirrorTestApiFixtures() {
  console.log('🔄 Mirroring test_api_fixtures to app_fixtures with api_match_id...\n');

  try {
    // Get all test_api_fixtures
    const { data: testFixtures, error: testError } = await supabase
      .from('test_api_fixtures')
      .select('*')
      .order('test_gw', { ascending: true })
      .order('fixture_index', { ascending: true });
    
    if (testError) {
      console.error('❌ Error fetching test_api_fixtures:', testError);
      return;
    }
    
    if (!testFixtures || testFixtures.length === 0) {
      console.log('⚠️  No test_api_fixtures found');
      return;
    }
    
    console.log(`📊 Found ${testFixtures.length} test_api_fixtures`);
    
    // Map test_api_fixtures to app_fixtures format
    const appFixtures = testFixtures.map(tf => ({
      gw: tf.test_gw, // Map test_gw to gw
      fixture_index: tf.fixture_index,
      home_team: tf.home_team,
      away_team: tf.away_team,
      home_code: tf.home_code,
      away_code: tf.away_code,
      home_name: tf.home_name,
      away_name: tf.away_name,
      kickoff_time: tf.kickoff_time,
      api_match_id: tf.api_match_id // CRITICAL: Copy api_match_id for live scores
    }));
    
    // Group by GW for logging
    const byGw = new Map();
    appFixtures.forEach(af => {
      const gw = af.gw;
      if (!byGw.has(gw)) {
        byGw.set(gw, []);
      }
      byGw.get(gw).push(af);
    });
    
    console.log(`\n📝 Upserting ${appFixtures.length} fixtures to app_fixtures...`);
    byGw.forEach((fixtures, gw) => {
      const withApiMatchId = fixtures.filter(f => f.api_match_id !== null).length;
      console.log(`   GW ${gw}: ${fixtures.length} fixtures (${withApiMatchId} with api_match_id)`);
    });
    
    const { error: upsertError } = await supabase
      .from('app_fixtures')
      .upsert(appFixtures, { onConflict: 'gw,fixture_index' });
    
    if (upsertError) {
      console.error('❌ Error upserting to app_fixtures:', upsertError);
      return;
    }
    
    console.log('\n✅ Successfully mirrored all test_api_fixtures to app_fixtures');
    console.log('   Live scores should now work for API Test leagues!');
    
  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

mirrorTestApiFixtures();

