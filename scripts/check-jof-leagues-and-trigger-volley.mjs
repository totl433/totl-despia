#!/usr/bin/env node
/**
 * Check Jof's leagues and trigger Volley congratulations
 * Usage: node scripts/check-jof-leagues-and-trigger-volley.mjs [gameweek]
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);
const JOF_USER_ID = '4542c037-5b38-40d0-b189-847b8f17c222';

async function checkLeaguesAndTrigger() {
  try {
    // 1. Find Jof's user record
    const { data: user, error: userError } = await admin
      .from('users')
      .select('id, name')
      .eq('id', JOF_USER_ID)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.name} (${user.id})\n`);

    // 2. Get all leagues Jof is a member of
    const { data: memberships, error: membersError } = await admin
      .from('league_members')
      .select(`
        league_id,
        leagues (
          id,
          name,
          code
        )
      `)
      .eq('user_id', JOF_USER_ID);

    if (membersError) throw membersError;

    console.log(`📋 Jof is a member of ${memberships?.length || 0} leagues:\n`);
    if (memberships && memberships.length > 0) {
      memberships.forEach((m) => {
        const league = m.leagues;
        console.log(`   - ${league.name} (${league.code || league.id})`);
      });
    } else {
      console.log('   (No leagues found)');
    }

    // 3. Determine gameweek
    const targetGw = process.argv[2] ? parseInt(process.argv[2], 10) : null;
    let gameweek = targetGw;

    if (!gameweek) {
      console.log('\n🔍 Finding latest completed gameweek...');
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
      console.log(`✅ Found latest completed gameweek: ${gameweek}\n`);
    }

    // 4. Trigger Volley congratulations
    console.log(`🚀 Triggering Volley congratulations for Gameweek ${gameweek}...\n`);

    // Call the Netlify function
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://totl-staging.netlify.app';
    const functionUrl = `${baseUrl}/.netlify/functions/sendVolleyGwCongratulations`;

    console.log(`📡 Calling: ${functionUrl}`);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameweek }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.ok) {
      console.log(`\n✅ Success!`);
      console.log(`   📊 Total leagues: ${data.totalLeagues || 0}`);
      console.log(`   ✅ Sent: ${data.successCount || 0}`);
      console.log(`   ⏭️  Skipped: ${data.skippedCount || 0}`);
      console.log(`   ❌ Errors: ${data.errorCount || 0}`);

      // Show which of Jof's leagues got messages
      if (data.results && memberships) {
        console.log(`\n📬 Messages sent to Jof's leagues:`);
        const jofLeagueIds = new Set(memberships.map((m) => m.league_id));
        data.results.forEach((result) => {
          if (jofLeagueIds.has(result.leagueId)) {
            if (result.success) {
              console.log(`   ✅ ${result.leagueName || result.leagueId}: "${result.message}"`);
            } else if (result.skipped) {
              console.log(`   ⏭️  ${result.leagueName || result.leagueId}: ${result.reason}${result.existingMessage ? ` (existing: "${result.existingMessage}")` : ''}`);
            } else if (result.error) {
              console.log(`   ❌ ${result.leagueName || result.leagueId}: ${result.error}`);
            }
          }
        });
      }
    } else {
      console.error(`\n❌ Error: ${data.error || response.statusText}`);
      console.error(`   Status: ${response.status}`);
      if (data.details) console.error(`   Details: ${data.details}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkLeaguesAndTrigger();
