#!/usr/bin/env node
/**
 * Check if David Bird's GW16 picks were updated after his initial submission
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

async function checkDBPicksTimestamps() {
  console.log('🔍 Checking David Bird\'s GW16 picks timestamps...\n');
  
  // Get David Bird's user ID
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'David Bird')
    .maybeSingle();
  
  if (!user) {
    console.log('❌ David Bird not found');
    return;
  }
  
  const dbUserId = user.id;
  console.log(`David Bird User ID: ${dbUserId}\n`);
  
  // Get David Bird's GW16 picks with timestamps
  const { data: picksData, error: picksError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', dbUserId)
    .eq('gw', 16)
    .order('fixture_index', { ascending: true });
  
  if (picksError) {
    console.error('❌ Error fetching picks:', picksError);
    return;
  }
  
  // Get David Bird's GW16 submission timestamp
  const { data: submissionData, error: subError } = await supabase
    .from('gw_submissions')
    .select('submitted_at')
    .eq('user_id', dbUserId)
    .eq('gw', 16)
    .maybeSingle();
  
  if (subError) {
    console.error('❌ Error fetching submission:', subError);
    return;
  }
  
  console.log('📅 Submission timestamp:');
  if (submissionData) {
    console.log(`   submitted_at: ${submissionData.submitted_at}`);
  } else {
    console.log('   ❌ No submission found');
    return;
  }
  
  console.log('\n📊 Picks timestamps:');
  if (picksData && picksData.length > 0) {
    const createdTimes = picksData.map(p => new Date(p.created_at).getTime());
    const updatedTimes = picksData.map(p => p.updated_at ? new Date(p.updated_at).getTime() : null);
    
    const earliestCreated = new Date(Math.min(...createdTimes));
    const latestCreated = new Date(Math.max(...createdTimes));
    const latestUpdated = updatedTimes.filter(t => t !== null).length > 0 
      ? new Date(Math.max(...updatedTimes.filter(t => t !== null)))
      : null;
    
    console.log(`   Earliest created_at: ${earliestCreated.toISOString()}`);
    console.log(`   Latest created_at: ${latestCreated.toISOString()}`);
    if (latestUpdated) {
      console.log(`   Latest updated_at: ${latestUpdated.toISOString()}`);
    } else {
      console.log(`   No updated_at timestamps (all null)`);
    }
    
    // Check if picks were created at different times
    const allSameCreated = createdTimes.every(t => t === createdTimes[0]);
    if (!allSameCreated) {
      console.log(`\n   ⚠️  Picks were created at DIFFERENT times!`);
      picksData.forEach(p => {
        console.log(`   Fixture ${p.fixture_index}: created=${p.created_at}, updated=${p.updated_at || 'null'}`);
      });
    } else {
      console.log(`   ✅ All picks created at same time: ${earliestCreated.toISOString()}`);
    }
    
    // Compare with submission time
    const submissionTime = new Date(submissionData.submitted_at).getTime();
    const picksCreatedTime = Math.min(...createdTimes);
    
    console.log('\n🔍 Comparison:');
    console.log(`   Submission time: ${new Date(submissionTime).toISOString()}`);
    console.log(`   Picks created: ${new Date(picksCreatedTime).toISOString()}`);
    
    if (picksCreatedTime < submissionTime) {
      console.log(`   ✅ Picks created BEFORE submission (expected)`);
    } else if (picksCreatedTime > submissionTime) {
      console.log(`   ⚠️  Picks created AFTER submission (unusual!)`);
    } else {
      console.log(`   ⚠️  Picks created at SAME time as submission`);
    }
    
    if (latestUpdated && latestUpdated.getTime() > submissionTime) {
      console.log(`\n   🚨 PICKS WERE UPDATED AFTER SUBMISSION!`);
      console.log(`   Latest update: ${latestUpdated.toISOString()}`);
      console.log(`   Submission: ${new Date(submissionTime).toISOString()}`);
      const diffMinutes = Math.round((latestUpdated.getTime() - submissionTime) / 1000 / 60);
      const diffHours = Math.round(diffMinutes / 60);
      console.log(`   Difference: ${diffMinutes} minutes (${diffHours} hours) after submission`);
      
      // Show which picks were updated
      console.log(`\n   ⚠️  Picks updated after submission:`);
      picksData.forEach(p => {
        if (p.updated_at && new Date(p.updated_at).getTime() > submissionTime) {
          const pickUpdateTime = new Date(p.updated_at).getTime();
          const diffMins = Math.round((pickUpdateTime - submissionTime) / 1000 / 60);
          console.log(`   Fixture ${p.fixture_index}: updated at ${p.updated_at} (${diffMins} min after submission)`);
        }
      });
    } else if (latestUpdated) {
      console.log(`   ✅ Picks updated before or at submission time`);
    } else {
      console.log(`   ℹ️  No updated_at timestamps to compare`);
    }
    
    // Show all picks with their values
    console.log('\n📋 All GW16 picks:');
    const { data: fixtures } = await supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', 16)
      .order('fixture_index', { ascending: true });
    
    picksData.forEach(p => {
      const fixture = fixtures?.find(f => f.fixture_index === p.fixture_index);
      const matchName = fixture 
        ? `${fixture.home_name} vs ${fixture.away_name}`
        : `Fixture ${p.fixture_index}`;
      console.log(`   ${p.fixture_index}. ${matchName}: ${p.pick} (created: ${p.created_at}, updated: ${p.updated_at || 'null'})`);
    });
  } else {
    console.log('   ❌ No picks found');
  }
}

checkDBPicksTimestamps().catch(console.error);
