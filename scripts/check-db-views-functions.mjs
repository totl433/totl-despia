#!/usr/bin/env node
/**
 * Check if there are any database views or functions that might be transforming picks data
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

async function checkViewsAndFunctions() {
  console.log('🔍 Checking for database views or functions...\n');
  
  // Check if there's a view on picks table
  const { data: views, error: viewsError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT table_name, view_definition 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%pick%'
      `
    });
  
  console.log('📊 Views related to picks:', views);
  
  // Try to query picks directly vs through a potential view
  const dbUserId = 'd2cbeca9-7dae-4be1-88fb-706911d67256';
  
  console.log('\n🔍 Checking David Bird\'s GW16 picks directly from picks table:');
  const { data: directPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', dbUserId)
    .eq('gw', 16)
    .order('fixture_index');
  
  console.log('Direct query results:');
  directPicks?.forEach(p => {
    console.log(`   Fixture ${p.fixture_index}: ${p.pick}`);
  });
  
  // Check if there's a different way the web might be querying
  console.log('\n💡 The web might be:');
  console.log('   1. Using cached data (localStorage/sessionStorage)');
  console.log('   2. Reading from a different database/environment');
  console.log('   3. Using a database view we haven\'t found');
  console.log('   4. The picks were changed AFTER DB submitted, web shows old correct data');
}

checkViewsAndFunctions().catch(console.error);
