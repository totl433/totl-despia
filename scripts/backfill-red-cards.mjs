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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function normalizeTeamName(apiTeamName) {
  if (!apiTeamName) return null;
  
  const normalized = apiTeamName
    .toLowerCase()
    .replace(/\s+fc\s*$/i, '')
    .replace(/\s+&amp;\s+/g, ' ')
    .replace(/\s*&\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const teamNameMap = {
    'manchester city': 'Man City',
    'manchester united': 'Man United',
    'newcastle united': 'Newcastle',
    'west ham united': 'West Ham',
    'tottenham hotspur': 'Spurs',
    'wolverhampton wanderers': 'Wolves',
    'brighton and hove albion': 'Brighton',
    'brighton hove albion': 'Brighton',
    'leeds united': 'Leeds',
    'nottingham forest': 'Forest',
    'crystal palace': 'Palace',
    'aston villa': 'Villa',
    'everton': 'Everton',
  };
  
  if (teamNameMap[normalized]) {
    return teamNameMap[normalized];
  }
  
  return apiTeamName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+FC\s*$/i, '')
    .trim();
}

async function fetchMatchData(apiMatchId) {
  const apiUrl = `${FOOTBALL_DATA_BASE_URL}/matches/${apiMatchId}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'X-Auth-Token': FOOTBALL_DATA_API_KEY,
    },
  });

  if (!response.ok) {
    console.error(`API Error for match ${apiMatchId}: ${response.status}`);
    return null;
  }

  return await response.json();
}

async function backfillRedCards() {
  try {
    // Get all finished matches from live_scores
    const { data: finishedMatches, error } = await supabase
      .from('live_scores')
      .select('api_match_id, home_team, away_team, status, red_cards')
      .eq('status', 'FINISHED');

    if (error) {
      console.error('Error fetching finished matches:', error);
      return;
    }

    console.log(`\nFound ${finishedMatches?.length || 0} finished matches\n`);

    let updated = 0;
    let skipped = 0;

    for (const match of finishedMatches || []) {
      // Skip if already has red cards
      if (match.red_cards && Array.isArray(match.red_cards) && match.red_cards.length > 0) {
        skipped++;
        continue;
      }

      console.log(`Checking match ${match.api_match_id}: ${match.home_team} vs ${match.away_team}...`);

      const matchData = await fetchMatchData(match.api_match_id);
      if (!matchData) {
        console.log(`  ⚠️  Failed to fetch from API`);
        continue;
      }

      // Extract red cards (check for both "RED" and "RED_CARD")
      const redCards = (matchData.bookings || [])
        .filter((booking) => booking.card === 'RED_CARD' || booking.card === 'RED')
        .map((booking) => ({
          minute: booking.minute ?? null,
          player: booking.player?.name ?? null,
          playerId: booking.player?.id ?? null,
          team: normalizeTeamName(booking.team?.name) ?? null,
          teamId: booking.team?.id ?? null,
        }));

      if (redCards.length > 0) {
        console.log(`  ✅ Found ${redCards.length} red card(s):`);
        redCards.forEach((card) => {
          console.log(`     - ${card.player} (${card.team}) at ${card.minute}'`);
        });

        // Update the database
        const { error: updateError } = await supabase
          .from('live_scores')
          .update({ red_cards: redCards })
          .eq('api_match_id', match.api_match_id);

        if (updateError) {
          console.error(`  ❌ Error updating: ${updateError.message}`);
        } else {
          console.log(`  ✅ Updated in database`);
          updated++;
        }
      } else {
        console.log(`  ℹ️  No red cards found`);
        skipped++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ Backfill complete! Updated ${updated} matches, skipped ${skipped} matches\n`);

  } catch (error) {
    console.error('Error:', error);
  }
}

backfillRedCards();


