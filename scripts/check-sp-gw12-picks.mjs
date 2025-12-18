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

async function checkSPGw12Picks() {
  console.log('🔍 Checking SP\'s GW12 picks in App database...\n');

  const spUserId = '9c0bcf50-370d-412d-8826-95371a72b4fe'; // SP
  const gw = 12;

  try {
    // Get SP's user info
    const { data: spUser } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', spUserId)
      .maybeSingle();

    if (!spUser) {
      console.log('❌ SP user not found');
      return;
    }

    console.log(`✅ Found user: ${spUser.name} (${spUser.id})\n`);

    // Get SP's picks for GW12 from app_picks
    const { data: appPicks, error: appPicksError } = await supabase
      .from('app_picks')
      .select('user_id, gw, fixture_index, pick')
      .eq('user_id', spUserId)
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (appPicksError) {
      console.error('❌ Error fetching app_picks:', appPicksError);
      return;
    }

    console.log(`📊 SP's GW12 picks in app_picks: ${appPicks?.length || 0} picks\n`);

    if (appPicks && appPicks.length > 0) {
      console.log('Picks:');
      appPicks.forEach((pick, index) => {
        console.log(`  Fixture ${pick.fixture_index}: ${pick.pick}`);
      });
      console.log(`\nFull picks array: [${appPicks.map(p => `"${p.pick}"`).join(', ')}]`);
    } else {
      console.log('⚠️  No picks found in app_picks for GW12');
    }

    // Also check if SP has a submission for GW12
    const { data: appSubmission } = await supabase
      .from('app_gw_submissions')
      .select('user_id, gw, submitted_at')
      .eq('user_id', spUserId)
      .eq('gw', gw)
      .maybeSingle();

    if (appSubmission) {
      console.log(`\n✅ SP has submitted GW12 at: ${appSubmission.submitted_at}`);
    } else {
      console.log(`\n⚠️  SP has NOT submitted GW12 in app_gw_submissions`);
    }

    // Also check Web picks for comparison
    const { data: webPicks } = await supabase
      .from('picks')
      .select('user_id, gw, fixture_index, pick')
      .eq('user_id', spUserId)
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (webPicks && webPicks.length > 0) {
      console.log(`\n📊 SP's GW12 picks in Web picks table: ${webPicks.length} picks`);
      console.log(`Web picks array: [${webPicks.map(p => `"${p.pick}"`).join(', ')}]`);
    } else {
      console.log(`\n⚠️  No picks found in Web picks table for GW12`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

checkSPGw12Picks();



















