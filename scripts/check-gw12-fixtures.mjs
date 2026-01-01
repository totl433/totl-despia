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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkGw12Fixtures() {
  console.log('🔍 Checking GW12 fixtures...\n');

  const gw = 12;

  try {
    // Check app_fixtures first
    const { data: appFixtures, error: appError } = await supabase
      .from('app_fixtures')
      .select('gw, fixture_index, home_team, away_team, home_code, away_code, home_name, away_name, kickoff_time')
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (appError) {
      console.error('❌ Error fetching app_fixtures:', appError);
      return;
    }

    console.log(`📊 GW12 fixtures in app_fixtures: ${appFixtures?.length || 0} fixtures\n`);

    if (appFixtures && appFixtures.length > 0) {
      console.log('All fixtures:');
      appFixtures.forEach((fixture) => {
        console.log(`  Fixture ${fixture.fixture_index}: ${fixture.home_team} vs ${fixture.away_team} (${fixture.home_code} vs ${fixture.away_code})`);
      });

      // Specifically check fixture 9
      const fixture9 = appFixtures.find(f => f.fixture_index === 9);
      if (fixture9) {
        console.log(`\n🎯 Fixture 9: ${fixture9.home_team} vs ${fixture9.away_team}`);
        console.log(`   Codes: ${fixture9.home_code} vs ${fixture9.away_code}`);
        console.log(`   Names: ${fixture9.home_name} vs ${fixture9.away_name}`);
        console.log(`   Kickoff: ${fixture9.kickoff_time}`);
      } else {
        console.log('\n⚠️  Fixture 9 not found in app_fixtures');
      }
    } else {
      console.log('⚠️  No fixtures found in app_fixtures for GW12');
    }

    // Also check Web fixtures for comparison
    const { data: webFixtures } = await supabase
      .from('fixtures')
      .select('gw, fixture_index, home_team, away_team, home_code, away_code, home_name, away_name, kickoff_time')
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (webFixtures && webFixtures.length > 0) {
      const fixture9Web = webFixtures.find(f => f.fixture_index === 9);
      if (fixture9Web) {
        console.log(`\n📊 Web fixtures - Fixture 9: ${fixture9Web.home_team} vs ${fixture9Web.away_team}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

checkGw12Fixtures();




























