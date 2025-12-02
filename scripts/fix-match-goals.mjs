import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

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

// Normalize team name function (same as in pollLiveScores.ts)
function normalizeTeamName(apiTeamName) {
  if (!apiTeamName) return null;
  
  const normalized = apiTeamName
    .toLowerCase()
    .replace(/\s+fc\s*$/i, '') // Remove "FC" at end
    .replace(/\s+&amp;\s+/g, ' ') // Replace &amp; with space
    .replace(/\s*&\s*/g, ' ') // Replace & with space
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
  
  // Map common API variations to our canonical medium names
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
  };
  
  // Check if we have a mapping
  if (teamNameMap[normalized]) {
    return teamNameMap[normalized];
  }
  
  // If no mapping, capitalize first letter of each word (fallback)
  return apiTeamName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+FC\s*$/i, '')
    .trim();
}

// Match ID to fix (Fulham vs Man City)
const apiMatchId = 537919;

async function fixMatchGoals() {
  console.log(`\n🔄 Re-polling API for match ${apiMatchId} to get correct goal data...\n`);

  // Fetch match data from API
  const apiUrl = `${FOOTBALL_DATA_BASE_URL}/matches/${apiMatchId}`;
  console.log(`📡 Fetching from API: ${apiUrl}\n`);

  const response = await fetch(apiUrl, {
    headers: {
      'X-Auth-Token': FOOTBALL_DATA_API_KEY,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const matchData = await response.json();
  console.log(`✅ Got match data from API\n`);

  // Get current live_score record
  const { data: liveScore, error: fetchError } = await supabase
    .from('live_scores')
    .select('*')
    .eq('api_match_id', apiMatchId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch live score: ${fetchError.message}`);
  }

  if (!liveScore) {
    throw new Error(`No live score found for match ${apiMatchId}`);
  }

  console.log(`📊 Current stored data:`);
  console.log(`   Home: ${liveScore.home_team} ${liveScore.home_score}`);
  console.log(`   Away: ${liveScore.away_team} ${liveScore.away_score}`);
  console.log(`   Goals: ${(liveScore.goals || []).length}\n`);

  // Process goals with own goal detection
  const homeTeamId = matchData.homeTeam?.id;
  const awayTeamId = matchData.awayTeam?.id;
  
  // Log full goal structure to see what the API provides
  console.log(`\n🔍 Full API goal structure for first goal:`);
  if (matchData.goals && matchData.goals.length > 0) {
    console.log(JSON.stringify(matchData.goals[0], null, 2));
  }

  const goals = (matchData.goals || []).map((goal) => {
    // Log each goal's full structure
    console.log(`\n   Goal: ${goal.scorer?.name} ${goal.minute}'`);
    console.log(`      Full structure:`, JSON.stringify(goal, null, 6));
    
    let goalTeam = goal.team;
    let goalTeamId = goal.team?.id;
    
    // Check various ways the API might indicate own goals
    // API uses "OWN" for own goals (not "OWN_GOAL")
    const isOwnGoal = goal.type === 'OWN' || 
                     goal.type === 'OWN_GOAL' || 
                     goal.type === 'OWN GOAL' ||
                     (goal.scorer?.name && goal.scorer.name.toLowerCase().includes('own goal')) ||
                     (goal.scorer?.name && goal.scorer.name.toLowerCase().includes('(og)')) ||
                     goal.ownGoal === true ||
                     goal.ownGoal === 'true';
    
    if (isOwnGoal) {
      // Own goal: if player's team is home, goal counts for away (and vice versa)
      if (goalTeamId === homeTeamId) {
        goalTeam = matchData.awayTeam;
        goalTeamId = awayTeamId;
      } else if (goalTeamId === awayTeamId) {
        goalTeam = matchData.homeTeam;
        goalTeamId = homeTeamId;
      }
      console.log(`      ⚠️  OWN GOAL DETECTED - player's team: "${goal.team?.name}", goal counts for: "${goalTeam?.name}"`);
    } else {
      console.log(`      ✅ Regular goal - team: "${goalTeam?.name}"`);
    }
    
    const normalizedTeam = normalizeTeamName(goalTeam?.name);
    return {
      minute: goal.minute ?? null,
      scorer: goal.scorer?.name ?? null,
      scorerId: goal.scorer?.id ?? null,
      team: normalizedTeam ?? null,
      teamId: goalTeamId ?? null,
      isOwnGoal: isOwnGoal,
    };
  });

  // Get scores
  const status = matchData.status || 'FINISHED';
  const homeScore = matchData.score?.fullTime?.home ?? matchData.score?.current?.home ?? 0;
  const awayScore = matchData.score?.fullTime?.away ?? matchData.score?.current?.away ?? 0;

  // Update live_scores
  const { error: updateError } = await supabase
    .from('live_scores')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: status,
      minute: null, // Finished game
      home_team: normalizeTeamName(matchData.homeTeam?.name) || liveScore.home_team,
      away_team: normalizeTeamName(matchData.awayTeam?.name) || liveScore.away_team,
      goals: goals.length > 0 ? goals : null,
    })
    .eq('api_match_id', apiMatchId);

  if (updateError) {
    throw new Error(`Failed to update live score: ${updateError.message}`);
  }

  console.log(`\n✅ Successfully updated match ${apiMatchId}`);
  console.log(`   New score: ${homeScore}-${awayScore}`);
  console.log(`   Goals: ${goals.length} (${goals.filter(g => g.isOwnGoal).length} own goals)`);
  console.log(`\n   Home goals (${goals.filter(g => g.team === normalizeTeamName(matchData.homeTeam?.name)).length}):`);
  goals.filter(g => g.team === normalizeTeamName(matchData.homeTeam?.name)).forEach(g => {
    console.log(`      - ${g.scorer} ${g.minute}'${g.isOwnGoal ? ' (OWN GOAL)' : ''}`);
  });
  console.log(`   Away goals (${goals.filter(g => g.team === normalizeTeamName(matchData.awayTeam?.name)).length}):`);
  goals.filter(g => g.team === normalizeTeamName(matchData.awayTeam?.name)).forEach(g => {
    console.log(`      - ${g.scorer} ${g.minute}'${g.isOwnGoal ? ' (OWN GOAL)' : ''}`);
  });
}

fixMatchGoals()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

