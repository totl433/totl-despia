import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL not found in .env');
  process.exit(1);
}

console.log('\n🔧 Attempting to create Test API tables...\n');

// Try with service role key if available
if (serviceRoleKey) {
  console.log('✅ Found service role key, attempting to create tables...\n');
  
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const sqlPath = path.join(__dirname, '../supabase/sql/create_test_api_tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // Split SQL into statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

  try {
    // Try using RPC exec_sql if it exists
    for (const statement of statements) {
      if (statement.length < 10) continue;
      
      try {
        const { error } = await adminClient.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          if (error.message.includes('function') || error.message.includes('exec_sql')) {
            console.log('⚠️  RPC exec_sql function not available');
            break;
          }
          console.log(`⚠️  Error: ${error.message.substring(0, 100)}`);
        } else {
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        }
      } catch (rpcError) {
        console.log('⚠️  RPC exec_sql not available');
        break;
      }
    }
  } catch (error) {
    console.log('⚠️  Could not execute via RPC:', error.message);
  }

  // Try direct REST API approach
  console.log('\n📡 Attempting REST API approach...\n');
  
  try {
    // Supabase doesn't have a direct SQL execution endpoint via REST API
    // We need to use the Management API or create tables via PostgREST
    // But PostgREST doesn't support DDL operations
    
    console.log('⚠️  Cannot execute DDL (CREATE TABLE) via REST API');
    console.log('   Supabase REST API only supports DML operations (SELECT, INSERT, etc.)\n');
  } catch (error) {
    console.log('⚠️  REST API approach failed:', error.message);
  }
} else {
  console.log('⚠️  No SUPABASE_SERVICE_ROLE_KEY found in .env');
  console.log('   Cannot execute DDL operations without service role key\n');
}

// Check if tables exist
console.log('🔍 Checking if tables were created...\n');

const client = createClient(supabaseUrl, supabaseKey);
const tablesToCheck = [
  'test_api_meta',
  'test_api_fixtures',
  'test_api_picks',
  'test_api_submissions'
];

let allTablesExist = true;

for (const tableName of tablesToCheck) {
  const { error } = await client
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    if (error.code === 'PGRST205') {
      console.log(`❌ Table '${tableName}' does not exist`);
      allTablesExist = false;
    } else {
      console.log(`⚠️  Error checking '${tableName}': ${error.message}`);
    }
  } else {
    console.log(`✅ Table '${tableName}' exists`);
  }
}

if (allTablesExist) {
  console.log('\n🎉 All Test API tables exist!');
  console.log('   You can now use the Test API Admin to save fixtures.\n');
} else {
  console.log('\n' + '='.repeat(70));
  console.log('📋 MANUAL SETUP REQUIRED');
  console.log('='.repeat(70));
  console.log('\nI cannot execute SQL directly without admin access.');
  console.log('Please run the SQL manually:\n');
  
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'your-project';
  console.log(`1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('2. Copy SQL from: supabase/sql/create_test_api_tables.sql');
  console.log('3. Paste and click "Run"\n');
  
  // Show SQL file location
  const sqlPath = path.join(__dirname, '../supabase/sql/create_test_api_tables.sql');
  console.log(`SQL file location: ${sqlPath}\n`);
}

