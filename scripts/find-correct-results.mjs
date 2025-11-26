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

async function findCorrectResults() {
  console.log('Finding correct results to match expected scores...\n');

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

  // For each gameweek, try different result combinations to see which gives the expected scores
  for (let gw = 1; gw <= 7; gw++) {
    console.log(`\n=== GW${gw} - Finding correct results ===`);
    
    // Get current results
    const { data: currentResults } = await supabase
      .from('gw_results')
      .select('fixture_index, result')
      .eq('gw', gw)
      .order('fixture_index');

    if (!currentResults) continue;

    console.log('Current results:', currentResults.map(r => r.result).join(' '));
    
    // Calculate what each user's score would be with current results
    const currentScores = {};
    for (const [userName, picks] of Object.entries(allPicks)) {
      let correct = 0;
      for (const pick of picks) {
        if (pick.gw === gw) {
          const result = currentResults.find(r => r.fixture_index === pick.fixture_index);
          if (result && pick.pick === result.result) {
            correct++;
          }
        }
      }
      currentScores[userName] = correct;
    }

    console.log('Current scores for this GW:');
    for (const [userName, score] of Object.entries(currentScores)) {
      console.log(`  ${userName}: ${score}`);
    }

    // Try flipping some results to see if we can get closer to expected scores
    // This is a simplified approach - we'll try flipping results that would reduce scores
    const possibleResults = ['H', 'A', 'D'];
    let bestResults = [...currentResults.map(r => r.result)];
    let bestScore = calculateTotalScoreDifference(currentScores, expectedScores, allPicks, gw, bestResults);
    
    console.log(`Current total score difference: ${bestScore}`);
    
    // Try flipping each fixture result
    for (let fixtureIndex = 0; fixtureIndex < 10; fixtureIndex++) {
      for (const newResult of possibleResults) {
        if (newResult === bestResults[fixtureIndex]) continue;
        
        const testResults = [...bestResults];
        testResults[fixtureIndex] = newResult;
        
        const testScores = calculateScoresForResults(allPicks, gw, testResults);
        const testScore = calculateTotalScoreDifference(testScores, expectedScores, allPicks, gw, testResults);
        
        if (testScore < bestScore) {
          bestScore = testScore;
          bestResults = testResults;
          console.log(`Better result found: Fixture ${fixtureIndex} = ${newResult}, score diff = ${testScore}`);
        }
      }
    }
    
    console.log(`Best results for GW${gw}:`, bestResults.join(' '));
    console.log(`Best score difference: ${bestScore}`);
  }
}

function calculateScoresForResults(allPicks, gw, results) {
  const scores = {};
  for (const [userName, picks] of Object.entries(allPicks)) {
    let correct = 0;
    for (const pick of picks) {
      if (pick.gw === gw) {
        if (pick.pick === results[pick.fixture_index]) {
          correct++;
        }
      }
    }
    scores[userName] = correct;
  }
  return scores;
}

function calculateTotalScoreDifference(currentScores, expectedScores, allPicks, gw, results) {
  // Calculate what the total scores would be with these results
  const totalScores = {};
  for (const userName of Object.keys(expectedScores)) {
    let totalCorrect = 0;
    for (let testGw = 1; testGw <= 7; testGw++) {
      if (testGw === gw) {
        // Use the test results for this GW
        const userPicks = allPicks[userName] || [];
        for (const pick of userPicks) {
          if (pick.gw === gw && pick.pick === results[pick.fixture_index]) {
            totalCorrect++;
          }
        }
      } else {
        // Use current results for other GWs
        totalCorrect += currentScores[userName] || 0;
      }
    }
    totalScores[userName] = totalCorrect;
  }
  
  // Calculate difference from expected
  let totalDiff = 0;
  for (const [userName, expected] of Object.entries(expectedScores)) {
    const actual = totalScores[userName] || 0;
    totalDiff += Math.abs(actual - expected);
  }
  
  return totalDiff;
}

findCorrectResults().catch(console.error);

