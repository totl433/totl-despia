#!/usr/bin/env node
/**
 * Parse backup file to extract Sim's picks
 * 
 * Usage:
 * 1. Copy the relevant lines from the backup file (lines containing Sim's user_id and gw=16)
 * 2. Paste them into a file called sim-picks-raw.txt in the scripts/ directory
 * 3. Run: node scripts/parse-backup-for-sim.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const simUserId = 'c94f9804-ba11-4cd2-8892-49657aa6412c';
const gw = 16;

function parseBackup() {
  console.log('🔍 Parsing backup file for Sim\'s picks...\n');
  
  // Try to find backup file or raw text file
  const backupFile = process.argv[2] || join(__dirname, 'sim-picks-raw.txt');
  
  if (!fs.existsSync(backupFile)) {
    console.log('📝 Instructions:\n');
    console.log('1. Open the backup file in TextEdit');
    console.log('2. Search for: c94f9804-ba11-4cd2-8892-49657aa6412c');
    console.log('3. Find lines that also contain: 16 (for GW16)');
    console.log('4. Copy those lines and save them to: scripts/sim-picks-raw.txt');
    console.log('5. Run this script again\n');
    console.log('OR: Pass the backup file path as argument:');
    console.log('   node scripts/parse-backup-for-sim.mjs path/to/backup.file\n');
    return;
  }
  
  console.log(`📂 Reading file: ${backupFile}\n`);
  const content = fs.readFileSync(backupFile, 'utf8');
  const lines = content.split('\n');
  
  console.log(`📊 Found ${lines.length} lines in file\n`);
  
  const simPicks = [];
  
  // Look for lines containing Sim's user_id and gw=16
  lines.forEach((line, idx) => {
    if (line.includes(simUserId) && line.includes('16')) {
      // Try to parse different formats
      // Format 1: Tab-separated: user_id\tgw\tfixture_index\tpick
      // Format 2: Space-separated
      // Format 3: COPY format
      
      const parts = line.split(/\t|  +/); // Split on tabs or multiple spaces
      
      // Find user_id index
      const userIdIdx = parts.findIndex(p => p.includes(simUserId));
      if (userIdIdx === -1) return;
      
      // Try to find gw=16
      const gwIdx = parts.findIndex((p, i) => i > userIdIdx && p.trim() === '16');
      if (gwIdx === -1) return;
      
      // Next should be fixture_index
      const fixtureIdx = parseInt(parts[gwIdx + 1]);
      if (isNaN(fixtureIdx)) return;
      
      // Next should be pick (H, D, or A)
      const pick = parts[gwIdx + 2]?.trim();
      if (!['H', 'D', 'A'].includes(pick)) return;
      
      simPicks.push({
        user_id: simUserId,
        gw: gw,
        fixture_index: fixtureIdx,
        pick: pick
      });
      
      console.log(`✅ Found pick: Index ${fixtureIdx} = ${pick}`);
    }
  });
  
  if (simPicks.length === 0) {
    console.log('⚠️  No picks found!');
    console.log('\n💡 Try this:');
    console.log('1. Search for: c94f9804-ba11-4cd2-8892-49657aa6412c');
    console.log('2. Look for lines with that ID and the number 16');
    console.log('3. Copy those lines exactly as they appear');
    console.log('4. Save to: scripts/sim-picks-raw.txt');
    console.log('5. Run this script again\n');
    console.log('Example of what to look for:');
    console.log('   c94f9804-ba11-4cd2-8892-49657aa6412c    16    0    H');
    console.log('   c94f9804-ba11-4cd2-8892-49657aa6412c    16    1    A');
    return;
  }
  
  // Sort by fixture_index
  simPicks.sort((a, b) => a.fixture_index - b.fixture_index);
  
  console.log(`\n✅ Found ${simPicks.length} picks!\n`);
  
  // Check if we have all 10
  if (simPicks.length !== 10) {
    console.log(`⚠️  Expected 10 picks, found ${simPicks.length}`);
    console.log('   Missing indices:');
    for (let i = 0; i < 10; i++) {
      if (!simPicks.find(p => p.fixture_index === i)) {
        console.log(`   - Index ${i}`);
      }
    }
  }
  
  // Show all picks
  console.log('\n📋 Sim\'s GW16 picks:');
  simPicks.forEach(p => {
    console.log(`   Index ${p.fixture_index}: ${p.pick}`);
  });
  
  // Save as JSON
  const outputFile = join(__dirname, 'sim-gw16-picks-backup.json');
  fs.writeFileSync(outputFile, JSON.stringify(simPicks, null, 2));
  
  console.log(`\n✅ Saved to: ${outputFile}`);
  console.log('\n📝 Next step:');
  console.log('   node scripts/restore-sim-picks-from-backup.mjs');
}

parseBackup();
