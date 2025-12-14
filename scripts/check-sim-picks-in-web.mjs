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

async function checkSimPicks() {
  console.log('🔍 Checking Sim\'s picks in web (picks table)...\n');
  
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
  
  // Check app_picks (app table)
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('gw', gw)
    .eq('user_id', simUser.id)
    .order('fixture_index');
  
  console.log(`📊 Sim's picks in app_picks (app table): ${appPicks?.length || 0}`);
  if (appPicks && appPicks.length > 0) {
    appPicks.forEach(p => {
      console.log(`   fixture_index=${p.fixture_index}: ${p.pick}`);
    });
  } else {
    console.log('   ⚠️  No picks found in app_picks');
  }
  
  // Check picks (web table)
  const { data: webPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('gw', gw)
    .eq('user_id', simUser.id)
    .order('fixture_index');
  
  console.log(`\n📊 Sim's picks in picks (web table): ${webPicks?.length || 0}`);
  if (webPicks && webPicks.length > 0) {
    webPicks.forEach(p => {
      console.log(`   fixture_index=${p.fixture_index}: ${p.pick}`);
    });
  } else {
    console.log('   ⚠️  No picks found in picks table');
  }
  
  if (!webPicks || webPicks.length === 0) {
    console.log('\n❌ Sim\'s picks are NOT in the web (picks) table');
    console.log('   They need to be copied from app_picks to picks');
    return { needsFix: true, simUserId: simUser.id, appPicks };
  } else if (appPicks && appPicks.length > 0) {
    // Compare
    const appPicksMap = new Map(appPicks.map(p => [p.fixture_index, p.pick]));
    const webPicksMap = new Map(webPicks.map(p => [p.fixture_index, p.pick]));
    
    let matches = true;
    for (const [fixtureIndex, pick] of appPicksMap) {
      if (webPicksMap.get(fixtureIndex) !== pick) {
        console.log(`\n⚠️  Mismatch at fixture_index=${fixtureIndex}: app=${pick}, web=${webPicksMap.get(fixtureIndex)}`);
        matches = false;
      }
    }
    
    if (matches && appPicks.length === webPicks.length) {
      console.log('\n✅ Sim\'s picks are correctly mirrored to web table');
      return { needsFix: false };
    } else {
      console.log('\n⚠️  Sim\'s picks exist in web but don\'t match app picks');
      return { needsFix: true, simUserId: simUser.id, appPicks };
    }
  }
  
  return { needsFix: false };
}

checkSimPicks().then(result => {
  if (result && result.needsFix) {
    console.log('\n💡 Run fix-sim-picks-to-web.mjs to copy Sim\'s picks to web table');
  }
}).catch(console.error);
