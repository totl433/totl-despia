#!/usr/bin/env node
/**
 * Check if mirror trigger has a bug that's causing wrong picks to be mirrored
 * Web saves to picks table -> mirror trigger copies to app_picks
 * But what if the trigger is copying wrong data?
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

async function checkMirrorTrigger() {
  console.log('🔍 Checking mirror trigger logic...\n');
  
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
  
  console.log('MIRROR TRIGGER LOGIC:');
  console.log('  1. User saves picks to "picks" table');
  console.log('  2. Trigger fires: mirror_picks_to_app()');
  console.log('  3. Trigger checks if pick exists in app_picks');
  console.log('  4. If different or doesn\'t exist, updates app_picks\n');
  
  console.log('POTENTIAL BUGS:');
  console.log('  1. Trigger might be checking wrong fixture_index');
  console.log('  2. Trigger might be copying from wrong row');
  console.log('  3. Trigger might have race condition');
  console.log('  4. Picks might be getting swapped during mirror');
  console.log('  5. Multiple picks inserted simultaneously might cause wrong order\n');
  
  // Check if there are multiple picks for same fixture_index
  const { data: allWebPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('created_at', { ascending: true });
  
  const { data: allAppPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('created_at', { ascending: true });
  
  console.log('📊 All GW16 picks from picks table:');
  allWebPicks?.forEach(p => {
    const fixture = fixtures?.find(f => f.fixture_index === p.fixture_index);
    const matchName = fixture 
      ? `${fixture.home_name} vs ${fixture.away_name}`
      : `Fixture ${p.fixture_index}`;
    console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick} (created: ${p.created_at})`);
  });
  
  console.log('\n📊 All GW16 picks from app_picks table:');
  allAppPicks?.forEach(p => {
    const fixture = fixtures?.find(f => f.fixture_index === p.fixture_index);
    const matchName = fixture 
      ? `${fixture.home_name} vs ${fixture.away_name}`
      : `Fixture ${p.fixture_index}`;
    console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick} (created: ${p.created_at})`);
  });
  
  // Check if picks were inserted in wrong order
  console.log('\n🔍 Checking insertion order...');
  if (allWebPicks && allWebPicks.length > 0) {
    const sortedByCreated = [...allWebPicks].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const sortedByFixture = [...allWebPicks].sort((a, b) => a.fixture_index - b.fixture_index);
    
    const sameOrder = sortedByCreated.every((p, i) => 
      p.fixture_index === sortedByFixture[i].fixture_index
    );
    
    if (!sameOrder) {
      console.log('   ⚠️  Picks were NOT inserted in fixture_index order!');
      console.log('   This could cause mirror trigger to copy picks to wrong fixtures!');
    } else {
      console.log('   ✅ Picks were inserted in fixture_index order');
    }
  }
  
  console.log('\n💡 KEY INSIGHT:');
  console.log('   If web shows correct picks but database shows wrong picks,');
  console.log('   it means picks were changed AFTER DB submitted.');
  console.log('   The mirror trigger would have copied the WRONG picks to app_picks.');
  console.log('   But web interface might be showing cached/localStorage data.');
}

checkMirrorTrigger().catch(console.error);
