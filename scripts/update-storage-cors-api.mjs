#!/usr/bin/env node
/**
 * Update Supabase Storage CORS via Management API
 * 
 * This script uses the Supabase Management API to update CORS settings
 * for user-avatars and league-avatars buckets
 * 
 * Usage:
 *   node scripts/update-storage-cors-api.mjs
 * 
 * Requires:
 *   - SUPABASE_URL environment variable (to extract project ref)
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - try .env.local first, then .env
const envLocalPath = join(__dirname, '../.env.local');
const envPath = join(__dirname, '../.env');
try {
  dotenv.config({ path: envLocalPath });
} catch {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Extract project reference from Supabase URL
// Format: https://[project-ref].supabase.co
const projectRefMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!projectRefMatch) {
  console.error('❌ Could not extract project reference from SUPABASE_URL');
  console.error('   Expected format: https://[project-ref].supabase.co');
  process.exit(1);
}

const projectRef = projectRefMatch[1];
const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}`;

// CORS configuration
const corsConfig = {
  allowed_origins: [
    'https://playtotl.com',
    'https://www.playtotl.com',
    'https://totl-staging.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  allowed_methods: ['GET', 'HEAD'],
  allowed_headers: ['*'],
  max_age: 3600,
};

async function updateBucketCors(bucketName) {
  console.log(`\n📦 Updating CORS for bucket: ${bucketName}`);
  
  const url = `${managementApiUrl}/storage/buckets/${bucketName}/cors`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey, // Some endpoints require apikey header
      },
      body: JSON.stringify(corsConfig),
    });

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (response.ok) {
      console.log(`✅ Successfully updated CORS for ${bucketName}`);
      console.log(`   Response:`, responseData);
      return true;
    } else {
      console.error(`❌ Failed to update CORS for ${bucketName}`);
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Response:`, responseData);
      
      // Check if endpoint doesn't exist (404) - means CORS must be done via Dashboard
      if (response.status === 404) {
        console.error(`\n⚠️  CORS endpoint not found. CORS must be configured via Supabase Dashboard:`);
        console.error(`   1. Go to: https://supabase.com/dashboard/project/${projectRef}/storage/buckets`);
        console.error(`   2. Click on "${bucketName}"`);
        console.error(`   3. Find CORS settings in bucket configuration`);
      }
      
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating CORS for ${bucketName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Updating Supabase Storage CORS via Management API');
  console.log('='.repeat(60));
  console.log(`Project: ${projectRef}`);
  console.log(`API URL: ${managementApiUrl}`);
  
  const buckets = ['user-avatars', 'league-avatars'];
  let successCount = 0;
  
  for (const bucketName of buckets) {
    const success = await updateBucketCors(bucketName);
    if (success) successCount++;
    
    // Small delay between requests
    if (bucketName !== buckets[buckets.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (successCount === buckets.length) {
    console.log('✅ Successfully updated CORS for all buckets');
    console.log('\n⏳ Wait a few minutes for changes to propagate');
    console.log('🧪 Test by visiting: https://playtotl.com');
  } else if (successCount === 0) {
    console.log('⚠️  Could not update CORS via API');
    console.log('\n📋 Next steps:');
    console.log('   1. Try updating CORS via Supabase Dashboard');
    console.log('   2. See SUPABASE_STORAGE_CORS_FIX.md for detailed instructions');
    console.log('   3. Or run the SQL script: supabase/sql/update_storage_cors.sql');
  } else {
    console.log(`⚠️  Updated CORS for ${successCount}/${buckets.length} buckets`);
    console.log('   Check the errors above for details');
  }
}

main().catch(console.error);
