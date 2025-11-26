import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

// Everton match ID from test games
const EVERTON_MATCH_ID = 537902; // Man United vs Everton

async function checkEvertonRedCard() {
  try {
    console.log(`\nChecking API for match ${EVERTON_MATCH_ID} (Man United vs Everton)...\n`);
    
    const apiUrl = `${FOOTBALL_DATA_BASE_URL}/matches/${EVERTON_MATCH_ID}`;
    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Token': FOOTBALL_DATA_API_KEY,
      },
    });

    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text.substring(0, 500));
      return;
    }

    const matchData = await response.json();
    
    console.log('Match Status:', matchData.status);
    console.log('Score:', `${matchData.score?.fullTime?.home ?? 0} - ${matchData.score?.fullTime?.away ?? 0}`);
    
    // Check bookings
    console.log('\n--- Bookings ---');
    if (matchData.bookings && matchData.bookings.length > 0) {
      console.log(`Found ${matchData.bookings.length} bookings:`);
      matchData.bookings.forEach((booking, idx) => {
        console.log(`\n  Booking ${idx + 1}:`);
        console.log(`    Player: ${booking.player?.name || 'Unknown'}`);
        console.log(`    Team: ${booking.team?.name || 'Unknown'}`);
        console.log(`    Minute: ${booking.minute ?? 'Unknown'}`);
        console.log(`    Card: ${booking.card || 'Unknown'}`);
        if (booking.card === 'RED_CARD') {
          console.log(`    ⚠️  RED CARD FOUND!`);
        }
      });
      
      const redCards = matchData.bookings.filter((b) => b.card === 'RED_CARD');
      console.log(`\n  Total Red Cards: ${redCards.length}`);
      if (redCards.length > 0) {
        redCards.forEach((card, idx) => {
          console.log(`\n    Red Card ${idx + 1}:`);
          console.log(`      Player: ${card.player?.name || 'Unknown'}`);
          console.log(`      Team: ${card.team?.name || 'Unknown'}`);
          console.log(`      Minute: ${card.minute ?? 'Unknown'}`);
        });
      }
    } else {
      console.log('No bookings found in API response');
    }
    
    // Check goals for reference
    console.log('\n--- Goals ---');
    if (matchData.goals && matchData.goals.length > 0) {
      console.log(`Found ${matchData.goals.length} goals:`);
      matchData.goals.forEach((goal, idx) => {
        console.log(`  Goal ${idx + 1}: ${goal.scorer?.name || 'Unknown'} (${goal.minute ?? '?'}') - ${goal.team?.name || 'Unknown'}`);
      });
    } else {
      console.log('No goals found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkEvertonRedCard();

