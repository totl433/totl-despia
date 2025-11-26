import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fix Leeds v Villa score to 1-2
 * API match ID: 537901
 */
async function fixLeedsVillaScore() {
  const apiMatchId = 537901;
  const homeScore = 1;
  const awayScore = 2;

  console.log(`🔧 Fixing Leeds v Villa score (match ${apiMatchId}) to ${homeScore}-${awayScore}...\n`);

  try {
    // First, get the current score
    const { data: currentScore, error: fetchError } = await supabase
      .from('live_scores')
      .select('*')
      .eq('api_match_id', apiMatchId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Error fetching current score:', fetchError);
      process.exit(1);
    }

    if (!currentScore) {
      console.error(`❌ No live score found for api_match_id ${apiMatchId}`);
      process.exit(1);
    }

    console.log(`📊 Current score: ${currentScore.home_score}-${currentScore.away_score}`);
    console.log(`   Status: ${currentScore.status}`);
    console.log(`   Teams: ${currentScore.home_team} vs ${currentScore.away_team}`);
    console.log(`   GW: ${currentScore.gw}, Fixture Index: ${currentScore.fixture_index}\n`);

    // Update the score
    const { error: updateError } = await supabase
      .from('live_scores')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        updated_at: new Date().toISOString(),
      })
      .eq('api_match_id', apiMatchId);

    if (updateError) {
      console.error('❌ Error updating score:', updateError);
      process.exit(1);
    }

    console.log(`✅ Successfully updated score to ${homeScore}-${awayScore}`);
    console.log(`   Note: This will be overwritten if pollLiveScores runs again`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixLeedsVillaScore();

