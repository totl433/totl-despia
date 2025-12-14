#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSimPicksToWeb() {
  console.log('🔧 Copying Sim\'s picks from app_picks to picks (web table)...\n');
  
  const gw = 16;
  
  // Find Sim's user ID
  const { data: simUser } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', 'Sim')
    .maybeSingle();
  
  if (!simUser) {
    console.error('❌ Sim not found in users table');
    return;
  }
  
  console.log(`✅ Found Sim: ${simUser.name} (${simUser.id})\n`);
  
  // Get Sim's picks from app_picks
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('gw', gw)
    .eq('user_id', simUser.id)
    .order('fixture_index');
  
  if (!appPicks || appPicks.length === 0) {
    console.error('❌ No picks found in app_picks for Sim');
    return;
  }
  
  console.log(`📊 Found ${appPicks.length} picks in app_picks\n`);
  
  // Get app fixtures to find team codes/names
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('fixture_index, home_code, away_code, home_name, away_name')
    .eq('gw', gw)
    .order('fixture_index');
  
  // Get web fixtures to match by team codes/names
  const { data: webFixtures } = await supabase
    .from('fixtures')
    .select('fixture_index, home_code, away_code, home_name, away_name')
    .eq('gw', gw)
    .order('fixture_index');
  
  if (!appFixtures || !webFixtures) {
    console.error('❌ Error fetching fixtures');
    return;
  }
  
  // Create a map: app fixture_index -> web fixture_index
  const appToWebFixtureIndex = new Map();
  
  for (const appPick of appPicks) {
    const appFixture = appFixtures.find(f => f.fixture_index === appPick.fixture_index);
    if (!appFixture) {
      console.warn(`⚠️  No app fixture found for fixture_index=${appPick.fixture_index}`);
      continue;
    }
    
    // Normalize team codes (handle NFO -> NOT alias)
    const normalizeCode = (code) => {
      if (!code) return null;
      return code === 'NFO' ? 'NOT' : code;
    };
    
    const appHomeCodeNorm = normalizeCode(appFixture.home_code);
    const appAwayCodeNorm = normalizeCode(appFixture.away_code);
    
    // Find matching web fixture by codes first, then names
    const webFixture = webFixtures.find(webFix => {
      const webHomeCodeNorm = normalizeCode(webFix.home_code);
      const webAwayCodeNorm = normalizeCode(webFix.away_code);
      
      // Match by codes (both directions for home/away swap)
      if (appHomeCodeNorm && appAwayCodeNorm && webHomeCodeNorm && webAwayCodeNorm) {
        return (
          (appHomeCodeNorm === webHomeCodeNorm && appAwayCodeNorm === webAwayCodeNorm) ||
          (appHomeCodeNorm === webAwayCodeNorm && appAwayCodeNorm === webHomeCodeNorm)
        );
      }
      
      // Fall back to names if codes missing
      if (appFixture.home_name && appFixture.away_name && webFix.home_name && webFix.away_name) {
        const appHomeNameNorm = appFixture.home_name.toLowerCase();
        const appAwayNameNorm = appFixture.away_name.toLowerCase();
        const webHomeNameNorm = webFix.home_name.toLowerCase();
        const webAwayNameNorm = webFix.away_name.toLowerCase();
        
        return (
          (appHomeNameNorm === webHomeNameNorm && appAwayNameNorm === webAwayNameNorm) ||
          (appHomeNameNorm === webAwayNameNorm && appAwayNameNorm === webHomeNameNorm)
        );
      }
      
      return false;
    });
    
    if (!webFixture) {
      console.warn(`⚠️  No matching web fixture found for app fixture_index=${appPick.fixture_index}`);
      console.warn(`   App: ${appFixture.home_name || appFixture.home_code} vs ${appFixture.away_name || appFixture.away_code}`);
      continue;
    }
    
    appToWebFixtureIndex.set(appPick.fixture_index, webFixture.fixture_index);
    
    console.log(`   App fixture_index=${appPick.fixture_index} (${appFixture.home_name || appFixture.home_code} vs ${appFixture.away_name || appFixture.away_code})`);
    console.log(`   -> Web fixture_index=${webFixture.fixture_index} (${webFixture.home_name || webFixture.home_code} vs ${webFixture.away_name || webFixture.away_code})`);
    console.log(`   Pick: ${appPick.pick}\n`);
  }
  
  if (appToWebFixtureIndex.size === 0) {
    console.error('❌ No matching fixtures found');
    return;
  }
  
  // Delete existing picks for Sim in web table (if any)
  const { error: deleteError } = await supabase
    .from('picks')
    .delete()
    .eq('gw', gw)
    .eq('user_id', simUser.id);
  
  if (deleteError) {
    console.error('❌ Error deleting existing picks:', deleteError);
    return;
  }
  
  // Insert picks into web table with correct fixture_index
  const picksToInsert = [];
  for (const appPick of appPicks) {
    const webFixtureIndex = appToWebFixtureIndex.get(appPick.fixture_index);
    if (webFixtureIndex === undefined) continue;
    
    picksToInsert.push({
      user_id: simUser.id,
      gw: gw,
      fixture_index: webFixtureIndex,
      pick: appPick.pick,
    });
  }
  
  console.log(`\n🔄 Inserting ${picksToInsert.length} picks into picks (web) table...`);
  
  const { error: insertError } = await supabase
    .from('picks')
    .insert(picksToInsert);
  
  if (insertError) {
    console.error('❌ Error inserting picks:', insertError);
    return;
  }
  
  console.log('✅ Successfully copied Sim\'s picks to web (picks) table!');
  console.log(`   Inserted ${picksToInsert.length} picks`);
}

fixSimPicksToWeb().catch(console.error);
