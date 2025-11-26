import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Carl user IDs
const CARL_USER_IDS = [
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl (main)
  '8f52b4eb-dc80-4a74-a30f-cc1b8e27e7db', // carls
  '39ab58d2-6db1-400a-8094-fd2499a74376', // carlss
  '184d8634-549b-4be6-9513-92fc1c9c90e3', // carl.
];

function parseSQLValues(sqlLine) {
  // Extract values from INSERT statement
  // Handles: INSERT INTO table (cols) VALUES (val1, val2, ...), (val3, val4, ...);
  const valuesMatch = sqlLine.match(/VALUES\s+(.+);?$/s);
  if (!valuesMatch) return [];

  const valuesStr = valuesMatch[1];
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let inQuotes = false;
  let quoteChar = null;
  let parenDepth = 0;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    const nextChar = valuesStr[i + 1];

    if (!inQuotes && char === '(') {
      parenDepth++;
      if (parenDepth === 1) {
        currentRow = [];
        currentValue = '';
        continue;
      }
    } else if (!inQuotes && char === ')') {
      parenDepth--;
      if (parenDepth === 0) {
        if (currentValue.trim()) {
          currentRow.push(parseValue(currentValue.trim()));
        }
        rows.push(currentRow);
        currentRow = [];
        currentValue = '';
        // Skip comma after closing paren
        if (nextChar === ',') i++;
        continue;
      }
    } else if (!inQuotes && (char === '"' || char === "'") && (i === 0 || valuesStr[i - 1] !== '\\')) {
      inQuotes = true;
      quoteChar = char;
      currentValue += char;
      continue;
    } else if (inQuotes && char === quoteChar && valuesStr[i - 1] !== '\\') {
      inQuotes = false;
      quoteChar = null;
      currentValue += char;
      continue;
    } else if (!inQuotes && char === ',' && parenDepth === 1) {
      currentRow.push(parseValue(currentValue.trim()));
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  return rows;
}

function parseValue(val) {
  if (val === 'NULL' || val === 'null') return null;
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1).replace(/''/g, "'");
  }
  if (val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1).replace(/""/g, '"');
  }
  if (val === 'true' || val === 'TRUE') return true;
  if (val === 'false' || val === 'FALSE') return false;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d*\.\d+$/.test(val)) return parseFloat(val);
  return val;
}

async function extractAndRestoreCarl(backupFilePath) {
  console.log('🔄 Extracting Carl data from backup and restoring...\n');

  if (!backupFilePath || !fs.existsSync(backupFilePath)) {
    console.error('❌ Please provide a valid backup file path');
    console.log('\nUsage: node extract-carl-from-sql.mjs <path-to-backup.sql>');
    return;
  }

  console.log(`📂 Reading: ${backupFilePath}\n`);
  const content = fs.readFileSync(backupFilePath, 'utf8');

  // Split into lines and find INSERT statements
  const lines = content.split('\n');
  const carlData = {
    users: [],
    picks: [],
    submissions: [],
    leagueMembers: [],
  };

  let currentTable = null;
  let currentInsert = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('INSERT INTO public.')) {
      // Save previous insert if any
      if (currentInsert && currentTable) {
        processInsert(currentInsert, currentTable, carlData);
      }
      
      // Start new insert
      currentTable = line.match(/INSERT INTO public\.(\w+)/)?.[1];
      currentInsert = line;
    } else if (currentInsert && (line.endsWith(';') || line.includes(');'))) {
      currentInsert += ' ' + line;
      processInsert(currentInsert, currentTable, carlData);
      currentInsert = '';
      currentTable = null;
    } else if (currentInsert) {
      currentInsert += ' ' + line;
    }
  }

  // Process any remaining insert
  if (currentInsert && currentTable) {
    processInsert(currentInsert, currentTable, carlData);
  }

  console.log('📊 Extracted data:');
  console.log(`   Users: ${carlData.users.length}`);
  console.log(`   Picks: ${carlData.picks.length}`);
  console.log(`   Submissions: ${carlData.submissions.length}`);
  console.log(`   League Memberships: ${carlData.leagueMembers.length}\n`);

  if (carlData.users.length === 0) {
    console.error('❌ No Carl users found in backup!');
    return;
  }

  // Restore to database
  console.log('🔄 Restoring to database...\n');

  // Restore users
  for (const user of carlData.users) {
    const { error } = await supabase
      .from('users')
      .upsert(user, { onConflict: 'id' });
    
    if (error) {
      console.error(`   ❌ Error restoring user ${user.id}:`, error.message);
    } else {
      console.log(`   ✅ Restored user: ${user.name || user.id}`);
    }
  }

  // Restore picks
  if (carlData.picks.length > 0) {
    const { error } = await supabase
      .from('picks')
      .upsert(carlData.picks, { onConflict: 'user_id,gw,fixture_index' });
    
    if (error) {
      console.error(`   ❌ Error restoring picks:`, error.message);
    } else {
      console.log(`   ✅ Restored ${carlData.picks.length} picks`);
    }
  }

  // Restore submissions
  if (carlData.submissions.length > 0) {
    const { error } = await supabase
      .from('gw_submissions')
      .upsert(carlData.submissions, { onConflict: 'user_id,gw' });
    
    if (error) {
      console.error(`   ❌ Error restoring submissions:`, error.message);
    } else {
      console.log(`   ✅ Restored ${carlData.submissions.length} submissions`);
    }
  }

  // Restore league memberships
  if (carlData.leagueMembers.length > 0) {
    const { error } = await supabase
      .from('league_members')
      .upsert(carlData.leagueMembers, { onConflict: 'league_id,user_id' });
    
    if (error) {
      console.error(`   ❌ Error restoring league memberships:`, error.message);
    } else {
      console.log(`   ✅ Restored ${carlData.leagueMembers.length} league memberships`);
    }
  }

  console.log('\n✅ Done! Carl users restored with their data.\n');
}

function processInsert(sql, table, carlData) {
  if (!sql || !table) return;

  // Check if this insert contains any Carl user IDs
  const hasCarl = CARL_USER_IDS.some(id => sql.includes(id));
  if (!hasCarl) return;

  try {
    // Extract column names
    const colsMatch = sql.match(/INSERT INTO public\.\w+\s*\(([^)]+)\)/);
    if (!colsMatch) return;

    const columns = colsMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
    
    // Parse values
    const rows = parseSQLValues(sql);
    
    for (const row of rows) {
      if (row.length !== columns.length) continue;

      const record = {};
      columns.forEach((col, idx) => {
        record[col] = row[idx];
      });

      // Check if this record belongs to a Carl user
      const userId = record.user_id || record.id;
      if (!CARL_USER_IDS.includes(userId)) continue;

      // Add to appropriate collection
      if (table === 'users') {
        carlData.users.push(record);
      } else if (table === 'picks') {
        carlData.picks.push(record);
      } else if (table === 'gw_submissions') {
        carlData.submissions.push(record);
      } else if (table === 'league_members') {
        carlData.leagueMembers.push(record);
      }
    }
  } catch (e) {
    // Silently skip parsing errors
  }
}

// Get file path from command line
const backupFile = process.argv[2];
extractAndRestoreCarl(backupFile).catch(console.error);

