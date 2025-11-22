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

async function parseBackup() {
  console.log('🚨 Parsing backup file to extract ALL Carl data...\n');

  const backupContent = fs.readFileSync(backupFile, 'utf8');
  const lines = backupContent.split('\n');

  const carlData = {
    user: null,
    picks: [],
    submissions: [],
    leagueMembers: [],
  };

  let currentTable = null;
  let inDataSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect COPY statements
    if (line.includes('COPY public.users')) {
      currentTable = 'users';
      inDataSection = true;
      continue;
    } else if (line.includes('COPY public.picks')) {
      currentTable = 'picks';
      inDataSection = true;
      continue;
    } else if (line.includes('COPY public.gw_submissions')) {
      currentTable = 'gw_submissions';
      inDataSection = true;
      continue;
    } else if (line.includes('COPY public.league_members')) {
      currentTable = 'league_members';
      inDataSection = true;
      continue;
    }

    // Detect end of COPY data
    if (line.trim() === '\\.' || line.trim() === '.') {
      inDataSection = false;
      currentTable = null;
      continue;
    }

    // Parse data lines
    if (inDataSection && line.includes(CARL_USER_ID)) {
      const parts = line.split('\t');

      if (currentTable === 'users') {
        // Format: id, name, created_at
        if (parts[0] === CARL_USER_ID) {
          carlData.user = {
            id: parts[0],
            name: parts[1] || 'Carl',
            created_at: parts[2] || new Date().toISOString(),
          };
          console.log(`✅ Found user: ${carlData.user.name}`);
        }
      } else if (currentTable === 'picks') {
        // Format: id, user_id, league_id, gw, pick, created_at, updated_at, fixture_index
        if (parts[1] === CARL_USER_ID) {
          carlData.picks.push({
            user_id: parts[1],
            gw: parseInt(parts[3]) || null,
            fixture_index: parseInt(parts[7]) || null,
            pick: parts[4]?.trim(),
          });
        }
      } else if (currentTable === 'gw_submissions') {
        // Format: id, user_id, league_id, gw, submitted_at
        if (parts[1] === CARL_USER_ID) {
          carlData.submissions.push({
            user_id: parts[1],
            gw: parseInt(parts[3]) || null,
            submitted_at: parts[4] === '\\N' ? null : parts[4]?.trim(),
          });
        }
      } else if (currentTable === 'league_members') {
        // Format: id, league_id, user_id, created_at
        if (parts[2] === CARL_USER_ID) {
          carlData.leagueMembers.push({
            league_id: parts[1],
            user_id: parts[2],
          });
        }
      }
    }
  }

  console.log('\n📊 Extracted:');
  console.log(`   User: ${carlData.user ? 'Yes' : 'No'}`);
  console.log(`   Picks: ${carlData.picks.length}`);
  console.log(`   Submissions: ${carlData.submissions.length}`);
  console.log(`   League Memberships: ${carlData.leagueMembers.length}\n`);

  if (!carlData.user) {
    console.error('❌ User not found!');
    return;
  }

  // Restore to database
  console.log('🔄 Restoring to database...\n');

  // User
  const { error: userError } = await supabase
    .from('users')
    .upsert(carlData.user, { onConflict: 'id' });
  
  if (userError) {
    console.error('❌ Error restoring user:', userError.message);
  } else {
    console.log(`✅ Restored user: ${carlData.user.name}`);
  }

  // Picks (batch)
  if (carlData.picks.length > 0) {
    for (let i = 0; i < carlData.picks.length; i += 100) {
      const chunk = carlData.picks.slice(i, i + 100);
      const { error } = await supabase
        .from('picks')
        .upsert(chunk, { onConflict: 'user_id,gw,fixture_index' });
      
      if (error) {
        console.error(`❌ Error restoring picks chunk:`, error.message);
      }
    }
    console.log(`✅ Restored ${carlData.picks.length} picks`);
  }

  // Submissions
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

  // League members
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

  console.log('\n✅ DONE! All Carl data restored.\n');
}

parseBackup().catch(console.error);

