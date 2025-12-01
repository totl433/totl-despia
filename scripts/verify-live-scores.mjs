import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  console.log('Verifying live scores setup...\n');
  
  // Check current test_gw
  const { data: testMeta } = await supabase
    .from('test_api_meta')
    .select('current_test_gw')
    .eq('id', 1)
    .maybeSingle();
  
  const currentTestGw = testMeta?.current_test_gw || 1;
  console.log('Current test_gw:', currentTestGw);
  
  // Check app_fixtures for this test_gw
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('gw, fixture_index, api_match_id, home_team, away_team')
    .eq('gw', currentTestGw)
    .order('fixture_index', { ascending: true });
  
  console.log(`\nApp fixtures for GW ${currentTestGw}:`, fixtures?.length || 0);
  if (fixtures && fixtures.length > 0) {
    const withApiMatchId = fixtures.filter(f => f.api_match_id !== null).length;
    console.log(`  ${withApiMatchId} out of ${fixtures.length} have api_match_id`);
    
    if (withApiMatchId > 0) {
      const apiMatchIds = fixtures.map(f => f.api_match_id).filter(id => id !== null);
      console.log('  api_match_ids:', apiMatchIds.slice(0, 5).join(', '));
      
      // Check live scores
      const { data: liveScores } = await supabase
        .from('live_scores')
        .select('api_match_id, home_score, away_score, status')
        .in('api_match_id', apiMatchIds);
      
      console.log(`\n  Matching live scores: ${liveScores?.length || 0}`);
      if (liveScores && liveScores.length > 0) {
        console.log('  ✅ Live scores are available!');
        liveScores.slice(0, 3).forEach(ls => {
          console.log(`    Match ${ls.api_match_id}: ${ls.home_score}-${ls.away_score} (${ls.status})`);
        });
      } else {
        console.log('  ⚠️  No live scores found for these api_match_ids');
      }
    } else {
      console.log('  ❌ No fixtures have api_match_id - live scores won\'t work');
    }
  }
})();

