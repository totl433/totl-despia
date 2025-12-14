#!/usr/bin/env node
/**
 * Show David Bird's GW16 picks from APP table (app_picks)
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function showDavidBirdAppPicks() {
  console.log('🔍 David Bird\'s GW16 picks from APP table (app_picks)...\n');
  
  // Find David Bird's user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (userError) {
    console.error('❌ Error finding user:', userError);
    return;
  }
  
  if (!user) {
    console.log('❌ David Bird not found in users table');
    return;
  }
  
  console.log(`User: ${user.name} (ID: ${user.id})\n`);
  
  // Get GW16 fixtures from app_fixtures
  const { data: fixtures, error: fixturesError } = await supabase
    .from('app_fixtures')
    .select('*')
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError);
    return;
  }
  
  // Get David Bird's GW16 picks from APP table (app_picks)
  const { data: appPicks, error: appPicksError } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (appPicksError) {
    console.error('❌ Error fetching app picks:', appPicksError);
    return;
  }
  
  console.log(`📊 APP PICKS (app_picks table) - ${appPicks?.length || 0} picks:\n`);
  
  if (!appPicks || appPicks.length === 0) {
    console.log('   ❌ No picks found in app_picks table');
  } else {
    appPicks.forEach(pick => {
      const fixture = fixtures?.find(f => f.fixture_index === pick.fixture_index);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${pick.fixture_index}`;
      console.log(`   ${pick.fixture_index}. ${matchName}: ${pick.pick}`);
    });
  }
  
  console.log('\n');
}

showDavidBirdAppPicks().catch(console.error);
