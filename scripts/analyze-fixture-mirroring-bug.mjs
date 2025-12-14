#!/usr/bin/env node
/**
 * Analyze the fixture mirroring bug
 * Web fixtures table has null values, app fixtures table has correct values
 * Mirror trigger uses fixture_index, so picks get applied to wrong games
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

async function analyzeBug() {
  console.log('🔍 Analyzing fixture mirroring bug...\n');
  
  // Get fixtures from both tables
  const { data: webFixtures } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  const { data: appFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  console.log('📊 WEB fixtures table (fixtures):');
  webFixtures?.forEach(f => {
    console.log(`   Index ${f.fixture_index}: ${f.home_name || 'null'} vs ${f.away_name || 'null'}`);
  });
  
  console.log('\n📊 APP fixtures table (app_fixtures):');
  appFixtures?.forEach(f => {
    console.log(`   Index ${f.fixture_index}: ${f.home_name} vs ${f.away_name}`);
  });
  
  // Check how mirror trigger works
  console.log('\n🔍 MIRROR TRIGGER LOGIC:');
  console.log('   Line 23-24: INSERT INTO app_picks (user_id, gw, fixture_index, pick)');
  console.log('   VALUES (NEW.user_id, NEW.gw, NEW.fixture_index, NEW.pick)');
  console.log('   ⚠️  Uses ONLY fixture_index - does NOT check which game it is!');
  
  // Example: David Bird's picks
  const dbUserId = 'd2cbeca9-7dae-4be1-88fb-706911d67256';
  const { data: dbPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', dbUserId)
    .eq('gw', 16)
    .order('fixture_index');
  
  console.log('\n📋 David Bird\'s picks in picks table:');
  dbPicks?.forEach(p => {
    const webFix = webFixtures?.find(f => f.fixture_index === p.fixture_index);
    const appFix = appFixtures?.find(f => f.fixture_index === p.fixture_index);
    console.log(`   Index ${p.fixture_index}: Pick=${p.pick}`);
    console.log(`      Web fixture: ${webFix?.home_name || 'null'} vs ${webFix?.away_name || 'null'}`);
    console.log(`      App fixture: ${appFix?.home_name} vs ${appFix?.away_name}`);
    console.log(`      ⚠️  Pick for "${webFix?.home_name || 'null'} vs ${webFix?.away_name || 'null'}" was applied to "${appFix?.home_name} vs ${appFix?.away_name}"`);
  });
  
  // Check if fixtures were mirrored correctly
  console.log('\n🔍 FIXTURE MIRRORING:');
  console.log('   Trigger: mirror_fixtures_to_app()');
  console.log('   Line 85-108: Mirrors fixtures from web to app using fixture_index');
  console.log('   ⚠️  If web fixtures have null values, null values get mirrored to app!');
  console.log('   ⚠️  If fixtures are in wrong order on web, wrong order gets mirrored!');
  
  // Check when fixtures were created/updated
  if (webFixtures && webFixtures.length > 0) {
    const webCreated = webFixtures.map(f => f.created_at).filter(Boolean);
    const webUpdated = webFixtures.map(f => f.updated_at).filter(Boolean);
    
    if (webCreated.length > 0) {
      console.log(`\n📅 Web fixtures created: ${new Date(Math.min(...webCreated.map(d => new Date(d).getTime()))).toISOString()}`);
    }
    if (webUpdated.length > 0) {
      console.log(`📅 Web fixtures updated: ${new Date(Math.max(...webUpdated.map(d => new Date(d).getTime()))).toISOString()}`);
    }
  }
  
  if (appFixtures && appFixtures.length > 0) {
    const appCreated = appFixtures.map(f => f.created_at).filter(Boolean);
    const appUpdated = appFixtures.map(f => f.updated_at).filter(Boolean);
    
    if (appCreated.length > 0) {
      console.log(`📅 App fixtures created: ${new Date(Math.min(...appCreated.map(d => new Date(d).getTime()))).toISOString()}`);
    }
    if (appUpdated.length > 0) {
      console.log(`📅 App fixtures updated: ${new Date(Math.max(...appUpdated.map(d => new Date(d).getTime()))).toISOString()}`);
    }
  }
  
  console.log('\n💡 ROOT CAUSE:');
  console.log('   1. Web fixtures table has null values (or wrong order)');
  console.log('   2. Mirror trigger copies picks using ONLY fixture_index');
  console.log('   3. Pick for fixture_index 4 on web gets copied to fixture_index 4 on app');
  console.log('   4. But fixture_index 4 represents DIFFERENT games on web vs app!');
  console.log('   5. Result: Picks are applied to wrong games');
}

analyzeBug().catch(console.error);
