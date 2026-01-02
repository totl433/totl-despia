/**
 * Service to PRE-WARM caches before showing the app.
 * Used when "load everything first" mode is enabled.
 * 
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  IMPORTANT: LEAGUES ARE PRE-WARMED ONLY                             │
 * │                                                                      │
 * │  This service populates caches so pages load instantly.              │
 * │  UI components MUST use hooks (e.g., useLeagues) to read data.       │
 * │  DO NOT consume league data from this function's return value.       │
 * │                                                                      │
 * │  Single source of truth for leagues: src/hooks/useLeagues.ts         │
 * │  Single source of truth for sorting: src/lib/sortLeagues.ts          │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { supabase } from '../lib/supabase';
import { setCached, CACHE_TTL, getCached } from '../lib/cache';
import { sortLeaguesWithUnreadMap } from '../lib/sortLeagues';
import { log } from '../lib/logEvent';
import { prewarmLeaguesCache } from '../api/leagues';
import { getGameweekState, type GameweekState } from '../lib/gameweekState';

/**
 * Return type for initial data loading.
 * 
 * NOTE: The `leagues` field is included for backwards compatibility only.
 * Pages should NOT use it - use the useLeagues hook instead.
 */
export interface InitialData {
  // Current gameweek
  currentGw: number;
  latestGw: number | null;
  
  /**
   * @deprecated Use useLeagues hook instead. This is for backwards compatibility only.
   * Leagues are pre-warmed by prewarmLeaguesCache() and should be consumed via useLeagues hook.
   */
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
  
  /**
   * @deprecated League data should be fetched via useLeagues and Tables-specific hooks.
   */
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
 * Pre-warm all critical caches for the app.
 * 
 * This function populates caches so that pages load instantly.
 * Pages should use hooks (useLeagues, etc.) to consume data - NOT this return value.
 * 
 * LEAGUE DATA FLOW:
 * 1. prewarmLeaguesCache() populates leagues:${userId} and leagues:unread:${userId} caches
 * 2. useLeagues hook reads from these caches on mount
 * 3. Pages render immediately from cache, then refresh in background
 * 
 * @param userId - The user's ID
 * @returns InitialData for backwards compatibility (pages should use hooks instead)
 */
export async function loadInitialData(userId: string): Promise<InitialData> {
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: PRE-WARM LEAGUES CACHE
  // ═══════════════════════════════════════════════════════════════════════
  // This is the ONLY place we fetch leagues during initial load.
  // prewarmLeaguesCache() populates:
  //   - leagues:${userId} cache (for useLeagues hook)
  //   - leagues:unread:${userId} cache (for unread counts)
  // 
  // UI pages (Home, Tables) should use useLeagues hook to read this data.
  // DO NOT add any additional league fetching or sorting here.
  // ═══════════════════════════════════════════════════════════════════════
  log.debug('preload/leagues_prewarm_start', { userId: userId.slice(0, 8) });
  const { leagueIds } = await prewarmLeaguesCache(userId);
  log.debug('preload/leagues_prewarm_complete', { count: leagueIds.length });
  
  // Read leagues from cache for backwards compatibility return value only
  // IMPORTANT: Pages should NOT use this - they should use useLeagues hook
  const cachedLeagues = getCached<Array<{ id: string; name: string; code: string; avatar?: string | null; created_at?: string | null }>>(`leagues:${userId}`) || [];
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: PRE-WARM OTHER CACHES (GW data, fixtures, picks, leaderboards)
  // ═══════════════════════════════════════════════════════════════════════
  // Fetch all other data in parallel for maximum speed
  const [
    metaResult,
    gwPointsResult,
    overallResult,
    _fixturesResult, // Placeholder - replaced later
    _picksResult, // Placeholder - replaced later
    leagueMembersResult,
    latestGwResult,
    webPicksResult,
    appPicksResult,
    // Additional data for Tables page (placeholders - populated later)
    _allLeaguesResult, // Placeholder - populated later
    _leagueMembersWithUsersResult, // Placeholder - populated later
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
    
    // 2. Get recent GW points only (for form leaderboards - last 15 GWs is enough for 10-week form)
    // This dramatically reduces data transfer for mature seasons
    supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .order('gw', { ascending: false })
      .limit(15000), // ~1000 users × 15 GWs = 15000 rows max
    
    // 3. Get top 100 overall standings (sufficient for display, user rank fetched separately if needed)
    supabase
      .from('app_v_ocp_overall')
      .select('user_id, name, ocp')
      .order('ocp', { ascending: false })
      .limit(100),
    
    // 4. Get fixtures for current GW (will be updated after we get currentGw)
    Promise.resolve({ data: null, error: null }), // Placeholder
    
    // 5. Get user's picks for current GW (will be updated after we get currentGw)
    Promise.resolve({ data: null, error: null }), // Placeholder
    
    // 6. Get league memberships (for league data - member counts, etc.)
    supabase
      .from('league_members')
      .select('league_id, user_id')
      .limit(10000),
    
    // 7. Get latest GW from results
    supabase
      .from('app_gw_results')
      .select('gw')
      .order('gw', { ascending: false })
      .limit(1)
      .maybeSingle(),
    
    // 8. Get Web picks with timestamps (to determine origin)
    supabase
      .from('picks')
      .select('user_id, gw, created_at')
      .limit(10000),
    
    // 8b. Get App picks with timestamps (to compare with Web picks)
    supabase
      .from('app_picks')
      .select('user_id, gw, created_at')
      .limit(10000),
    
    // 9. Get all leagues (for Tables page)
    Promise.resolve({ data: null, error: null }), // Will be populated after we get league IDs
    
    // 10. Get league members with user names (for Tables page)
    Promise.resolve({ data: null, error: null }), // Will be populated after we get league IDs
    
    // 11. Get all GW results (for Tables page calculations)
    supabase
      .from('app_gw_results')
      .select('gw, fixture_index, result'),
    
    // 12. Get all fixtures (for Tables page calculations)
    supabase
      .from('app_fixtures')
      .select('gw, kickoff_time')
      .order('gw', { ascending: true })
      .order('kickoff_time', { ascending: true }),
    
    // 13. Get league submissions (will be populated after we get league IDs and currentGw)
    Promise.resolve({ data: null, error: null }), // Placeholder
  ]);

