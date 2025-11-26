// Quick script to check what's in live_scores table
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function checkLiveScores() {
  try {
    // Get all test API fixtures to find their api_match_ids
    const { data: testFixtures } = await supabase
      .from('test_api_fixtures')
      .select('api_match_id, home_team, away_team')
      .not('api_match_id', 'is', null);

    if (!testFixtures || testFixtures.length === 0) {
      console.log('No test fixtures found');
      return;
    }

    const apiMatchIds = testFixtures.map(f => f.api_match_id);
    
    // Check live_scores for these matches
    const { data: liveScores, error } = await supabase
      .from('live_scores')
      .select('api_match_id, home_team, away_team, goals, red_cards')
      .in('api_match_id', apiMatchIds);

    if (error) {
      console.error('Error fetching live_scores:', error);
      return;
    }

    console.log(`\nFound ${liveScores?.length || 0} matches in live_scores:\n`);

    liveScores?.forEach((score) => {
      const fixture = testFixtures.find(f => f.api_match_id === score.api_match_id);
      console.log(`${score.home_team} vs ${score.away_team} (api_match_id: ${score.api_match_id})`);
      console.log(`  Goals: ${score.goals ? JSON.stringify(score.goals, null, 2) : 'null'}`);
      console.log(`  Red Cards: ${score.red_cards ? JSON.stringify(score.red_cards, null, 2) : 'null'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

checkLiveScores()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });


