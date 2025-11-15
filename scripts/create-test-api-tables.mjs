import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestApiTables() {
  console.log('🔧 Creating Test API tables...\n');

  // Read the SQL file
  const sqlPath = path.join(__dirname, '../supabase/sql/create_test_api_tables.sql');
  let sqlContent;
  
  try {
    sqlContent = fs.readFileSync(sqlPath, 'utf8');
  } catch (error) {
    console.error('❌ Could not read SQL file:', sqlPath);
    console.error('Error:', error.message);
    return;
  }

  // Try to create tables using RPC (if available)
  console.log('Attempting to create tables via RPC...');
  
  try {
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let failCount = 0;

    for (const statement of statements) {
      if (statement.length < 10) continue; // Skip very short statements
      
      try {
        // Try using RPC exec_sql if available
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          // RPC might not be available, that's okay
          if (error.message.includes('function') || error.message.includes('exec_sql')) {
            console.log('⚠️  RPC exec_sql not available, will need manual setup');
            break;
          }
          failCount++;
          console.log(`⚠️  Failed: ${statement.substring(0, 50)}...`);
        } else {
          successCount++;
        }
      } catch (rpcError) {
        // RPC not available, break and show manual instructions
        console.log('⚠️  RPC exec_sql not available');
        break;
      }
    }

    if (successCount > 0) {
      console.log(`✅ Successfully executed ${successCount} statements`);
    }
  } catch (error) {
    console.log('⚠️  Could not create tables via RPC');
  }

  // Check if tables exist now
  console.log('\n🔍 Checking if tables were created...\n');
  
  const tablesToCheck = [
    'test_api_meta',
    'test_api_fixtures',
    'test_api_picks',
    'test_api_submissions'
  ];

  let allTablesExist = true;

  for (const tableName of tablesToCheck) {
    const { error } = await supabase
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
    console.log('\n🎉 All Test API tables exist! You can now use the Test API Admin.');
    return;
  }

  // If tables don't exist, provide manual instructions
  console.log('\n' + '='.repeat(70));
  console.log('📋 MANUAL SETUP REQUIRED');
  console.log('='.repeat(70));
  console.log('\nThe tables need to be created manually in Supabase.\n');
  console.log('Steps:');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Navigate to "SQL Editor" (in the left sidebar)');
  console.log('3. Click "New query"');
  console.log('4. Copy and paste the SQL below:');
  console.log('\n' + '-'.repeat(70));
  console.log(sqlContent);
  console.log('-'.repeat(70));
  console.log('\n5. Click "Run" to execute the SQL');
  console.log('6. Once done, run this script again to verify:');
  console.log('   node scripts/create-test-api-tables.mjs\n');
}

createTestApiTables();

