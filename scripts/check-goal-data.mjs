import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Check Fulham vs Man City match (api_match_id 537919 from earlier logs)
const apiMatchId = 537919;

async function checkGoalData() {
  console.log(`\n🔍 Checking goal data for match ${apiMatchId} (Fulham vs Man City)\n`);

  const { data: liveScore, error } = await supabase
    .from('live_scores')
    .select('*')
    .eq('api_match_id', apiMatchId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching live score:', error);
    return;
  }

  if (!liveScore) {
    console.log('❌ No live score found for this match');
    return;
  }

  console.log('📊 Match Info:');
  console.log(`   Home Team: "${liveScore.home_team}"`);
  console.log(`   Away Team: "${liveScore.away_team}"`);
  console.log(`   Score: ${liveScore.home_score}-${liveScore.away_score}`);
  console.log(`   Status: ${liveScore.status}\n`);

  console.log('⚽ Goals:');
  const goals = liveScore.goals || [];
  if (goals.length === 0) {
    console.log('   No goals found');
  } else {
    goals.forEach((goal, index) => {
      console.log(`   ${index + 1}. ${goal.scorer} ${goal.minute}'`);
      console.log(`      - goal.team: "${goal.team}"`);
      console.log(`      - goal.teamId: ${goal.teamId}`);
      console.log(`      - Matches home_team: ${goal.team === liveScore.home_team ? '✅' : '❌'}`);
      console.log(`      - Matches away_team: ${goal.team === liveScore.away_team ? '✅' : '❌'}`);
      console.log('');
    });
  }

  // Check what the frontend would see
  console.log('\n🎯 Frontend Matching Analysis:');
  const homeGoals = goals.filter(g => g.team === liveScore.home_team);
  const awayGoals = goals.filter(g => g.team === liveScore.away_team);
  const unmatchedGoals = goals.filter(g => g.team !== liveScore.home_team && g.team !== liveScore.away_team);

  console.log(`   Home goals (${homeGoals.length}):`);
  homeGoals.forEach(g => console.log(`      - ${g.scorer} ${g.minute}' (team: "${g.team}")`));
  
  console.log(`   Away goals (${awayGoals.length}):`);
  awayGoals.forEach(g => console.log(`      - ${g.scorer} ${g.minute}' (team: "${g.team}")`));
  
  if (unmatchedGoals.length > 0) {
    console.log(`   ⚠️  Unmatched goals (${unmatchedGoals.length}):`);
    unmatchedGoals.forEach(g => console.log(`      - ${g.scorer} ${g.minute}' (team: "${g.team}")`));
  }
}

checkGoalData()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

