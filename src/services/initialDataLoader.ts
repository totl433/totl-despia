/**
 * Service to load all critical data upfront before showing the app
 * Used when "load everything first" mode is enabled
 */

import { supabase } from '../lib/supabase';
import { setCached, CACHE_TTL } from '../lib/cache';

export interface InitialData {
  // Current game week
  currentGw: number;
  latestGw: number | null;
  
  // User's leagues
  leagues: Array<{
    id: string;
    name: string;
    code: string;
    avatar?: string | null;
    created_at?: string | null;
  }>;
  
  // Leaderboard data
  allGwPoints: Array<{ user_id: string; gw: number; points: number }>;
  overall: Array<{ user_id: string; name: string | null; ocp: number | null }>;
  lastGwRank: {
    rank: number;
    total: number;
    score: number;
    gw: number;
    totalFixtures: number;
    isTied: boolean;
  } | null;
  
  // Fixtures for current GW
  fixtures: Array<{
    id: string;
    gw: number;
    fixture_index: number;
    home_code?: string | null;
    away_code?: string | null;
    home_team?: string | null;
    away_team?: string | null;
    home_name?: string | null;
    away_name?: string | null;
    home_crest?: string | null;
    away_crest?: string | null;
    kickoff_time?: string | null;
    api_match_id?: number | null;
    test_gw?: number | null;
  }>;
  
  // User's picks for current GW
  userPicks: Record<number, "H" | "D" | "A">;
  
  // League data (members, submissions, etc.)
  leagueData: Record<string, {
    id: string;
    members: Array<{ id: string; name: string }>;
    userPosition: number | null;
    positionChange: 'up' | 'down' | 'same' | null;
    submittedMembers?: string[] | Set<string>;
    sortedMemberIds?: string[];
    latestGwWinners?: string[] | Set<string>;
    latestRelevantGw?: number | null;
    webUserIds?: string[] | Set<string>;
  }>;
  
  // Web user IDs (users with picks in Web table)
  webUserIds: Set<string>;
  
  // Submission status
  isInApiTestLeague: boolean;
}

/**
 * Load all critical data for the app
 */
