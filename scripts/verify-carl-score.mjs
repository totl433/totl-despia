import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

async function verifyCarlScore() {
  console.log('🔍 Verifying Carl\'s score (READ-ONLY check)...\n');

  // Get Carl's picks
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', CARL_USER_ID)
    .order('gw', { ascending: true })
    .order('fixture_index', { ascending: true });

  if (picksError) {
    console.error('❌ Error fetching picks:', picksError.message);
    return;
  }

  console.log(`📊 Carl has ${picks.length} picks across ${new Set(picks.map(p => p.gw)).size} gameweeks\n`);

  // Get all results
  const { data: results, error: resultsError } = await supabase
    .from('gw_results')
    .select('*')
    .order('gw', { ascending: true })
    .order('fixture_index', { ascending: true });

  if (resultsError) {
    console.error('❌ Error fetching results:', resultsError.message);
    return;
  }

  // Create a map of results for quick lookup
  const resultMap = new Map();
  results.forEach(r => {
    const key = `${r.gw}:${r.fixture_index}`;
    resultMap.set(key, r.result);
  });

  // Calculate Carl's score
  let correctPicks = 0;
  let totalPicks = 0;
  const scoreByGw = new Map();

  picks.forEach(pick => {
    totalPicks++;
    const key = `${pick.gw}:${pick.fixture_index}`;
    const result = resultMap.get(key);
    
    if (result && pick.pick === result) {
      correctPicks++;
      
      // Track by gameweek
      if (!scoreByGw.has(pick.gw)) {
        scoreByGw.set(pick.gw, { correct: 0, total: 0 });
      }
      const gwScore = scoreByGw.get(pick.gw);
      gwScore.correct++;
      gwScore.total++;
    } else if (result) {
      // Track by gameweek even if incorrect
      if (!scoreByGw.has(pick.gw)) {
        scoreByGw.set(pick.gw, { correct: 0, total: 0 });
      }
      const gwScore = scoreByGw.get(pick.gw);
      gwScore.total++;
    }
  });

  console.log('📈 Score Summary:');
  console.log(`   Total Picks: ${totalPicks}`);
  console.log(`   Correct Picks: ${correctPicks}`);
  console.log(`   Accuracy: ${totalPicks > 0 ? ((correctPicks / totalPicks) * 100).toFixed(1) : 0}%\n`);

  console.log('📊 Score by Gameweek:');
  const sortedGws = Array.from(scoreByGw.keys()).sort((a, b) => a - b);
  sortedGws.forEach(gw => {
    const score = scoreByGw.get(gw);
    console.log(`   GW${gw}: ${score.correct}/${score.total} correct`);
  });

  // Get Carl's submissions
  const { data: submissions, error: subsError } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', CARL_USER_ID)
    .not('submitted_at', 'is', null)
    .order('gw', { ascending: true });

  if (subsError) {
    console.error('❌ Error fetching submissions:', subsError.message);
  } else {
    console.log(`\n📝 Submissions: ${submissions.length} gameweeks submitted`);
    submissions.forEach(s => {
      console.log(`   GW${s.gw}: Submitted at ${new Date(s.submitted_at).toLocaleString()}`);
    });
  }

  // Check OCP (Overall Correct Predictions) from the view if it exists
  console.log('\n🔍 Checking overall standings...');
  const { data: standings, error: standingsError } = await supabase
    .from('v_ocp_overall')
    .select('user_id, name, ocp')
    .eq('user_id', CARL_USER_ID)
    .single();

  if (standingsError) {
    console.log('   ⚠️  Could not fetch from v_ocp_overall view');
  } else if (standings) {
    console.log(`   ✅ Carl's OCP in database: ${standings.ocp}`);
    console.log(`   ✅ Calculated correct picks: ${correctPicks}`);
    
    if (standings.ocp !== correctPicks) {
      console.log(`\n   ⚠️  WARNING: Mismatch!`);
      console.log(`      Database OCP: ${standings.ocp}`);
      console.log(`      Calculated: ${correctPicks}`);
      console.log(`      Difference: ${standings.ocp - correctPicks}`);
    } else {
      console.log(`\n   ✅ Score matches! Carl's OCP is correct.`);
    }
  }

  // Check mini-league table scores
  console.log('\n🔍 Checking league memberships...');
  const { data: leagues, error: leagueError } = await supabase
    .from('league_members')
    .select('league_id, leagues(name)')
    .eq('user_id', CARL_USER_ID);

  if (leagueError) {
    console.error('❌ Error fetching leagues:', leagueError.message);
  } else {
    console.log(`   Carl is in ${leagues.length} league(s):`);
    leagues.forEach(l => {
      console.log(`   - ${l.leagues?.name || 'Unknown'}`);
    });
  }

  console.log('\n✅ Verification complete!\n');
}

verifyCarlScore().catch(console.error);

