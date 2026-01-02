#!/usr/bin/env node
/**
 * Test script to trigger Volley congratulations for latest completed gameweek
 * Usage: node scripts/test-volley-congrats.mjs [gameweek]
 * If no gameweek provided, uses latest completed gameweek
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Try multiple env var names (Netlify uses different names)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Looking for: VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('   Looking for: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
  console.error('\n💡 Tip: If testing on Netlify, use the direct curl command instead');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);

// Get Netlify function URL (use localhost for dev, or provide via env)
const functionUrl = process.env.NETLIFY_FUNCTION_URL || 'http://localhost:8888';
const targetGw = process.argv[2] ? parseInt(process.argv[2], 10) : null;

async function testVolleyCongratulations() {
  try {
    let gameweek = targetGw;

    // If no gameweek specified, find latest completed one
    if (!gameweek) {
      console.log('🔍 Finding latest completed gameweek...');
      const { data: results, error } = await admin
        .from('app_gw_results')
        .select('gw')
        .order('gw', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!results || results.length === 0) {
        console.error('❌ No completed gameweeks found');
        process.exit(1);
      }

      gameweek = results[0].gw;
      console.log(`✅ Found latest completed gameweek: ${gameweek}`);
    }

    console.log(`\n🚀 Triggering Volley congratulations for Gameweek ${gameweek}...`);
    console.log(`📡 Calling: ${functionUrl}/.netlify/functions/testVolleyCongratulations\n`);

    const response = await fetch(`${functionUrl}/.netlify/functions/testVolleyCongratulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameweek }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      console.log('✅ Success!');
      console.log(`📊 Results:`, JSON.stringify(data.result, null, 2));
      console.log(`\n💬 Check your mini-league chats to see Volley's messages!`);
    } else {
      console.error('❌ Failed:', data);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testVolleyCongratulations();

