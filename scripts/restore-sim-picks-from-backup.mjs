#!/usr/bin/env node
/**
 * Restore Sim's GW16 picks from Supabase backup
 * 
 * Steps:
 * 1. Access Supabase dashboard → Database → Backups
 * 2. Find a backup from BEFORE we ran fix-app-picks-from-web-picks.mjs
 * 3. Export Sim's picks from that backup
 * 4. Run this script to restore them
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

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

const simUserId = 'c94f9804-ba11-4cd2-8892-49657aa6412c';
const gw = 16;

async function restoreFromBackup() {
  console.log('🔍 Restoring Sim\'s GW16 picks from backup...\n');
  console.log('📋 Sim\'s details:');
  console.log(`   User ID: ${simUserId}`);
  console.log(`   Name: Sim`);
  console.log(`   Gameweek: ${gw}\n`);
  
  // Check if backup file exists
  const backupFile = join(__dirname, 'sim-gw16-picks-backup.json');
  
  if (!fs.existsSync(backupFile)) {
    console.log('📝 Instructions to get backup data:\n');
    console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to Database → Backups');
    console.log('4. Find a backup from BEFORE we ran fix-app-picks-from-web-picks.mjs');
    console.log('   (Look for a backup from around Dec 12, 2025, before ~11:30 UTC)');
    console.log('5. Click on the backup');
    console.log('6. Use Point-in-Time Recovery or export the app_picks table');
    console.log('7. Query for Sim\'s picks:\n');
    console.log('   SELECT * FROM app_picks');
    console.log('   WHERE user_id = \'c94f9804-ba11-4cd2-8892-49657aa6412c\'');
    console.log('   AND gw = 16');
    console.log('   ORDER BY fixture_index;\n');
    console.log('8. Save the results as JSON in: scripts/sim-gw16-picks-backup.json');
    console.log('   Format: [{ "user_id": "...", "gw": 16, "fixture_index": 0, "pick": "H" }, ...]\n');
    console.log('9. Then run this script again to restore the picks\n');
    return;
  }
  
  // Read backup file
  console.log('📂 Reading backup file...');
  const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  
  if (!Array.isArray(backupData) || backupData.length === 0) {
    console.error('❌ Backup file is empty or invalid format');
    console.log('   Expected: Array of pick objects');
    return;
  }
  
  console.log(`✅ Found ${backupData.length} picks in backup\n`);
  
  // Validate backup data
  console.log('🔍 Validating backup data...');
  const validPicks = backupData.filter(p => 
    p.user_id === simUserId && 
    p.gw === gw && 
    p.fixture_index !== undefined && 
    ['H', 'D', 'A'].includes(p.pick)
  );
  
  if (validPicks.length === 0) {
    console.error('❌ No valid picks found in backup');
    return;
  }
  
  console.log(`✅ Found ${validPicks.length} valid picks\n`);
  
  // Show what we're restoring
  console.log('📋 Picks to restore:');
  validPicks.sort((a, b) => a.fixture_index - b.fixture_index).forEach(p => {
    console.log(`   Index ${p.fixture_index}: ${p.pick}`);
  });
  
  // Get fixtures to show what picks correspond to
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', gw)
    .order('fixture_index');
  
  if (fixtures && fixtures.length > 0) {
    console.log('\n📊 Picks mapped to fixtures:');
    validPicks.sort((a, b) => a.fixture_index - b.fixture_index).forEach(p => {
      const fix = fixtures.find(f => f.fixture_index === p.fixture_index);
      const pickDesc = p.pick === 'H' ? 'HOME WIN' : p.pick === 'A' ? 'AWAY WIN' : 'DRAW';
      console.log(`   ${fix?.home_name || fix?.home_code || '?'} vs ${fix?.away_name || fix?.away_code || '?'}: ${p.pick} (${pickDesc})`);
    });
  }
  
  // Confirm before restoring
  console.log('\n⚠️  Ready to restore Sim\'s picks to app_picks table');
  console.log('   This will insert/update picks for Sim in app_picks');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Restore picks
  console.log('🔄 Restoring picks...');
  
  const picksToInsert = validPicks.map(p => ({
    user_id: p.user_id,
    gw: p.gw,
    fixture_index: p.fixture_index,
    pick: p.pick
  }));
  
  // Insert picks (upsert to handle conflicts)
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < picksToInsert.length; i += batchSize) {
    const batch = picksToInsert.slice(i, i + batchSize);
    const { error: insertErr } = await supabase
      .from('app_picks')
      .upsert(batch, { 
        onConflict: 'user_id,gw,fixture_index',
        ignoreDuplicates: false 
      });
    
    if (insertErr) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertErr);
      return;
    }
    inserted += batch.length;
  }
  
  console.log(`✅ Restored ${inserted} picks\n`);
  
  // Verify restoration
  console.log('🔍 Verifying restoration...');
  const { data: restoredPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', simUserId)
    .eq('gw', gw)
    .order('fixture_index');
  
  if (restoredPicks && restoredPicks.length === validPicks.length) {
    console.log(`✅ Successfully restored ${restoredPicks.length} picks`);
    console.log('\n📋 Restored picks:');
    restoredPicks.forEach(p => {
      const fix = fixtures?.find(f => f.fixture_index === p.fixture_index);
      console.log(`   Index ${p.fixture_index}: ${fix?.home_name || fix?.home_code || '?'} vs ${fix?.away_name || fix?.away_code || '?'} = ${p.pick}`);
    });
  } else {
    console.error(`❌ Verification failed: Expected ${validPicks.length} picks, found ${restoredPicks?.length || 0}`);
  }
  
  console.log('\n✅ Restoration complete!');
  console.log('   Sim\'s picks should now be visible in the app');
}

restoreFromBackup().catch(console.error);
