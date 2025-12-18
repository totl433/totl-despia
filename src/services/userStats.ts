import { supabase } from '../lib/supabase';

export interface UserStatsData {
  // Last completed GW percentile
  lastCompletedGw: number | null;
  lastCompletedGwPercentile: number | null; // 0-100
  
  // Overall percentile
  overallPercentile: number | null; // 0-100
  
  // Correct prediction rate
  correctPredictionRate: number | null; // 0-100
  
  // Best streak (top 25%)
  bestStreak: number;
  bestStreakGwRange: string | null; // "GW6–GW10"
  
  // Average points per week
  avgPointsPerWeek: number | null;
  
  // Most correctly predicted team
  mostCorrectTeam: {
    code: string | null;
    name: string;
    percentage: number;
  } | null;
  
  // Most incorrectly picked team
  mostIncorrectTeam: {
    code: string | null;
    name: string;
    percentage: number;
  } | null;
}

/**
 * Calculate percentile (0-100) where higher is better
 * Returns the percentage of players who scored equal or less
 * Example: If user scored 10 and 80% of players scored <= 10, returns 80
 */
function calculatePercentile(userValue: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  
  // Count how many players scored <= user's value
  const rank = allValues.filter(v => v <= userValue).length;
  const percentile = (rank / allValues.length) * 100;
  
  return Math.round(percentile * 100) / 100; // Round to 2dp
}

/**
 * Get fun subcopy for a stat (optional rotating messages)
 */
