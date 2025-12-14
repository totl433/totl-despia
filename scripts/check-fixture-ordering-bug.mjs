#!/usr/bin/env node
/**
 * Check fixture ordering between web and app tables
 * User found: First Sunday game on APP is Sunderland v Newcastle
 * First Sunday game on WEB is CRY v MCI
 * But picks for CRY v MCI are being applied to Sunderland v Newcastle
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFixtureOrdering() {
  console.log('🔍 Checking fixture ordering between web and app tables for GW16...\n');
  
  // Get fixtures from web table (fixtures)
  const { data: webFixtures, error: webErr } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (webErr) {
    console.error('❌ Error fetching web fixtures:', webErr);
    return;
  }
  
  // Get fixtures from app table (app_fixtures)
  const { data: appFixtures, error: appErr } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (appErr) {
    console.error('❌ Error fetching app fixtures:', appErr);
    return;
  }
  
  console.log(`📊 Web fixtures count: ${webFixtures?.length || 0}`);
  console.log(`📊 App fixtures count: ${appFixtures?.length || 0}\n`);
  
  // Check Sunday fixtures specifically
  console.log('📅 SUNDAY FIXTURES:\n');
  
  const webSundayFixtures = webFixtures?.filter(f => {
    if (!f.kickoff_time) return false;
    const date = new Date(f.kickoff_time);
    return date.getDay() === 0; // Sunday
  }).sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
  
  const appSundayFixtures = appFixtures?.filter(f => {
    if (!f.kickoff_time) return false;
    const date = new Date(f.kickoff_time);
    return date.getDay() === 0; // Sunday
  }).sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
  
  console.log('🌐 WEB Sunday fixtures (ordered by kickoff time):');
  webSundayFixtures?.forEach((f, i) => {
    const date = new Date(f.kickoff_time);
    console.log(`   ${i + 1}. Fixture ${f.fixture_index}: ${f.home_name} vs ${f.away_name} (${date.toISOString()})`);
  });
  
  console.log('\n📱 APP Sunday fixtures (ordered by kickoff time):');
  appSundayFixtures?.forEach((f, i) => {
    const date = new Date(f.kickoff_time);
    console.log(`   ${i + 1}. Fixture ${f.fixture_index}: ${f.home_name} vs ${f.away_name} (${date.toISOString()})`);
  });
  
  // Compare fixture_index ordering
  console.log('\n🔍 COMPARING FIXTURE_INDEX ORDERING:\n');
  
  if (webFixtures && appFixtures) {
    const mismatches = [];
    
    for (let i = 0; i < Math.max(webFixtures.length, appFixtures.length); i++) {
      const webFix = webFixtures[i];
      const appFix = appFixtures[i];
      
      if (!webFix || !appFix) {
        mismatches.push({
          index: i,
          web: webFix ? `${webFix.home_name} vs ${webFix.away_name}` : 'MISSING',
          app: appFix ? `${appFix.home_name} vs ${appFix.away_name}` : 'MISSING'
        });
        continue;
      }
      
      const webMatch = `${webFix.home_name} vs ${webFix.away_name}`;
      const appMatch = `${appFix.home_name} vs ${appFix.away_name}`;
      
      if (webMatch !== appMatch) {
        mismatches.push({
          index: i,
          web: webMatch,
          app: appMatch
        });
      }
    }
    
    if (mismatches.length > 0) {
      console.log('🚨 FIXTURE ORDERING MISMATCHES FOUND:');
      mismatches.forEach(m => {
        console.log(`   Fixture Index ${m.index}:`);
        console.log(`      Web: ${m.web}`);
        console.log(`      App: ${m.app}`);
      });
      
      console.log('\n💡 CRITICAL BUG:');
      console.log('   Picks use fixture_index to match games.');
      console.log('   If fixtures are in different orders, picks will be applied to WRONG games!');
      console.log('   Example: Pick for fixture_index 4 on web might be applied to fixture_index 4 on app,');
      console.log('   but those are DIFFERENT games!');
    } else {
      console.log('✅ All fixtures match at same fixture_index');
    }
  }
  
  // Check how mirror trigger works
  console.log('\n🔍 CHECKING MIRROR TRIGGER LOGIC:\n');
  console.log('   Mirror trigger copies picks using: user_id, gw, fixture_index');
  console.log('   If fixture_index 4 on web = CRY v MCI');
  console.log('   But fixture_index 4 on app = Sunderland v Newcastle');
  console.log('   Then pick for CRY v MCI will be copied to Sunderland v Newcastle!');
  console.log('   This is the bug!');
}

checkFixtureOrdering().catch(console.error);
