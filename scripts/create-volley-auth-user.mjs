#!/usr/bin/env node
/**
 * Create Volley user in auth.users (Supabase Auth)
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

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';

async function createVolleyAuthUser() {
  try {
    console.log('🔍 Checking if Volley exists in auth.users...');
    
    // Check if user exists in auth
    const { data: { user }, error: getUserError } = await admin.auth.admin.getUserById(VOLLEY_USER_ID);
    
    if (user) {
      console.log(`✅ Volley already exists in auth.users: ${user.email || user.id}`);
    } else {
      console.log('👤 Creating Volley in auth.users...');
      
      // Create user in auth.users
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        id: VOLLEY_USER_ID,
        email: 'volley@totl.app',
        password: Math.random().toString(36).slice(-20) + Math.random().toString(36).slice(-20) + 'A1!', // Random secure password
        email_confirm: true,
        user_metadata: {
          name: 'Volley',
          display_name: 'Volley'
        }
      });

      if (createError) {
        throw createError;
      }

      console.log(`✅ Created Volley in auth.users: ${newUser.user.id}`);
    }

    // Also ensure Volley exists in public.users
    console.log('👤 Ensuring Volley exists in public.users...');
    const { error: publicError } = await admin
      .from('users')
      .upsert({
        id: VOLLEY_USER_ID,
        name: 'Volley',
      }, {
        onConflict: 'id'
      });

    if (publicError && publicError.code !== '23505') {
      throw publicError;
    }

    console.log('✅ Volley user setup complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status === 422) {
      console.error('   User might already exist with different ID');
    }
    process.exit(1);
  }
}

createVolleyAuthUser();

