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

async function mirrorMissingGws() {
  console.log('🔄 Mirroring missing GWs (9-13) to App tables...\n');

  try {
    // Check which GWs are missing in app_picks
    const { data: appPicksGws } = await supabase
      .from('app_picks')
      .select('gw')
      .order('gw', { ascending: false });
    
    const appGws = new Set((appPicksGws || []).map(p => p.gw));
    console.log('📊 GWs currently in app_picks:', Array.from(appGws).sort((a, b) => a - b));
    
    // Check which GWs exist in Web picks
    const { data: webPicksGws } = await supabase
      .from('picks')
      .select('gw')
      .order('gw', { ascending: false });
    
    const webGws = new Set((webPicksGws || []).map(p => p.gw));
    console.log('📊 GWs in Web picks:', Array.from(webGws).sort((a, b) => a - b));
    
    // Find missing GWs - also check GWs that have results but no picks
    const { data: resultsGws } = await supabase
      .from('app_gw_results')
      .select('gw')
      .order('gw', { ascending: false });
    const resultsGwsSet = new Set((resultsGws || []).map(r => r.gw));
    console.log('📊 GWs with results:', Array.from(resultsGwsSet).sort((a, b) => a - b));
    
    // Missing GWs = GWs in Web picks that aren't in app_picks, OR GWs with results but no picks
    const missingFromWeb = Array.from(webGws).filter(gw => !appGws.has(gw));
    const missingFromResults = Array.from(resultsGwsSet).filter(gw => !appGws.has(gw));
    const missingGws = [...new Set([...missingFromWeb, ...missingFromResults])];
    console.log('\n🔍 Missing GWs to mirror:', missingGws.length > 0 ? missingGws.sort((a, b) => a - b) : 'None');
    
    if (missingGws.length === 0) {
      console.log('✅ All GWs are already mirrored!');
      return;
    }
    
    // Mirror picks for missing GWs
    for (const gw of missingGws.sort((a, b) => a - b)) {
      console.log(`\n📝 Mirroring GW ${gw} picks...`);
      const { data: webPicks, error: picksError } = await supabase
        .from('picks')
        .select('user_id, gw, fixture_index, pick')
        .eq('gw', gw);
      
      if (picksError) {
        console.error(`   ❌ Error fetching GW ${gw} picks:`, picksError);
        continue;
      }
      
      if (!webPicks || webPicks.length === 0) {
        console.log(`   ⚠️  No picks found for GW ${gw}`);
        continue;
      }
      
      const { error: insertError } = await supabase
        .from('app_picks')
        .upsert(webPicks, { onConflict: 'user_id,gw,fixture_index' });
      
      if (insertError) {
        console.error(`   ❌ Error mirroring GW ${gw} picks:`, insertError);
      } else {
        console.log(`   ✅ Mirrored ${webPicks.length} picks for GW ${gw}`);
      }
    }
    
    // Mirror submissions for missing GWs
    for (const gw of missingGws.sort((a, b) => a - b)) {
      console.log(`\n📝 Mirroring GW ${gw} submissions...`);
      const { data: webSubs, error: subsError } = await supabase
        .from('gw_submissions')
        .select('user_id, gw, submitted_at')
        .eq('gw', gw);
      
      if (subsError) {
        console.error(`   ❌ Error fetching GW ${gw} submissions:`, subsError);
        continue;
      }
      
      if (!webSubs || webSubs.length === 0) {
        console.log(`   ⚠️  No submissions found for GW ${gw}`);
        continue;
      }
      
      const { error: insertError } = await supabase
        .from('app_gw_submissions')
        .upsert(webSubs, { onConflict: 'user_id,gw' });
      
      if (insertError) {
        console.error(`   ❌ Error mirroring GW ${gw} submissions:`, insertError);
      } else {
        console.log(`   ✅ Mirrored ${webSubs.length} submissions for GW ${gw}`);
      }
    }
    
    // Results should already be mirrored, but check anyway
    console.log('\n✅ Mirroring complete!');
    console.log('   Missing GWs have been copied to app_picks and app_gw_submissions.');
    
  } catch (error) {
    console.error('❌ Error mirroring data:', error.message || error);
    process.exit(1);
  }
}

mirrorMissingGws();

