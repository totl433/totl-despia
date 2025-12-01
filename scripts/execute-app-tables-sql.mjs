#!/usr/bin/env node
/**
 * Execute create_app_tables.sql in Supabase using REST API
 * This creates the App database replica tables
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  console.error('\nNote: SUPABASE_SERVICE_ROLE_KEY is required to execute SQL');
  console.error('You can find it in: Supabase Dashboard → Settings → API → service_role key\n');
  process.exit(1);
}

async function executeSQL() {
  console.log('🚀 Executing create_app_tables.sql in Supabase...\n');
  
  try {
    // Read the SQL file
    const sqlPath = join(__dirname, '..', 'supabase', 'sql', 'create_app_tables.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Use Supabase REST API to execute SQL
    // Note: Supabase doesn't have a direct SQL execution endpoint via REST API
    // We need to use the Management API or PostgREST RPC functions
    
    // Extract project reference from URL
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectRef) {
      throw new Error('Could not extract project reference from Supabase URL');
    }
    
    console.log('📝 SQL file loaded successfully');
    console.log(`📊 Project: ${projectRef}`);
    console.log('\n⚠️  Supabase REST API does not support direct SQL execution.');
    console.log('   The SQL must be executed via the Supabase Dashboard SQL Editor.\n');
    
    console.log('📋 MANUAL EXECUTION INSTRUCTIONS:');
    console.log('==================================');
    console.log('1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
    console.log('2. Copy the entire contents of: supabase/sql/create_app_tables.sql');
    console.log('3. Paste into the SQL Editor');
    console.log('4. Click "Run" (or press Cmd/Ctrl + Enter)');
    console.log('\n✅ SAFETY CHECK:');
    console.log('   - Only creates NEW tables with "app_" prefix');
    console.log('   - Does NOT modify any existing tables');
    console.log('   - Does NOT affect live games or live_scores');
    console.log('   - Uses IF NOT EXISTS (safe to run multiple times)\n');
    
    // Also show the SQL file location
    console.log('📄 SQL File Location:');
    console.log('   ' + sqlPath + '\n');
    
    // Optionally, we could try to use pgAdmin or psql if available
    // But for now, manual execution is the safest approach
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

executeSQL();