  // Handle errors (non-critical errors for Tables/Global data are handled separately)
  if (metaResult.error) throw new Error(`Failed to load current GW: ${metaResult.error.message}`);
  if (gwPointsResult.error) throw new Error(`Failed to load GW points: ${gwPointsResult.error.message}`);
  if (overallResult.error) throw new Error(`Failed to load overall standings: ${overallResult.error.message}`);
  if (leagueMembersResult.error) throw new Error(`Failed to load league members: ${leagueMembersResult.error.message}`);
  if (latestGwResult.error) throw new Error(`Failed to load latest GW: ${latestGwResult.error.message}`);
  if (webPicksResult.error) throw new Error(`Failed to load Web picks: ${webPicksResult.error.message}`);
  if (appPicksResult.error) throw new Error(`Failed to load App picks: ${appPicksResult.error.message}`);
  // Note: _allResultsResult, _allFixturesResult errors are non-critical

  const currentGw = metaResult.data?.current_gw ?? 1;
  const latestGw = latestGwResult.data?.gw ?? null;

  // Now fetch fixtures, picks, and user's own OCP (if not in top 100)
  const userInTop100 = (overallResult.data || []).some((r: any) => r.user_id === userId);
  
  const [fixturesForGw, picksForGw, userOcpResult] = await Promise.all([
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
    
    // Fetch user's own OCP if not in top 100
    userInTop100
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from('app_v_ocp_overall')
          .select('user_id, name, ocp')
          .eq('user_id', userId)
          .maybeSingle(),
  ]);
  
  // Merge user's OCP into overall if they weren't in top 100
  let overallData = overallResult.data || [];
  if (!userInTop100 && userOcpResult.data) {
    overallData = [...overallData, userOcpResult.data];
  }

  if (fixturesForGw.error) throw new Error(`Failed to load fixtures: ${fixturesForGw.error.message}`);
  if (picksForGw.error) throw new Error(`Failed to load picks: ${picksForGw.error.message}`);

  // Use leagues from cache for backwards compatibility return value
  // IMPORTANT: Pages should use useLeagues hook, not this variable
  const leagues = cachedLeagues;
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: PRE-WARM TABLES PAGE CACHE (non-blocking)
  // ═══════════════════════════════════════════════════════════════════════
  // Tables page needs member counts and submission data.
  // This pre-warms that cache so Tables loads instantly.
  // Note: Tables page will use useLeagues for league list/sorting.
  // This only pre-warms the member-specific data.
  // ═══════════════════════════════════════════════════════════════════════
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
        // Get unread counts from cache (already populated by prewarmLeaguesCache)
        const unreadCounts: Record<string, number> = getCached<Record<string, number>>(`leagues:unread:${userId}`) || {};
        
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
        const unsortedLeagueRows = allLeagues
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
        
        // Sort using canonical sort helper (by unread desc, then name asc)
        const leagueRows = sortLeaguesWithUnreadMap(unsortedLeagueRows, unreadCounts);
        
        log.debug('preload/tables_leagues_sorted', { count: leagueRows.length });
        
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

