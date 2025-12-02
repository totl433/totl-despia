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

async function updateSPGw12Fixture9() {
  console.log('🔄 Updating SP\'s GW12 fixture 9 pick...\n');

  const spUserId = '9c0bcf50-370d-412d-8826-95371a72b4fe'; // SP
  const gw = 12;
  const fixtureIndex = 9;
  const newPick = 'H'; // Manchester United win

  try {
    // Update in app_picks
    const { error: updateError } = await supabase
      .from('app_picks')
      .update({ pick: newPick })
      .eq('user_id', spUserId)
      .eq('gw', gw)
      .eq('fixture_index', fixtureIndex);

    if (updateError) {
      console.error('❌ Error updating app_picks:', updateError);
      process.exit(1);
    }

    console.log(`✅ Updated SP's GW12 fixture ${fixtureIndex} pick to "${newPick}" in app_picks`);

    // Verify the update
    const { data: updatedPick } = await supabase
      .from('app_picks')
      .select('user_id, gw, fixture_index, pick')
      .eq('user_id', spUserId)
      .eq('gw', gw)
      .eq('fixture_index', fixtureIndex)
      .maybeSingle();

    if (updatedPick) {
      console.log(`✅ Verified: Pick is now "${updatedPick.pick}"`);
    }

    // Check if it was mirrored to Web picks (should happen automatically via trigger)
    const { data: webPick } = await supabase
      .from('picks')
      .select('user_id, gw, fixture_index, pick')
      .eq('user_id', spUserId)
      .eq('gw', gw)
      .eq('fixture_index', fixtureIndex)
      .maybeSingle();

    if (webPick) {
      console.log(`✅ Mirrored to Web picks: "${webPick.pick}"`);
    } else {
      console.log(`⚠️  Not yet mirrored to Web picks (trigger may need a moment)`);
    }

    // Show all SP's GW12 picks
    const { data: allPicks } = await supabase
      .from('app_picks')
      .select('fixture_index, pick')
      .eq('user_id', spUserId)
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (allPicks) {
      console.log(`\n📊 SP's complete GW12 picks: [${allPicks.map(p => `"${p.pick}"`).join(', ')}]`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

updateSPGw12Fixture9();




