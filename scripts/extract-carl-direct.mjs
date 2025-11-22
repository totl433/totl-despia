import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';
const backupFile = '/Users/jof/Documents/GitHub/totl-web/../Downloads/db_cluster-21-11-2025@03-35-56.backup';

async function extractCarlDirect() {
  console.log('🚨 Extracting Carl data directly from backup...\n');

  // Try to list what's in the backup first
  console.log('📋 Listing backup contents...\n');
  try {
    const list = execSync(`pg_restore --list "${backupFile}" 2>&1`, { encoding: 'utf8' });
    console.log('Backup contains:');
    console.log(list.split('\n').filter(l => l.includes('TABLE DATA') || l.includes('users') || l.includes('picks') || l.includes('submissions')).slice(0, 20).join('\n'));
    console.log('\n');
  } catch (e) {
    console.log('Could not list backup contents\n');
  }

  // Try to extract just the data we need using pg_restore with filters
  console.log('🔍 Extracting Carl-specific data...\n');
  
  const tempDir = '/tmp/carl_extract';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Extract users table data
  try {
    console.log('   Extracting users table...');
    execSync(`pg_restore -t users -a "${backupFile}" > "${tempDir}/users.sql" 2>&1`, { encoding: 'utf8' });
    const usersSQL = fs.readFileSync(`${tempDir}/users.sql`, 'utf8');
    if (usersSQL.includes(CARL_USER_ID)) {
      console.log('   ✅ Found Carl in users table');
      // Parse and extract
      await extractUserData(usersSQL);
    }
  } catch (e) {
    console.log('   ⚠️  Could not extract users table');
  }

  // Extract picks table data
  try {
    console.log('   Extracting picks table...');
    execSync(`pg_restore -t picks -a "${backupFile}" > "${tempDir}/picks.sql" 2>&1`, { encoding: 'utf8' });
    const picksSQL = fs.readFileSync(`${tempDir}/picks.sql`, 'utf8');
    if (picksSQL.includes(CARL_USER_ID)) {
      const count = (picksSQL.match(new RegExp(CARL_USER_ID, 'g')) || []).length;
      console.log(`   ✅ Found ${count} pick records for Carl`);
      await extractPicksData(picksSQL);
    }
  } catch (e) {
    console.log('   ⚠️  Could not extract picks table');
  }

  // Extract submissions
  try {
    console.log('   Extracting gw_submissions table...');
    execSync(`pg_restore -t gw_submissions -a "${backupFile}" > "${tempDir}/submissions.sql" 2>&1`, { encoding: 'utf8' });
    const subsSQL = fs.readFileSync(`${tempDir}/submissions.sql`, 'utf8');
    if (subsSQL.includes(CARL_USER_ID)) {
      const count = (subsSQL.match(new RegExp(CARL_USER_ID, 'g')) || []).length;
      console.log(`   ✅ Found ${count} submission records for Carl`);
      await extractSubmissionsData(subsSQL);
    }
  } catch (e) {
    console.log('   ⚠️  Could not extract submissions table');
  }

  // Extract league_members
  try {
    console.log('   Extracting league_members table...');
    execSync(`pg_restore -t league_members -a "${backupFile}" > "${tempDir}/league_members.sql" 2>&1`, { encoding: 'utf8' });
    const leagueSQL = fs.readFileSync(`${tempDir}/league_members.sql`, 'utf8');
    if (leagueSQL.includes(CARL_USER_ID)) {
      const count = (leagueSQL.match(new RegExp(CARL_USER_ID, 'g')) || []).length;
      console.log(`   ✅ Found ${count} league membership records for Carl`);
      await extractLeagueMembersData(leagueSQL);
    }
  } catch (e) {
    console.log('   ⚠️  Could not extract league_members table');
  }

  // Cleanup
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }

  console.log('\n✅ Extraction complete!\n');
}

async function extractUserData(sql) {
  // Find Carl's user record and restore it
  const lines = sql.split('\n');
  for (const line of lines) {
    if (line.includes(CARL_USER_ID) && line.includes('INSERT') || line.includes('COPY')) {
      // Parse and restore
      console.log('   Restoring user...');
      // For now, just create the user - we'll parse the full data if needed
      await supabase.from('users').upsert({
        id: CARL_USER_ID,
        name: 'Carl',
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      console.log('   ✅ User restored');
      break;
    }
  }
}

async function extractPicksData(sql) {
  const lines = sql.split('\n');
  const picks = [];
  
  for (const line of lines) {
    if (line.includes(CARL_USER_ID)) {
      // Parse COPY format or INSERT format
      if (line.includes('\t')) {
        // COPY format
        const parts = line.split('\t');
        if (parts.length >= 4 && parts[0] === CARL_USER_ID) {
          picks.push({
            user_id: parts[0],
            gw: parseInt(parts[1]) || null,
            fixture_index: parseInt(parts[2]) || null,
            pick: parts[3]?.trim(),
          });
        }
      }
    }
  }

  if (picks.length > 0) {
    console.log(`   Restoring ${picks.length} picks...`);
    // Batch insert
    for (let i = 0; i < picks.length; i += 100) {
      const chunk = picks.slice(i, i + 100);
      await supabase.from('picks').upsert(chunk, { onConflict: 'user_id,gw,fixture_index' });
    }
    console.log(`   ✅ ${picks.length} picks restored`);
  }
}

async function extractSubmissionsData(sql) {
  const lines = sql.split('\n');
  const submissions = [];
  
  for (const line of lines) {
    if (line.includes(CARL_USER_ID)) {
      if (line.includes('\t')) {
        const parts = line.split('\t');
        if (parts.length >= 3 && parts[0] === CARL_USER_ID) {
          submissions.push({
            user_id: parts[0],
            gw: parseInt(parts[1]) || null,
            submitted_at: parts[2] === '\\N' ? null : parts[2]?.trim(),
          });
        }
      }
    }
  }

  if (submissions.length > 0) {
    console.log(`   Restoring ${submissions.length} submissions...`);
    await supabase.from('gw_submissions').upsert(submissions, { onConflict: 'user_id,gw' });
    console.log(`   ✅ ${submissions.length} submissions restored`);
  }
}

async function extractLeagueMembersData(sql) {
  const lines = sql.split('\n');
  const members = [];
  
  for (const line of lines) {
    if (line.includes(CARL_USER_ID)) {
      if (line.includes('\t')) {
        const parts = line.split('\t');
        if (parts.length >= 2 && parts[1] === CARL_USER_ID) {
          members.push({
            league_id: parts[0],
            user_id: parts[1],
          });
        }
      }
    }
  }

  if (members.length > 0) {
    console.log(`   Restoring ${members.length} league memberships...`);
    await supabase.from('league_members').upsert(members, { onConflict: 'league_id,user_id' });
    console.log(`   ✅ ${members.length} league memberships restored`);
  }
}

extractCarlDirect().catch(console.error);

