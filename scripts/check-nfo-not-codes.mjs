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

async function checkCodes() {
  console.log('🔍 Checking NFO vs NOT codes for fixture_index 5, GW16...\n');
  
  const gw = 16;
  const fixtureIndex = 5;
  
  // Get web fixture
  const { data: webFix } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', gw)
    .eq('fixture_index', fixtureIndex)
    .single();
  
  // Get app fixture
  const { data: appFix } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .eq('fixture_index', fixtureIndex)
    .single();
  
  console.log('📊 Web fixture (fixtures table):');
  console.log(`   fixture_index: ${webFix?.fixture_index}`);
  console.log(`   home_code: ${webFix?.home_code || 'NULL'}`);
  console.log(`   away_code: ${webFix?.away_code || 'NULL'}`);
  console.log(`   home_team: ${webFix?.home_team || 'NULL'}`);
  console.log(`   away_team: ${webFix?.away_team || 'NULL'}`);
  console.log(`   home_name: ${webFix?.home_name || 'NULL'}`);
  console.log(`   away_name: ${webFix?.away_name || 'NULL'}`);
  
  console.log('\n📊 App fixture (app_fixtures table):');
  console.log(`   fixture_index: ${appFix?.fixture_index}`);
  console.log(`   home_code: ${appFix?.home_code || 'NULL'}`);
  console.log(`   away_code: ${appFix?.away_code || 'NULL'}`);
  console.log(`   home_team: ${appFix?.home_team || 'NULL'}`);
  console.log(`   away_team: ${appFix?.away_team || 'NULL'}`);
  console.log(`   home_name: ${appFix?.home_name || 'NULL'}`);
  console.log(`   away_name: ${appFix?.away_name || 'NULL'}`);
  
  console.log('\n🔍 Comparison:');
  if (webFix?.home_code && appFix?.home_code) {
    console.log(`   home_code match: ${webFix.home_code === appFix.home_code ? '✅' : '❌'} (${webFix.home_code} vs ${appFix.home_code})`);
  }
  if (webFix?.away_code && appFix?.away_code) {
    console.log(`   away_code match: ${webFix.away_code === appFix.away_code ? '✅' : '❌'} (${webFix.away_code} vs ${appFix.away_code})`);
  }
  
  // Check if they match when swapped
  if (webFix?.home_code && appFix?.away_code && webFix?.away_code && appFix?.home_code) {
    const swappedMatch = (webFix.home_code === appFix.away_code && webFix.away_code === appFix.home_code);
    console.log(`   Swapped match: ${swappedMatch ? '✅' : '❌'}`);
  }
}

checkCodes().catch(console.error);
