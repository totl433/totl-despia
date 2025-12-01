#!/usr/bin/env node
/**
 * Script to run create_app_tables.sql in Supabase
 * This creates the App database replica tables
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQLFile() {
  console.log('🚀 Running create_app_tables.sql...\n');
  
  try {
    // Read the SQL file
    const sqlPath = join(__dirname, '..', 'supabase', 'sql', 'create_app_tables.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements (basic splitting by semicolon)
    // Note: This is a simple approach. For production, use a proper SQL parser
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--')) continue;
      
      try {
        // Use RPC if available, otherwise try direct query
        // Note: Supabase JS client doesn't support raw SQL execution directly
        // This will likely need to be run manually in Supabase SQL Editor
        console.log(`⚠️  Statement ${i + 1}/${statements.length}: Cannot execute via JS client`);
        console.log(`   Supabase JS client doesn't support raw SQL execution.`);
        console.log(`   Please run the SQL file manually in Supabase SQL Editor.\n`);
        break;
      } catch (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      console.log(`\n✅ Successfully executed ${successCount} statements`);
    }
    
    if (errorCount > 0) {
      console.log(`\n❌ ${errorCount} statements failed`);
    }
    
    // Provide manual instructions
    console.log('\n📋 MANUAL EXECUTION REQUIRED:');
    console.log('================================');
    console.log('The Supabase JS client cannot execute raw SQL statements.');
    console.log('Please run the SQL file manually:');
    console.log('\n1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to: SQL Editor');
    console.log('4. Copy and paste the contents of: supabase/sql/create_app_tables.sql');
    console.log('5. Click "Run"');
    console.log('\n✅ The SQL file is safe - it only creates new App tables (app_*)');
    console.log('   It does NOT modify any existing tables or live game data.\n');
    
  } catch (error) {
    console.error('❌ Error reading or executing SQL file:', error.message);
    console.log('\n📋 Please run the SQL file manually in Supabase SQL Editor');
    process.exit(1);
  }
}

runSQLFile();

