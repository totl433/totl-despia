#!/usr/bin/env node
/**
 * Update Supabase Storage CORS settings for user-avatars and league-avatars buckets
 * 
 * This script updates CORS to allow playtotl.com and staging domains
 * 
 * Usage:
 *   node scripts/update-storage-cors.mjs
 * 
 * Requires:
 *   - SUPABASE_URL environment variable
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable (for admin access)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease set these in your .env file or environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// CORS configuration for both buckets
const corsConfig = {
  allowedOrigins: [
    'https://playtotl.com',
    'https://www.playtotl.com',
    'https://totl-staging.netlify.app',
    'http://localhost:5173', // Local dev
    'http://localhost:3000', // Alternative local dev port
  ],
  allowedMethods: ['GET', 'HEAD'],
  allowedHeaders: ['*'],
  maxAge: 3600, // 1 hour
};

async function updateBucketCors(bucketName) {
  console.log(`\n📦 Updating CORS for bucket: ${bucketName}`);
  
  try {
    // Note: Supabase Storage CORS is typically managed via Dashboard
    // This script shows what needs to be configured, but may require Dashboard access
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`❌ Error listing buckets:`, listError);
      return false;
    }
    
    const bucket = buckets.find(b => b.name === bucketName);
    if (!bucket) {
      console.error(`❌ Bucket "${bucketName}" not found`);
      return false;
    }
    
    console.log(`✅ Bucket "${bucketName}" exists`);
    console.log(`   Public: ${bucket.public}`);
    console.log(`   File size limit: ${bucket.file_size_limit ? `${bucket.file_size_limit / 1024}KB` : 'Unset'}`);
    
    // Note: CORS configuration via API may not be available in all Supabase plans
    // You may need to configure this in the Dashboard:
    console.log(`\n⚠️  CORS configuration may need to be done in Supabase Dashboard:`);
    console.log(`   1. Go to Storage → Buckets → ${bucketName}`);
    console.log(`   2. Click on Settings or Configuration`);
    console.log(`   3. Find CORS settings`);
    console.log(`   4. Add these allowed origins:`);
    corsConfig.allowedOrigins.forEach(origin => {
      console.log(`      - ${origin}`);
    });
    
    return true;
  } catch (error) {
    console.error(`❌ Error updating CORS for ${bucketName}:`, error);
    return false;
  }
}

async function main() {
  console.log('🔧 Updating Supabase Storage CORS Configuration');
  console.log('=' .repeat(50));
  
  const buckets = ['user-avatars', 'league-avatars'];
  let successCount = 0;
  
  for (const bucketName of buckets) {
    const success = await updateBucketCors(bucketName);
    if (success) successCount++;
  }
  
  console.log('\n' + '='.repeat(50));
  if (successCount === buckets.length) {
    console.log('✅ All buckets found');
    console.log('\n⚠️  IMPORTANT: CORS must be configured in Supabase Dashboard');
    console.log('   See SUPABASE_STORAGE_CORS_FIX.md for detailed instructions');
  } else {
    console.log(`⚠️  Some buckets may not exist or have errors`);
  }
}

main().catch(console.error);
