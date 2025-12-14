#!/usr/bin/env node
/**
 * Find user IDs for Dan Gray (DG) and Joe Devine (JD)
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findUsers() {
  console.log('🔍 Finding Dan Gray and Joe Devine...\n');
  
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .or('name.ilike.%Dan Gray%,name.ilike.%Joe Devine%,name.ilike.%DG%,name.ilike.%JD%');
  
  console.log('Found users:');
  users?.forEach(u => {
    console.log(`  ${u.name}: ${u.id}`);
  });
  
  // Also check league members for LBTG8
  const { data: league } = await supabase
    .from('leagues')
    .select('id')
    .eq('code', 'LBTG8')
    .maybeSingle();
  
  if (league) {
    console.log(`\n🔍 League LBTG8 ID: ${league.id}`);
    
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id, users(id, name)')
      .eq('league_id', league.id);
    
    console.log('\nLeague members:');
    members?.forEach(m => {
      const user = m.users;
      console.log(`  ${user.name}: ${user.id}`);
    });
  }
}

findUsers().catch(console.error);
