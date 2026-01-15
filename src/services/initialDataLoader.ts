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
import { resolveLeagueStartGw } from '../lib/leagueStart';
import { APP_ONLY_USER_IDS } from '../lib/appOnlyUsers';

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
    userNotificationPrefsResult, // User notification preferences for PredictionsBanner
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
    
    // 14. Get user notification preferences (for PredictionsBanner - current_viewing_gw)
    supabase
      .from('user_notification_preferences')
      .select('current_viewing_gw')
      .eq('user_id', userId)
      .maybeSingle(),
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
  // Note: userNotificationPrefsResult error is non-critical (banner will work without it)
  
  const currentGw = metaResult.data?.current_gw ?? 1;
  const latestGw = latestGwResult.data?.gw ?? null;
  
  // Cache app_meta for synchronous access in HomePage (prevents DB queries)
  setCached(`app_meta:current_gw`, { current_gw: currentGw }, CACHE_TTL.HOME);
  
  // Cache availableGws (list of all GWs with results) for League page tabs
  // Extract unique GWs from app_gw_results
  if (_allResultsResult.data && Array.isArray(_allResultsResult.data)) {
    const gwList = [...new Set(_allResultsResult.data.map((r: any) => r.gw))].sort((a, b) => b - a);
    // Include currentGw if it's not already there (for live GWs without results yet)
    if (currentGw && !gwList.includes(currentGw)) {
      gwList.unshift(currentGw); // Add to beginning (highest GW)
    }
    setCached('app:available_gws', gwList, CACHE_TTL.HOME);
    log.info('preload/available_gws_cached', { count: gwList.length, gws: gwList.slice(0, 5) });
  }
  
  // Cache user notification preferences for PredictionsBanner and HomePage
  // IMPORTANT: If there's no row yet (new user), treat as null (user has "moved on")
  // We still cache the null value so UI can default to currentGw deterministically.
  const userViewingGw = userNotificationPrefsResult.data?.current_viewing_gw ?? null;
  setCached(`user_notification_prefs:${userId}`, { current_viewing_gw: userViewingGw }, CACHE_TTL.HOME);
  
  // Cache last completed GW for MiniLeagueGwTableCard (avoids DB query)
  if (latestGw) {
    setCached('app:lastCompletedGw', latestGw, CACHE_TTL.HOME);
  }

  // Pre-load gameState for current GW (so homepage knows LIVE vs non-LIVE immediately)
  let gameState: GameweekState | null = null;
  try {
    gameState = await getGameweekState(currentGw);
    // Cache gameState for immediate access
    setCached(`gameState:${currentGw}`, gameState, CACHE_TTL.HOME);
  } catch (error) {
    console.warn('[Pre-loading] Failed to pre-load gameState:', error);
    // Non-critical - gameState will load when useGameweekState hook runs
  }

  // Determine viewing GW (for PredictionsBanner + homepage fixtures cache)
  // Only show previous GW if the user explicitly has a viewing GW < currentGw.
  // New users (null) should see currentGw by default.
  const viewingGw = userViewingGw !== null && userViewingGw < currentGw ? userViewingGw : currentGw;

  // Now fetch fixtures, picks, and user's own OCP (if not in top 100)
  const userInTop100 = (overallResult.data || []).some((r: any) => r.user_id === userId);
  
  // Fetch submissions for both current and viewing GW (for PredictionsBanner)
  const submissionsForBanner = viewingGw !== currentGw
    ? await Promise.all([
        supabase.from('app_gw_submissions').select('user_id, gw').eq('gw', currentGw),
        supabase.from('app_gw_submissions').select('user_id, gw').eq('gw', viewingGw),
      ])
    : [await supabase.from('app_gw_submissions').select('user_id, gw').eq('gw', currentGw)];
  
  // Cache submissions for PredictionsBanner
  if (submissionsForBanner[0]?.data) {
    setCached(`home:submissions:${currentGw}`, submissionsForBanner[0].data, CACHE_TTL.HOME);
  }
  if (viewingGw !== currentGw && submissionsForBanner[1]?.data) {
    setCached(`home:submissions:${viewingGw}`, submissionsForBanner[1].data, CACHE_TTL.HOME);
  }
  
  // Fetch and cache user's own submissions (for Share button visibility)
  const userSubmissionsResult = await supabase
    .from('app_gw_submissions')
    .select('gw')
    .eq('user_id', userId)
    .order('gw', { ascending: false });
  
  if (userSubmissionsResult.data) {
    const userSubmissionsGws = userSubmissionsResult.data.map((s: any) => s.gw);
    setCached(`home:userSubmissions:${userId}`, userSubmissionsGws, CACHE_TTL.HOME);
  }
  
  const [fixturesForGw, picksForGw, userOcpResult, fixturesForViewingGw] = await Promise.all([
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
    
    // Fetch fixtures for viewing GW (for PredictionsBanner deadline calculation)
    viewingGw !== currentGw
      ? supabase
          .from('app_fixtures')
          .select('gw, kickoff_time')
          .eq('gw', viewingGw)
          .order('kickoff_time', { ascending: true })
      : Promise.resolve({ data: null, error: null }),
  ]);
  
  // Fetch results for currentGw (needed for fixture cards to show outcomes)
  const gwResultsResult = await supabase
    .from('app_gw_results')
    .select('fixture_index, result')
    .eq('gw', currentGw);
  
  // Cache results for currentGw
  if (gwResultsResult.data) {
    const resultsArray = gwResultsResult.data
      .filter((r: any) => r.result === "H" || r.result === "D" || r.result === "A")
      .map((r: any) => ({ fixture_index: r.fixture_index, result: r.result as "H" | "D" | "A" }));
    setCached(`home:gwResults:${currentGw}`, resultsArray, CACHE_TTL.HOME);
  }
  
  // Fetch and cache live scores for currentGw (needed for fixture cards to show scores/goals instantly)
  const liveScoresResult = await supabase
    .from('live_scores')
    .select('*')
    .eq('gw', currentGw);
  
  const liveScoresArray = liveScoresResult.data || [];
  
  // Build userPicks map from picksForGw data
  const userPicks: Record<number, "H" | "D" | "A"> = {};
  if (picksForGw.data) {
    for (const pick of picksForGw.data) {
      userPicks[pick.fixture_index] = pick.pick;
    }
  }
  
  // Cache fixtures WITH live scores for currentGw
  if (fixturesForGw.data) {
    setCached(`home:fixtures:${userId}:${currentGw}`, {
      fixtures: fixturesForGw.data,
      userPicks,
      liveScores: liveScoresArray.length > 0 ? liveScoresArray : undefined,
    }, CACHE_TTL.HOME);
  }
  
  // Cache fixtures for viewingGw (PredictionsBanner)
  if (viewingGw !== currentGw && fixturesForViewingGw.data) {
    setCached(`home:fixtures:${viewingGw}`, fixturesForViewingGw.data, CACHE_TTL.HOME);
  }
  
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
  // STEP 2: PRE-WARM HOMEPAGE LEAGUE DATA CACHE (NON-BLOCKING - load in background)
  // ═══════════════════════════════════════════════════════════════════════
  // Homepage ML live tables need league data (members, picks, results, etc.)
  // This FULLY processes and caches the data so ML live tables load instantly.
  // NON-BLOCKING: Start in background so app shows immediately, cache will be ready when needed.
  // ═══════════════════════════════════════════════════════════════════════
  if (leagueIds.length > 0 && currentGw) {
    // NON-BLOCKING - start in background, don't await (app shows immediately)
    (async () => {
      try {
        const leagueDataCacheKey = `home:leagueData:v6:${userId}:${currentGw}`; // v6: Ensure HP ordering matches /tables
        
        // Check if already cached
        const existingCache = getCached<any>(leagueDataCacheKey);
        const hasExistingLeagueData = existingCache && existingCache.leagueData && Object.keys(existingCache.leagueData).length > 0;
        const allLeaguesHaveWebUserIds = hasExistingLeagueData && Object.values(existingCache.leagueData).every((data: any) => 
          data.webUserIds !== undefined
        );
        
        // Declare variables that may be used in both branches (declare before usage)
        let membersByLeague: Record<string, Array<{ id: string; name: string }>> = {};
        let picksByLeague: Map<string, Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }>> = new Map();
        let submittedUserIds: Set<string> = new Set();
        
        // Check if ML live table cache exists for all leagues
        let needsMlLiveTableCache = false;
        if (hasExistingLeagueData && allLeaguesHaveWebUserIds) {
          // League data is cached, but check if ML live table cache exists
          for (const league of leagues) {
            const mlTableCacheKey = `ml_live_table:${league.id}:${currentGw}`;
            const mlCache = getCached<any>(mlTableCacheKey);
            if (!mlCache || !mlCache.fixtures || mlCache.fixtures.length === 0) {
              needsMlLiveTableCache = true;
              break;
            }
          }
          
        if (!needsMlLiveTableCache) {
            log.debug('preload/league_data_cached', { userId: userId.slice(0, 8), gw: currentGw });
            // Both caches exist - skip league data processing but continue to ML cache check
            // (ML cache section will detect it exists and skip)
            // BUT: Still need to ensure mltRows are cached for instant GW Table loading
            const cachedLeagueData = existingCache.leagueData;
            if (cachedLeagueData) {
              for (const [leagueId, data] of Object.entries(cachedLeagueData)) {
                if (data && typeof data === 'object' && 'members' in data && Array.isArray(data.members)) {
                  // Check if mltRows cache exists for this league
                  const mltRowsCacheKey = `league:mltRows:${leagueId}`;
                  const existingMltRows = getCached<any[]>(mltRowsCacheKey);
                  if (!existingMltRows || existingMltRows.length === 0) {
                    // Cache empty mltRows from members for instant loading
                    const emptyMltRows = (data.members as Array<{ id: string; name: string }>).map((m) => ({
                      user_id: m.id,
                      name: m.name,
                      mltPts: 0,
                      ocp: 0,
                      unicorns: 0,
                      wins: 0,
                      draws: 0,
                      form: [] as ("W" | "D" | "L")[],
                    }));
                    setCached(mltRowsCacheKey, emptyMltRows, CACHE_TTL.LEAGUES);
                    log.debug('preload/mlt_rows_cached', { 
                      leagueId: leagueId.slice(0, 8), 
                      leagueName: (data as any).name || 'unknown',
                      cacheKey: mltRowsCacheKey, 
                      rowsCount: emptyMltRows.length,
                      note: 'empty (from existing cache)'
                    });
                  }
                }
              }
            }
          } else {
            // League data cached but ML live table cache missing - need to fetch minimal data for ML cache
            log.debug('preload/ml_live_table_cache_missing', { userId: userId.slice(0, 8), gw: currentGw });
            // Load members from existing cache for ML cache population
            const cachedLeagueData = existingCache.leagueData;
            for (const [leagueId, data] of Object.entries(cachedLeagueData)) {
              if (data && typeof data === 'object' && 'members' in data && Array.isArray(data.members)) {
                membersByLeague[leagueId] = data.members;
              }
            }
          }
        }
        
        // Only process league data if cache doesn't exist
        if (!hasExistingLeagueData || !allLeaguesHaveWebUserIds) {
          log.debug('preload/league_data_start', { userId: userId.slice(0, 8), gw: currentGw, leagueCount: leagueIds.length });
        
          // Fetch all data in parallel (same as Home.tsx)
          const [membersResult, _readsResult, submissionsResult, resultsResult, _fixturesResult, webPicksResult, appPicksResult] = await Promise.all([
            supabase.from("league_members").select("league_id, user_id, users!inner(id, name)").in("league_id", leagueIds),
            supabase.from("league_message_reads").select("league_id, last_read_at").eq("user_id", userId).in("league_id", leagueIds),
            supabase.from("app_gw_submissions").select("user_id").eq("gw", currentGw),
            supabase.from("app_gw_results").select("gw, fixture_index, result"),
            supabase.from("app_fixtures").select("gw, fixture_index, home_team, away_team, home_name, away_name, kickoff_time").in("gw", Array.from({ length: Math.min(20, latestGw || 20) }, (_, i) => i + 1)),
            supabase.from("picks").select("user_id, gw, created_at").limit(10000),
            supabase.from("app_picks").select("user_id, gw, created_at").limit(10000),
          ]);
          
          // Process members
          membersByLeague = {};
        (membersResult.data ?? []).forEach((m: any) => {
          if (!membersByLeague[m.league_id]) {
            membersByLeague[m.league_id] = [];
          }
          membersByLeague[m.league_id].push({
            id: m.users.id,
            name: m.users.name
          });
        });
        
          const allMemberIdsSet = new Set(Object.values(membersByLeague).flat().map(m => m.id));
          submittedUserIds = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id).filter((id: string) => allMemberIdsSet.has(id)));
        
        // Identify Web users (same logic as Home.tsx)
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
        
        const appTestUserIds = new Set(APP_ONLY_USER_IDS);
        const webUserIds = new Set<string>();
        
        webPicksEarliest.forEach((webTime, key) => {
          const [userIdStr, gwStr] = key.split(':');
          const gwNum = parseInt(gwStr, 10);
          if (gwNum !== currentGw) return;
          const appTime = appPicksEarliest.get(key);
          if (appTime && (webTime.getTime() - appTime.getTime()) < -500) {
            if (allMemberIdsSet.has(userIdStr) && !appTestUserIds.has(userIdStr)) {
              webUserIds.add(userIdStr);
            }
          }
        });
        
        // Calculate league start GWs (used to bound picks fetch)
        const leagueStartGws = new Map<string, number>();
        const leagueStartGwPromises = leagues.map(async (league) => {
          const leagueStartGw = await resolveLeagueStartGw(league, currentGw);
          return { leagueId: league.id, leagueStartGw };
        });
        const leagueStartGwResults = await Promise.all(leagueStartGwPromises);
        leagueStartGwResults.forEach(({ leagueId, leagueStartGw }) => {
          leagueStartGws.set(leagueId, leagueStartGw);
        });

        // Fetch ALL picks for ALL ML members (bounded + paged) so ordering can't truncate.
        const allMemberIds = Array.from(allMemberIdsSet);
        const boundedStartGw = (() => {
          const starts = Array.from(leagueStartGws.values())
            .map((v) => (typeof v === 'number' ? v : 1))
            .map((v) => (v <= 0 ? 1 : v))
            .filter((v) => v !== 999);
          return starts.length ? Math.min(...starts) : 1;
        })();
        const boundedEndGw = currentGw;

        // NOTE: PostgREST commonly caps responses to ~1000 rows unless paged correctly.
        // Using PAGE_SIZE=1000 ensures our loop continues until all rows are fetched.
        const PAGE_SIZE = 1000;
        const allMemberPicks: Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }> = [];
        if (allMemberIds.length > 0) {
          let from = 0;
          while (true) {
            const to = from + PAGE_SIZE - 1;
            const pageResult = await supabase
              .from("app_picks")
              .select("user_id, gw, fixture_index, pick")
              .in("user_id", allMemberIds)
              .gte("gw", boundedStartGw)
              .lte("gw", boundedEndGw)
              .order("gw", { ascending: true })
              .order("fixture_index", { ascending: true })
              .order("user_id", { ascending: true })
              .range(from, to);

            if (pageResult.error) {
              console.warn('[initialDataLoader] Failed to page app_picks for ML prewarm', pageResult.error);
              break;
            }
            const page = (pageResult.data ?? []) as Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }>;
            if (page.length === 0) break;
            allMemberPicks.push(...page);
            if (page.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
          }
        }

        // Index picks by user for efficient per-league aggregation
        const picksByUserId = new Map<string, Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }>>();
        allMemberPicks.forEach((p) => {
          const arr = picksByUserId.get(p.user_id) ?? [];
          arr.push(p);
          picksByUserId.set(p.user_id, arr);
        });

        // Build picksResults (ALL GWs) for league processing
        const picksResults = leagues.map((league) => {
          const memberIds = (membersByLeague[league.id] ?? []).map((m) => m.id);
          const picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }> = [];
          memberIds.forEach((id) => {
            const userPicks = picksByUserId.get(id);
            if (userPicks?.length) picks.push(...userPicks);
          });
          return { leagueId: league.id, picks };
        });
        
        // Process outcomes
        const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
        (resultsResult.data ?? []).forEach((r: any) => {
          const out = r.result === "H" || r.result === "D" || r.result === "A" ? r.result : null;
          if (out) outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
        });
        
        const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
        if (currentGw && !gwsWithResults.includes(currentGw)) {
          const currentGwResults = (resultsResult.data ?? []).filter((r: any) => r.gw === currentGw);
          if (currentGwResults.length > 0) {
            gwsWithResults.push(currentGw);
            gwsWithResults.sort((a, b) => a - b);
          }
        }
        
        // Process picks
        const picksByLeague = new Map<string, Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }>>();
        picksResults.forEach(({ leagueId, picks }) => {
          picksByLeague.set(leagueId, picks);
        });
        
        // leagueStartGws already calculated above
        
        // Process league data (full logic from Home.tsx)
        const leagueDataMap: Record<string, any> = {};
        const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
        
        leagues.forEach(league => {
          const members = membersByLeague[league.id] ?? [];
          const memberIds = members.map(m => m.id);
          const submittedCount = memberIds.filter(id => submittedUserIds.has(id)).length;
          const totalCount = memberIds.length;
          
          submissionStatus[league.id] = {
            allSubmitted: submittedCount === totalCount && totalCount > 0,
            submittedCount,
            totalCount
          };
          
          if (outcomeByGwIdx.size === 0) {
            const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
            leagueDataMap[league.id] = {
              id: league.id,
              members: sortedMembers,
              userPosition: null,
              positionChange: null,
              submittedMembers: Array.from(memberIds.filter(id => submittedUserIds.has(id))),
              sortedMemberIds: sortedMembers.map(m => m.id),
              latestGwWinners: [],
              latestRelevantGw: null,
              webUserIds: Array.from(memberIds.filter(id => webUserIds.has(id)))
            };
            // Cache empty mltRows for instant loading (no results yet)
            const emptyMltRows = sortedMembers.map((m) => ({
              user_id: m.id,
              name: m.name,
              mltPts: 0,
              ocp: 0,
              unicorns: 0,
              wins: 0,
              draws: 0,
              form: [] as ("W" | "D" | "L")[],
            }));
          const cacheKey = `league:mltRows:${league.id}`;
          setCached(cacheKey, emptyMltRows, CACHE_TTL.LEAGUES);
            log.debug('preload/mlt_rows_cached', { 
              leagueId: league.id.slice(0, 8), 
              leagueName: league.name,
              cacheKey, 
              rowsCount: emptyMltRows.length,
              note: 'empty (no results yet)'
            });
            return;
          }
          
          const leagueStartGw = leagueStartGws.get(league.id) ?? currentGw;
          const currentGwFinished = gwsWithResults.includes(currentGw);
          const allRelevantGws = leagueStartGw === 0 
            ? gwsWithResults 
            : gwsWithResults.filter(g => g >= leagueStartGw);
          const relevantGws = currentGwFinished && !allRelevantGws.includes(currentGw)
            ? [...allRelevantGws, currentGw].sort((a, b) => a - b)
            : allRelevantGws;
          
          if (relevantGws.length === 0) {
            const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
            leagueDataMap[league.id] = {
              id: league.id,
              members: sortedMembers,
              userPosition: null,
              positionChange: null,
              submittedMembers: Array.from(memberIds.filter(id => submittedUserIds.has(id))),
              sortedMemberIds: sortedMembers.map(m => m.id),
              latestGwWinners: [],
              latestRelevantGw: null,
              webUserIds: Array.from(memberIds.filter(id => webUserIds.has(id)))
            };
            // Cache empty mltRows for instant loading (no relevant GWs yet)
            const emptyMltRows = sortedMembers.map((m) => ({
              user_id: m.id,
              name: m.name,
              mltPts: 0,
              ocp: 0,
              unicorns: 0,
              wins: 0,
              draws: 0,
              form: [] as ("W" | "D" | "L")[],
            }));
            const cacheKey = `league:mltRows:${league.id}`;
            setCached(cacheKey, emptyMltRows, CACHE_TTL.LEAGUES);
            log.debug('preload/mlt_rows_cached', { 
              leagueId: league.id.slice(0, 8), 
              leagueName: league.name,
              cacheKey, 
              rowsCount: emptyMltRows.length,
              note: 'empty (no relevant GWs)'
            });
            return;
          }
          
          const allPicks = picksByLeague.get(league.id) ?? [];
          const relevantGwsSet = new Set(relevantGws);
          const picksAll = allPicks.filter(p => relevantGwsSet.has(p.gw));
          
          const outcomeByGwAndIdx = new Map<number, Map<number, "H" | "D" | "A">>();
          relevantGws.forEach((g) => {
            outcomeByGwAndIdx.set(g, new Map<number, "H" | "D" | "A">());
          });
          outcomeByGwIdx.forEach((out: "H" | "D" | "A", key: string) => {
            const [gwStr, idxStr] = key.split(":");
            const g = parseInt(gwStr, 10);
            const idx = parseInt(idxStr, 10);
            if (relevantGwsSet.has(g)) {
              outcomeByGwAndIdx.get(g)?.set(idx, out);
            }
          });
          
          const perGw = new Map<number, Map<string, { user_id: string; score: number; unicorns: number }>>();
          const gwWinners = new Map<number, Set<string>>();
          
          relevantGws.forEach((g) => {
            const map = new Map<string, { user_id: string; score: number; unicorns: number }>();
            members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
            perGw.set(g, map);
          });
          
          const picksByGwIdx = new Map<string, Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }>>();
          picksAll.forEach((p) => {
            const key = `${p.gw}:${p.fixture_index}`;
            const arr = picksByGwIdx.get(key) ?? [];
            arr.push(p);
            picksByGwIdx.set(key, arr);
          });
          
          const memberIdsSet = new Set(members.map(m => m.id));
          
          relevantGws.forEach((g) => {
            const gwOutcomes = outcomeByGwAndIdx.get(g)!;
            const map = perGw.get(g)!;
            
            gwOutcomes.forEach((out: "H" | "D" | "A", idx: number) => {
              const key = `${g}:${idx}`;
              const thesePicks = (picksByGwIdx.get(key) ?? []).filter((p) => memberIdsSet.has(p.user_id));
              const correctUsers: string[] = [];
              
              thesePicks.forEach((p) => {
                if (p.pick === out) {
                  const row = map.get(p.user_id);
                  if (row) {
                    row.score += 1;
                    correctUsers.push(p.user_id);
                  }
                }
              });
              
              if (correctUsers.length === 1 && members.length >= 3) {
                const row = map.get(correctUsers[0]);
                if (row) row.unicorns += 1;
              }
            });
          });
          
          const mltPts = new Map<string, number>();
          const ocp = new Map<string, number>();
          const unis = new Map<string, number>();
          members.forEach((m) => {
            mltPts.set(m.id, 0);
            ocp.set(m.id, 0);
            unis.set(m.id, 0);
          });
          
          relevantGws.forEach((g) => {
            const gwRows: Array<{ user_id: string; score: number; unicorns: number }> = Array.from(perGw.get(g)!.values());
            gwRows.forEach((r) => {
              ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
              unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
            });
            
            gwRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
            if (gwRows.length === 0) return;
            
            const top = gwRows[0];
            const coTop = gwRows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
            const winners = new Set(coTop.map((r) => r.user_id));
            gwWinners.set(g, winners);
            
            if (coTop.length === 1) {
              mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
            } else {
              coTop.forEach((r) => {
                mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
              });
            }
          });
          
          const mltRows = members.map((m) => ({
            user_id: m.id,
            name: m.name,
            mltPts: mltPts.get(m.id) ?? 0,
            unicorns: unis.get(m.id) ?? 0,
            ocp: ocp.get(m.id) ?? 0,
          }));
          
          const sortedMltRows = [...mltRows].sort((a, b) => 
            b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
          );
          
          // Cache mltRows separately for instant loading on League page
          // Add wins, draws, and form (empty for now - will be calculated on League page if needed)
          const mltRowsWithForm = sortedMltRows.map((r) => ({
            ...r,
            wins: 0,
            draws: 0,
            form: [] as ("W" | "D" | "L")[],
          }));
          const cacheKey = `league:mltRows:${league.id}`;
          setCached(cacheKey, mltRowsWithForm, CACHE_TTL.LEAGUES);
          log.debug('preload/mlt_rows_cached', { 
            leagueId: league.id.slice(0, 8), 
            leagueName: league.name,
            cacheKey, 
            rowsCount: mltRowsWithForm.length 
          });
          
          const sortedMemberIds = sortedMltRows.map(r => r.user_id);
          const userIndex = sortedMltRows.findIndex(r => r.user_id === userId);
          const userPosition = userIndex !== -1 ? userIndex + 1 : null;
          
          const latestRelevantGw = relevantGws.length ? Math.max(...relevantGws) : null;
          const latestGwWinners = latestRelevantGw !== null ? (gwWinners.get(latestRelevantGw) ?? new Set<string>()) : new Set<string>();
          const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
          
          const leagueWebUserIds = Array.from(memberIds.filter(id => webUserIds.has(id)));
          
          leagueDataMap[league.id] = {
            id: league.id,
            members: sortedMembers,
            userPosition,
            positionChange: null,
            submittedMembers: Array.from(memberIds.filter(id => submittedUserIds.has(id))),
            sortedMemberIds,
            latestGwWinners: Array.from(latestGwWinners),
            latestRelevantGw,
            webUserIds: leagueWebUserIds
          };
        });
        
        // Cache the processed data (same format as Home.tsx)
        const cacheableLeagueData: Record<string, any> = {};
        for (const [leagueId, data] of Object.entries(leagueDataMap)) {
          cacheableLeagueData[leagueId] = {
            ...data,
            submittedMembers: data.submittedMembers ? (data.submittedMembers instanceof Set ? Array.from(data.submittedMembers) : data.submittedMembers) : undefined,
            latestGwWinners: data.latestGwWinners ? (data.latestGwWinners instanceof Set ? Array.from(data.latestGwWinners) : data.latestGwWinners) : undefined,
            webUserIds: data.webUserIds ? (data.webUserIds instanceof Set ? Array.from(data.webUserIds) : data.webUserIds) : undefined,
          };
        }
        
          setCached(leagueDataCacheKey, {
            leagueData: cacheableLeagueData,
            leagueSubmissions: submissionStatus,
          }, CACHE_TTL.HOME);
          
          log.debug('preload/league_data_complete', { userId: userId.slice(0, 8), gw: currentGw, leagueCount: Object.keys(leagueDataMap).length });
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // PRE-CACHE ML LIVE TABLE DATA for MiniLeagueGwTableCard
        // ═══════════════════════════════════════════════════════════════════════
        // MiniLeagueGwTableCard needs fixtures, picks, submissions, results for currentGw
        // Pre-cache these so cards load instantly without individual fetches
        // ═══════════════════════════════════════════════════════════════════════
        try {
          // Fetch fixtures for currentGw (for ML live tables)
          const { data: mlFixtures, error: mlFixturesError } = await supabase
            .from('app_fixtures')
            .select('id, gw, fixture_index, home_name, away_name, home_team, away_team, home_code, away_code, kickoff_time, api_match_id')
            .eq('gw', currentGw)
            .order('fixture_index', { ascending: true });
          
          if (!mlFixturesError && mlFixtures) {
            // Fetch results for currentGw
            const { data: mlResults } = await supabase
              .from('app_gw_results')
              .select('gw, fixture_index, result')
              .eq('gw', currentGw);
            
            // If picksByLeague is empty, we need to fetch picks (happens when league data was cached)
            if (picksByLeague.size === 0) {
              const picksPromises = leagues.map(async (league) => {
                const memberIds = (membersByLeague[league.id] ?? []).map(m => m.id);
                if (memberIds.length === 0) return { leagueId: league.id, picks: [] };
                const { data } = await supabase
                  .from("app_picks")
                  .select("user_id, gw, fixture_index, pick")
                  .eq("gw", currentGw)
                  .in("user_id", memberIds);
                return { leagueId: league.id, picks: (data ?? []) as Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }> };
              });
              const picksResults = await Promise.all(picksPromises);
              picksResults.forEach(({ leagueId, picks }) => {
                picksByLeague.set(leagueId, picks);
              });
            }
            
            // If submittedUserIds is empty, fetch submissions
            if (submittedUserIds.size === 0) {
              const { data: submissionsData, error: submissionsError } = await supabase
                .from('app_gw_submissions')
                .select('user_id')
                .eq('gw', currentGw)
                .not('submitted_at', 'is', null);
              
              if (submissionsError) {
                log.warn('preload/ml_live_table_submissions_error', { 
                  userId: userId.slice(0, 8), 
                  gw: currentGw, 
                  error: submissionsError.message 
                });
              }
              
              const allMemberIds = new Set(Object.values(membersByLeague).flat().map(m => m.id));
              submittedUserIds = new Set((submissionsData ?? []).map((s: any) => s.user_id).filter((id: string) => allMemberIds.has(id)));
              
              log.debug('preload/ml_live_table_submissions_fetched', { 
                userId: userId.slice(0, 8), 
                gw: currentGw, 
                totalSubmissions: submissionsData?.length || 0,
                filteredSubmissions: submittedUserIds.size,
                allMemberIdsCount: allMemberIds.size
              });
            }
            
            // Cache ML live table data per league (fixtures, picks, submissions, results)
            for (const league of leagues) {
              const memberIds = (membersByLeague[league.id] ?? []).map(m => m.id);
              if (memberIds.length === 0) continue;
              
              // Get picks for this league's members for currentGw
              const leaguePicks = (picksByLeague.get(league.id) ?? []).filter(p => p.gw === currentGw);
              
              // Get submissions for this league's members for currentGw
              const leagueSubmissions = Array.from(submittedUserIds).filter(id => memberIds.includes(id));
              
              // Cache per league so MiniLeagueGwTableCard can load instantly
              const mlTableCacheKey = `ml_live_table:${league.id}:${currentGw}`;
              setCached(mlTableCacheKey, {
                fixtures: mlFixtures,
                picks: leaguePicks,
                submissions: leagueSubmissions,
                results: mlResults ?? [],
              }, CACHE_TTL.HOME);
              
              // Log cache creation for debugging
              log.debug('preload/ml_live_table_cache_created', { 
                userId: userId.slice(0, 8), 
                gw: currentGw, 
                leagueId: league.id.slice(0, 8),
                fixturesCount: mlFixtures.length,
                picksCount: leaguePicks.length,
                submissionsCount: leagueSubmissions.length,
                resultsCount: (mlResults ?? []).length,
                memberIdsCount: memberIds.length
              });
            }
            
            // Summary log - keep as debug to reduce console noise
            log.debug('preload/ml_live_table_data_cached', { 
              userId: userId.slice(0, 8), 
              gw: currentGw, 
              leagueCount: leagues.length,
              fixturesCount: mlFixtures.length 
            });
          }
          
          // Also pre-cache for last completed GW (in case displayGw is different)
          if (latestGw && latestGw !== currentGw) {
            const { data: lastGwFixtures } = await supabase
              .from('app_fixtures')
              .select('id, gw, fixture_index, home_name, away_name, home_team, away_team, home_code, away_code, kickoff_time, api_match_id')
              .eq('gw', latestGw)
              .order('fixture_index', { ascending: true });
            
            if (lastGwFixtures) {
              const { data: lastGwResults } = await supabase
                .from('app_gw_results')
                .select('gw, fixture_index, result')
                .eq('gw', latestGw);
              
              // Fetch picks for last completed GW
              const lastGwPicksPromises = leagues.map(async (league) => {
                const memberIds = (membersByLeague[league.id] ?? []).map(m => m.id);
                if (memberIds.length === 0) return { leagueId: league.id, picks: [] };
                const { data } = await supabase
                  .from("app_picks")
                  .select("user_id, gw, fixture_index, pick")
                  .eq("gw", latestGw)
                  .in("user_id", memberIds);
                return { leagueId: league.id, picks: (data ?? []) as Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }> };
              });
              const lastGwPicksResults = await Promise.all(lastGwPicksPromises);
              
              // Fetch submissions for last completed GW
              const { data: lastGwSubmissionsData } = await supabase
                .from('app_gw_submissions')
                .select('user_id')
                .eq('gw', latestGw);
              
              const lastGwSubmittedUserIds = new Set((lastGwSubmissionsData ?? []).map((s: any) => s.user_id));
              
              // Cache per league for last completed GW
              for (const league of leagues) {
                const memberIds = (membersByLeague[league.id] ?? []).map(m => m.id);
                if (memberIds.length === 0) continue;
                
                const lastGwPicks = lastGwPicksResults.find(r => r.leagueId === league.id)?.picks ?? [];
                const lastGwSubmissions = Array.from(lastGwSubmittedUserIds).filter(id => memberIds.includes(id));
                
                const mlTableCacheKey = `ml_live_table:${league.id}:${latestGw}`;
                setCached(mlTableCacheKey, {
                  fixtures: lastGwFixtures,
                  picks: lastGwPicks,
                  submissions: lastGwSubmissions,
                  results: lastGwResults ?? [],
                }, CACHE_TTL.HOME);
              }
            }
          }
        } catch (mlError) {
          console.warn('[Pre-loading] Failed to pre-cache ML live table data:', mlError);
          // Non-critical - cards will fetch their own data
        }
      } catch (error) {
        console.warn('[Pre-loading] Failed to pre-load league data:', error);
        // Non-critical - Home.tsx will fetch it when needed
      }
    })().catch(err => {
      console.warn('[Pre-loading] Background league data load failed:', err);
    });
  }
  
  // Ensure ML live table data is cached before returning (critical for instant load)
  // This is already handled above, but we wait for it here to ensure completion
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: PRE-WARM TABLES PAGE CACHE (non-blocking)
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

  // Process user picks (userPicks already created above from picksForGw.data)
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

  // CRITICAL: Cache fixtures for the GW the user is VIEWING (not necessarily currentGw)
  // This ensures HomePage loads the correct GW immediately
  const gwToCache = viewingGw; // Use viewing GW, not current GW
  const fixturesCacheKey = `home:fixtures:${userId}:${gwToCache}`;
  
  // If viewing GW is different from current GW, we need to fetch fixtures/picks for viewing GW
  let fixturesToCache = fixturesForGw.data || [];
  let picksToCache = userPicks;
  let liveScoresToCache: any[] | undefined = liveScoresArray && liveScoresArray.length > 0 ? liveScoresArray : undefined;
  
  if (viewingGw !== currentGw) {
    // Fetch fixtures, picks, live scores, and results for viewing GW
    const [viewingGwFixturesResult, viewingGwPicksResult, viewingGwLiveScoresResult, viewingGwResultsResult] = await Promise.all([
      supabase
        .from('app_fixtures')
        .select('*')
        .eq('gw', viewingGw)
        .order('fixture_index', { ascending: true }),
      supabase
        .from('app_picks')
        .select('fixture_index, pick')
        .eq('user_id', userId)
        .eq('gw', viewingGw),
      supabase
        .from('live_scores')
        .select('*')
        .eq('gw', viewingGw),
      supabase
        .from('app_gw_results')
        .select('fixture_index, result')
        .eq('gw', viewingGw),
    ]);
    
    if (viewingGwFixturesResult.data) {
      fixturesToCache = viewingGwFixturesResult.data;
    }
    
    if (viewingGwPicksResult.data) {
      picksToCache = {};
      viewingGwPicksResult.data.forEach((p: any) => {
        picksToCache[p.fixture_index] = p.pick;
      });
    }
    
    if (viewingGwLiveScoresResult.data) {
      liveScoresToCache = viewingGwLiveScoresResult.data;
    }
    
    // Cache results for viewing GW
    if (viewingGwResultsResult.data) {
      const resultsArray: Array<{ fixture_index: number; result: "H" | "D" | "A" }> = [];
      viewingGwResultsResult.data.forEach((r: any) => {
        if (r.result === "H" || r.result === "D" || r.result === "A") {
          resultsArray.push({ fixture_index: r.fixture_index, result: r.result });
        }
      });
      setCached(`home:gwResults:${viewingGw}`, resultsArray, CACHE_TTL.HOME);
    }
  }
  
  const existingCache = getCached<{
    fixtures: any[];
    userPicks: Record<number, "H" | "D" | "A">;
    liveScores?: Array<any>;
  }>(fixturesCacheKey);
  
  // Prefer fresh liveScoresArray if available, otherwise use existing cache
  if (!liveScoresToCache || liveScoresToCache.length === 0) {
    liveScoresToCache = existingCache?.liveScores || undefined;
  }
  
  setCached(fixturesCacheKey, {
    fixtures: fixturesToCache,
    userPicks: picksToCache,
    liveScores: (liveScoresToCache && liveScoresToCache.length > 0) ? liveScoresToCache : undefined,
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

  // Preload chat messages and member names for all leagues (NON-BLOCKING - runs in background)
  // This ensures chat loads instantly when user navigates to league page
  if (leagueIds.length > 0) {
    (async () => {
      try {
        log.debug('preload/chat_messages_start', { userId: userId.slice(0, 8), leagueCount: leagueIds.length });
        
        // Pre-load member names for all leagues (needed for chat to render)
        const memberNamesPromises = leagueIds.map(async (leagueId) => {
          try {
            const { data: members, error } = await supabase
              .from('league_members')
              .select('user_id, users(id, name)')
              .eq('league_id', leagueId);
            
            if (error) {
              console.warn(`[Pre-loading] Failed to preload member names for league ${leagueId}:`, error);
              return null;
            }
            
            if (members) {
              const memberMap = new Map<string, string>();
              members.forEach((m: any) => {
                if (m.users?.id && m.users?.name) {
                  memberMap.set(m.users.id, m.users.name);
                }
              });
              // Cache member names for this league
              setCached(`league:members:${leagueId}`, Array.from(memberMap.entries()), CACHE_TTL.HOME);
            }
            return true;
          } catch (err) {
            console.warn(`[Pre-loading] Error preloading member names for league ${leagueId}:`, err);
            return null;
          }
        });
        
        // Fetch messages for all leagues in parallel
        const messagePromises = leagueIds.map(async (leagueId) => {
          try {
            // Fetch first page of messages (50 most recent)
            const { data: messages, error } = await supabase
              .from('league_messages')
              .select(`
                id, 
                league_id, 
                user_id, 
                content, 
                created_at,
                reply_to_message_id
              `)
              .eq('league_id', leagueId)
              .order('created_at', { ascending: false })
              .limit(50);

            if (error) {
              console.warn(`[Pre-loading] Failed to preload chat messages for league ${leagueId}:`, error);
              return null;
            }

            if (messages && messages.length > 0) {
              // Fetch reply data for messages that have reply_to_message_id
              const messagesWithReply = messages.filter((msg: any) => msg.reply_to_message_id);
              const replyMessageIds = [...new Set(messagesWithReply.map((msg: any) => msg.reply_to_message_id))];
              
              let replyDataMap = new Map<string, any>();
              if (replyMessageIds.length > 0) {
                const { data: replyMessages } = await supabase
                  .from('league_messages')
                  .select('id, content, user_id')
                  .in('id', replyMessageIds);
                
                if (replyMessages) {
                  replyMessages.forEach((msg: any) => {
                    replyDataMap.set(msg.id, msg);
                  });
                }
              }

              // Enrich messages with reply data
              const enrichedMessages = messages.map((msg: any) => {
                if (msg.reply_to_message_id && replyDataMap.has(msg.reply_to_message_id)) {
                  const replyMsg = replyDataMap.get(msg.reply_to_message_id);
                  return {
                    ...msg,
                    reply_to: {
                      id: replyMsg.id,
                      content: replyMsg.content,
                      user_id: replyMsg.user_id,
                    },
                  };
                }
                return msg;
              });

              // Reverse to match hook's behavior (hook fetches newest first, then reverses)
              // This ensures messages are in oldest-to-newest order (newest at end, scroll to bottom)
              const reversedMessages = enrichedMessages.reverse();

              // Cache messages for this league (oldest to newest, newest at end)
              setCached(`chat:messages:${leagueId}`, reversedMessages, CACHE_TTL.HOME);
            }
            
            return messages?.length || 0;
          } catch (err) {
            console.warn(`[Pre-loading] Error preloading chat for league ${leagueId}:`, err);
            return null;
          }
        });

        // Wait for both member names and messages to complete
        const [, messageResults] = await Promise.all([
          Promise.all(memberNamesPromises),
          Promise.all(messagePromises)
        ]);
        const totalMessages = messageResults.reduce((sum, count) => (sum || 0) + (count || 0), 0);
        log.debug('preload/chat_messages_complete', { 
          userId: userId.slice(0, 8), 
          leagueCount: leagueIds.length,
          totalMessages 
        });
      } catch (error) {
        // Silent fail - chat will load normally if preload fails
        console.warn('[Pre-loading] Failed to preload chat messages:', error);
      }
    })();
  }

  // Preload Predictions page data (BLOCKING - ensures zero loading in Predictions page)
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
        }, CACHE_TTL.PREDICTIONS);

        console.log('[Pre-loading] Predictions page data cached:', { 
          fixturesCount: fixturesData.length, 
          picksCount: picksArray.length,
          submitted: !!testSubmission?.submitted_at 
        });
      }
    }
  } catch (error) {
    // Silent fail for Predictions preload - non-critical, but log for debugging
    console.warn('[Pre-loading] Failed to preload Predictions data:', error);
  }

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


