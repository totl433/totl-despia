import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Expected scores from the leaderboard image
const expectedScores = {
  'Phil Bolton': 38,
  'David Bird': 36,
  'Sim': 35,
  'Paul N': 33,
  'Carl': 32,
  'Jof': 32,
  'gregory': 31,
  'Matthew Bird': 31,
  'SP': 31,
  'Will Middleton': 29,
  'ThomasJamesBird': 28,
  'Ben New': 26
};

// Get all picks for all users
async function calculateCorrectResults() {
  console.log('Calculating what the results should be to match expected scores...\n');

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const userMap = new Map(users.map(u => [u.name, u.id]));
  
  // Get all picks for target users
  const allPicks = {};
  for (const userName of Object.keys(expectedScores)) {
    const userId = userMap.get(userName);
    if (!userId) continue;

    const { data: picks } = await supabase
      .from('picks')
      .select('gw, fixture_index, pick')
      .eq('user_id', userId)
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    if (picks) {
      allPicks[userName] = picks;
    }
  }

  // For each gameweek, calculate what results would give the expected scores
  for (let gw = 1; gw <= 7; gw++) {
    console.log(`\n=== GW${gw} Analysis ===`);
    
    // Get current results for this GW
    const { data: currentResults } = await supabase
      .from('gw_results')
      .select('fixture_index, result')
      .eq('gw', gw)
      .order('fixture_index');

    if (!currentResults) continue;

    console.log('Current results:', currentResults.map(r => r.result).join(' '));
    
    // For each fixture, see what the majority of users picked
    const fixturePicks = {};
    for (let fixtureIndex = 0; fixtureIndex < 10; fixtureIndex++) {
      const picks = [];
      for (const [userName, userPicks] of Object.entries(allPicks)) {
        const pick = userPicks.find(p => p.gw === gw && p.fixture_index === fixtureIndex);
        if (pick) {
          picks.push({ userName, pick: pick.pick });
        }
      }
      fixturePicks[fixtureIndex] = picks;
    }

    // Show picks for each fixture
    for (let fixtureIndex = 0; fixtureIndex < 10; fixtureIndex++) {
      const picks = fixturePicks[fixtureIndex];
      const hCount = picks.filter(p => p.pick === 'H').length;
      const aCount = picks.filter(p => p.pick === 'A').length;
      const dCount = picks.filter(p => p.pick === 'D').length;
      
      console.log(`Fixture ${fixtureIndex}: H=${hCount} A=${aCount} D=${dCount} (Current result: ${currentResults[fixtureIndex]?.result})`);
    }
  }

  console.log('\nThis analysis shows the distribution of picks for each fixture.');
  console.log('The correct results should be determined by what gives the expected scores.');
}

calculateCorrectResults().catch(console.error);

