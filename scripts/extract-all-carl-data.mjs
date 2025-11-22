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
const backupFile = '/Users/jof/Downloads/db_cluster-21-11-2025@03-35-56.backup';

async function extractAllCarlData() {
  console.log('🚨 URGENT: Extracting ALL Carl data from backup...\n');

  // Step 1: Convert backup to SQL using pg_restore
  console.log('📦 Converting backup to SQL...\n');
  
  const tempSQL = '/tmp/carl_backup_extract.sql';
  
  try {
    // Try pg_restore to SQL format
    execSync(`pg_restore -f "${tempSQL}" "${backupFile}" 2>&1`, { 
      encoding: 'utf8',
      maxBuffer: 200 * 1024 * 1024 
    });
    console.log('✅ Converted backup to SQL\n');
  } catch (e) {
    console.error('❌ pg_restore failed:', e.message);
    console.log('\n💡 Alternative: Use Supabase "Restore to new project" feature,');
    console.log('   then I can extract Carl data from that temporary project.\n');
    return;
  }

  if (!fs.existsSync(tempSQL)) {
    console.error('❌ SQL file not created');
    return;
  }

  // Step 2: Read and parse SQL
  console.log('📖 Reading SQL file...\n');
  const sqlContent = fs.readFileSync(tempSQL, 'utf8');
  const fileSize = (fs.statSync(tempSQL).size / 1024 / 1024).toFixed(2);
  console.log(`   File size: ${fileSize} MB\n`);

  // Step 3: Extract all Carl data
  console.log('🔍 Extracting Carl data...\n');

  const carlData = {
    user: null,
    picks: [],
    submissions: [],
    leagueMembers: [],
    pushSubscriptions: [],
  };

  // Extract user - look for the INSERT statement
  console.log('   Searching for user record...');
  const userMatches = sqlContent.match(new RegExp(`INSERT INTO public\\.users[\\s\\S]{0,50000}${CARL_USER_ID}[\\s\\S]{0,50000}`, 'gi'));
  
  if (userMatches && userMatches.length > 0) {
    console.log(`   ✅ Found ${userMatches.length} user record(s)`);
    // Parse the first match
    const userMatch = userMatches[0];
    const valuesMatch = userMatch.match(/VALUES\\s*\\(([^)]+)\\)/s);
    if (valuesMatch) {
      const values = parseSQLRow(valuesMatch[1]);
      if (values.length >= 2) {
        carlData.user = {
          id: cleanValue(values[0]),
          name: cleanValue(values[1]),
          created_at: values[2] ? cleanValue(values[2]) : new Date().toISOString(),
        };
        console.log(`   ✅ Parsed user: ${carlData.user.name}`);
      }
    }
  }

  // Extract picks - need to find all INSERT statements for picks table
  console.log('   Searching for picks...');
  const picksSection = sqlContent.match(/COPY public\\.picks[\\s\\S]*?\\./gi);
  if (picksSection) {
    // Parse COPY format
    for (const section of picksSection) {
      const lines = section.split('\\n');
      for (const line of lines) {
        if (line.includes(CARL_USER_ID)) {
          const parts = line.split('\\t');
          if (parts.length >= 4) {
            carlData.picks.push({
              user_id: cleanValue(parts[0]),
              gw: parseInt(cleanValue(parts[1])) || null,
              fixture_index: parseInt(cleanValue(parts[2])) || null,
              pick: cleanValue(parts[3]),
            });
          }
        }
      }
    }
  } else {
    // Try INSERT format
    const picksMatches = sqlContent.match(new RegExp(`INSERT INTO public\\.picks[\\s\\S]*?'${CARL_USER_ID}'[\\s\\S]*?;`, 'gi'));
    if (picksMatches) {
      for (const match of picksMatches) {
        const rows = extractInsertRows(match);
        for (const row of rows) {
          if (row.length >= 4 && row[0].includes(CARL_USER_ID)) {
            carlData.picks.push({
              user_id: cleanValue(row[0]),
              gw: parseInt(cleanValue(row[1])) || null,
              fixture_index: parseInt(cleanValue(row[2])) || null,
              pick: cleanValue(row[3]),
            });
          }
        }
      }
    }
  }
  console.log(`   ✅ Found ${carlData.picks.length} picks`);

  // Extract submissions
  console.log('   Searching for submissions...');
  const subsMatches = sqlContent.match(new RegExp(`INSERT INTO public\\.gw_submissions[\\s\\S]*?'${CARL_USER_ID}'[\\s\\S]*?;`, 'gi'));
  if (subsMatches) {
    for (const match of subsMatches) {
      const rows = extractInsertRows(match);
      for (const row of rows) {
        if (row.length >= 3 && row[0].includes(CARL_USER_ID)) {
          carlData.submissions.push({
            user_id: cleanValue(row[0]),
            gw: parseInt(cleanValue(row[1])) || null,
            submitted_at: cleanValue(row[2]) === 'NULL' ? null : cleanValue(row[2]),
          });
        }
      }
    }
  }
  console.log(`   ✅ Found ${carlData.submissions.length} submissions`);

  // Extract league members
  console.log('   Searching for league memberships...');
  const leagueMatches = sqlContent.match(new RegExp(`INSERT INTO public\\.league_members[\\s\\S]*?'${CARL_USER_ID}'[\\s\\S]*?;`, 'gi'));
  if (leagueMatches) {
    for (const match of leagueMatches) {
      const rows = extractInsertRows(match);
      for (const row of rows) {
        if (row.length >= 2 && row[1]?.includes(CARL_USER_ID)) {
          carlData.leagueMembers.push({
            league_id: cleanValue(row[0]),
            user_id: cleanValue(row[1]),
          });
        }
      }
    }
  }
  console.log(`   ✅ Found ${carlData.leagueMembers.length} league memberships`);

  // Extract push subscriptions
  console.log('   Searching for push subscriptions...');
  const pushMatches = sqlContent.match(new RegExp(`INSERT INTO public\\.push_subscriptions[\\s\\S]*?'${CARL_USER_ID}'[\\s\\S]*?;`, 'gi'));
  if (pushMatches) {
    for (const match of pushMatches) {
      const rows = extractInsertRows(match);
      for (const row of rows) {
        if (row.length >= 2 && row[0]?.includes(CARL_USER_ID)) {
          carlData.pushSubscriptions.push({
            user_id: cleanValue(row[0]),
            player_id: cleanValue(row[1]),
            platform: cleanValue(row[2]) || 'ios',
            is_active: cleanValue(row[3]) === 'true' || cleanValue(row[3]) === 't' || true,
          });
        }
      }
    }
  }
  console.log(`   ✅ Found ${carlData.pushSubscriptions.length} push subscriptions`);

  console.log('\n📊 Summary:');
  console.log(`   User: ${carlData.user ? 'Yes' : 'No'}`);
  console.log(`   Picks: ${carlData.picks.length}`);
  console.log(`   Submissions: ${carlData.submissions.length}`);
  console.log(`   League Memberships: ${carlData.leagueMembers.length}`);
  console.log(`   Push Subscriptions: ${carlData.pushSubscriptions.length}\n`);

  // Step 4: Restore everything to database
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
  }

  // Restore picks
  if (carlData.picks.length > 0) {
    // Batch insert in chunks of 100
    for (let i = 0; i < carlData.picks.length; i += 100) {
      const chunk = carlData.picks.slice(i, i + 100);
      const { error } = await supabase
        .from('picks')
        .upsert(chunk, { onConflict: 'user_id,gw,fixture_index' });
      
      if (error) {
        console.error(`❌ Error restoring picks chunk ${i}-${i + chunk.length}:`, error.message);
      }
    }
    console.log(`✅ Restored ${carlData.picks.length} picks`);
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

  // Restore league members
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

  // Restore push subscriptions
  if (carlData.pushSubscriptions.length > 0) {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(carlData.pushSubscriptions, { onConflict: 'user_id,player_id' });
    
    if (error) {
      console.error('❌ Error restoring push subscriptions:', error.message);
    } else {
      console.log(`✅ Restored ${carlData.pushSubscriptions.length} push subscriptions`);
    }
  }

  // Cleanup
  if (fs.existsSync(tempSQL)) {
    fs.unlinkSync(tempSQL);
  }

  console.log('\n✅ DONE! All Carl data restored.\n');
}

function parseSQLRow(rowStr) {
  const values = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    const prevChar = i > 0 ? rowStr[i - 1] : '';

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

function extractInsertRows(insertSQL) {
  const rows = [];
  const valuesMatch = insertSQL.match(/VALUES\\s+(.+?);?$/s);
  if (!valuesMatch) return rows;

  const valuesStr = valuesMatch[1];
  // Split by ),( to get individual rows
  const rowMatches = valuesStr.match(/\\([^)]+\\)/g);
  if (rowMatches) {
    for (const rowMatch of rowMatches) {
      const rowContent = rowMatch.slice(1, -1); // Remove outer parentheses
      rows.push(parseSQLRow(rowContent));
    }
  }

  return rows;
}

function cleanValue(val) {
  if (!val) return null;
  if (val === 'NULL' || val === 'null') return null;
  val = val.toString();
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1).replace(/''/g, "'").replace(/""/g, '"');
  }
  return val;
}

extractAllCarlData().catch(console.error);

