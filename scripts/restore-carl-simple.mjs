import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';
const backupFile = '/Users/jof/Downloads/db_cluster-21-11-2025@03-35-56.backup';

async function restoreCarl() {
  console.log('🔄 Restoring Carl from backup...\n');

  // Step 1: Convert backup to SQL using pg_restore
  console.log('📦 Converting backup to SQL format...\n');
  let sqlContent = '';
  
  try {
    // Use pg_restore to convert to SQL
    sqlContent = execSync(`pg_restore -f - "${backupFile}" 2>/dev/null`, { 
      encoding: 'utf8', 
      maxBuffer: 100 * 1024 * 1024 
    });
    console.log('✅ Converted to SQL\n');
  } catch (e) {
    console.error('❌ pg_restore failed:', e.message);
    console.log('   Trying to read as text...\n');
    try {
      sqlContent = fs.readFileSync(backupFile, 'utf8');
    } catch (e2) {
      console.error('❌ Cannot read backup file:', e2.message);
      return;
    }
  }

  // Step 2: Extract Carl's data using regex
  console.log('🔍 Extracting Carl data...\n');

  const carlData = {
    user: null,
    picks: [],
    submissions: [],
    leagueMembers: [],
  };

  // Extract user record - look for INSERT INTO users with Carl's ID
  // Handle both single-line and multi-line INSERT statements
  const userPattern = new RegExp(`INSERT INTO public\\.users[\\s\\S]*?'${CARL_USER_ID}'[\\s\\S]*?;`, 'i');
  const userMatch = sqlContent.match(userPattern);
  
  if (userMatch) {
    console.log('✅ Found Carl user record');
    // Parse the INSERT statement to extract values
    const valuesMatch = userMatch[0].match(/VALUES\\s*\\(([^)]+)\\)/s);
    if (valuesMatch) {
      // Parse values - handle quoted strings, NULL, etc.
      const values = parseSQLValues(valuesMatch[1]);
      if (values.length >= 3) {
        carlData.user = {
          id: values[0]?.replace(/'/g, '') || CARL_USER_ID,
          name: values[1]?.replace(/'/g, '') || 'Carl',
          created_at: values[2]?.replace(/'/g, '') || new Date().toISOString(),
        };
      }
    }
  }

  // Extract picks
  const picksPattern = new RegExp(`INSERT INTO public\\.picks[^;]*'${CARL_USER_ID}'[^;]*;`, 'gis');
  const picksMatches = sqlContent.match(picksPattern);
  if (picksMatches) {
    console.log(`✅ Found ${picksMatches.length} pick record(s)`);
    // Parse picks
    for (const match of picksMatches) {
      const valuesMatch = match.match(/VALUES\\s*\\(([^)]+)\\)/s);
      if (valuesMatch) {
        const values = parseSQLValues(valuesMatch[1]);
        if (values.length >= 4) {
          carlData.picks.push({
            user_id: values[0]?.replace(/'/g, ''),
            gw: parseInt(values[1]) || null,
            fixture_index: parseInt(values[2]) || null,
            pick: values[3]?.replace(/'/g, ''),
          });
        }
      }
    }
  }

  // Extract submissions
  const subsPattern = new RegExp(`INSERT INTO public\\.gw_submissions[^;]*'${CARL_USER_ID}'[^;]*;`, 'gis');
  const subsMatches = sqlContent.match(subsPattern);
  if (subsMatches) {
    console.log(`✅ Found ${subsMatches.length} submission record(s)`);
    for (const match of subsMatches) {
      const valuesMatch = match.match(/VALUES\\s*\\(([^)]+)\\)/s);
      if (valuesMatch) {
        const values = parseSQLValues(valuesMatch[1]);
        if (values.length >= 3) {
          carlData.submissions.push({
            user_id: values[0]?.replace(/'/g, ''),
            gw: parseInt(values[1]) || null,
            submitted_at: values[2] === 'NULL' ? null : values[2]?.replace(/'/g, ''),
          });
        }
      }
    }
  }

  // Extract league members
  const leaguePattern = new RegExp(`INSERT INTO public\\.league_members[^;]*'${CARL_USER_ID}'[^;]*;`, 'gis');
  const leagueMatches = sqlContent.match(leaguePattern);
  if (leagueMatches) {
    console.log(`✅ Found ${leagueMatches.length} league membership record(s)`);
    for (const match of leagueMatches) {
      const valuesMatch = match.match(/VALUES\\s*\\(([^)]+)\\)/s);
      if (valuesMatch) {
        const values = parseSQLValues(valuesMatch[1]);
        if (values.length >= 2) {
          carlData.leagueMembers.push({
            league_id: values[0]?.replace(/'/g, ''),
            user_id: values[1]?.replace(/'/g, ''),
          });
        }
      }
    }
  }

  console.log(`\n📊 Extracted:`);
  console.log(`   User: ${carlData.user ? 'Yes' : 'No'}`);
  console.log(`   Picks: ${carlData.picks.length}`);
  console.log(`   Submissions: ${carlData.submissions.length}`);
  console.log(`   League Memberships: ${carlData.leagueMembers.length}\n`);

  // Step 3: Restore to database
  console.log('🔄 Restoring to database...\n');

  // Restore user
  if (carlData.user) {
    const { error } = await supabase
      .from('users')
      .upsert(carlData.user, { onConflict: 'id' });
    
    if (error) {
      console.error('❌ Error restoring user:', error.message);
    } else {
      console.log(`✅ Restored user: ${carlData.user.name}`);
    }
  } else {
    // Create basic user if not found
    const { error } = await supabase
      .from('users')
      .upsert({
        id: CARL_USER_ID,
        name: 'Carl',
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('❌ Error creating user:', error.message);
    } else {
      console.log('✅ Created Carl user');
    }
  }

  // Restore picks
  if (carlData.picks.length > 0) {
    const { error } = await supabase
      .from('picks')
      .upsert(carlData.picks, { onConflict: 'user_id,gw,fixture_index' });
    
    if (error) {
      console.error('❌ Error restoring picks:', error.message);
    } else {
      console.log(`✅ Restored ${carlData.picks.length} picks`);
    }
  }

  // Restore submissions
  if (carlData.submissions.length > 0) {
    const { error } = await supabase
      .from('gw_submissions')
      .upsert(carlData.submissions, { onConflict: 'user_id,gw' });
    
    if (error) {
      console.error('❌ Error restoring submissions:', error.message);
    } else {
      console.log(`✅ Restored ${carlData.submissions.length} submissions`);
    }
  }

  // Restore league memberships
  if (carlData.leagueMembers.length > 0) {
    const { error } = await supabase
      .from('league_members')
      .upsert(carlData.leagueMembers, { onConflict: 'league_id,user_id' });
    
    if (error) {
      console.error('❌ Error restoring league memberships:', error.message);
    } else {
      console.log(`✅ Restored ${carlData.leagueMembers.length} league memberships`);
    }
  }

  console.log('\n✅ Done! Carl restored.\n');
}

function parseSQLValues(valuesStr) {
  // Simple parser for SQL VALUES - handles quoted strings, NULL, etc.
  const values = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    const prevChar = i > 0 ? valuesStr[i - 1] : '';

    if (!inQuotes && (char === "'" || char === '"')) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar && prevChar !== '\\') {
      inQuotes = false;
      quoteChar = null;
      current += char;
    } else if (!inQuotes && char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    values.push(current.trim());
  }

  return values;
}

restoreCarl().catch(console.error);

