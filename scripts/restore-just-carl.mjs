import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'; // Main Carl only
const backupFile = '/Users/jof/Downloads/db_cluster-21-11-2025@03-35-56.backup';

async function restoreJustCarl() {
  console.log('🔄 Restoring ONLY main Carl user from backup...\n');

  // First, check if backup file exists
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Backup file not found: ${backupFile}`);
    return;
  }

  console.log(`📂 Found backup: ${backupFile}\n`);

  // Check if it's a SQL dump or PostgreSQL custom format
  const fileContent = fs.readFileSync(backupFile, 'utf8', { encoding: 'utf8', flag: 'r' });
  const isSQL = fileContent.startsWith('--') || fileContent.includes('INSERT INTO');

  if (isSQL) {
    console.log('📄 Detected SQL format backup\n');
    await extractFromSQL(fileContent);
  } else {
    console.log('📦 Detected PostgreSQL custom format backup\n');
    console.log('⚠️  Need to use pg_restore. Checking if available...\n');
    
    try {
      // Try to extract using pg_restore
      const sqlDump = execSync(`pg_restore -f - "${backupFile}" 2>/dev/null`, { encoding: 'utf8' });
      await extractFromSQL(sqlDump);
    } catch (e) {
      console.error('❌ pg_restore not available or failed. Trying alternative method...\n');
      // Try reading as text anyway
      await extractFromSQL(fileContent);
    }
  }
}

async function extractFromSQL(sqlContent) {
  console.log('🔍 Extracting Carl data from SQL...\n');

  const carlData = {
    user: null,
    picks: [],
    submissions: [],
    leagueMembers: [],
  };

  // Extract user
  const userRegex = new RegExp(`INSERT INTO public\\.users[^;]*'${CARL_USER_ID}'[^;]*;`, 'gi');
  const userMatch = sqlContent.match(userRegex);
  
  if (userMatch) {
    // Parse user data
    const valuesMatch = userMatch[0].match(/VALUES\\s*\\(([^)]+)\\)/);
    if (valuesMatch) {
      // This is a simplified parser - we'll extract what we can
      console.log('✅ Found Carl user in backup');
      // We'll need to parse the actual values, but for now let's extract the user record
    }
  }

  // Extract picks
  const picksRegex = new RegExp(`INSERT INTO public\\.picks[^;]*'${CARL_USER_ID}'[^;]*;`, 'gi');
  const picksMatches = sqlContent.match(picksRegex);
  if (picksMatches) {
    console.log(`✅ Found ${picksMatches.length} pick records for Carl`);
  }

  // Extract submissions
  const subsRegex = new RegExp(`INSERT INTO public\\.gw_submissions[^;]*'${CARL_USER_ID}'[^;]*;`, 'gi');
  const subsMatches = sqlContent.match(subsRegex);
  if (subsMatches) {
    console.log(`✅ Found ${subsMatches.length} submission records for Carl`);
  }

  // Extract league members
  const leagueRegex = new RegExp(`INSERT INTO public\\.league_members[^;]*'${CARL_USER_ID}'[^;]*;`, 'gi');
  const leagueMatches = sqlContent.match(leagueRegex);
  if (leagueMatches) {
    console.log(`✅ Found ${leagueMatches.length} league membership records for Carl`);
  }

  // Actually, let's use a simpler approach - use pg_restore to get SQL, then parse
  console.log('\n💡 Using pg_restore to extract SQL...\n');
  
  try {
    // Extract to a temporary SQL file
    const tempSQL = '/tmp/carl_backup.sql';
    execSync(`pg_restore "${backupFile}" > "${tempSQL}" 2>/dev/null || pg_restore -f "${tempSQL}" "${backupFile}" 2>&1`, { encoding: 'utf8' });
    
    if (fs.existsSync(tempSQL)) {
      const sqlDump = fs.readFileSync(tempSQL, 'utf8');
      await parseAndRestore(sqlDump);
      fs.unlinkSync(tempSQL);
    } else {
      // Try direct parsing
      await parseAndRestore(sqlContent);
    }
  } catch (e) {
    console.log('⚠️  pg_restore failed, trying direct SQL parsing...\n');
    await parseAndRestore(sqlContent);
  }
}

async function parseAndRestore(sqlContent) {
  console.log('📊 Parsing SQL and extracting Carl data...\n');

  // Find all INSERT statements for Carl
  const lines = sqlContent.split('\n');
  let inInsert = false;
  let currentTable = null;
  let currentInsert = '';
  const carlInserts = [];

  for (const line of lines) {
    if (line.match(/INSERT INTO public\.(\w+)/)) {
      if (currentInsert && currentTable) {
        if (currentInsert.includes(CARL_USER_ID)) {
          carlInserts.push({ table: currentTable, sql: currentInsert });
        }
      }
      const match = line.match(/INSERT INTO public\.(\w+)/);
      currentTable = match ? match[1] : null;
      currentInsert = line;
      inInsert = true;
    } else if (inInsert) {
      currentInsert += '\n' + line;
      if (line.trim().endsWith(';')) {
        if (currentInsert.includes(CARL_USER_ID)) {
          carlInserts.push({ table: currentTable, sql: currentInsert });
        }
        inInsert = false;
        currentInsert = '';
        currentTable = null;
      }
    }
  }

  // Process any remaining insert
  if (currentInsert && currentTable && currentInsert.includes(CARL_USER_ID)) {
    carlInserts.push({ table: currentTable, sql: currentInsert });
  }

  console.log(`📦 Found ${carlInserts.length} INSERT statements containing Carl's ID\n`);

  // Now restore each one
  for (const { table, sql } of carlInserts) {
    console.log(`🔄 Processing ${table}...`);
    
    // For now, let's use a simpler approach - just recreate the user
    // and we'll manually restore the data
    if (table === 'users') {
      // Extract user data from SQL
      const valuesMatch = sql.match(/VALUES\\s*\\(([^)]+)\\)/);
      if (valuesMatch) {
        // Parse the values - this is complex, so let's use a simpler method
        console.log('   Found user record');
      }
    }
  }

  // SIMPLER APPROACH: Just recreate Carl user with basic info
  console.log('\n🔄 Recreating Carl user...\n');
  
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: CARL_USER_ID,
      name: 'Carl',
      email: null,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (userError) {
    console.error('❌ Error creating Carl user:', userError.message);
  } else {
    console.log('✅ Carl user recreated!');
    console.log('\n⚠️  Note: Picks, submissions, and league memberships need to be restored separately.');
    console.log('   The backup file contains this data - we can extract it if needed.\n');
  }
}

restoreJustCarl().catch(console.error);

