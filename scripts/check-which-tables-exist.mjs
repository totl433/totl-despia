import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('🔍 Checking which Test API tables exist...\n');

  const tables = [
    'test_api_meta',
    'test_api_fixtures',
    'test_api_picks',
    'test_api_submissions'
  ];

  const results = {};

  for (const tableName of tables) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST205') {
          results[tableName] = '❌ DOES NOT EXIST';
        } else {
          results[tableName] = `⚠️  ERROR: ${error.message}`;
        }
      } else {
        results[tableName] = '✅ EXISTS';
      }
    } catch (err) {
      results[tableName] = `⚠️  EXCEPTION: ${err.message}`;
    }
  }

  console.log('Results:');
  console.log('='.repeat(50));
  for (const [table, status] of Object.entries(results)) {
    console.log(`${table.padEnd(30)} ${status}`);
  }
  console.log('='.repeat(50));

  const missingTables = Object.entries(results)
    .filter(([_, status]) => status.includes('DOES NOT EXIST'))
    .map(([table, _]) => table);

  if (missingTables.length > 0) {
    console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
    console.log('\n💡 Solution:');
    console.log('   1. Run only the CREATE TABLE statements from the SQL');
    console.log('   2. Then run the rest (indexes, policies, etc.)');
    console.log('\n   Or use the step-by-step version:');
    console.log('   supabase/sql/create_test_api_tables_step_by_step.sql');
  } else {
    console.log('\n✅ All tables exist!');
  }
}

checkTables();

