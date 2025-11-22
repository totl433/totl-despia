import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

async function getCarlWeeklyScores() {
  console.log('📊 Carl\'s Weekly Scores Breakdown (READ-ONLY)\n');

  // Get all of Carl's picks
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('gw, fixture_index, pick')
    .eq('user_id', CARL_USER_ID)
    .order('gw', { ascending: true })
    .order('fixture_index', { ascending: true });

  if (picksError) {
    console.error('❌ Error fetching picks:', picksError.message);
    return;
  }

  // Get all results
  const { data: results, error: resultsError } = await supabase
    .from('gw_results')
    .select('gw, fixture_index, result')
    .order('gw', { ascending: true })
    .order('fixture_index', { ascending: true });

  if (resultsError) {
    console.error('❌ Error fetching results:', resultsError.message);
    return;
  }

  // Create result map
  const resultMap = new Map();
  results.forEach(r => {
    const key = `${r.gw}:${r.fixture_index}`;
    resultMap.set(key, r.result);
  });

  // Calculate scores by gameweek
  const scoresByGw = new Map();
  let totalCorrect = 0;
  let totalPicks = 0;

  picks.forEach(pick => {
    totalPicks++;
    const key = `${pick.gw}:${pick.fixture_index}`;
    const result = resultMap.get(key);
    
    if (!scoresByGw.has(pick.gw)) {
      scoresByGw.set(pick.gw, { correct: 0, total: 0 });
    }
    
    const gwScore = scoresByGw.get(pick.gw);
    gwScore.total++;
    
    if (result && pick.pick === result) {
      gwScore.correct++;
      totalCorrect++;
    }
  });

  // Display results
  console.log('='.repeat(60));
  console.log('Gameweek | Correct | Total | Score');
  console.log('='.repeat(60));

  const sortedGws = Array.from(scoresByGw.keys()).sort((a, b) => a - b);
  let runningTotal = 0;

  sortedGws.forEach(gw => {
    const score = scoresByGw.get(gw);
    runningTotal += score.correct;
    const percentage = score.total > 0 ? ((score.correct / score.total) * 100).toFixed(1) : 0;
    console.log(`   GW${String(gw).padStart(2)}  |   ${String(score.correct).padStart(2)}    |  ${String(score.total).padStart(2)}  | ${score.correct}/${score.total} (${percentage}%)`);
  });

  console.log('='.repeat(60));
  console.log(`   TOTAL  |   ${String(totalCorrect).padStart(2)}    |  ${String(totalPicks).padStart(3)}  | ${totalCorrect}/${totalPicks} (${((totalCorrect / totalPicks) * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  console.log(`\n📈 Summary:`);
  console.log(`   Total Correct Predictions: ${totalCorrect}`);
  console.log(`   Total Picks Made: ${totalPicks}`);
  console.log(`   Overall Accuracy: ${((totalCorrect / totalPicks) * 100).toFixed(1)}%`);
  console.log(`   Gameweeks Played: ${sortedGws.length}\n`);

  // Show best and worst gameweeks
  let bestGw = null;
  let worstGw = null;
  let bestScore = 0;
  let worstScore = Infinity;

  sortedGws.forEach(gw => {
    const score = scoresByGw.get(gw);
    const percentage = score.total > 0 ? (score.correct / score.total) : 0;
    
    if (percentage > bestScore) {
      bestScore = percentage;
      bestGw = { gw, correct: score.correct, total: score.total };
    }
    
    if (percentage < worstScore) {
      worstScore = percentage;
      worstGw = { gw, correct: score.correct, total: score.total };
    }
  });

  if (bestGw) {
    console.log(`🏆 Best Gameweek: GW${bestGw.gw} - ${bestGw.correct}/${bestGw.total} (${((bestGw.correct / bestGw.total) * 100).toFixed(1)}%)`);
  }
  if (worstGw) {
    console.log(`📉 Worst Gameweek: GW${worstGw.gw} - ${worstGw.correct}/${worstGw.total} (${((worstGw.correct / worstGw.total) * 100).toFixed(1)}%)\n`);
  }
}

getCarlWeeklyScores().catch(console.error);

