#!/usr/bin/env node
/**
 * Check what table league_messages.user_id references
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);

async function checkFK() {
  try {
    // Query to check foreign key constraints
    const { data, error } = await admin.rpc('exec_sql', {
      sql: `
        SELECT 
          conname as constraint_name,
          conrelid::regclass::text as table_name,
          confrelid::regclass::text as referenced_table,
          a.attname as column_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE conrelid = 'league_messages'::regclass 
          AND contype = 'f'
          AND a.attname = 'user_id';
      `
    });

    if (error) {
      // Try direct query instead
      const { data: directData, error: directError } = await admin
        .from('league_messages')
        .select('user_id')
        .limit(1);
      
      console.log('Sample user_id from league_messages:', directData?.[0]?.user_id);
      console.log('\n💡 To check the FK constraint, run this in Supabase SQL Editor:');
      console.log(`
SELECT 
  conname as constraint_name,
  conrelid::regclass::text as table_name,
  confrelid::regclass::text as referenced_table,
  a.attname as column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE conrelid = 'league_messages'::regclass 
  AND contype = 'f'
  AND a.attname = 'user_id';
      `);
      return;
    }

    console.log('Foreign key constraints on league_messages.user_id:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkFK();

