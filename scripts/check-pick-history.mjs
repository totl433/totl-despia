#!/usr/bin/env node
/**
 * Check if picks were updated/changed after initial submission
 * Look for any evidence of picks being modified
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHistory() {
  console.log('🔍 Checking David Bird\'s pick history and submission timing...\n');
  
  // Find David Bird
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (!user) {
    console.log('❌ David Bird not found');
    return;
  }
  
  console.log(`User: ${user.name} (ID: ${user.id})\n`);
  
  // Get submission time
  const { data: submission } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .maybeSingle();
  
  console.log('📝 Submission:');
  if (submission) {
    console.log(`   Submitted at: ${submission.submitted_at}`);
  } else {
    console.log('   ❌ No submission found');
  }
  
  // Get all GW16 picks with timestamps
  const { data: webPicks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  const { data: appPicks } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', user.id)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  console.log('\n📊 WEB PICKS (picks) with timestamps:');
  webPicks?.forEach(p => {
    const created = new Date(p.created_at);
    const updated = new Date(p.updated_at);
    const wasUpdated = created.getTime() !== updated.getTime();
    console.log(`   Fixture ${p.fixture_index}: ${p.pick} | Created: ${p.created_at} | Updated: ${p.updated_at} ${wasUpdated ? '⚠️ MODIFIED' : ''}`);
  });
  
  console.log('\n📊 APP PICKS (app_picks) with timestamps:');
  appPicks?.forEach(p => {
    const created = new Date(p.created_at);
    const updated = new Date(p.updated_at);
    const wasUpdated = created.getTime() !== updated.getTime();
    console.log(`   Fixture ${p.fixture_index}: ${p.pick} | Created: ${p.created_at} | Updated: ${p.updated_at} ${wasUpdated ? '⚠️ MODIFIED' : ''}`);
  });
  
  // Check if picks were updated after submission
  if (submission) {
    const submissionTime = new Date(submission.submitted_at);
    console.log('\n🔍 Picks updated AFTER submission:');
    
    webPicks?.forEach(p => {
      const updated = new Date(p.updated_at);
      if (updated > submissionTime) {
        console.log(`   ⚠️  WEB Fixture ${p.fixture_index}: Updated ${p.updated_at} (after submission at ${submission.submitted_at})`);
      }
    });
    
    appPicks?.forEach(p => {
      const updated = new Date(p.updated_at);
      if (updated > submissionTime) {
        console.log(`   ⚠️  APP Fixture ${p.fixture_index}: Updated ${p.updated_at} (after submission at ${submission.submitted_at})`);
      }
    });
  }
  
  // Check for specific fixtures
  const sunderlandWeb = webPicks?.find(p => p.fixture_index === 4);
  const forestWeb = webPicks?.find(p => p.fixture_index === 6);
  
  console.log('\n🎯 KEY FINDINGS:');
  console.log(`   Sunderland (fixture_index 4):`);
  console.log(`     Web: ${sunderlandWeb?.pick} (created: ${sunderlandWeb?.created_at}, updated: ${sunderlandWeb?.updated_at})`);
  console.log(`   Forest (fixture_index 6):`);
  console.log(`     Web: ${forestWeb?.pick} (created: ${forestWeb?.created_at}, updated: ${forestWeb?.updated_at})`);
  
  console.log('\n💡 ANALYSIS:');
  console.log('   Web interface reads from "picks" table (Predictions.tsx line 215)');
  console.log('   If web shows different picks than database, possible causes:');
  console.log('   1. Browser cache showing old data');
  console.log('   2. Picks were changed after page load');
  console.log('   3. Different user session');
  console.log('   4. Database was updated but web hasn\'t refreshed');
}

checkHistory().catch(console.error);