export function getFunSubcopy(statType: string, isTop: boolean): string {
  const subcopies: Record<string, { top: string[]; bottom: string[] }> = {
    'gameweek': {
      top: ["One good week can change everything.", "Football's a funny old game."],
      bottom: ["We go again."]
    },
    'overall': {
      top: ["Season-long grind.", "Consistency is king."],
      bottom: ["Plenty of football left."]
    },
    'prediction-rate': {
      top: ["Every flip of the coin counts.", "Trust the process."],
      bottom: ["Better than guessing… just."]
    },
    'avg-points': {
      top: ["Slow and steady.", "Points on the board."],
      bottom: ["Adds up over a season."]
    },
    'best-streak': {
      top: ["Your purple patch.", "You were cooking.", "Form of your life."],
      bottom: []
    },
    'most-correct-team': {
      top: ["You've got them figured out.", "Safe pair of hands.", "Built on trust."],
      bottom: []
    },
    'most-incorrect-team': {
      top: [],
      bottom: ["They keep letting you down.", "Time to stop backing them?", "Fool me once…"]
    }
  };
  
  const options = subcopies[statType];
  if (!options) return '';
  
  const arr = isTop ? options.top : options.bottom;
  if (arr.length === 0) return '';
  
  // Return a random one (or first one for consistency)
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Fetch and calculate all user stats
 */
export async function fetchUserStats(userId: string): Promise<UserStatsData> {
  const stats: UserStatsData = {
    lastCompletedGw: null,
    lastCompletedGwPercentile: null,
    overallPercentile: null,
    correctPredictionRate: null,
    bestStreak: 0,
    bestStreakGwRange: null,
    avgPointsPerWeek: null,
    mostCorrectTeam: null,
    mostIncorrectTeam: null,
  };

  try {
    // 1. Get last completed GW
    const { data: lastGwData } = await supabase
      .from('app_gw_results')
      .select('gw')
      .order('gw', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastCompletedGw = lastGwData?.gw || null;
    stats.lastCompletedGw = lastCompletedGw;

    if (!lastCompletedGw) {
      // Not enough data
      return stats;
    }

    // 2. Last completed GW percentile
    if (lastCompletedGw) {
      const { data: gwPoints } = await supabase
        .from('app_v_gw_points')
        .select('user_id, points')
        .eq('gw', lastCompletedGw);

      if (gwPoints && gwPoints.length > 0) {
        const allPoints = gwPoints.map((p: any) => p.points || 0);
        const userPoints = gwPoints.find((p: any) => p.user_id === userId)?.points || 0;
        stats.lastCompletedGwPercentile = calculatePercentile(userPoints, allPoints);
      }
    }

    // 3. Overall percentile (from OCP)
    const { data: overallStandings } = await supabase
      .from('v_ocp_overall')
      .select('user_id, ocp')
      .order('ocp', { ascending: false });

    if (overallStandings && overallStandings.length > 0) {
      const allOcp = overallStandings.map((s: any) => s.ocp || 0);
      const userOcp = overallStandings.find((s: any) => s.user_id === userId)?.ocp || 0;
      // Invert percentile - higher OCP should mean higher percentile
      stats.overallPercentile = calculatePercentile(userOcp, allOcp);
    }

    // 4. Correct prediction rate
    // Get all user picks and results
    // Try both app_picks and picks tables to ensure we get all predictions
    const [appPicksResult, picksResult] = await Promise.all([
      supabase
        .from('app_picks')
        .select('gw, fixture_index, pick')
        .eq('user_id', userId),
      supabase
        .from('picks')
        .select('gw, fixture_index, pick')
        .eq('user_id', userId)
    ]);

    // Combine picks from both tables (app_picks takes precedence if duplicate)
    const picksMap = new Map<string, { gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' }>();
    
    if (picksResult.data) {
      picksResult.data.forEach((pick: any) => {
        const key = `${pick.gw}:${pick.fixture_index}`;
        picksMap.set(key, pick);
      });
    }
    
    if (appPicksResult.data) {
      appPicksResult.data.forEach((pick: any) => {
        const key = `${pick.gw}:${pick.fixture_index}`;
        picksMap.set(key, pick); // app_picks overwrites picks if duplicate
      });
    }
    
    const allPicks = Array.from(picksMap.values());

    console.log('[userStats] Picks from app_picks:', appPicksResult.data?.length || 0);
    console.log('[userStats] Picks from picks table:', picksResult.data?.length || 0);
    console.log('[userStats] Total unique picks (combined):', allPicks.length);
    if (appPicksResult.error) {
      console.error('[userStats] Error fetching app_picks:', appPicksResult.error);
    }
    if (picksResult.error && picksResult.error.code !== 'PGRST116') {
      console.error('[userStats] Error fetching picks:', picksResult.error);
    }

    const { data: allResults, error: resultsError } = await supabase
      .from('app_gw_results')
      .select('gw, fixture_index, result');

    console.log('[userStats] Total results fetched:', allResults?.length || 0);
    if (resultsError) {
      console.error('[userStats] Error fetching results:', resultsError);
    }

    if (allPicks && allResults) {
      const resultsMap = new Map<string, 'H' | 'D' | 'A'>();
      allResults.forEach((r: any) => {
        if (r.result) {
          resultsMap.set(`${r.gw}:${r.fixture_index}`, r.result);
        }
      });

      let correct = 0;
      let total = 0;

      allPicks.forEach((pick: any) => {
        const result = resultsMap.get(`${pick.gw}:${pick.fixture_index}`);
        if (result) {
          total++;
          if (pick.pick === result) {
            correct++;
          }
        }
      });

      if (total > 0) {
        stats.correctPredictionRate = (correct / total) * 100;
      }
    }

    // 5. Best streak (top 25%) and average points per week
    const { data: userGwPoints } = await supabase
      .from('app_v_gw_points')
      .select('gw, points')
      .eq('user_id', userId)
      .order('gw', { ascending: true });

    if (userGwPoints && userGwPoints.length > 0) {
      // Calculate average points per week
      const totalPoints = userGwPoints.reduce((sum: number, p: any) => sum + (p.points || 0), 0);
      stats.avgPointsPerWeek = totalPoints / userGwPoints.length;

      // Calculate best streak (top 25%)
      const completedGws = new Set<number>();
      const { data: completedGwResults } = await supabase
        .from('app_gw_results')
        .select('gw')
        .order('gw', { ascending: true });

      completedGwResults?.forEach((r: any) => {
        completedGws.add(r.gw);
      });

      // Calculate percentile for each GW (fetch all GW points once)
      const { data: allGwPoints } = await supabase
        .from('app_v_gw_points')
        .select('gw, user_id, points')
        .in('gw', Array.from(completedGws));

      const gwPercentiles = new Map<number, number>();
      const gwPointsMap = new Map<number, Array<{ user_id: string; points: number }>>();

      // Group points by GW
      if (allGwPoints) {
        allGwPoints.forEach((p: any) => {
          const gw = p.gw;
          if (!gwPointsMap.has(gw)) {
            gwPointsMap.set(gw, []);
          }
          gwPointsMap.get(gw)!.push({ user_id: p.user_id, points: p.points || 0 });
        });
      }

      // Calculate percentile for each GW
      for (const gw of Array.from(completedGws).sort((a, b) => a - b)) {
        const gwPoints = gwPointsMap.get(gw);
        if (gwPoints && gwPoints.length > 0) {
          const allPoints = gwPoints.map(p => p.points);
          const userPoints = gwPoints.find(p => p.user_id === userId)?.points || 0;
          const percentile = calculatePercentile(userPoints, allPoints);
          gwPercentiles.set(gw, percentile);
        }
      }

      // Find best streak (consecutive GWs in top 25%)
      let currentStreak = 0;
      let bestStreak = 0;
      let bestStreakStart = 0;
      let bestStreakEnd = 0;
      let currentStreakStart = 0;

      for (const gw of Array.from(completedGws).sort((a, b) => a - b)) {
        const percentile = gwPercentiles.get(gw);
        if (percentile !== undefined && percentile >= 75) {
          // Top 25% means percentile >= 75
          if (currentStreak === 0) {
            currentStreakStart = gw;
          }
          currentStreak++;
          if (currentStreak > bestStreak) {
            bestStreak = currentStreak;
            bestStreakStart = currentStreakStart;
            bestStreakEnd = gw;
          }
        } else {
          currentStreak = 0;
        }
      }

      stats.bestStreak = bestStreak;
      if (bestStreak > 0) {
        stats.bestStreakGwRange = `GW${bestStreakStart}–GW${bestStreakEnd}`;
      }
    }

    // 6 & 7. Most correctly/incorrectly predicted teams
    if (allPicks && allResults) {
      const resultsMap = new Map<string, 'H' | 'D' | 'A'>();
      allResults.forEach((r: any) => {
        if (r.result) {
          resultsMap.set(`${r.gw}:${r.fixture_index}`, r.result);
        }
      });

      // Get fixtures to map picks to teams
      const { data: allFixtures } = await supabase
        .from('app_fixtures')
        .select('gw, fixture_index, home_code, away_code, home_team, away_team');

      if (allFixtures) {
        const fixturesMap = new Map<string, any>();
        allFixtures.forEach((f: any) => {
          fixturesMap.set(`${f.gw}:${f.fixture_index}`, f);
        });

        // Track team prediction stats
        // For each team, count ALL matches they played in and check if user's prediction was correct
        const teamStats = new Map<string, { correct: number; total: number; code: string | null; name: string }>();
        
        // Create a map of picks for quick lookup
        const picksMap = new Map<string, 'H' | 'D' | 'A'>();
        allPicks.forEach((pick: any) => {
          picksMap.set(`${pick.gw}:${pick.fixture_index}`, pick.pick);
        });

        // Iterate through ALL fixtures with results to find matches for each team
        allFixtures.forEach((fixture: any) => {
          const result = resultsMap.get(`${fixture.gw}:${fixture.fixture_index}`);
          const userPick = picksMap.get(`${fixture.gw}:${fixture.fixture_index}`);
          
          if (!result || !userPick) return; // Skip if no result or user didn't make a pick
          
          // Check both teams in this fixture
          const homeTeam = { code: fixture.home_code, name: fixture.home_team || '' };
          const awayTeam = { code: fixture.away_code, name: fixture.away_team || '' };
          
          [homeTeam, awayTeam].forEach((team) => {
            if (!team.code || !team.name) return;
            
            const key = team.code.toUpperCase();
            const existing = teamStats.get(key) || { correct: 0, total: 0, code: team.code, name: team.name };
            
            // Count this match for this team
            existing.total++;
            
            // Check if the user's pick matched the result (correct prediction)
            const isCorrect = userPick === result;
            if (isCorrect) {
              existing.correct++;
            }
            
            // Debug logging for specific team
            if (key === 'FUL') {
              const teamPosition = team.code === fixture.home_code ? 'HOME' : 'AWAY';
              console.log(`[userStats] Fulham: GW${fixture.gw}, ${fixture.home_team} vs ${fixture.away_team}, Fulham ${teamPosition}, picked ${userPick}, result ${result}, ${isCorrect ? 'CORRECT' : 'WRONG'}`);
            }
            
            teamStats.set(key, existing);
          });
        });

        // Debug logging for team stats
        const teamStatsArray = Array.from(teamStats.entries()).map(([code, stats]) => ({
          code,
          name: stats.name,
          correct: stats.correct,
          total: stats.total,
          percentage: ((stats.correct / stats.total) * 100).toFixed(2)
        }));
        
        console.log('[userStats] All team prediction stats:', JSON.stringify(teamStatsArray, null, 2));
        console.log('[userStats] Teams with >= 3 picks:', JSON.stringify(teamStatsArray.filter(t => t.total >= 3), null, 2));
        
        // Also log total picks processed for team stats
        let totalPicksProcessedForTeams = 0;
        teamStats.forEach((stats) => {
          totalPicksProcessedForTeams += stats.total;
        });
        console.log('[userStats] Total picks processed for team stats:', totalPicksProcessedForTeams);
        console.log('[userStats] Total picks with fixtures and results:', allPicks.filter((pick: any) => {
          const fixture = fixturesMap.get(`${pick.gw}:${pick.fixture_index}`);
          const result = resultsMap.get(`${pick.gw}:${pick.fixture_index}`);
          return fixture && result;
        }).length);

        // Find most correct and most incorrect teams
        let mostCorrect: { code: string | null; name: string; percentage: number } | null = null;
        let mostIncorrect: { code: string | null; name: string; percentage: number } | null = null;

        teamStats.forEach((stats, teamCode) => {
          if (stats.total >= 3) { // Require at least 3 predictions
            const correctPct = (stats.correct / stats.total) * 100;
            const incorrectPct = ((stats.total - stats.correct) / stats.total) * 100;

            if (!mostCorrect || correctPct > mostCorrect.percentage) {
              mostCorrect = {
                code: stats.code,
                name: stats.name,
                percentage: correctPct,
              };
            }

            if (!mostIncorrect || incorrectPct > mostIncorrect.percentage) {
              mostIncorrect = {
                code: stats.code,
                name: stats.name,
                percentage: incorrectPct,
              };
            }
          }
        });

        stats.mostCorrectTeam = mostCorrect;
        stats.mostIncorrectTeam = mostIncorrect;
      }
    }
  } catch (error) {
    console.error('Error fetching user stats:', error);
  }

  return stats;
}

