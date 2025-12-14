#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixLiveScoresFixtureIndex() {
  console.log('🔧 Fixing live_scores fixture_index alignment...\n');
  
  const gw = 16;
  
  // Get fixtures (correct order)
  const { data: fixtures, error: fixturesError } = await supabase
    .from('app_fixtures')
    .select('fixture_index, api_match_id')
    .eq('gw', gw)
    .order('fixture_index');
  
  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError);
    return;
  }
  
  // Create a map: api_match_id -> correct fixture_index
  const apiMatchIdToFixtureIndex = new Map();
  fixtures?.forEach(f => {
    if (f.api_match_id) {
      apiMatchIdToFixtureIndex.set(f.api_match_id, f.fixture_index);
    }
  });
  
  console.log('📊 Correct fixture_index mapping:');
  apiMatchIdToFixtureIndex.forEach((fixtureIndex, apiMatchId) => {
    console.log(`   api_match_id=${apiMatchId} -> fixture_index=${fixtureIndex}`);
  });
  
  // Get all live scores for this GW
  const { data: liveScores, error: liveScoresError } = await supabase
    .from('live_scores')
    .select('*')
    .eq('gw', gw);
  
  if (liveScoresError) {
    console.error('❌ Error fetching live scores:', liveScoresError);
    return;
  }
  
  console.log(`\n📊 Found ${liveScores?.length || 0} live scores for GW${gw}`);
  
  // Update each live score with correct fixture_index
  const updates = [];
  for (const liveScore of liveScores || []) {
    const correctFixtureIndex = apiMatchIdToFixtureIndex.get(liveScore.api_match_id);
    
    if (correctFixtureIndex === undefined) {
      console.warn(`⚠️  No fixture found for api_match_id=${liveScore.api_match_id}`);
      continue;
    }
    
    if (liveScore.fixture_index !== correctFixtureIndex) {
      console.log(`   Updating api_match_id=${liveScore.api_match_id}: fixture_index ${liveScore.fixture_index} -> ${correctFixtureIndex}`);
      updates.push({
        api_match_id: liveScore.api_match_id,
        gw: liveScore.gw,
        fixture_index: correctFixtureIndex,
      });
    } else {
      console.log(`   ✓ api_match_id=${liveScore.api_match_id}: fixture_index=${correctFixtureIndex} (already correct)`);
    }
  }
  
  if (updates.length === 0) {
    console.log('\n✅ All live scores already have correct fixture_index values');
    return;
  }
  
  console.log(`\n🔄 Updating ${updates.length} live scores...`);
  
  // Update each live score
  for (const update of updates) {
    const { error } = await supabase
      .from('live_scores')
      .update({ fixture_index: update.fixture_index })
      .eq('api_match_id', update.api_match_id)
      .eq('gw', update.gw);
    
    if (error) {
      console.error(`❌ Error updating live score for api_match_id=${update.api_match_id}:`, error);
    } else {
      console.log(`   ✅ Updated api_match_id=${update.api_match_id} to fixture_index=${update.fixture_index}`);
    }
  }
  
  console.log('\n✅ Live scores fixture_index alignment complete!');
  console.log('   The Global page should now show correct live scores for GW16');
}

fixLiveScoresFixtureIndex().catch(console.error);