  // Process Web user IDs by comparing timestamps:
  // If picks in `picks` table were created BEFORE (or within 1 second of) picks in `app_picks`,
  // the user made picks on Web first (Web origin)
  const webPicksEarliest = new Map<string, Date>();
  (webPicksResult.data || []).forEach((p: any) => {
    if (!p.created_at) return;
    const key = `${p.user_id}:${p.gw}`;
    const pickTime = new Date(p.created_at);
    const existing = webPicksEarliest.get(key);
    if (!existing || pickTime < existing) {
      webPicksEarliest.set(key, pickTime);
    }
  });
  
  const appPicksEarliest = new Map<string, Date>();
  (appPicksResult.data || []).forEach((p: any) => {
    if (!p.created_at) return;
    const key = `${p.user_id}:${p.gw}`;
    const pickTime = new Date(p.created_at);
    const existing = appPicksEarliest.get(key);
    if (!existing || pickTime < existing) {
      appPicksEarliest.set(key, pickTime);
    }
  });
  
  // Identify Web users: those whose picks in `picks` table were created 
  // BEFORE picks in `app_picks` table (Web origin)
  // If picks originated from App, app_picks will have earlier timestamps due to mirroring
  // IMPORTANT: Only check the CURRENT gameweek to avoid false positives from old migrated data
  // Historical gameweeks may have been migrated, making timestamp comparison unreliable
  const webUserIds = new Set<string>();
  const gwToCheck = currentGw; // Only check current GW for reliable origin detection
  webPicksEarliest.forEach((webTime, key) => {
    const [userId, gwStr] = key.split(':');
    const gwNum = parseInt(gwStr, 10);
    
    // Skip if not the current gameweek
    if (gwNum !== gwToCheck) return;
    
    const appTime = appPicksEarliest.get(key);
    
    // Only mark as Web user if web picks were created significantly BEFORE app picks
    // Require both timestamps to exist for reliable determination
    // Use a threshold of 500ms to account for trigger timing - web must be clearly earlier
    if (appTime && (webTime.getTime() - appTime.getTime()) < -500) {
      webUserIds.add(userId);
    }
    // If no appTime exists, we can't reliably determine origin (could be data migration, etc.)
    // So we don't mark as web user to be safe
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

  // Calculate 5-week form rank (uses overallData which includes current user)
  const fiveGwRank = latestGw && latestGw >= 5 
    ? calculateFormRank(latestGw - 4, latestGw, gwPointsResult.data || [], overallData, userId)
    : null;

  // Calculate 10-week form rank
  const tenGwRank = latestGw && latestGw >= 10
    ? calculateFormRank(latestGw - 9, latestGw, gwPointsResult.data || [], overallData, userId)
    : null;

  // Calculate season rank using overallData (includes user if not in top 100)
  let seasonRank: { rank: number; total: number; isTied: boolean } | null = null;
  if (overallData.length > 0) {
    const sorted = [...overallData].sort((a: any, b: any) => (b.ocp ?? 0) - (a.ocp ?? 0) || (a.name ?? "User").localeCompare(b.name ?? "User"));
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
      // Note: total is limited to top 100 + user, actual total would require COUNT query
      seasonRank = {
        rank: userEntry.rank,
        total: overallData.length,
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
    overall: overallData, // Use merged data that includes user
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
    overall: overallData, // Use merged data that includes user
    prevOcp: prevOcpData,
  }, CACHE_TTL.GLOBAL);
  console.log('[Pre-loading] Global page data cached:', { latestGw: globalLatestGw, gwPointsCount: (gwPointsResult.data || []).length });

  // Preload Predictions page data (non-blocking - let it complete in background)
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
          // Convert fixtures to the format Predictions expects
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

          // Cache Predictions data
          const testPredictionsCacheKey = `predictions:${userId}:${currentGw}`;
          setCached(testPredictionsCacheKey, {
            fixtures: fixturesData,
            picks: picksArray,
            submitted: !!testSubmission?.submitted_at,
            results: [], // Results loaded separately via useLiveScores
          }, CACHE_TTL.HOME);

          console.log('[Pre-loading] Predictions page data cached:', { 
            fixturesCount: fixturesData.length, 
            picksCount: picksArray.length,
            submitted: !!testSubmission?.submitted_at 
          });
        }
      }
    } catch (error) {
      // Silent fail for Predictions preload - non-critical
      console.warn('[Pre-loading] Failed to preload Predictions data:', error);
    }
  })(); // Don't await - let it run in background

  return {
    currentGw,
    latestGw,
    leagues,
    allGwPoints: gwPointsResult.data || [],
    overall: overallData, // Use merged data that includes user
    lastGwRank,
    fixtures: fixturesForGw.data || [],
    userPicks,
    leagueData,
    webUserIds,
    isInApiTestLeague,
  };
}


