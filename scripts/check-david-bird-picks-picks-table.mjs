#!/usr/bin/env node
/**
 * Check if David Bird's picks are in picks table (same check as JD)
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

async function checkDavidBirdPicks() {
  console.log('🔍 Checking David Bird\'s picks...\n');
  
  // Get David Bird's user ID
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (!user) {
    console.log('❌ David Bird not found');
    return;
  }
  
  const dbUserId = user.id;
  console.log(`David Bird User ID: ${dbUserId}\n`);
  
  // Check picks table
  const { data: picksData, error: picksError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', dbUserId)
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
    .eq('user_id', dbUserId)
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
  
  if (picksData && picksData.length > 0 && fixtures) {
    console.log('\n📋 David Bird\'s GW16 picks from picks table:');
    picksData.forEach(p => {
      const fixture = fixtures.find(f => f.fixture_index === p.fixture_index);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${p.fixture_index}`;
      console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick}`);
    });
  }
  
  if (appPicksData && appPicksData.length > 0 && fixtures) {
    console.log('\n📋 David Bird\'s GW16 picks from app_picks table:');
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
    console.log('   ✅ David Bird HAS picks in "picks" table');
  } else {
    console.log('   ❌ David Bird does NOT have picks in "picks" table');
  }
  
  if (appPicksData && appPicksData.length > 0) {
    console.log('   ✅ David Bird HAS picks in "app_picks" table');
  } else {
    console.log('   ❌ David Bird does NOT have picks in "app_picks" table');
  }
  
  if (!picksData || picksData.length === 0) {
    if (appPicksData && appPicksData.length > 0) {
      console.log('\n   🎯 David Bird\'s picks are ONLY in "app_picks" table!');
      console.log('   🚨 But the live website queries "picks" table!');
      console.log('   ❓ So where is David Bird\'s data coming from on the live site?');
    }
  }
}

checkDavidBirdPicks().catch(console.error);