export async function loadInitialData(userId: string): Promise<InitialData> {
  // Fetch all data in parallel for maximum speed
  const [
    metaResult,
    leaguesResult,
    gwPointsResult,
    overallResult,
    _fixturesResult, // Placeholder - replaced later
    _picksResult, // Placeholder - replaced later
    leagueMembersResult,
    latestGwResult,
    webPicksResult,
    // Additional data for Tables page (placeholders - populated later)
    _allLeaguesResult, // Placeholder - populated later
    _leagueMembersWithUsersResult, // Placeholder - populated later
    leagueReadsResult,
    _allResultsResult, // Used in background async function
    _allFixturesResult, // Used in background async function
    _leagueSubmissionsResult, // Placeholder - populated later
  ] = await Promise.all([
    // 1. Get current GW from app_meta
    supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle(),
    
    // 2. Get user's leagues
    supabase
      .from('league_members')
      .select('leagues(id, name, code, avatar, created_at)')
      .eq('user_id', userId),
    
    // 3. Get all GW points (for form leaderboards)
    supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .order('gw', { ascending: true }),
    
    // 4. Get overall standings
    supabase
      .from('app_v_ocp_overall')
      .select('user_id, name, ocp')
      .order('ocp', { ascending: false }),
    
    // 5. Get fixtures for current GW (will be updated after we get currentGw)
    Promise.resolve({ data: null, error: null }), // Placeholder
    
    // 6. Get user's picks for current GW (will be updated after we get currentGw)
    Promise.resolve({ data: null, error: null }), // Placeholder
    
    // 7. Get league memberships (for league data)
    supabase
      .from('league_members')
      .select('league_id, user_id')
      .limit(10000),
    
    // 8. Get latest GW from results
    supabase
      .from('app_gw_results')
      .select('gw')
      .order('gw', { ascending: false })
      .limit(1)
      .maybeSingle(),
    
    // 9. Get Web user IDs (users with picks in Web table)
    supabase
      .from('picks')
      .select('user_id')
      .limit(10000),
    
    // 10. Get all leagues (for Tables page)
    Promise.resolve({ data: null, error: null }), // Will be populated after we get league IDs
    
    // 11. Get league members with user names (for Tables page)
    Promise.resolve({ data: null, error: null }), // Will be populated after we get league IDs
    
    // 12. Get league message reads (for unread counts)
    supabase
      .from('league_message_reads')
      .select('league_id, last_read_at')
      .eq('user_id', userId),
    
    // 13. Get all GW results (for Tables page calculations)
    supabase
      .from('app_gw_results')
      .select('gw, fixture_index, result'),
    
    // 14. Get all fixtures (for Tables page calculations)
    supabase
      .from('app_fixtures')
      .select('gw, kickoff_time')
      .order('gw', { ascending: true })
      .order('kickoff_time', { ascending: true }),
    
    // 15. Get league submissions (will be populated after we get league IDs and currentGw)
    Promise.resolve({ data: null, error: null }), // Placeholder
  ]);

  // Handle errors (non-critical errors for Tables/Global data are handled separately)
  if (metaResult.error) throw new Error(`Failed to load current GW: ${metaResult.error.message}`);
  if (leaguesResult.error) throw new Error(`Failed to load leagues: ${leaguesResult.error.message}`);
  if (gwPointsResult.error) throw new Error(`Failed to load GW points: ${gwPointsResult.error.message}`);
  if (overallResult.error) throw new Error(`Failed to load overall standings: ${overallResult.error.message}`);
  if (leagueMembersResult.error) throw new Error(`Failed to load league members: ${leagueMembersResult.error.message}`);
  if (latestGwResult.error) throw new Error(`Failed to load latest GW: ${latestGwResult.error.message}`);
  if (webPicksResult.error) throw new Error(`Failed to load Web picks: ${webPicksResult.error.message}`);
  // Note: leagueReadsResult, _allResultsResult, _allFixturesResult errors are non-critical

  const currentGw = metaResult.data?.current_gw ?? 1;
  const latestGw = latestGwResult.data?.gw ?? null;

  // Now fetch fixtures and picks for current GW
  const [fixturesForGw, picksForGw] = await Promise.all([
    supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', currentGw)
      .order('fixture_index', { ascending: true }),
    
    supabase
      .from('app_picks')
      .select('fixture_index, pick')
      .eq('user_id', userId)
      .eq('gw', currentGw),
  ]);

  if (fixturesForGw.error) throw new Error(`Failed to load fixtures: ${fixturesForGw.error.message}`);
  if (picksForGw.error) throw new Error(`Failed to load picks: ${picksForGw.error.message}`);

  // Process leagues
  const leagues = (leaguesResult.data || [])
    .map((lm: any) => lm.leagues)
    .filter((l: any) => l !== null)
    .filter((l: any) => l.name !== 'API Test'); // Filter out API Test league
  
  const leagueIds = leagues.map((l: any) => l.id);
  
  // Fetch additional Tables page data if we have leagues (non-blocking - don't wait)
  if (leagueIds.length > 0) {
    // Start Tables data loading but don't await it - let it complete in background
    (async () => {
      try {
      const [
        allLeaguesForTables,
        membersWithUsersForTables,
        submissionsForTables,
      ] = await Promise.all([
        supabase
          .from('leagues')
          .select('id, name, code, created_at, avatar')
          .in('id', leagueIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('league_members')
          .select('league_id, user_id, users(id, name)')
          .in('league_id', leagueIds)
          .limit(10000),
        supabase
          .from('app_gw_submissions')
          .select('user_id')
          .eq('gw', currentGw)
          .limit(10000),
      ]);
      
      if (!allLeaguesForTables.error && !membersWithUsersForTables.error && !submissionsForTables.error) {
        // Process unread counts
        const unreadCounts: Record<string, number> = {};
        try {
          const readsData = leagueReadsResult.data || [];
          const lastRead = new Map<string, string>();
          readsData.forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));
          
          if (leagueIds.length > 0) {
            const sinceMap = new Map<string, string>();
            leagueIds.forEach(id => {
              sinceMap.set(id, lastRead.get(id) ?? "1970-01-01T00:00:00Z");
            });
            
            const earliestSince = Math.min(...Array.from(sinceMap.values()).map(s => new Date(s).getTime()));
            const earliestSinceStr = new Date(earliestSince).toISOString();
            
            const { data: allMessages } = await supabase
              .from('league_messages')
              .select('id, league_id, created_at')
              .in('league_id', leagueIds)
              .gte('created_at', earliestSinceStr);
            
            const messagesByLeague = new Map<string, any[]>();
            (allMessages ?? []).forEach((m: any) => {
              const arr = messagesByLeague.get(m.league_id) ?? [];
              arr.push(m);
              messagesByLeague.set(m.league_id, arr);
            });
            
            leagueIds.forEach(leagueId => {
              const since = sinceMap.get(leagueId)!;
              const sinceTime = new Date(since).getTime();
              const leagueMessages = messagesByLeague.get(leagueId) ?? [];
              const unread = leagueMessages.filter((m: any) => new Date(m.created_at).getTime() > sinceTime).length;
              unreadCounts[leagueId] = unread;
            });
          }
        } catch (e) {
          // Silent fail for unread counts
        }
        
        // Process league rows for Tables
        const allLeagues = (allLeaguesForTables.data || []) as Array<{ id: string; name: string; code: string; created_at?: string; avatar?: string }>;
        const membersByLeague = new Map<string, string[]>();
        ((membersWithUsersForTables.data || []) as any[]).forEach((r: any) => {
          const arr = membersByLeague.get(r.league_id) ?? [];
          arr.push(r.user_id);
          membersByLeague.set(r.league_id, arr);
        });
        
        const submittedUserIds = new Set(((submissionsForTables.data || []) as any[]).map((s: any) => s.user_id));
        
        // Build league rows
        const leagueRows = allLeagues
          .filter((l) => l.name !== 'API Test')
          .map((l) => {
            const memberIds = membersByLeague.get(l.id) ?? [];
            return {
              id: l.id,
              name: l.name,
              code: l.code,
              memberCount: memberIds.length,
              avatar: l.avatar || null,
              created_at: l.created_at || null,
            };
          });
        
        // Sort by unread messages first
        leagueRows.sort((a, b) => {
          const unreadA = unreadCounts[a.id] ?? 0;
          const unreadB = unreadCounts[b.id] ?? 0;
          if (unreadA > 0 && unreadB === 0) return -1;
          if (unreadA === 0 && unreadB > 0) return 1;
          return 0;
        });
        
        // Calculate submission status
        const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
        for (const league of allLeagues) {
          const memberIds = membersByLeague.get(league.id) ?? [];
          const totalCount = memberIds.length;
          const submittedCount = memberIds.reduce((count, id) => count + (submittedUserIds.has(id) ? 1 : 0), 0);
          
          submissionStatus[league.id] = {
            allSubmitted: submittedCount === totalCount && totalCount > 0,
            submittedCount,
            totalCount
          };
        }
        
        // Cache Tables page data (simplified - full leagueData calculation happens in Tables.tsx)
        setCached(`tables:${userId}`, {
          rows: leagueRows,
          currentGw,
          leagueSubmissions: submissionStatus,
          unreadByLeague: unreadCounts,
          leagueData: {}, // Empty - Tables page will calculate this
        }, CACHE_TTL.TABLES);
        
        console.log('[Pre-loading] Tables page data cached successfully');
      }
    } catch (error) {
      console.warn('[Pre-loading] Failed to load Tables page data:', error);
      // Non-critical - Tables page will load its own data
    }
    })(); // Don't await - let it run in background
  }

  // Process user picks
  const userPicks: Record<number, "H" | "D" | "A"> = {};
  (picksForGw.data || []).forEach((pick: any) => {
    userPicks[pick.fixture_index] = pick.pick;
  });

  // Process Web user IDs
  const webUserIds = new Set<string>();
  (webPicksResult.data || []).forEach((pick: any) => {
    if (pick.user_id) webUserIds.add(pick.user_id);
  });

  // Calculate last GW rank
  const userGwPoints = (gwPointsResult.data || []).filter((gp: any) => gp.user_id === userId);
  const lastGwPoints = userGwPoints.filter((gp: any) => gp.gw === latestGw);
  const lastGwScore = lastGwPoints.reduce((sum: number, gp: any) => sum + (gp.points || 0), 0);
  
  // Get all users' scores for last GW
  const allLastGwPoints = (gwPointsResult.data || []).filter((gp: any) => gp.gw === latestGw);
  const sortedLastGw = allLastGwPoints
    .map((gp: any) => ({ user_id: gp.user_id, points: gp.points || 0 }))
    .sort((a: any, b: any) => b.points - a.points);
  
  const lastGwRankIndex = sortedLastGw.findIndex((u: any) => u.user_id === userId);
  const lastGwRank = lastGwRankIndex >= 0 ? {
    rank: lastGwRankIndex + 1,
    total: sortedLastGw.length,
    score: lastGwScore,
    gw: latestGw || 1,
    totalFixtures: fixturesForGw.data?.length || 0,
    isTied: lastGwRankIndex > 0 && sortedLastGw[lastGwRankIndex - 1]?.points === lastGwScore,
  } : null;

  // Calculate form ranks (5-week and 10-week) during preload
  const calculateFormRank = (startGw: number, endGw: number, allPoints: any[], allUsers: any[], userId: string): { rank: number; total: number; isTied: boolean } | null => {
    if (endGw < startGw || !latestGw || latestGw < endGw) return null;
    
    const formPoints = allPoints.filter((gp: any) => gp.gw >= startGw && gp.gw <= endGw);
    const userData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
    
    // Initialize userData from overall (all users who have played)
    allUsers.forEach((o: any) => {
      userData.set(o.user_id, {
        user_id: o.user_id,
        name: o.name ?? "User",
        formPoints: 0,
        weeksPlayed: new Set()
      });
    });
    
    // Add points for each GW in the form period
    formPoints.forEach((gp: any) => {
      const user = userData.get(gp.user_id);
      if (user) {
        user.formPoints += gp.points ?? 0;
        user.weeksPlayed.add(gp.gw);
      }
    });
    
    // Filter to only users who played ALL weeks in the form period
    const sorted = Array.from(userData.values())
      .filter(u => {
        for (let g = startGw; g <= endGw; g++) {
          if (!u.weeksPlayed.has(g)) return false;
        }
        return true;
      })
      .sort((a, b) => b.formPoints - a.formPoints || a.name.localeCompare(b.name));
    
    if (sorted.length === 0) return null;
    
    let currentRank = 1;
    const ranked = sorted.map((player, index) => {
      if (index > 0 && sorted[index - 1].formPoints !== player.formPoints) {
        currentRank = index + 1;
      }
      return { ...player, rank: currentRank };
    });
    
          const userEntry = ranked.find((u: any) => u.user_id === userId);
          if (!userEntry) return null;
          
          const rankCount = ranked.filter((r: any) => r.rank === userEntry.rank).length;
          return {
            rank: userEntry.rank,
            total: ranked.length,
            isTied: rankCount > 1
          };
        };

  // Calculate 5-week form rank
  const fiveGwRank = latestGw && latestGw >= 5 
    ? calculateFormRank(latestGw - 4, latestGw, gwPointsResult.data || [], overallResult.data || [], userId)
    : null;

  // Calculate 10-week form rank
  const tenGwRank = latestGw && latestGw >= 10
    ? calculateFormRank(latestGw - 9, latestGw, gwPointsResult.data || [], overallResult.data || [], userId)
    : null;

  // Calculate season rank
  let seasonRank: { rank: number; total: number; isTied: boolean } | null = null;
  if (overallResult.data && overallResult.data.length > 0) {
    const sorted = [...overallResult.data].sort((a: any, b: any) => (b.ocp ?? 0) - (a.ocp ?? 0) || (a.name ?? "User").localeCompare(b.name ?? "User"));
    let currentRank = 1;
    const ranked = sorted.map((player: any, index: number) => {
      if (index > 0 && (sorted[index - 1].ocp ?? 0) !== (player.ocp ?? 0)) {
        currentRank = index + 1;
      }
      return { ...player, rank: currentRank };
    });
    
    const userEntry = ranked.find((o: any) => o.user_id === userId);
    if (userEntry) {
      const rankCount = ranked.filter((r: any) => r.rank === userEntry.rank).length;
      seasonRank = {
        rank: userEntry.rank,
        total: overallResult.data.length,
        isTied: rankCount > 1
      };
    }
  }

  // Process league data (simplified - full processing happens in Home.tsx)
  const leagueData: Record<string, any> = {};
  const userLeagueIdsSet = new Set(leagues.map((l: any) => l.id));
  
  (leagueMembersResult.data || []).forEach((lm: any) => {
    if (userLeagueIdsSet.has(lm.league_id)) {
      if (!leagueData[lm.league_id]) {
        leagueData[lm.league_id] = {
          id: lm.league_id,
          members: [],
          userPosition: null,
          positionChange: null,
        };
      }
    }
  });

  // Check if user is in API Test league
  const isInApiTestLeague = leagues.some((l: any) => l.name === 'API Test');

  // Cache the data for future use (including pre-calculated form ranks)
  const cacheKey = `home:basic:${userId}`;
  setCached(cacheKey, {
    leagues,
    currentGw,
    latestGw,
    allGwPoints: gwPointsResult.data || [],
    overall: overallResult.data || [],
    lastGwRank,
    fiveGwRank,
    tenGwRank,
    seasonRank,
    isInApiTestLeague,
  }, CACHE_TTL.HOME);

  // Cache fixtures
  const fixturesCacheKey = `home:fixtures:${userId}:${currentGw}`;
  setCached(fixturesCacheKey, {
    fixtures: fixturesForGw.data || [],
    userPicks,
  }, CACHE_TTL.HOME);

  // Cache Global page data (ensure latestGw is a number, not null)
  const globalLatestGw = latestGw ?? 1;
  const prevOcpData: Record<string, number> = {};
  if (globalLatestGw > 1) {
    const prevList = (gwPointsResult.data || []).filter((r: any) => r.gw < globalLatestGw);
    prevList.forEach((r: any) => {
      prevOcpData[r.user_id] = (prevOcpData[r.user_id] ?? 0) + (r.points || 0);
    });
  }
  setCached('global:leaderboard', {
    latestGw: globalLatestGw,
    gwPoints: gwPointsResult.data || [],
    overall: overallResult.data || [],
    prevOcp: prevOcpData,
  }, CACHE_TTL.GLOBAL);
  console.log('[Pre-loading] Global page data cached:', { latestGw: globalLatestGw, gwPointsCount: (gwPointsResult.data || []).length });

  // Preload TestApiPredictions page data (non-blocking - let it complete in background)
  (async () => {
    try {
      // Load test fixtures for current GW
      const { data: testFixtures, error: testFixturesError } = await supabase
        .from('app_fixtures')
        .select('*')
        .eq('gw', currentGw)
        .order('fixture_index', { ascending: true });

      if (!testFixturesError && testFixtures && testFixtures.length > 0) {
        // Load user picks for test GW
        const { data: testPicks, error: testPicksError } = await supabase
          .from('app_picks')
          .select('gw, fixture_index, pick')
          .eq('user_id', userId)
          .eq('gw', currentGw);

        // Check submission status
        const { data: testSubmission, error: testSubmissionError } = await supabase
          .from('app_gw_submissions')
          .select('submitted_at')
          .eq('gw', currentGw)
          .eq('user_id', userId)
          .maybeSingle();

        if (!testPicksError && !testSubmissionError) {
          // Convert fixtures to the format TestApiPredictions expects
          const fixturesData = testFixtures.map((f: any) => ({
            id: f.id || String(f.api_match_id || f.fixture_index),
            gw: currentGw,
            fixture_index: f.fixture_index,
            home_team: f.home_team,
            away_team: f.away_team,
            home_code: f.home_code,
            away_code: f.away_code,
            home_name: f.home_name,
            away_name: f.away_name,
            home_crest: null,
            away_crest: null,
            kickoff_time: f.kickoff_time,
            api_match_id: f.api_match_id || null,
          }));

          // Convert picks to array format
          const picksArray = (testPicks || []).map((p: any) => ({
            fixture_index: p.fixture_index,
            pick: p.pick,
            matchday: currentGw,
          }));

          // Cache TestApiPredictions data
          const testPredictionsCacheKey = `predictions:${userId}:${currentGw}`;
          setCached(testPredictionsCacheKey, {
            fixtures: fixturesData,
            picks: picksArray,
            submitted: !!testSubmission?.submitted_at,
            results: [], // Results loaded separately via useLiveScores
          }, CACHE_TTL.HOME);

          console.log('[Pre-loading] TestApiPredictions page data cached:', { 
            fixturesCount: fixturesData.length, 
            picksCount: picksArray.length,
            submitted: !!testSubmission?.submitted_at 
          });
        }
      }
    } catch (error) {
      // Silent fail for TestApiPredictions preload - non-critical
      console.warn('[Pre-loading] Failed to preload TestApiPredictions data:', error);
    }
  })(); // Don't await - let it run in background

  return {
    currentGw,
    latestGw,
    leagues,
    allGwPoints: gwPointsResult.data || [],
    overall: overallResult.data || [],
    lastGwRank,
    fixtures: fixturesForGw.data || [],
    userPicks,
    leagueData,
    webUserIds,
    isInApiTestLeague,
  };
}


