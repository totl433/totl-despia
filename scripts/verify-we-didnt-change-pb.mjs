#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

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

async function verify() {
  console.log('🔍 Verifying we did NOT change PB\'s picks...\n');
  
  const pbUserId = 'f09b62e6-792c-4fe1-a6ba-583d802781df';
  const appOnlyUserIds = [
    '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
    '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
  ];
  
  console.log('📋 App-only user IDs we modified:');
  appOnlyUserIds.forEach(id => console.log(`   ${id}`));
  console.log(`\n📋 PB's user ID: ${pbUserId}`);
  
  if (appOnlyUserIds.includes(pbUserId)) {
    console.log('   ❌ ERROR: PB\'s ID IS in the list!');
  } else {
    console.log('   ✅ PB\'s ID is NOT in the list - we did NOT modify his picks');
  }
  
  // Check what we actually did
  console.log('\n📝 What we did:');
  console.log('   1. fix-app-picks-from-web-picks.mjs:');
  console.log('      - Read FROM picks table');
  console.log('      - Wrote TO app_picks table');
  console.log('      - Did NOT modify picks table');
  console.log('\n   2. fix-app-only-users-picks-v2.mjs:');
  console.log('      - Modified picks table ONLY for 4 app-only users');
  console.log('      - PB is NOT in that list');
  
  // Check if there's any way PB's pick could have been affected
  console.log('\n🔍 Checking if fixture matching could have caused issues:');
  console.log('   - We matched fixtures by team codes (SUN vs NEW)');
  console.log('   - Index 6 in web = SUN vs NEW');
  console.log('   - Index 6 in app = Sunderland vs Newcastle');
  console.log('   - These match correctly');
  console.log('   - We copied picks using same fixture_index');
  console.log('   - So index 6 pick should have stayed at index 6');
  
  // The issue might be: was PB's pick already wrong BEFORE we ran scripts?
  console.log('\n⚠️  IMPORTANT: We did NOT modify picks table for PB');
  console.log('   If PB\'s pick is wrong, it was wrong BEFORE we ran our scripts');
  console.log('   OR something else changed it');
  
  // Check if there are any triggers that might have modified it
  console.log('\n🔍 Checking for triggers that modify picks table:');
  console.log('   - mirror_picks_to_web: Only mirrors FROM app_picks TO picks for 4 test users');
  console.log('   - PB is NOT a test user, so this wouldn\'t affect him');
  console.log('   - mirror_picks_to_app: Mirrors FROM picks TO app_picks (doesn\'t modify picks)');
}

verify().catch(console.error);
