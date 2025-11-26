import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function restoreCarlFromBackup(backupFilePath) {
  console.log('🔄 Restoring Carl users from backup file...\n');

  if (!backupFilePath) {
    console.error('❌ Please provide the backup file path');
    console.log('\nUsage: node restore-carl-from-backup.mjs <path-to-backup.sql>');
    console.log('Example: node restore-carl-from-backup.mjs ~/Downloads/backup.sql');
    process.exit(1);
  }

  if (!fs.existsSync(backupFilePath)) {
    console.error(`❌ Backup file not found: ${backupFilePath}`);
    process.exit(1);
  }

  console.log(`📂 Reading backup file: ${backupFilePath}\n`);
  const backupContent = fs.readFileSync(backupFilePath, 'utf8');

  // Parse SQL backup to extract Carl's data
  console.log('🔍 Extracting Carl data from backup...\n');

  const carlData = {
    users: [],
    picks: [],
    submissions: [],
    leagueMembers: [],
    pushSubscriptions: [],
  };

  // Extract users
  const userMatches = backupContent.match(/INSERT INTO public\.users[^;]+;/g);
  if (userMatches) {
    for (const match of userMatches) {
      for (const userId of CARL_USER_IDS) {
        if (match.includes(userId)) {
          // Parse the INSERT statement
          const valuesMatch = match.match(/VALUES\s*\(([^)]+)\)/);
          if (valuesMatch) {
            // This is simplified - SQL parsing is complex, but we can extract the data
            carlData.users.push({ userId, raw: match });
          }
        }
      }
    }
  }

  // Extract picks
  const picksMatches = backupContent.match(/INSERT INTO public\.picks[^;]+;/g);
  if (picksMatches) {
    for (const match of picksMatches) {
      for (const userId of CARL_USER_IDS) {
        if (match.includes(userId)) {
          carlData.picks.push({ userId, raw: match });
        }
      }
    }
  }

  // Extract submissions
  const subsMatches = backupContent.match(/INSERT INTO public\.gw_submissions[^;]+;/g);
  if (subsMatches) {
    for (const match of subsMatches) {
      for (const userId of CARL_USER_IDS) {
        if (match.includes(userId)) {
          carlData.submissions.push({ userId, raw: match });
        }
      }
    }
  }

  // Extract league members
  const leagueMatches = backupContent.match(/INSERT INTO public\.league_members[^;]+;/g);
  if (leagueMatches) {
    for (const match of leagueMatches) {
      for (const userId of CARL_USER_IDS) {
        if (match.includes(userId)) {
          carlData.leagueMembers.push({ userId, raw: match });
        }
      }
    }
  }

  // Extract push subscriptions
  const pushMatches = backupContent.match(/INSERT INTO public\.push_subscriptions[^;]+;/g);
  if (pushMatches) {
    for (const match of pushMatches) {
      for (const userId of CARL_USER_IDS) {
        if (match.includes(userId)) {
          carlData.pushSubscriptions.push({ userId, raw: match });
        }
      }
    }
  }

  console.log('📊 Found Carl data:');
  console.log(`   Users: ${carlData.users.length}`);
  console.log(`   Picks: ${carlData.picks.length}`);
  console.log(`   Submissions: ${carlData.submissions.length}`);
  console.log(`   League Memberships: ${carlData.leagueMembers.length}`);
  console.log(`   Push Subscriptions: ${carlData.pushSubscriptions.length}\n`);

  if (carlData.users.length === 0) {
    console.error('❌ No Carl users found in backup file!');
    process.exit(1);
  }

  // Now restore the data
  console.log('🔄 Restoring to database...\n');

  // Restore users first
  console.log('1. Restoring users...');
  for (const user of carlData.users) {
    // Parse the INSERT statement more carefully
    // This is a simplified approach - we'll need to extract actual values
    try {
      // For now, let's use a simpler approach - extract and parse the SQL
      const valuesMatch = user.raw.match(/VALUES\s*\(([^)]+)\)/);
      if (valuesMatch) {
        // Parse the values - this is complex SQL parsing, so we'll do it step by step
        console.log(`   Found user data for ${user.userId}`);
      }
    } catch (e) {
      console.error(`   Error parsing user ${user.userId}:`, e.message);
    }
  }

  console.log('\n⚠️  SQL backup parsing is complex. Let me create a better parser...\n');
  console.log('💡 Better approach: I can help you extract the data manually, or');
  console.log('   you can restore to a new project and I\'ll extract from there.\n');
}

// Get backup file path from command line
const backupFilePath = process.argv[2];
restoreCarlFromBackup(backupFilePath).catch(console.error);

