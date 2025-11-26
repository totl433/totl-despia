// One-time script to poll test games and update goals/red cards
// Run this manually to backfill scorer and red card data for finished test games

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL or VITE_SUPABASE_URL environment variable');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('   This script needs the service role key to update the database.');
  console.error('   You can find it in Supabase Dashboard → Settings → API → service_role key');
  console.error('   Add it to your .env file as: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchMatchScore(apiMatchId) {
  const apiUrl = `${FOOTBALL_DATA_BASE_URL}/matches/${apiMatchId}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'X-Auth-Token': FOOTBALL_DATA_API_KEY,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.warn(`Rate limited for match ${apiMatchId}, retry after ${retryAfter}s`);
      return null;
    }
    console.error(`API error for match ${apiMatchId}:`, response.status, response.statusText);
    return null;
  }

  return await response.json();
}

async function pollTestGames() {
  try {
    console.log('🔍 Fetching test API fixtures...\n');
    
    // Get all test API fixtures
    const { data: testFixtures, error: fixturesError } = await supabase
      .from('test_api_fixtures')
      .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, test_gw')
      .not('api_match_id', 'is', null);

    if (fixturesError) {
      console.error('Error fetching test fixtures:', fixturesError);
      return;
    }

    if (!testFixtures || testFixtures.length === 0) {
      console.log('No test fixtures found');
      return;
    }

    console.log(`Found ${testFixtures.length} test fixtures\n`);

    const updates = [];

    for (let i = 0; i < testFixtures.length; i++) {
      const fixture = testFixtures[i];
      const apiMatchId = fixture.api_match_id;

      console.log(`[${i + 1}/${testFixtures.length}] Polling match ${apiMatchId} (${fixture.home_team} vs ${fixture.away_team})...`);

      // Small delay between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const matchData = await fetchMatchScore(apiMatchId);
      
      if (!matchData) {
        console.log(`  ⚠️  Skipped (rate limited or error)\n`);
        continue;
      }

      // Extract goals
      const goals = (matchData.goals || []).map((goal) => ({
        minute: goal.minute ?? null,
        scorer: goal.scorer?.name ?? null,
        scorerId: goal.scorer?.id ?? null,
        team: goal.team?.name ?? null,
        teamId: goal.team?.id ?? null,
      }));

      // Extract red cards
      const redCards = (matchData.bookings || [])
        .filter((booking) => booking.card === 'RED_CARD')
        .map((booking) => ({
          minute: booking.minute ?? null,
          player: booking.player?.name ?? null,
          playerId: booking.player?.id ?? null,
          team: booking.team?.name ?? null,
          teamId: booking.team?.id ?? null,
        }));

      updates.push({
        api_match_id: apiMatchId,
        goals: goals.length > 0 ? goals : null,
        red_cards: redCards.length > 0 ? redCards : null,
      });

      console.log(`  ✅ Updated: ${goals.length} goals, ${redCards.length} red cards\n`);
    }

    // Update live_scores with goals and red_cards only
    if (updates.length > 0) {
      console.log(`\n📝 Updating ${updates.length} matches in live_scores...\n`);

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('live_scores')
          .update({
            goals: update.goals,
            red_cards: update.red_cards,
          })
          .eq('api_match_id', update.api_match_id);

        if (updateError) {
          console.error(`  ❌ Error updating match ${update.api_match_id}:`, updateError);
        } else {
          console.log(`  ✅ Updated match ${update.api_match_id}`);
        }
      }

      console.log(`\n✨ Done! Updated ${updates.length} matches with goals and red cards.`);
    } else {
      console.log('\n⚠️  No updates to apply');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

pollTestGames()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

