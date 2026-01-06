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

async function checkGw17() {
  console.log('🔍 Checking GW17 in database...\n');

  try {
    // Check app_meta for current_gw
    const { data: meta, error: metaError } = await supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();
    
    if (metaError) throw metaError;
    console.log('📊 app_meta.current_gw:', meta?.current_gw ?? 'NOT SET');
    
    // Check app_fixtures for GW17
    const { data: fixtures, error: fixturesError } = await supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', 17)
      .order('fixture_index', { ascending: true });
    
    if (fixturesError) throw fixturesError;
    console.log(`\n🏟️  GW17 Fixtures in app_fixtures: ${fixtures?.length ?? 0}`);
    if (fixtures && fixtures.length > 0) {
      console.log('First 3 fixtures:');
      fixtures.slice(0, 3).forEach(f => {
        console.log(`  - ${f.home_team} vs ${f.away_team} (index ${f.fixture_index})`);
      });
    }
    
    // Check regular fixtures table for GW17
    const { data: fixturesOld, error: fixturesOldError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 17)
      .order('fixture_index', { ascending: true });
    
    if (fixturesOldError) throw fixturesOldError;
    console.log(`\n🏟️  GW17 Fixtures in fixtures table: ${fixturesOld?.length ?? 0}`);
    
    // Check app_gw_results for GW17
    const { data: results, error: resultsError } = await supabase
      .from('app_gw_results')
      .select('*')
      .eq('gw', 17);
    
    if (resultsError) throw resultsError;
    console.log(`\n🏆 GW17 Results in app_gw_results: ${results?.length ?? 0}`);
    
    // Check app_picks for GW17
    const { data: picks, error: picksError } = await supabase
      .from('app_picks')
      .select('user_id, fixture_index')
      .eq('gw', 17)
      .limit(10);
    
    if (picksError) throw picksError;
    console.log(`\n🎯 GW17 Picks in app_picks: ${picks?.length ?? 0} (showing first 10)`);
    
    // Summary
    console.log('\n📋 Summary:');
    console.log(`  - current_gw in app_meta: ${meta?.current_gw ?? 'NOT SET'}`);
    console.log(`  - GW17 fixtures in app_fixtures: ${fixtures?.length ?? 0}`);
    console.log(`  - GW17 fixtures in fixtures: ${fixturesOld?.length ?? 0}`);
    console.log(`  - GW17 results: ${results?.length ?? 0}`);
    console.log(`  - GW17 picks: ${picks?.length ?? 0}`);
    
    if (meta?.current_gw === 17 && (fixtures?.length ?? 0) === 0) {
      console.log('\n⚠️  WARNING: current_gw is 17 but no fixtures exist in app_fixtures!');
    }
    
  } catch (error) {
    console.error('❌ Error checking GW17:', error);
  }
}

checkGw17();














