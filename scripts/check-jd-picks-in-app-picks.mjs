#!/usr/bin/env node
/**
 * Check if Joe Devine's picks are in app_picks table
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

async function checkJDPicks() {
  console.log('🔍 Checking Joe Devine\'s picks...\n');
  
  const jdUserId = '51eb44c0-6222-45f1-827f-40dc82b9bd84';
  
  // Check picks table
  const { data: picksData, error: picksError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', jdUserId)
    .eq('gw', 16);
  
  console.log('📊 Picks in "picks" table (GW16):');
  if (picksError) {
    console.log(`   Error: ${picksError.message}`);
  } else {
    console.log(`   Found ${picksData?.length || 0} picks`);
    if (picksData && picksData.length > 0) {
      picksData.forEach(p => {
        console.log(`   Fixture ${p.fixture_index}: ${p.pick}`);
      });
    }
  }
  
  // Check app_picks table
  const { data: appPicksData, error: appPicksError } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', jdUserId)
    .eq('gw', 16);
  
  console.log('\n📊 Picks in "app_picks" table (GW16):');
  if (appPicksError) {
    console.log(`   Error: ${appPicksError.message}`);
  } else {
    console.log(`   Found ${appPicksData?.length || 0} picks`);
    if (appPicksData && appPicksData.length > 0) {
      appPicksData.forEach(p => {
        console.log(`   Fixture ${p.fixture_index}: ${p.pick}`);
      });
    }
  }
  
  // Get fixtures for context
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (appPicksData && appPicksData.length > 0 && fixtures) {
    console.log('\n📋 Joe Devine\'s GW16 picks from app_picks:');
    appPicksData.forEach(p => {
      const fixture = fixtures.find(f => f.fixture_index === p.fixture_index);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${p.fixture_index}`;
      console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick}`);
    });
  }
  
  console.log('\n💡 CONCLUSION:');
  if (picksData && picksData.length > 0) {
    console.log('   ✅ Joe Devine HAS picks in "picks" table');
  } else {
    console.log('   ❌ Joe Devine does NOT have picks in "picks" table');
  }
  
  if (appPicksData && appPicksData.length > 0) {
    console.log('   ✅ Joe Devine HAS picks in "app_picks" table');
    console.log('   🎯 The live website must be reading from "app_picks" table!');
  } else {
    console.log('   ❌ Joe Devine does NOT have picks in "app_picks" table');
  }
}

checkJDPicks().catch(console.error);
