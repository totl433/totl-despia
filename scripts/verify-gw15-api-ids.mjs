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

async function verifyGw15() {
  console.log('✅ Verifying GW15 fixtures have api_match_id...\n');

  const { data, error } = await supabase
    .from('app_fixtures')
    .select('fixture_index, home_code, away_code, api_match_id')
    .eq('gw', 15)
    .order('fixture_index');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('GW15 Fixtures:');
  console.log('─'.repeat(70));
  data.forEach(f => {
    const hasId = f.api_match_id ? '✅' : '❌';
    console.log(`${hasId} ${f.fixture_index}: ${f.home_code} v ${f.away_code} - ID: ${f.api_match_id || 'MISSING'}`);
  });
  console.log('─'.repeat(70));
  
  const withId = data.filter(f => f.api_match_id).length;
  const total = data.length;
  
  console.log(`\n📊 Summary: ${withId}/${total} fixtures have api_match_id`);
  
  if (withId === total) {
    console.log('🎉 All fixtures are ready for live score polling!');
  } else {
    console.log(`⚠️  ${total - withId} fixtures still need api_match_id`);
  }
}

verifyGw15();

