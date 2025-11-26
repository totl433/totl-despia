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

async function checkRedCards() {
  try {
    // Get all live_scores with red cards
    const { data, error } = await supabase
      .from('live_scores')
      .select('api_match_id, home_team, away_team, red_cards, goals')
      .not('red_cards', 'is', null)
      .order('api_match_id');

    if (error) {
      console.error('Error fetching live scores:', error);
      return;
    }

    console.log(`\nFound ${data?.length || 0} matches with red cards:\n`);

    data?.forEach(match => {
      console.log(`${match.home_team} vs ${match.away_team} (api_match_id: ${match.api_match_id})`);
      console.log(`  Red Cards: ${JSON.stringify(match.red_cards, null, 2)}`);
      console.log(`  Goals: ${JSON.stringify(match.goals, null, 2)}\n`);
    });

    // Also check for Everton specifically
    console.log('\n--- Checking for Everton matches ---\n');
    const { data: evertonMatches, error: evertonError } = await supabase
      .from('live_scores')
      .select('api_match_id, home_team, away_team, red_cards')
      .or('home_team.ilike.%everton%,away_team.ilike.%everton%');

    if (evertonError) {
      console.error('Error fetching Everton matches:', evertonError);
    } else {
      console.log(`Found ${evertonMatches?.length || 0} Everton matches:\n`);
      evertonMatches?.forEach(match => {
        console.log(`${match.home_team} vs ${match.away_team} (api_match_id: ${match.api_match_id})`);
        console.log(`  Red Cards: ${JSON.stringify(match.red_cards, null, 2)}\n`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkRedCards();

