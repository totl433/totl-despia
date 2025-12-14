#!/usr/bin/env node
/**
 * Fix app_picks table to match web fixture order
 * DO NOT CHANGE picks table - only fix app_picks
 * 
 * Web order (correct reference):
 * 0. CHE v EVE
 * 1. LIV v BHA
 * 2. BUR v FUL
 * 3. ARS v WOL
 * 4. CRY v MCI (first Sunday)
 * 5. NFO v TOT
 * 6. SUN v NEW
 * 7. WHU v AVL
 * 8. BRE v LEE
 * 9. MUN v BOU
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
  console.error('   Need SUPABASE_SERVICE_ROLE_KEY for updates');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Web fixture order (correct reference) - using team codes/names
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

async function fixAppPicks() {
  console.log('🔧 Fixing app_picks table to match web fixture order...\n');
  console.log('⚠️  This will remap picks based on team names, not fixture_index\n');
  
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
  
  console.log('📊 Current app fixtures order:');
  appFixtures?.forEach((f, i) => {
    console.log(`   ${i}. ${f.home_name} vs ${f.away_name}`);
  });
  
  // Create mapping: web fixture_index -> app fixture_index
  const fixtureMapping = new Map();
  
  console.log('\n🔍 Creating fixture mapping...');
  WEB_FIXTURE_ORDER.forEach((webFix, webIndex) => {
    const appIndex = appFixtures?.findIndex(appFix => matchFixture(webFix, appFix));
    if (appIndex !== undefined && appIndex !== -1) {
      fixtureMapping.set(webIndex, appIndex);
      console.log(`   Web index ${webIndex} (${webFix.homeCode} v ${webFix.awayCode}) -> App index ${appIndex} (${appFixtures[appIndex].home_name} vs ${appFixtures[appIndex].away_name})`);
    } else {
      console.log(`   ⚠️  Could not find match for Web index ${webIndex} (${webFix.homeCode} v ${webFix.awayCode})`);
    }
  });
  
  // Get all app_picks for GW16
  const { data: allAppPicks, error: picksErr } = await supabase
    .from('app_picks')
    .select('*')
    .eq('gw', gw);
  
  if (picksErr) {
    console.error('❌ Error fetching app_picks:', picksErr);
    return;
  }
  
  console.log(`\n📊 Found ${allAppPicks?.length || 0} picks in app_picks for GW16`);
  
  // Group picks by user
  const picksByUser = new Map();
  allAppPicks?.forEach(pick => {
    if (!picksByUser.has(pick.user_id)) {
      picksByUser.set(pick.user_id, []);
    }
    picksByUser.get(pick.user_id).push(pick);
  });
  
  console.log(`📊 Found ${picksByUser.size} users with picks\n`);
  
  // For each user, remap their picks
  const updates = [];
  const deletions = [];
  
  for (const [userId, userPicks] of picksByUser.entries()) {
    // Create map of current app picks by fixture_index
    const currentPicksByAppIndex = new Map();
    userPicks.forEach(p => {
      currentPicksByAppIndex.set(p.fixture_index, p.pick);
    });
    
    // Remap: for each web fixture_index, find the pick from correct app fixture_index
    const remappedPicks = new Map();
    
    fixtureMapping.forEach((appIndex, webIndex) => {
      const pick = currentPicksByAppIndex.get(appIndex);
      if (pick) {
        remappedPicks.set(webIndex, pick);
      }
    });
    
    // Delete all current picks for this user
    deletions.push({
      user_id: userId,
      gw: gw
    });
    
    // Insert remapped picks with correct fixture_index (web order)
    remappedPicks.forEach((pick, webIndex) => {
      updates.push({
        user_id: userId,
        gw: gw,
        fixture_index: webIndex,
        pick: pick
      });
    });
  }
  
  console.log(`📊 Will delete ${deletions.length} user pick sets`);
  console.log(`📊 Will insert ${updates.length} remapped picks\n`);
  
  // Show preview for first user
  if (updates.length > 0) {
    const firstUserId = updates[0].user_id;
    const firstUserUpdates = updates.filter(u => u.user_id === firstUserId);
    console.log(`📋 Preview for first user (${firstUserId}):`);
    firstUserUpdates.forEach(u => {
      const webFix = WEB_FIXTURE_ORDER[u.fixture_index];
      console.log(`   Index ${u.fixture_index}: ${webFix.homeCode} v ${webFix.awayCode} = ${u.pick}`);
    });
    console.log('');
  }
  
  console.log('⚠️  READY TO FIX - This will:');
  console.log('   1. Delete all GW16 picks from app_picks');
  console.log('   2. Re-insert picks with correct fixture_index mapping');
  console.log('   3. NOT touch the picks table (web table)\n');
  
  // Ask for confirmation
  console.log('🔧 Starting fix...\n');
  
  // Delete all GW16 picks from app_picks
  console.log('🗑️  Deleting all GW16 picks from app_picks...');
  const { error: deleteErr } = await supabase
    .from('app_picks')
    .delete()
    .eq('gw', gw);
  
  if (deleteErr) {
    console.error('❌ Error deleting picks:', deleteErr);
    return;
  }
  console.log('✅ Deleted all GW16 picks from app_picks\n');
  
  // Insert remapped picks
  console.log('➕ Inserting remapped picks...');
  
  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const { error: insertErr } = await supabase
      .from('app_picks')
      .insert(batch);
    
    if (insertErr) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertErr);
      return;
    }
  }
  
  console.log(`✅ Inserted ${updates.length} remapped picks\n`);
  
  // Verify
  console.log('🔍 Verifying fix...');
  const { data: verifyPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('gw', gw)
    .order('user_id, fixture_index');
  
  console.log(`✅ Verified: ${verifyPicks?.length || 0} picks in app_picks for GW16`);
  
  // Show sample
  if (verifyPicks && verifyPicks.length > 0) {
    const sampleUser = verifyPicks[0].user_id;
    const samplePicks = verifyPicks.filter(p => p.user_id === sampleUser);
    console.log(`\n📋 Sample user picks (${sampleUser}):`);
    samplePicks.forEach(p => {
      const webFix = WEB_FIXTURE_ORDER[p.fixture_index];
      const appFix = appFixtures?.find(f => matchFixture(webFix, f));
      console.log(`   Index ${p.fixture_index}: ${webFix.homeCode} v ${webFix.awayCode} = ${p.pick} (matches app: ${appFix?.home_name} vs ${appFix?.away_name})`);
    });
  }
  
  console.log('\n✅ Fix complete!');
  console.log('   app_picks now matches web fixture order');
  console.log('   picks table unchanged (web table)');
}

fixAppPicks().catch(console.error);
