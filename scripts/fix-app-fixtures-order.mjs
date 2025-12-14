#!/usr/bin/env node
/**
 * Fix app_fixtures table to match web fixture order
 * This ensures fixture_index values align correctly for future mirroring
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

// Web fixture order (correct reference)
const WEB_FIXTURE_ORDER = [
  { home: 'Chelsea', away: 'Everton', homeCode: 'CHE', awayCode: 'EVE' },
  { home: 'Liverpool', away: 'Brighton', homeCode: 'LIV', awayCode: 'BHA' },
  { home: 'Burnley', away: 'Fulham', homeCode: 'BUR', awayCode: 'FUL' },
  { home: 'Arsenal', away: 'Wolves', homeCode: 'ARS', awayCode: 'WOL' },
  { home: 'Crystal Palace', away: 'Manchester City', homeCode: 'CRY', awayCode: 'MCI' },
  { home: 'Nottingham Forest', away: 'Tottenham', homeCode: 'NFO', awayCode: 'TOT' },
  { home: 'Sunderland', away: 'Newcastle', homeCode: 'SUN', awayCode: 'NEW' },
  { home: 'West Ham', away: 'Aston Villa', homeCode: 'WHU', awayCode: 'AVL' },
  { home: 'Brentford', away: 'Leeds', homeCode: 'BRE', awayCode: 'LEE' },
  { home: 'Manchester United', away: 'Bournemouth', homeCode: 'MUN', awayCode: 'BOU' },
];

function normalizeTeamName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\s+fc\s*/gi, ' ')
    .replace(/\s+&/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchFixture(webFixture, appFixture) {
  const webHome = normalizeTeamName(webFixture.home);
  const webAway = normalizeTeamName(webFixture.away);
  const appHome = normalizeTeamName(appFixture.home_name);
  const appAway = normalizeTeamName(appFixture.away_name);
  
  return (webHome === appHome || webFixture.homeCode === appFixture.home_code) &&
         (webAway === appAway || webFixture.awayCode === appFixture.away_code);
}

async function fixAppFixtures() {
  console.log('🔧 Fixing app_fixtures table to match web fixture order...\n');
  
  const gw = 16;
  
  // Get current app fixtures
  const { data: appFixtures, error: appFixErr } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index', { ascending: true });
  
  if (appFixErr) {
    console.error('❌ Error fetching app fixtures:', appFixErr);
    return;
  }
  
  console.log('📊 Current app fixtures:');
  appFixtures?.forEach((f, i) => {
    console.log(`   ${i}. ${f.home_name} vs ${f.away_name}`);
  });
  
  // Create mapping: web order -> app fixture data
  const remappedFixtures = [];
  
  console.log('\n🔍 Remapping fixtures to web order...');
  WEB_FIXTURE_ORDER.forEach((webFix, webIndex) => {
    const appFix = appFixtures?.find(f => matchFixture(webFix, f));
    if (appFix) {
      remappedFixtures.push({
        ...appFix,
        fixture_index: webIndex  // Update fixture_index to match web order
      });
      console.log(`   Web index ${webIndex}: ${webFix.homeCode} v ${webFix.awayCode} -> ${appFix.home_name} vs ${appFix.away_name}`);
    } else {
      console.log(`   ⚠️  Could not find match for ${webFix.homeCode} v ${webFix.awayCode}`);
    }
  });
  
  if (remappedFixtures.length !== 10) {
    console.error(`❌ Expected 10 fixtures, found ${remappedFixtures.length}`);
    return;
  }
  
  console.log('\n🔧 Updating app_fixtures...');
  
  // Delete all GW16 fixtures
  const { error: deleteErr } = await supabase
    .from('app_fixtures')
    .delete()
    .eq('gw', gw);
  
  if (deleteErr) {
    console.error('❌ Error deleting fixtures:', deleteErr);
    return;
  }
  console.log('✅ Deleted all GW16 fixtures from app_fixtures');
  
  // Insert remapped fixtures
  const { error: insertErr } = await supabase
    .from('app_fixtures')
    .insert(remappedFixtures.map(f => ({
      gw: f.gw,
      fixture_index: f.fixture_index,
      home_team: f.home_team,
      away_team: f.away_team,
      home_code: f.home_code,
      away_code: f.away_code,
      home_name: f.home_name,
      away_name: f.away_name,
      kickoff_time: f.kickoff_time,
      api_match_id: f.api_match_id
    })));
  
  if (insertErr) {
    console.error('❌ Error inserting fixtures:', insertErr);
    return;
  }
  
  console.log('✅ Inserted remapped fixtures\n');
  
  // Verify
  const { data: verifyFixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index', { ascending: true });
  
  console.log('📊 Updated app fixtures order:');
  verifyFixtures?.forEach((f, i) => {
    console.log(`   ${i}. ${f.home_name} vs ${f.away_name}`);
  });
  
  console.log('\n✅ Fix complete!');
  console.log('   app_fixtures now matches web fixture order');
  console.log('   Future mirroring will work correctly');
}

fixAppFixtures().catch(console.error);
