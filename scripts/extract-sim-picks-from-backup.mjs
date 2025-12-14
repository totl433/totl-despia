#!/usr/bin/env node
/**
 * Extract Sim's picks from Supabase backup file
 * 
 * This script will:
 * 1. Use pg_restore to extract app_picks table from backup
 * 2. Query for Sim's GW16 picks
 * 3. Save them in the format needed for restoration
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const simUserId = 'c94f9804-ba11-4cd2-8892-49657aa6412c';
const gw = 16;

async function extractFromBackup() {
  console.log('🔍 Extracting Sim\'s picks from backup file...\n');
  
  // Look for backup file
  const backupFile = process.argv[2] || 'db_cluster-14-12-2025@04-33-06.backup';
  const backupPath = join(__dirname, backupFile);
  
  if (!fs.existsSync(backupPath)) {
    console.log('❌ Backup file not found!');
    console.log(`   Looking for: ${backupPath}`);
    console.log('\n📝 Usage:');
    console.log('   node scripts/extract-sim-picks-from-backup.mjs [path-to-backup-file]');
    console.log('\n   Or place the backup file in the scripts/ directory');
    return;
  }
  
  console.log(`✅ Found backup file: ${backupPath}\n`);
  
  // Check if pg_restore is available
  try {
    execSync('which pg_restore', { stdio: 'ignore' });
  } catch (e) {
    console.log('❌ pg_restore not found!');
    console.log('\n📝 You need PostgreSQL client tools installed:');
    console.log('   macOS: brew install postgresql');
    console.log('   Or use Docker: docker run --rm -v "$PWD":/backup postgres:15 pg_restore ...');
    console.log('\n   Alternatively, you can restore the backup to a temporary database');
    console.log('   and query it manually.');
    return;
  }
  
  console.log('📋 Step 1: Extracting app_picks table structure and data...\n');
  
  // Create temp directory for extracted data
  const tempDir = join(__dirname, 'temp_backup_extract');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  try {
    // Extract just the app_picks table data
    console.log('   Extracting app_picks table...');
    execSync(`pg_restore -t app_picks -f ${join(tempDir, 'app_picks.sql')} "${backupPath}"`, {
      stdio: 'inherit'
    });
    
    console.log('✅ Extraction complete!\n');
    
    // Read the SQL file
    const sqlFile = join(tempDir, 'app_picks.sql');
    if (fs.existsSync(sqlFile)) {
      console.log('📋 Step 2: Parsing extracted data...\n');
      
      const sqlContent = fs.readFileSync(sqlFile, 'utf8');
      
      // Parse INSERT statements or COPY statements
      // Look for Sim's picks
      const simPicks = [];
      
      // Try to find COPY or INSERT statements with Sim's user_id
      const lines = sqlContent.split('\n');
      let inCopyBlock = false;
      let copyColumns = [];
      
      for (const line of lines) {
        // Check for COPY statement
        if (line.match(/^COPY.*app_picks/i)) {
          inCopyBlock = true;
          // Extract column names
          const match = line.match(/\(([^)]+)\)/);
          if (match) {
            copyColumns = match[1].split(',').map(c => c.trim().replace(/"/g, ''));
          }
          continue;
        }
        
        if (line === '\\.' || line === '') {
          inCopyBlock = false;
          continue;
        }
        
        if (inCopyBlock) {
          // Parse COPY data
          const values = line.split('\t');
          if (values.length >= copyColumns.length) {
            const row = {};
            copyColumns.forEach((col, idx) => {
              row[col] = values[idx];
            });
            
            // Check if this is Sim's pick for GW16
            if (row.user_id === simUserId && parseInt(row.gw) === gw) {
              simPicks.push({
                user_id: row.user_id,
                gw: parseInt(row.gw),
                fixture_index: parseInt(row.fixture_index),
                pick: row.pick
              });
            }
          }
        }
        
        // Also check for INSERT statements
        if (line.match(/^INSERT INTO.*app_picks/i)) {
          // Parse INSERT statement
          const match = line.match(/VALUES\s*\(([^)]+)\)/);
          if (match) {
            const values = match[1].split(',').map(v => v.trim().replace(/'/g, ''));
            // Assuming order: user_id, gw, fixture_index, pick
            if (values[0] === simUserId && parseInt(values[1]) === gw) {
              simPicks.push({
                user_id: values[0],
                gw: parseInt(values[1]),
                fixture_index: parseInt(values[2]),
                pick: values[3]
              });
            }
          }
        }
      }
      
      if (simPicks.length > 0) {
        console.log(`✅ Found ${simPicks.length} picks for Sim!\n`);
        
        // Sort by fixture_index
        simPicks.sort((a, b) => a.fixture_index - b.fixture_index);
        
        // Show picks
        console.log('📋 Sim\'s GW16 picks:');
        simPicks.forEach(p => {
          console.log(`   Index ${p.fixture_index}: ${p.pick}`);
        });
        
        // Save to JSON file
        const outputFile = join(__dirname, 'sim-gw16-picks-backup.json');
        fs.writeFileSync(outputFile, JSON.stringify(simPicks, null, 2));
        console.log(`\n✅ Saved picks to: ${outputFile}`);
        console.log('\n📝 Next step:');
        console.log('   Run: node scripts/restore-sim-picks-from-backup.mjs');
      } else {
        console.log('⚠️  No picks found for Sim in the backup');
        console.log('   The backup might be from before Sim submitted');
        console.log('   Or the extraction method needs adjustment');
      }
    } else {
      console.log('⚠️  Could not find extracted SQL file');
      console.log('   The backup format might be different');
      console.log('   Try manual extraction or restore to temp database');
    }
    
  } catch (error) {
    console.error('❌ Error extracting from backup:', error.message);
    console.log('\n💡 Alternative approach:');
    console.log('   1. Restore backup to a temporary PostgreSQL database');
    console.log('   2. Query: SELECT * FROM app_picks WHERE user_id = \'' + simUserId + '\' AND gw = ' + gw);
    console.log('   3. Save results as JSON');
    console.log('   4. Run: node scripts/restore-sim-picks-from-backup.mjs');
  } finally {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

extractFromBackup().catch(console.error);
