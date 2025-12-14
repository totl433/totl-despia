#!/usr/bin/env node
/**
 * Check David Bird's submissions in web vs app tables
 * Identifies mirroring issues
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDavidBirdSubmissions() {
  console.log('🔍 Checking David Bird\'s submissions...\n');
  
  // Find David Bird's user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (userError) {
    console.error('❌ Error finding user:', userError);
    return;
  }
  
  if (!user) {
    console.log('❌ David Bird not found in users table');
    return;
  }
  
  console.log(`✅ Found user: ${user.name} (ID: ${user.id})\n`);
  
  // Get web submissions
  const { data: webSubs, error: webError } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', user.id)
    .order('gw', { ascending: true });
  
  if (webError) {
    console.error('❌ Error fetching web submissions:', webError);
    return;
  }
  
  // Get app submissions
  const { data: appSubs, error: appError } = await supabase
    .from('app_gw_submissions')
    .select('*')
    .eq('user_id', user.id)
    .order('gw', { ascending: true });
  
  if (appError) {
    console.error('❌ Error fetching app submissions:', appError);
    return;
  }
  
  console.log('📊 WEB SUBMISSIONS (gw_submissions):');
  if (!webSubs || webSubs.length === 0) {
    console.log('   No submissions found');
  } else {
    webSubs.forEach(sub => {
      console.log(`   GW${sub.gw}: ${sub.submitted_at}`);
    });
  }
  
  console.log('\n📊 APP SUBMISSIONS (app_gw_submissions):');
  if (!appSubs || appSubs.length === 0) {
    console.log('   No submissions found');
  } else {
    appSubs.forEach(sub => {
      console.log(`   GW${sub.gw}: ${sub.submitted_at}`);
    });
  }
  
  // Compare
  console.log('\n🔍 COMPARISON:');
  
  const webGws = new Set(webSubs?.map(s => s.gw) || []);
  const appGws = new Set(appSubs?.map(s => s.gw) || []);
  
  const missingInApp = [...webGws].filter(gw => !appGws.has(gw));
  const missingInWeb = [...appGws].filter(gw => !webGws.has(gw));
  const inBoth = [...webGws].filter(gw => appGws.has(gw));
  
  if (missingInApp.length > 0) {
    console.log(`\n❌ MISSING IN APP (${missingInApp.length}):`);
    missingInApp.forEach(gw => {
      const webSub = webSubs.find(s => s.gw === gw);
      console.log(`   GW${gw}: Web has ${webSub?.submitted_at}, but NOT in app_gw_submissions`);
    });
  }
  
  if (missingInWeb.length > 0) {
    console.log(`\n⚠️  IN APP BUT NOT IN WEB (${missingInWeb.length}):`);
    missingInWeb.forEach(gw => {
      const appSub = appSubs.find(s => s.gw === gw);
      console.log(`   GW${gw}: App has ${appSub?.submitted_at}, but NOT in gw_submissions`);
    });
  }
  
  if (inBoth.length > 0) {
    console.log(`\n✅ IN BOTH (${inBoth.length}):`);
    inBoth.forEach(gw => {
      const webSub = webSubs.find(s => s.gw === gw);
      const appSub = appSubs.find(s => s.gw === gw);
      const match = webSub?.submitted_at === appSub?.submitted_at;
      console.log(`   GW${gw}: ${match ? '✅ Match' : '⚠️  Timestamps differ'}`);
      if (!match) {
        console.log(`      Web: ${webSub?.submitted_at}`);
        console.log(`      App: ${appSub?.submitted_at}`);
      }
    });
  }
  
  if (missingInApp.length === 0 && missingInWeb.length === 0 && inBoth.length > 0) {
    console.log('\n✅ All submissions are properly mirrored!');
  } else if (missingInApp.length > 0) {
    console.log(`\n❌ ISSUE: ${missingInApp.length} submission(s) missing in app table`);
    console.log('   These need to be manually mirrored or the trigger needs investigation.');
  }
}

checkDavidBirdSubmissions().catch(console.error);
