#!/usr/bin/env node
/**
 * Check if ANY table has David Bird's actual predictions
 * He predicted: Sunderland=H, Forest=D
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

async function check() {
  console.log('🔍 Checking if ANY table has David Bird\'s actual predictions...\n');
  console.log('Expected: Sunderland=H, Forest=D\n');
  
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (!user) {
    console.log('❌ David Bird not found');
    return;
  }
  
  // Get fixtures
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  const sunderlandFixture = fixtures?.find(f => 
    f.home_name?.includes('Sunderland') && f.away_name?.includes('Newcastle')
  );
  const forestFixture = fixtures?.find(f => 
    f.home_name?.includes('Forest') && f.away_name?.includes('Tottenham')
  );
  
  if (!sunderlandFixture || !forestFixture) {
    console.log('❌ Could not find fixtures');
    return;
  }
  
  console.log(`Sunderland fixture_index: ${sunderlandFixture.fixture_index}`);
  console.log(`Forest fixture_index: ${forestFixture.fixture_index}\n`);
  
  // Check picks table
  const { data: sunderlandWeb } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', sunderlandFixture.fixture_index)
    .maybeSingle();
  
  const { data: forestWeb } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', forestFixture.fixture_index)
    .maybeSingle();
  
  // Check app_picks table
  const { data: sunderlandApp } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', sunderlandFixture.fixture_index)
    .maybeSingle();
  
  const { data: forestApp } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .eq('fixture_index', forestFixture.fixture_index)
    .maybeSingle();
  
  console.log('📊 PICKS TABLE (picks):');
  console.log(`   Sunderland: ${sunderlandWeb?.pick || 'NOT FOUND'}`);
  console.log(`   Forest: ${forestWeb?.pick || 'NOT FOUND'}`);
  const picksTableCorrect = sunderlandWeb?.pick === 'H' && forestWeb?.pick === 'D';
  console.log(`   ✅ Has correct picks: ${picksTableCorrect ? 'YES' : 'NO'}`);
  
  console.log('\n📊 APP_PICKS TABLE (app_picks):');
  console.log(`   Sunderland: ${sunderlandApp?.pick || 'NOT FOUND'}`);
  console.log(`   Forest: ${forestApp?.pick || 'NOT FOUND'}`);
  const appPicksTableCorrect = sunderlandApp?.pick === 'H' && forestApp?.pick === 'D';
  console.log(`   ✅ Has correct picks: ${appPicksTableCorrect ? 'YES' : 'NO'}`);
  
  console.log('\n🎯 ANSWER:');
  if (picksTableCorrect) {
    console.log('   ✅ YES - picks table has correct predictions');
  } else if (appPicksTableCorrect) {
    console.log('   ✅ YES - app_picks table has correct predictions');
  } else {
    console.log('   ❌ NO - Neither table has the correct predictions');
    console.log('   Both tables have wrong picks (Sunderland=D, Forest=H)');
  }
}

check().catch(console.error);
