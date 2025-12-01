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

async function checkPB() {
  console.log('🔍 Checking PB (Phil Bolton) in Easy League...\n');

  const gw = 14;

  try {
    // Find PB user
    const { data: pbUser } = await supabase
      .from('users')
      .select('id, name')
      .or('name.ilike.%phil%,name.ilike.%bolton%,name.ilike.%PB%')
      .limit(5);

    console.log('📊 Users matching PB/Phil/Bolton:', pbUser);

    if (!pbUser || pbUser.length === 0) {
      console.log('❌ PB user not found');
      return;
    }

    const user = pbUser[0];
    console.log(`\n✅ Found user: ${user.name} (${user.id})\n`);

    // Check if PB has picks in Web table
    const { data: webPicks } = await supabase
      .from('picks')
      .select('fixture_index, pick')
      .eq('user_id', user.id)
      .eq('gw', gw);

    console.log(`📊 Web picks for GW${gw}:`, webPicks?.length || 0);
    if (webPicks && webPicks.length > 0) {
      console.log('   ✅ PB is a Web user - should show blue outline');
    } else {
      console.log('   ❌ PB has no Web picks - will NOT show blue outline');
    }

    // Check Easy League
    const { data: easyLeague } = await supabase
      .from('leagues')
      .select('id, name, code')
      .ilike('name', '%easy%')
      .maybeSingle();

    if (easyLeague) {
      console.log(`\n📊 Easy League: ${easyLeague.name} (${easyLeague.id})`);
      
      // Check if PB is a member
      const { data: membership } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', easyLeague.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        console.log('   ✅ PB is a member of Easy League');
      } else {
        console.log('   ❌ PB is NOT a member of Easy League');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

checkPB();

