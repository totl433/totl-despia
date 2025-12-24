import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGw18() {
  console.log('🔍 Checking GW18 fixtures...\n');

  try {
    // Check app_meta for current_gw
    const { data: meta, error: metaError } = await supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();
    
    if (metaError) throw metaError;
    console.log('📊 app_meta.current_gw:', meta?.current_gw ?? 'NOT SET');
    
    // Check app_fixtures for GW18 (where ApiAdmin saves)
    const { data: appFixtures, error: appError } = await supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', 18)
      .order('fixture_index', { ascending: true });
    
    if (appError) throw appError;
    console.log(`\n📱 GW18 Fixtures in app_fixtures: ${appFixtures?.length ?? 0}`);
    if (appFixtures && appFixtures.length > 0) {
      console.log('\nFixtures:');
      appFixtures.forEach(f => {
        console.log(`  ${f.fixture_index}: ${f.home_code || f.home_team} v ${f.away_code || f.away_team} (${f.kickoff_time || 'TBC'})`);
      });
    }

    // Check fixtures table (web table)
    const { data: webFixtures, error: webError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 18)
      .order('fixture_index', { ascending: true });
    
    if (webError) throw webError;
    console.log(`\n🌐 GW18 Fixtures in fixtures table: ${webFixtures?.length ?? 0}`);

    // Summary
    console.log('\n' + '='.repeat(50));
    if (appFixtures && appFixtures.length > 0) {
      console.log(`✅ GW18 fixtures exist in app_fixtures (${appFixtures.length} fixtures)`);
    } else {
      console.log(`❌ No GW18 fixtures found in app_fixtures`);
    }
    
    if (meta?.current_gw === 18) {
      console.log(`✅ app_meta.current_gw is set to 18`);
    } else {
      console.log(`⚠️  app_meta.current_gw is ${meta?.current_gw || 'null'} (not 18)`);
    }

  } catch (error) {
    console.error('❌ Error checking GW18:', error);
  }
}

checkGw18();
