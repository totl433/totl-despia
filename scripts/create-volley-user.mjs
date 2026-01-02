#!/usr/bin/env node
/**
 * Create Volley user in the database
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
const VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';

async function createVolleyUser() {
  try {
    console.log('🔍 Checking if Volley user exists...');
    
    // Check if user already exists
    const { data: existing, error: checkError } = await admin
      .from('users')
      .select('id, name')
      .eq('id', VOLLEY_USER_ID)
      .maybeSingle();

    if (existing) {
      console.log(`✅ Volley user already exists: ${existing.name}`);
      return;
    }

    console.log('👤 Creating Volley user...');
    
    // Create Volley user (users table only has id and name)
    const { data, error } = await admin
      .from('users')
      .insert({
        id: VOLLEY_USER_ID,
        name: 'Volley',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        console.log('✅ Volley user already exists (different check)');
      } else {
        throw error;
      }
    } else {
      console.log(`✅ Created Volley user: ${data.name}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createVolleyUser();

