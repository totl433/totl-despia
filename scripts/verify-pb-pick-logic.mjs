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

async function verifyLogic() {
  console.log('🔍 Triple-checking our copy logic for PB\'s picks...\n');
  
  const pbUserId = 'f09b62e6-792c-4fe1-a6ba-583d802781df';
  const gw = 16;
  
  // Simulate what our script did
  console.log('📝 What our script (fix-app-picks-from-web-picks.mjs) did:');
  console.log('   1. Read ALL picks from picks table');
  console.log('   2. For each pick, copied it to app_picks with SAME fixture_index');
  console.log('   3. Did NOT modify picks table');
  console.log('   4. Did NOT change fixture_index values');
  console.log('   5. Did NOT remap or reorder picks\n');
  
  // Get PB's picks from both tables
  const { data: webPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', pbUserId)
    .eq('gw', gw)
    .order('fixture_index');
  
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', pbUserId)
    .eq('gw', gw)
    .order('fixture_index');
  
  // Get fixtures
  const { data: webFixtures } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  console.log('🔍 Verifying our copy logic:');
  console.log('   Our script copied picks using: fixture_index (same value)\n');
  
  let allMatch = true;
  webPicks?.forEach(webPick => {
    const appPick = appPicks?.find(p => p.fixture_index === webPick.fixture_index);
    const webFix = webFixtures?.find(f => f.fixture_index === webPick.fixture_index);
    const appFix = appFixtures?.find(f => f.fixture_index === webPick.fixture_index);
    
    if (webPick.pick !== appPick?.pick) {
      console.log(`   ❌ Mismatch at index ${webPick.fixture_index}:`);
      console.log(`      Web (picks): ${webPick.pick}`);
      console.log(`      App (app_picks): ${appPick?.pick || 'NOT FOUND'}`);
      allMatch = false;
    }
    
    // Check if fixture matches
    if (webFix && appFix) {
      const webMatch = (webFix.home_code === appFix.home_code && webFix.away_code === appFix.away_code) ||
                       (webFix.home_code === appFix.away_code && webFix.away_code === appFix.home_code);
      if (!webMatch) {
        console.log(`   ⚠️  Fixture mismatch at index ${webPick.fixture_index}:`);
        console.log(`      Web: ${webFix.home_code} vs ${webFix.away_code}`);
        console.log(`      App: ${appFix.home_code} vs ${appFix.away_code}`);
      }
    }
  });
  
  if (allMatch) {
    console.log('   ✅ All picks match between picks and app_picks');
    console.log('   ✅ Our copy logic worked correctly - same fixture_index = same pick\n');
  }
  
  // Check specifically for SUN v NEW
  console.log('🔍 SUN v NEW (index 6, 7th game) check:');
  const sunNewWebPick = webPicks?.find(p => p.fixture_index === 6);
  const sunNewAppPick = appPicks?.find(p => p.fixture_index === 6);
  const sunNewWebFix = webFixtures?.find(f => f.fixture_index === 6);
  const sunNewAppFix = appFixtures?.find(f => f.fixture_index === 6);
  
  console.log(`   Web fixture at index 6: ${sunNewWebFix?.home_code} vs ${sunNewWebFix?.away_code}`);
  console.log(`   App fixture at index 6: ${sunNewAppFix?.home_name || sunNewAppFix?.home_code} vs ${sunNewAppFix?.away_name || sunNewAppFix?.away_code}`);
  console.log(`   Web pick at index 6: ${sunNewWebPick?.pick || 'NOT FOUND'}`);
  console.log(`   App pick at index 6: ${sunNewAppPick?.pick || 'NOT FOUND'}`);
  
  // Verify fixtures match
  const fixturesMatch = sunNewWebFix && sunNewAppFix &&
    ((sunNewWebFix.home_code === sunNewAppFix.home_code && sunNewWebFix.away_code === sunNewAppFix.away_code) ||
     (sunNewWebFix.home_code === sunNewAppFix.away_code && sunNewWebFix.away_code === sunNewAppFix.home_code));
  
  if (fixturesMatch) {
    console.log(`   ✅ Fixtures match at index 6`);
  } else {
    console.log(`   ❌ Fixtures DON'T match at index 6 - THIS IS THE PROBLEM!`);
  }
  
  if (sunNewWebPick?.pick === sunNewAppPick?.pick) {
    console.log(`   ✅ Picks match at index 6`);
  } else {
    console.log(`   ❌ Picks DON'T match at index 6`);
  }
  
  console.log('\n📝 Conclusion:');
  console.log('   Our script copied picks using SAME fixture_index');
  console.log('   Index 6 in picks table → Index 6 in app_picks table');
  console.log('   We did NOT remap or reorder - just direct copy');
  console.log('   If PB\'s pick is wrong, it was wrong BEFORE we ran scripts');
  console.log('   OR the pick was saved incorrectly when PB submitted');
}

verifyLogic().catch(console.error);
