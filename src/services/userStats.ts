import { supabase } from '../lib/supabase';
import { getFullName } from '../lib/teamNames';
import { calculateLastGwRank, calculateFormRank, calculateSeasonRank } from '../lib/helpers';

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
  
  // Best single GW
  bestSingleGw: {
    points: number;
    gw: number;
  } | null;
  
  // Lowest single GW
  lowestSingleGw: {
    points: number;
    gw: number;
  } | null;
  
  // Chaos Index (percentage of picks that 25% or fewer players made)
  chaosIndex: number | null; // 0-100
  chaosCorrectCount: number | null; // How many chaos picks were correct
  chaosTotalCount: number | null; // Total number of chaos picks
  
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
  
  // Weekly Par data (user points vs average for each week)
  weeklyParData: Array<{
    gw: number;
    userPoints: number;
    averagePoints: number;
  }> | null;
  
  // Trophy Cabinet - counts of top finishes
  trophyCabinet: {
    lastGw: number;
    form5: number;
    form10: number;
    overall: number;
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
    bestSingleGw: null,
    lowestSingleGw: null,
    chaosIndex: null,
    chaosCorrectCount: null,
    chaosTotalCount: null,
    mostCorrectTeam: null,
    mostIncorrectTeam: null,
    weeklyParData: null,
    trophyCabinet: null,
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

      const sortedGws = Array.from(completedGws).sort((a, b) => a - b);
      console.log('[userStats] Calculating best streak. Completed GWs:', sortedGws);
      console.log('[userStats] User percentiles per GW:', Array.from(gwPercentiles.entries()).map(([gw, pct]) => ({ gw, percentile: pct.toFixed(2), inTop25: pct >= 75 })));

      for (const gw of sortedGws) {
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
          if (currentStreak > 0) {
            console.log(`[userStats] Streak broken at GW${gw} (percentile: ${percentile?.toFixed(2) || 'N/A'}). Previous streak was ${currentStreak} games`);
          }
          currentStreak = 0;
        }
      }

      stats.bestStreak = bestStreak;
      if (bestStreak > 0) {
        stats.bestStreakGwRange = `GW${bestStreakStart}–GW${bestStreakEnd}`;
        console.log(`[userStats] Best streak: ${bestStreak} games from ${stats.bestStreakGwRange}`);
      } else {
        console.log('[userStats] No streak found (user never in top 25%)');
      }

      // Calculate best and lowest single GW
      let bestGw = { points: -1, gw: 0 };
      let lowestGw = { points: 999, gw: 0 };
      
      userGwPoints.forEach((p: any) => {
        const points = p.points || 0;
        if (points > bestGw.points) {
          bestGw = { points, gw: p.gw };
        }
        if (points < lowestGw.points) {
          lowestGw = { points, gw: p.gw };
        }
      });

      if (bestGw.points >= 0) {
        stats.bestSingleGw = bestGw;
      }
      if (lowestGw.points < 999) {
        stats.lowestSingleGw = lowestGw;
      }

      // Calculate weekly Par data (user points vs average for each week)
      const weeklyParData: Array<{ gw: number; userPoints: number; averagePoints: number }> = [];
      
      // Calculate average for each GW using the already-fetched allGwPoints
      const gwAverages = new Map<number, number>();
      
      gwPointsMap.forEach((points, gw) => {
        const average = points.reduce((sum, p) => sum + p.points, 0) / points.length;
        gwAverages.set(gw, average);
      });

      // Build weekly Par data for user's GWs
      userGwPoints.forEach((p: any) => {
        const gw = p.gw;
        const userPoints = p.points || 0;
        const averagePoints = gwAverages.get(gw);
        
        if (averagePoints !== undefined) {
          weeklyParData.push({
            gw,
            userPoints,
            averagePoints,
          });
        }
      });

      // Sort by GW
      weeklyParData.sort((a, b) => a.gw - b.gw);
      
      stats.weeklyParData = weeklyParData.length > 0 ? weeklyParData : null;

      // Calculate trophy counts
      let trophyCabinet = {
        lastGw: 0,
        form5: 0,
        form10: 0,
        overall: 0,
      };

      // Reuse completedGwResults that was already fetched above
      if (completedGwResults && allGwPoints) {
        console.log('[userStats] Calculating trophy cabinet...');
        const completedGwsArray = [...new Set(completedGwResults.map((r: any) => r.gw))].sort((a, b) => a - b);
        
        // Fetch all GW points for all users (needed for ranking calculations)
        const { data: allUsersGwPoints } = await supabase
          .from('app_v_gw_points')
          .select('user_id, gw, points')
          .order('gw', { ascending: true });
        
        // Fetch overall OCP data (needed for overall ranking)
        const { data: allOverallData } = await supabase
          .from('app_v_ocp_overall')
          .select('user_id, name, ocp');
        
        completedGwsArray.forEach((gw) => {
          // Last GW trophy
          const lastGwRank = calculateLastGwRank(userId, gw, allUsersGwPoints || []);
          if (lastGwRank && lastGwRank.rank === 1) {
            trophyCabinet.lastGw++;
          }
          
          // 5-Week Form trophy (only if user has 5+ GWs completed)
          if (gw >= 5) {
            const form5Rank = calculateFormRank(
              userId,
              gw - 4,
              gw,
              allUsersGwPoints || [],
              allOverallData || []
            );
            if (form5Rank && form5Rank.rank === 1) {
              trophyCabinet.form5++;
            }
          }
          
          // 10-Week Form trophy (only if user has 10+ GWs completed)
          if (gw >= 10) {
            const form10Rank = calculateFormRank(
              userId,
              gw - 9,
              gw,
              allUsersGwPoints || [],
              allOverallData || []
            );
            if (form10Rank && form10Rank.rank === 1) {
              trophyCabinet.form10++;
            }
          }
          
          // Overall trophy - calculate overall ranking at this GW point
          // Need to calculate cumulative OCP up to this GW for all users
          // Get all unique user IDs who have played up to this GW
          const usersUpToGw = new Set<string>();
          (allUsersGwPoints || []).forEach((p: any) => {
            if (p.gw <= gw) {
              usersUpToGw.add(p.user_id);
            }
          });
          
          // Calculate cumulative points for each user up to this GW
          const overallAtGw = Array.from(usersUpToGw).map((uid: string) => {
            const userPointsUpToGw = (allUsersGwPoints || [])
              .filter((p: any) => p.user_id === uid && p.gw <= gw)
              .reduce((sum: number, p: any) => sum + (p.points || 0), 0);
            
            // Get user name from allOverallData if available
            const userData = (allOverallData || []).find((u: any) => u.user_id === uid);
            return {
              user_id: uid,
              name: userData?.name || null,
              ocp: userPointsUpToGw
            };
          });
          
          const overallRank = calculateSeasonRank(userId, overallAtGw);
          if (overallRank && overallRank.rank === 1) {
            trophyCabinet.overall++;
          }
        });
        
        console.log('[userStats] Trophy cabinet calculated:', trophyCabinet);
      } else {
        console.log('[userStats] Skipping trophy calculation - missing data:', {
          hasCompletedGwResults: !!completedGwResults,
          hasAllGwPoints: !!allGwPoints,
        });
      }

      stats.trophyCabinet = trophyCabinet;
    } else {
      // User has no GW points, initialize trophy cabinet with zeros
      stats.trophyCabinet = {
        lastGw: 0,
        form5: 0,
        form10: 0,
        overall: 0,
      };
    }

    // Calculate Chaos Index - how often user picks against the crowd (25% or fewer picked the same)
    if (allPicks && allPicks.length > 0) {
      // Get all picks from all users for fixtures where this user made a pick
      const userPickGwFixtures = new Set<string>();
      allPicks.forEach((pick: any) => {
        userPickGwFixtures.add(`${pick.gw}:${pick.fixture_index}`);
      });

      if (userPickGwFixtures.size > 0) {
        // Get unique GWs to fetch
        const uniqueGws = Array.from(userPickGwFixtures).map((key: string) => parseInt(key.split(':')[0]));
        const gwSet = new Set(uniqueGws);
        
        // Fetch all picks from BOTH tables for those fixtures (same as we do for user picks)
        const [allUsersPicksApp, allUsersPicksLegacy] = await Promise.all([
          supabase
            .from('app_picks')
            .select('gw, fixture_index, pick')
            .in('gw', Array.from(gwSet)),
          supabase
            .from('picks')
            .select('gw, fixture_index, pick')
            .in('gw', Array.from(gwSet))
        ]);

        // Group picks by fixture to count popularity
        // We need to count ALL picks from ALL users, not overwrite duplicates
        const pickCounts = new Map<string, Map<'H' | 'D' | 'A', number>>();
        
        // Count picks from legacy table first
        if (allUsersPicksLegacy.data) {
          allUsersPicksLegacy.data.forEach((pick: any) => {
            const key = `${pick.gw}:${pick.fixture_index}`;
            if (userPickGwFixtures.has(key)) {
              if (!pickCounts.has(key)) {
                pickCounts.set(key, new Map());
              }
              const counts = pickCounts.get(key)!;
              counts.set(pick.pick, (counts.get(pick.pick) || 0) + 1);
            }
          });
        }
        
        // Count picks from app_picks table (adds to existing counts)
        if (allUsersPicksApp.data) {
          allUsersPicksApp.data.forEach((pick: any) => {
            const key = `${pick.gw}:${pick.fixture_index}`;
            if (userPickGwFixtures.has(key)) {
              if (!pickCounts.has(key)) {
                pickCounts.set(key, new Map());
              }
              const counts = pickCounts.get(key)!;
              // If this exact user already has a pick counted from legacy, skip to avoid double counting
              // Actually, we should count all picks regardless - different users might have picks in different tables
              // But we need to avoid counting the same user's pick twice. Let's just count all for now.
              counts.set(pick.pick, (counts.get(pick.pick) || 0) + 1);
            }
          });
        }

        // Calculate total unique picks counted
        let totalPicksCounted = 0;
        pickCounts.forEach((counts) => {
          totalPicksCounted += Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
        });
        
        console.log(`[userStats] Chaos Index: Checking ${allPicks.length} user picks across ${userPickGwFixtures.size} fixtures`);
        console.log(`[userStats] Chaos Index: Found ${totalPicksCounted} total picks from all users across all fixtures`);

        // Calculate chaos index: percentage of user's picks that were made by 25% or fewer players
        // Also track how many chaos picks were correct
        let chaosPicks = 0;
        let chaosCorrectPicks = 0;
        let totalPicks = 0;

        // Create results map for checking correctness
        const chaosResultsMap = new Map<string, 'H' | 'D' | 'A'>();
        if (allResults) {
          allResults.forEach((r: any) => {
            if (r.result) {
              chaosResultsMap.set(`${r.gw}:${r.fixture_index}`, r.result);
            }
          });
        }

        let sampleLogged = false;
        const missingFixtures: string[] = [];
        allPicks.forEach((userPick: any) => {
          const key = `${userPick.gw}:${userPick.fixture_index}`;
          const counts = pickCounts.get(key);
          
          if (counts) {
            const totalPickers = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
            const userPickCount = counts.get(userPick.pick) || 0;
            const userPickPercentage = totalPickers > 0 ? (userPickCount / totalPickers) * 100 : 0;
            
            // Log a sample for debugging
            if (!sampleLogged && totalPickers > 0) {
              const hCount = counts.get('H') || 0;
              const dCount = counts.get('D') || 0;
              const aCount = counts.get('A') || 0;
              console.log(`[userStats] Chaos Index sample: GW${userPick.gw} fixture ${userPick.fixture_index}, user picked ${userPick.pick}, totals: H=${hCount}, D=${dCount}, A=${aCount}, total=${totalPickers}, userPickPercentage=${userPickPercentage.toFixed(2)}%`);
              sampleLogged = true;
            }
            
            totalPicks++;
            // Chaos pick: 25% or fewer players picked the same thing
            if (userPickPercentage <= 25) {
              chaosPicks++;
              
              // Check if this chaos pick was correct
              const result = chaosResultsMap.get(key);
              if (result && userPick.pick === result) {
                chaosCorrectPicks++;
              }
            }
          } else {
            // No counts found for this fixture - might not have enough data
            missingFixtures.push(key);
          }
        });

        // Log missing fixtures once if any were found
        if (missingFixtures.length > 0) {
          console.log(`[userStats] Chaos Index: ${missingFixtures.length} fixtures with no pick counts (skipped from calculation): ${missingFixtures.slice(0, 10).join(', ')}${missingFixtures.length > 10 ? ` ... and ${missingFixtures.length - 10} more` : ''}`);
        }

        if (totalPicks > 0) {
          stats.chaosIndex = (chaosPicks / totalPicks) * 100;
          stats.chaosCorrectCount = chaosCorrectPicks;
          stats.chaosTotalCount = chaosPicks;
          console.log(`[userStats] Chaos Index: ${stats.chaosIndex.toFixed(2)}% (${chaosPicks} of ${totalPicks} picks, ${chaosCorrectPicks} correct)`);
          console.log(`[userStats] Chaos Index breakdown: ${totalPicks} total picks, ${chaosPicks} chaos picks`);
        }
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
        .select('gw, fixture_index, home_code, away_code, home_team, away_team, home_name, away_name');

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
        const burnleyDebugLog: Array<{gw: number; fixture_index: number; home: string; away: string; pick: string; result: string; isCorrect: boolean}> = [];
        
        allFixtures.forEach((fixture: any) => {
          const result = resultsMap.get(`${fixture.gw}:${fixture.fixture_index}`);
          const userPick = picksMap.get(`${fixture.gw}:${fixture.fixture_index}`);
          
          if (!result || !userPick) return; // Skip if no result or user didn't make a pick
          
          // Check both teams in this fixture
          // Use home_name/away_name if available, otherwise fall back to home_team/away_team, then resolve full name from code
          const homeTeamName = fixture.home_name || fixture.home_team || '';
          const awayTeamName = fixture.away_name || fixture.away_team || '';
          const homeTeam = { 
            code: fixture.home_code, 
            name: fixture.home_code ? getFullName(fixture.home_code) : homeTeamName 
          };
          const awayTeam = { 
            code: fixture.away_code, 
            name: fixture.away_code ? getFullName(fixture.away_code) : awayTeamName 
          };
          
          // Count a team as "correct" if the user correctly predicted the outcome of any game they played in
          // If Burnley is playing (home or away), and the user got the result right, it counts for Burnley
          // This means: if userPick === result, both teams get credit for that correct prediction
          const userGotItRight = userPick === result;
          
          if (homeTeam.code) {
            const key = homeTeam.code.toUpperCase();
            const existing = teamStats.get(key) || { correct: 0, total: 0, code: homeTeam.code, name: homeTeam.name };
            existing.total++;
            // Home team gets credit if the user correctly predicted the outcome (regardless of what they picked)
            if (userGotItRight) {
              existing.correct++;
            }
            teamStats.set(key, existing);
            
            // Debug logging for Burnley
            if (key === 'BUR' || homeTeam.code.toUpperCase() === 'BUR') {
              burnleyDebugLog.push({
                gw: fixture.gw,
                fixture_index: fixture.fixture_index,
                home: homeTeam.name,
                away: awayTeam.name,
                pick: userPick,
                result: result,
                isCorrect: userGotItRight
              });
            }
          }
          
          if (awayTeam.code) {
            const key = awayTeam.code.toUpperCase();
            const existing = teamStats.get(key) || { correct: 0, total: 0, code: awayTeam.code, name: awayTeam.name };
            existing.total++;
            // Away team gets credit if the user correctly predicted the outcome (regardless of what they picked)
            if (userGotItRight) {
              existing.correct++;
            }
            teamStats.set(key, existing);
            
            // Debug logging for Burnley
            if (key === 'BUR' || awayTeam.code.toUpperCase() === 'BUR') {
              burnleyDebugLog.push({
                gw: fixture.gw,
                fixture_index: fixture.fixture_index,
                home: homeTeam.name,
                away: awayTeam.name,
                pick: userPick,
                result: result,
                isCorrect: userGotItRight
              });
            }
          }
        });
        
        // Log Burnley-specific debug info
        if (burnleyDebugLog.length > 0) {
          console.log('[userStats] Burnley picks breakdown:', JSON.stringify(burnleyDebugLog, null, 2));
          const burnleyStats = teamStats.get('BUR');
          if (burnleyStats) {
            console.log('[userStats] Burnley final stats:', {
              correct: burnleyStats.correct,
              total: burnleyStats.total,
              percentage: ((burnleyStats.correct / burnleyStats.total) * 100).toFixed(2) + '%'
            });
          }
        }

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

        teamStats.forEach((stats, _teamCode) => {
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

