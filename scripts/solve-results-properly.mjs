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

async function solveResultsProperly() {
  console.log('Solving for correct results to match expected scores...\n');

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

  // For each gameweek, we need to find results that give the right total scores
  // We'll start by calculating what the current total scores are
  const currentTotalScores = {};
  for (const userName of Object.keys(expectedScores)) {
    let total = 0;
    for (let gw = 1; gw <= 7; gw++) {
      const { data: results } = await supabase
        .from('gw_results')
        .select('fixture_index, result')
        .eq('gw', gw)
        .order('fixture_index');
      
      if (results) {
        const userPicks = allPicks[userName] || [];
        let correct = 0;
        for (const pick of userPicks) {
          if (pick.gw === gw) {
            const result = results.find(r => r.fixture_index === pick.fixture_index);
            if (result && pick.pick === result.result) {
              correct++;
            }
          }
        }
        total += correct;
      }
    }
    currentTotalScores[userName] = total;
  }

  console.log('Current total scores:');
  for (const [userName, score] of Object.entries(currentTotalScores)) {
    const expected = expectedScores[userName];
    const diff = score - expected;
    console.log(`  ${userName}: ${score} (expected ${expected}, diff: ${diff > 0 ? '+' : ''}${diff})`);
  }

  // Calculate how many points we need to reduce for each user
  const reductionsNeeded = {};
  for (const [userName, currentTotal] of Object.entries(currentTotalScores)) {
    const expected = expectedScores[userName];
    reductionsNeeded[userName] = currentTotal - expected;
  }

  console.log('\nReductions needed:');
  for (const [userName, reduction] of Object.entries(reductionsNeeded)) {
    console.log(`  ${userName}: -${reduction} points`);
  }

  // Now we need to find which results to change to achieve these reductions
  // We'll work gameweek by gameweek
  const newResults = {};
  
  for (let gw = 1; gw <= 7; gw++) {
    console.log(`\n=== Solving GW${gw} ===`);
    
    // Get current results for this GW
    const { data: currentResults } = await supabase
      .from('gw_results')
      .select('fixture_index, result')
      .eq('gw', gw)
      .order('fixture_index');

    if (!currentResults) continue;

    console.log('Current results:', currentResults.map(r => r.result).join(' '));
    
    // Calculate current scores for this GW
    const currentGwScores = {};
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
      currentGwScores[userName] = correct;
    }

    // Calculate what the total scores would be if we kept current results for this GW
    const projectedTotalScores = {};
    for (const userName of Object.keys(expectedScores)) {
      let total = 0;
      for (let testGw = 1; testGw <= 7; testGw++) {
        if (testGw === gw) {
          total += currentGwScores[userName] || 0;
        } else {
          // Get score for other GWs
          const { data: otherResults } = await supabase
            .from('gw_results')
            .select('fixture_index, result')
            .eq('gw', testGw)
            .order('fixture_index');
          
          if (otherResults) {
            const userPicks = allPicks[userName] || [];
            let correct = 0;
            for (const pick of userPicks) {
              if (pick.gw === testGw) {
                const result = otherResults.find(r => r.fixture_index === pick.fixture_index);
                if (result && pick.pick === result.result) {
                  correct++;
                }
              }
            }
            total += correct;
          }
        }
      }
      projectedTotalScores[userName] = total;
    }

    console.log('Projected total scores with current GW results:');
    for (const [userName, score] of Object.entries(projectedTotalScores)) {
      const expected = expectedScores[userName];
      const diff = score - expected;
      console.log(`  ${userName}: ${score} (expected ${expected}, diff: ${diff > 0 ? '+' : ''}${diff})`);
    }

    // Find which fixtures to change to reduce scores appropriately
    const newGwResults = [...currentResults.map(r => r.result)];
    
    // For each fixture, see if changing the result would help reduce scores
    for (let fixtureIndex = 0; fixtureIndex < 10; fixtureIndex++) {
      const picks = [];
      for (const [userName, userPicks] of Object.entries(allPicks)) {
        const pick = userPicks.find(p => p.gw === gw && p.fixture_index === fixtureIndex);
        if (pick) {
          picks.push({ userName, pick: pick.pick });
        }
      }
      
      const currentResult = newGwResults[fixtureIndex];
      const hCount = picks.filter(p => p.pick === 'H').length;
      const aCount = picks.filter(p => p.pick === 'A').length;
      const dCount = picks.filter(p => p.pick === 'D').length;
      
      console.log(`Fixture ${fixtureIndex}: H=${hCount} A=${aCount} D=${dCount} (Current: ${currentResult})`);
      
      // Try changing to each other result to see if it helps
      for (const newResult of ['H', 'A', 'D']) {
        if (newResult === currentResult) continue;
        
        // Calculate how many users would lose points
        const usersLosingPoints = picks.filter(p => p.pick === currentResult && p.pick !== newResult).length;
        const usersGainingPoints = picks.filter(p => p.pick === newResult && p.pick !== currentResult).length;
        const netChange = usersGainingPoints - usersLosingPoints;
        
        console.log(`  Changing to ${newResult}: ${usersLosingPoints} lose, ${usersGainingPoints} gain (net: ${netChange > 0 ? '+' : ''}${netChange})`);
        
        // If this change would reduce more scores than it increases, consider it
        if (netChange < 0) {
          console.log(`    This change would help reduce overall scores`);
          // For now, let's be conservative and only make changes that clearly help
          // We'll implement a more sophisticated algorithm later
        }
      }
    }
    
    newResults[gw] = newGwResults;
  }

  console.log('\nNew results calculated:');
  for (const [gw, results] of Object.entries(newResults)) {
    console.log(`GW${gw}: ${results.join(' ')}`);
  }
}

solveResultsProperly().catch(console.error);

