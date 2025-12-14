#!/usr/bin/env node
/**
 * Test script to verify trigger matching logic before deploying
 * Checks if fixtures can be matched correctly by codes
 */

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

async function testMatchingLogic() {
  console.log('🧪 Testing trigger matching logic...\n');
  
  // Test with GW16 (the one we just fixed)
  const gw = 16;
  
  // Get web fixtures
  const { data: webFixtures } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  // Get app fixtures
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  if (!webFixtures || webFixtures.length === 0) {
    console.log('⚠️  No web fixtures found for GW16');
    return;
  }
  
  if (!appFixtures || appFixtures.length === 0) {
    console.log('⚠️  No app fixtures found for GW16');
    return;
  }
  
  console.log(`📊 Found ${webFixtures.length} web fixtures and ${appFixtures.length} app fixtures\n`);
  
  // Test matching logic
  let allMatched = true;
  let matchesByIndex = 0;
  let matchesByCode = 0;
  let noMatch = 0;
  
  console.log('🔍 Testing matching logic:\n');
  
  for (const webFix of webFixtures) {
    // Normalize codes (handle aliases like NFO -> NOT)
    const webHomeNorm = webFix.home_code === 'NFO' ? 'NOT' : webFix.home_code;
    const webAwayNorm = webFix.away_code === 'NFO' ? 'NOT' : webFix.away_code;
    
    // Try to find matching app fixture by codes (like the trigger does)
    const matchingAppFix = appFixtures.find(appFix => {
      if (webHomeNorm && webAwayNorm && appFix.home_code && appFix.away_code) {
        return (
          (appFix.home_code === webHomeNorm && appFix.away_code === webAwayNorm) ||
          (appFix.home_code === webAwayNorm && appFix.away_code === webHomeNorm)
        );
      }
      return false;
    });
    
    const matchByIndex = appFixtures.find(f => f.fixture_index === webFix.fixture_index);
    
    if (matchingAppFix) {
      matchesByCode++;
      const sameIndex = matchingAppFix.fixture_index === webFix.fixture_index;
      if (sameIndex) {
        matchesByIndex++;
        console.log(`✅ Index ${webFix.fixture_index}: ${webFix.home_code} v ${webFix.away_code} - Matched by code (same index)`);
      } else {
        console.log(`⚠️  Index ${webFix.fixture_index}: ${webFix.home_code} v ${webFix.away_code} - Matched by code BUT DIFFERENT INDEX (${matchingAppFix.fixture_index})`);
        allMatched = false;
      }
    } else if (matchByIndex) {
      // Would fall back to fixture_index
      console.log(`⚠️  Index ${webFix.fixture_index}: ${webFix.home_code} v ${webFix.away_code} - No code match, would fall back to fixture_index`);
      if (!webFix.home_code || !webFix.away_code) {
        console.log(`   ⚠️  Missing codes: home_code=${webFix.home_code}, away_code=${webFix.away_code}`);
      }
      noMatch++;
    } else {
      console.log(`❌ Index ${webFix.fixture_index}: ${webFix.home_code} v ${webFix.away_code} - NO MATCH FOUND`);
      allMatched = false;
      noMatch++;
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Matched by code (same index): ${matchesByIndex}`);
  console.log(`   ⚠️  Matched by code (different index): ${matchesByCode - matchesByIndex}`);
  console.log(`   ⚠️  No code match (would fall back): ${noMatch}`);
  
  if (allMatched && matchesByCode === webFixtures.length) {
    console.log(`\n✅ All fixtures can be matched by codes!`);
    console.log(`   Triggers will work correctly.`);
  } else if (matchesByCode > 0) {
    console.log(`\n⚠️  Some fixtures matched by codes, but:`);
    console.log(`   - ${matchesByCode - matchesByIndex} fixtures are in different positions`);
    console.log(`   - ${noMatch} fixtures would fall back to fixture_index`);
    console.log(`   Triggers will still work, but may need fixture alignment.`);
  } else {
    console.log(`\n❌ No fixtures matched by codes!`);
    console.log(`   Triggers will fall back to fixture_index (same as before).`);
    console.log(`   Check if fixtures have codes populated.`);
  }
  
  // Check for missing codes
  const webMissingCodes = webFixtures.filter(f => !f.home_code || !f.away_code).length;
  const appMissingCodes = appFixtures.filter(f => !f.home_code || !f.away_code).length;
  
  if (webMissingCodes > 0 || appMissingCodes > 0) {
    console.log(`\n⚠️  Missing codes:`);
    console.log(`   Web fixtures: ${webMissingCodes} missing codes`);
    console.log(`   App fixtures: ${appMissingCodes} missing codes`);
  }
}

testMatchingLogic().catch(console.error);
