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

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL not found in .env');
  process.exit(1);
}

// Extract project ref
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'your-project';

console.log('\n🚀 Quick Setup for Test API Tables\n');
console.log('=' .repeat(60));
console.log('\n📋 Step 1: Open Supabase SQL Editor');
console.log(`   👉 https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);

console.log('📋 Step 2: Copy the SQL below and paste it in the editor:\n');
console.log('-'.repeat(60));

const sqlPath = path.join(__dirname, '../supabase/sql/create_test_api_tables.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');
console.log(sqlContent);

console.log('-'.repeat(60));
console.log('\n📋 Step 3: Click "Run" in Supabase SQL Editor\n');

console.log('📋 Step 4: Verify by running:');
console.log('   node scripts/check-test-api-gw.mjs\n');

console.log('💡 Tip: After creating the tables, go back to Test API Admin');
console.log('   and save your 3 fixtures again!\n');

