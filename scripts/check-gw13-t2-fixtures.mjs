import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFixtures() {
  console.log('🔍 Checking GW13 (Web) and T2 (App Test) fixtures...\n');

  // Get GW13 fixtures
  const { data: gw13, error: gw13Error } = await supabase
    .from('fixtures')
    .select('gw, fixture_index, home_code, away_code, home_team, away_team, kickoff_time')
    .eq('gw', 13)
    .order('fixture_index', { ascending: true });

  if (gw13Error) {
    console.error('Error fetching GW13:', gw13Error);
    return;
  }

  // Get T2 fixtures
  const { data: t2, error: t2Error } = await supabase
    .from('test_api_fixtures')
    .select('test_gw, fixture_index, home_code, away_code, home_team, away_team, kickoff_time')
    .eq('test_gw', 2)
    .order('fixture_index', { ascending: true });

  if (t2Error) {
    console.error('Error fetching T2:', t2Error);
    return;
  }

  console.log('📊 GW13 (Web) Fixtures:');
  console.log('='.repeat(80));
  if (gw13 && gw13.length > 0) {
    gw13.forEach(f => {
      console.log(`Index ${f.fixture_index}: ${f.home_code || 'N/A'} vs ${f.away_code || 'N/A'} | ${f.home_team} vs ${f.away_team} | ${f.kickoff_time || 'N/A'}`);
    });
  } else {
    console.log('No GW13 fixtures found');
  }

  console.log('\n📊 T2 (App Test) Fixtures:');
  console.log('='.repeat(80));
  if (t2 && t2.length > 0) {
    t2.forEach(f => {
      console.log(`Index ${f.fixture_index}: ${f.home_code || 'N/A'} vs ${f.away_code || 'N/A'} | ${f.home_team} vs ${f.away_team} | ${f.kickoff_time || 'N/A'}`);
    });
  } else {
    console.log('No T2 fixtures found');
  }

  console.log('\n🔗 Matching Analysis:');
  console.log('='.repeat(80));
  
  if (gw13 && t2) {
    gw13.forEach(webFixture => {
      const match = t2.find(appFixture => 
        appFixture.home_code === webFixture.home_code && 
        appFixture.away_code === webFixture.away_code
      );
      
      if (match) {
        console.log(`✅ GW13[${webFixture.fixture_index}] ${webFixture.home_code} vs ${webFixture.away_code} → T2[${match.fixture_index}] ${match.home_code} vs ${match.away_code}`);
      } else {
        console.log(`❌ GW13[${webFixture.fixture_index}] ${webFixture.home_code} vs ${webFixture.away_code} → NO MATCH FOUND`);
      }
    });
  }
}

checkFixtures().catch(console.error);

