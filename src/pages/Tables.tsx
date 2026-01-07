import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { MiniLeagueCard } from "../components/MiniLeagueCard";
import type { LeagueRow, LeagueData } from "../components/MiniLeagueCard";
import { getDeterministicLeagueAvatar } from "../lib/leagueAvatars";
import { resolveLeagueStartGw } from "../lib/leagueStart";
import { getCached, setCached, getCacheTimestamp, CACHE_TTL, invalidateUserCache } from "../lib/cache";
import { useLeagues } from "../hooks/useLeagues";
import { useCurrentGameweek } from "../hooks/useCurrentGameweek";
import { PageHeader } from "../components/PageHeader";
import { fetchUserLeagues } from "../services/userLeagues";
import CreateJoinTray from "../components/CreateJoinTray";

/**
 * Tables.tsx - Mini Leagues Page
 * 
 * IMPORTANT: This page uses the useLeagues hook for leagues and unread counts (single source of truth).
 * It still fetches member data separately via Supabase for member counts and league data calculations.
 * 
 * Data flow:
 * - Leagues: useLeagues hook (sorted by unread count, API Test filtered out)
 * - Unread counts: useLeagues hook
 * - Member counts: Fetched separately from league_members
 * - League data (positions, winners): Calculated from picks data
 */

type LeagueMember = { id: string; name: string };
type ResultRowRaw = {
  gw: number;
  fixture_index: number;
  result?: "H" | "D" | "A" | null;
};
type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  return null;
}

export default function TablesPage() {
  const { user } = useAuth();
  // Use centralized hook for current gameweek (single source of truth)
  const { currentGw: dbCurrentGwFromHook } = useCurrentGameweek();
  
  // LEAGUES: Use centralized useLeagues hook (single source of truth)
  // This provides leagues already sorted by unread count, filtered (no API Test)
  const { 
    leagues, 
    unreadByLeague, 
    loading: leaguesLoading,
    invalidateAndRefresh: refreshLeagues
  } = useLeagues({ pageName: 'tables' });
  
  // Load additional Tables-specific data from cache (member counts, league data, submissions)
  const loadInitialStateFromCache = () => {
    let userId: string | undefined = user?.id;
    if (!userId && typeof window !== 'undefined') {
      try {
        const userStr = localStorage.getItem('totl:user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          userId = userObj.id;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (typeof window === 'undefined' || !userId) {
      return {
        memberCounts: {} as Record<string, number>,
        leagueDataLoading: true,
        currentGw: null,
        leagueSubmissions: {} as Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>,
        leagueData: {} as Record<string, LeagueData>,
        hasCache: false,
      };
    }
    
    try {
      const cacheKey = `tables:${userId}`;
      const cached = getCached<{
        rows: LeagueRow[];
        currentGw: number | null;
        leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
        leagueData: Record<string, LeagueData>;
        memberCounts?: Record<string, number>;
      }>(cacheKey);
      
      // Check cache freshness synchronously
      const cacheTimestamp = getCacheTimestamp(cacheKey);
      const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
      const isCacheStale = cacheAge > CACHE_TTL.TABLES;
      
      if (cached && !isCacheStale) {
        // Cache is fresh - use it immediately
        // Extract member counts from cached rows
        const memberCounts: Record<string, number> = cached.memberCounts || {};
        if (cached.rows && Array.isArray(cached.rows)) {
          cached.rows.forEach(row => {
            if (row.memberCount !== undefined) {
              memberCounts[row.id] = row.memberCount;
            }
          });
        }
        
        // Convert arrays back to Sets for submittedMembers and latestGwWinners
        // Restore sortedMemberIds from cache - it will be recalculated if stale but used for instant display
        const restoredLeagueData: Record<string, LeagueData> = {};
        let hasValidLeagueData = false;
        if (cached.leagueData && Object.keys(cached.leagueData).length > 0) {
          for (const [leagueId, data] of Object.entries(cached.leagueData)) {
            // Ensure members array exists and is properly formatted
            let members: LeagueMember[] = [];
            if (data.members && Array.isArray(data.members) && data.members.length > 0) {
              members = data.members.map((m: any) => ({
                id: typeof m === 'string' ? m : (m.id || ''),
                name: typeof m === 'string' ? `User ${m.slice(0, 8)}` : (m.name || `User ${(m.id || '').slice(0, 8)}`)
              })).filter((m: LeagueMember) => m.id); // Filter out any invalid entries
            }
            
            // Only restore if we have members - otherwise wait for fresh data
            if (members.length > 0) {
              restoredLeagueData[leagueId] = {
                ...data,
                members,
                submittedMembers: data.submittedMembers ? (Array.isArray(data.submittedMembers) ? new Set(data.submittedMembers) : new Set()) : undefined,
                latestGwWinners: data.latestGwWinners ? (Array.isArray(data.latestGwWinners) ? new Set(data.latestGwWinners) : new Set()) : undefined,
                // Restore sortedMemberIds from cache for instant chip display
                sortedMemberIds: data.sortedMemberIds && Array.isArray(data.sortedMemberIds) && data.sortedMemberIds.length > 0 ? data.sortedMemberIds : undefined,
              };
              hasValidLeagueData = true;
            }
          }
        }
        
        // Only consider cache valid if we have leagueData with members (chips need this)
        return {
          memberCounts,
          leagueDataLoading: !hasValidLeagueData, // If no valid leagueData, still need to load
          currentGw: cached.currentGw,
          leagueSubmissions: cached.leagueSubmissions || {},
          leagueData: restoredLeagueData,
          hasCache: hasValidLeagueData, // Only true if we have actual leagueData
        };
      } else if (cached && isCacheStale) {
        // Cache exists but is stale - use it for instant render, refresh in background
        const memberCounts: Record<string, number> = cached.memberCounts || {};
        if (cached.rows && Array.isArray(cached.rows)) {
          cached.rows.forEach(row => {
            if (row.memberCount !== undefined) {
              memberCounts[row.id] = row.memberCount;
            }
          });
        }
        
        const restoredLeagueData: Record<string, LeagueData> = {};
        if (cached.leagueData) {
          for (const [leagueId, data] of Object.entries(cached.leagueData)) {
            // Ensure members array exists and is properly formatted
            let members: LeagueMember[] = [];
            if (data.members && Array.isArray(data.members) && data.members.length > 0) {
              members = data.members.map((m: any) => ({
                id: typeof m === 'string' ? m : (m.id || ''),
                name: typeof m === 'string' ? `User ${m.slice(0, 8)}` : (m.name || `User ${(m.id || '').slice(0, 8)}`)
              })).filter((m: LeagueMember) => m.id); // Filter out any invalid entries
            }
            
            // Only restore if we have members - otherwise wait for fresh data
            if (members.length > 0) {
              restoredLeagueData[leagueId] = {
                ...data,
                members,
                submittedMembers: data.submittedMembers ? (Array.isArray(data.submittedMembers) ? new Set(data.submittedMembers) : new Set()) : undefined,
                latestGwWinners: data.latestGwWinners ? (Array.isArray(data.latestGwWinners) ? new Set(data.latestGwWinners) : new Set()) : undefined,
                // Restore sortedMemberIds from cache for instant chip display
                sortedMemberIds: data.sortedMemberIds && Array.isArray(data.sortedMemberIds) && data.sortedMemberIds.length > 0 ? data.sortedMemberIds : undefined,
              };
            }
          }
        }
        
        return {
          memberCounts,
          leagueDataLoading: false, // Render immediately from stale cache
          currentGw: cached.currentGw,
          leagueSubmissions: cached.leagueSubmissions || {},
          leagueData: restoredLeagueData,
          hasCache: true,
        };
      }
    } catch (error) {
      // Error loading from cache (non-critical)
    }
    
    return {
      memberCounts: {} as Record<string, number>,
      leagueDataLoading: true,
      currentGw: null,
      leagueSubmissions: {} as Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>,
      leagueData: {} as Record<string, LeagueData>,
      hasCache: false,
    };
  };
  
  const initialState = loadInitialStateFromCache();
  
  // Member counts are fetched separately since useLeagues doesn't provide them
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>(initialState.memberCounts);
  const [leagueDataLoading, setLeagueDataLoading] = useState(initialState.leagueDataLoading);
  const [hasCache, setHasCache] = useState(initialState.hasCache);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [isCreateJoinTrayOpen, setIsCreateJoinTrayOpen] = useState(false);
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>(initialState.leagueSubmissions);
  const [leagueData, setLeagueData] = useState<Record<string, LeagueData>>(initialState.leagueData);
  const [currentGw, setCurrentGw] = useState<number | null>(initialState.currentGw);
  
  // Store base data for reactive recalculation
  const [baseResults, setBaseResults] = useState<ResultRowRaw[]>([]);
  const [allFixturesData, setAllFixturesData] = useState<Array<{ gw: number; kickoff_time: string }>>([]);
  const [picksData, setPicksData] = useState<Map<string, PickRow[]>>(new Map());
  const [membersByLeagueId, setMembersByLeagueId] = useState<Map<string, LeagueMember[]>>(new Map());
  const [leagueStartGwMap, setLeagueStartGwMap] = useState<Map<string, number>>(new Map());
  const [submittedUserIdsSet, setSubmittedUserIdsSet] = useState<Set<string>>(new Set());
  
  // Build rows from leagues (from hook) + member counts (fetched separately)
  // Sort by created_at to match database order (same as Home page)
  const rows: LeagueRow[] = useMemo(() => {
    const rowsUnsorted = leagues.map(league => ({
      id: league.id,
      name: league.name,
      code: league.code,
      avatar: league.avatar ?? getDeterministicLeagueAvatar(league.id),
      created_at: league.created_at,
      start_gw: league.start_gw,
      memberCount: memberCounts[league.id] ?? 0,
    }));
    
    // Sort by created_at to match the order in the leagues table (same as Home page)
    return rowsUnsorted.sort((a, b) => {
      if (!a.created_at || !b.created_at) return 0;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [leagues, memberCounts]);
  
  // Check if data is ready for rendering
  // If we have cache data loaded synchronously, we're ready immediately (even before leagues load from hook)
  const isDataReady = useMemo(() => {
    // If we have cache data loaded synchronously, render immediately (don't wait for leaguesLoading)
    if (hasCache && !leagueDataLoading && Object.keys(leagueData).length > 0) {
      return true;
    }
    
    // Otherwise, wait for leagues to load
    if (leaguesLoading) return false;
    
    // Must have league data loaded (for non-cached scenario)
    if (leagueDataLoading) return false;
    
    // If we have leagues, check that leagueData is complete for leagues with members
    if (leagues.length > 0) {
      const leaguesWithMembers = leagues.filter(l => (memberCounts[l.id] ?? 0) > 0);
      if (leaguesWithMembers.length > 0) {
        // All leagues with members must have leagueData with members array (chips can render without sortedMemberIds)
        const allHaveData = leaguesWithMembers.every(league => {
          const data = leagueData[league.id];
          return data && 
                 data.members && 
                 data.members.length > 0;
        });
        if (!allHaveData) return false;
      }
    }
    
    return true;
  }, [leaguesLoading, leagueDataLoading, leagues, memberCounts, leagueData, hasCache]);

  // Fetch member data and other Tables-specific data
  // NOTE: Leagues and unread counts come from useLeagues hook
  // This effect only fetches member counts, submissions, league data calculations
  useEffect(() => {
    if (!user?.id) {
      setLeagueDataLoading(false);
      return;
    }
    
    // Wait for leagues to load from hook
    if (leaguesLoading) return;
    
    // Get league IDs from hook (already filtered and sorted)
    const leagueIds = leagues.map(l => l.id);
    if (!leagueIds.length) {
      setLeagueDataLoading(false);
      return;
    }
    
    let alive = true;
    const cacheKey = `tables:${user.id}`;
    
    // Check cache freshness synchronously
    const cacheTimestamp = getCacheTimestamp(cacheKey);
    const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
    const isCacheStale = cacheAge > CACHE_TTL.TABLES;
    
    // If cache is fresh AND we have leagueData for all leagues, skip fetch entirely
    if (hasCache && !isCacheStale) {
      // Check if we have leagueData for all leagues with members
      const leaguesWithMembers = leagues.filter(l => (memberCounts[l.id] ?? 0) > 0);
      const allLeaguesHaveData = leaguesWithMembers.length === 0 || leaguesWithMembers.every(league => {
        const data = leagueData[league.id];
        return data && data.members && data.members.length > 0;
      });
      
      if (allLeaguesHaveData) {
        // Cache is fresh and complete - skip fetch
        return;
      }
      // Otherwise, fetch to fill in missing data
    }
    
    // Fetch member data and other Tables-specific data (cache miss or stale cache)
    // If cache is stale, render immediately from cache and refresh in background
    (async () => {
      try {
        // Step 1: Get current GW (use hook value, fallback to fixtures if hook not loaded)
        const fixturesResult = await supabase.from("app_fixtures").select("gw").order("gw", { ascending: false }).limit(1);
        
        if (!alive) return;

        const fixturesList = (fixturesResult.data as Array<{ gw: number }>) ?? [];
        const fetchedCurrentGw = fixturesList.length ? Math.max(...fixturesList.map((f) => f.gw)) : 1;
        // Use hook value if available, otherwise fallback to fixtures
        const dbCurrentGw = dbCurrentGwFromHook ?? (() => {
          const metaCache = getCached<{ current_gw: number }>('app_meta:current_gw');
          return metaCache?.current_gw ?? fetchedCurrentGw;
        })();
        
        // Get user's current_viewing_gw (which GW they're actually viewing)
        let userViewingGw: number | null = null;
        if (user?.id) {
          const { data: prefs } = await supabase
            .from("user_notification_preferences")
            .select("current_viewing_gw")
            .eq("user_id", user.id)
            .maybeSingle();
          
          // Use current_viewing_gw if set, otherwise default to currentGw - 1 (previous GW)
          // This ensures users stay on previous GW results when a new GW is published
          userViewingGw = prefs?.current_viewing_gw ?? (dbCurrentGw > 1 ? dbCurrentGw - 1 : dbCurrentGw);
        } else {
          // No user, use published GW
          userViewingGw = dbCurrentGw;
        }
        
        // Determine which GW to display
        // If user hasn't transitioned to new GW, show their viewing GW (previous GW)
        // Otherwise show the current GW
        // userViewingGw is guaranteed to be a number (set above), but TypeScript needs explicit check
        const gwToDisplay = userViewingGw !== null && userViewingGw < dbCurrentGw ? userViewingGw : dbCurrentGw;
        
        setCurrentGw(gwToDisplay);

        // Step 2: Fetch member data, results, fixtures, submissions
        // NOTE: We don't fetch leagues here - they come from useLeagues hook
        // NOTE: Leagues metadata (start_gw, created_at) now comes from useLeagues hook
        // No separate query to leagues table needed - RLS blocks direct access anyway
        const [
          memDataResult,
          allResultsResult,
          allFixturesResult,
          allMembersWithUsersResult
        ] = await Promise.all([
          supabase.from("league_members").select("league_id,user_id").in("league_id", leagueIds).limit(10000),
          supabase.from("app_gw_results").select("gw,fixture_index,result"),
          supabase.from("app_fixtures").select("gw,kickoff_time").order("gw", { ascending: true }).order("kickoff_time", { ascending: true }),
          supabase.from("league_members").select("league_id,user_id, users(id, name)").in("league_id", leagueIds).limit(10000)
        ]);
        
        if (memDataResult.error) throw memDataResult.error;
        if (allMembersWithUsersResult.error) {
          console.error('[Tables] Error fetching members with users:', allMembersWithUsersResult.error);
          throw allMembersWithUsersResult.error;
        }
        if (!alive) return;

        // Process members and build member counts
        const membersByLeague = new Map<string, string[]>();
        (memDataResult.data ?? []).forEach((r: any) => {
          const arr = membersByLeague.get(r.league_id) ?? [];
          arr.push(r.user_id);
          membersByLeague.set(r.league_id, arr);
        });
        
        // Update member counts
        const newMemberCounts: Record<string, number> = {};
        leagueIds.forEach(leagueId => {
          newMemberCounts[leagueId] = (membersByLeague.get(leagueId) ?? []).length;
        });
        setMemberCounts(newMemberCounts);

        // Optimize: use Set for faster lookups
        const allMemberIds = Array.from(new Set(Array.from(membersByLeague.values()).flat()));
        
        // Step 3: Fetch submissions for the VIEWING GW (not the published GW)
        // CRITICAL: Use gwToDisplay so chips show green for users who submitted for the GW they're viewing
        const [submissionsResult] = await Promise.all([
          allMemberIds.length > 0
            ? supabase.from("app_gw_submissions").select("user_id").eq("gw", gwToDisplay).in("user_id", allMemberIds).limit(10000)
            : Promise.resolve({ data: [], error: null }),
        ]);
        
        const submittedUserIds = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id));
        setSubmittedUserIdsSet(submittedUserIds);
        
        // Calculate submission status for each league
        const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
        for (const league of leagues) {
          const memberIds = membersByLeague.get(league.id) ?? [];
          const totalCount = memberIds.length;
          const submittedCount = memberIds.reduce((count, id) => count + (submittedUserIds.has(id) ? 1 : 0), 0);
          
          submissionStatus[league.id] = {
            allSubmitted: submittedCount === totalCount && totalCount > 0,
            submittedCount,
            totalCount
          };
        }
        setLeagueSubmissions(submissionStatus);

        if (!alive) return;

        // Store base data for reactive recalculation
        const resultList = (allResultsResult.data as ResultRowRaw[]) ?? [];
        setBaseResults(resultList);
        
        const allFixtures = allFixturesResult.data ?? [];
        setAllFixturesData(allFixtures as Array<{ gw: number; kickoff_time: string }>);
        
        // Calculate gwsWithResults FIRST (needed for league start GW calculation and picks fetching) - same as Home page
        const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
        for (const r of resultList) {
          const out = rowToOutcome(r);
          if (out) outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
        }
        const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
        
        // Build fixturesByGw map for league start GW calculation
        const fixturesByGw = new Map<number, string[]>();
        allFixtures.forEach((f: { gw: number; kickoff_time: string }) => {
          const arr = fixturesByGw.get(f.gw) ?? [];
          arr.push(f.kickoff_time);
          fixturesByGw.set(f.gw, arr);
        });
        
        // Process members with user names
        const membersByLeagueIdMap = new Map<string, LeagueMember[]>();
        const membersData = allMembersWithUsersResult.data ?? [];
        membersData.forEach((m: any) => {
          // Use name if available, otherwise fallback to user_id (shouldn't happen but defensive)
          const name = m.users?.name || `User ${m.user_id.slice(0, 8)}`;
          const arr = membersByLeagueIdMap.get(m.league_id) ?? [];
          arr.push({ id: m.user_id, name });
          membersByLeagueIdMap.set(m.league_id, arr);
        });
        setMembersByLeagueId(membersByLeagueIdMap);

        // Build leagues metadata map from useLeagues data (already has start_gw, created_at)
        const leaguesMetaMap = new Map<string, typeof leagues[0]>();
        leagues.forEach((l) => {
          leaguesMetaMap.set(l.id, l);
        });

        // Calculate start_gw for all leagues using EXACT same logic as League.tsx
        // Use resolveLeagueStartGw which queries fixtures table (same as League page)
        const leagueStartGwMap = new Map<string, number>();
        const leagueStartGwPromises = leagues.map(async (league) => {
          const leagueStartGw = await resolveLeagueStartGw(league, dbCurrentGw);
          return { leagueId: league.id, leagueStartGw };
        });
        const leagueStartGwResults = await Promise.all(leagueStartGwPromises);
        leagueStartGwResults.forEach(({ leagueId, leagueStartGw }) => {
          leagueStartGwMap.set(leagueId, leagueStartGw);
        });
        
        // Fetch picks in parallel for all leagues (same as Home page)
        // NOTE: Supabase default limit is 1000 rows - we use range() to get more if needed
        const picksPromises = leagues.map(async league => {
          const memberIds = membersByLeagueIdMap.get(league.id) ?? [];
          if (memberIds.length === 0) return { data: [], error: null };
          
          const leagueStartGw = leagueStartGwMap.get(league.id) ?? dbCurrentGw;
          const relevantGws = leagueStartGw === 0 
            ? gwsWithResults 
            : gwsWithResults.filter(gw => gw >= leagueStartGw);
          
          if (relevantGws.length === 0) return { data: [], error: null };
          
          // Fetch picks - Supabase defaults to 1000 rows max
          // Use pagination if we might exceed that limit
          const result = await supabase
            .from("app_picks")
            .select("user_id,gw,fixture_index,pick")
            .in("user_id", memberIds.map(m => m.id))
            .in("gw", relevantGws);
          
          if (result.error) {
            console.error(`[Tables] Error fetching picks for ${league.name}:`, result.error);
            return { data: [], error: result.error };
          }
          
          const picks = (result.data ?? []) as PickRow[];
          
          // Warn if we might have hit Supabase's 1000 row limit
          if (picks.length === 1000) {
            console.warn(`[Tables] WARNING: ${league.name} may have hit Supabase 1000 row limit! Got exactly 1000 picks.`);
          }
          
          return { data: picks, error: null };
        });

        const allPicksResults = await Promise.all(picksPromises);
        if (!alive) return;
        
        // Check for Supabase errors
        for (let i = 0; i < leagues.length; i++) {
          const result = allPicksResults[i];
          if (result.error) {
            console.error(`[Tables] Supabase error fetching picks:`, result.error);
          }
        }
        
        // Store picks data by league
        const picksDataMap = new Map<string, PickRow[]>();
        for (let i = 0; i < leagues.length; i++) {
          picksDataMap.set(leagues[i].id, (allPicksResults[i].data ?? []) as PickRow[]);
        }
        setPicksData(picksDataMap);
        
        // Store league start GW map
        setLeagueStartGwMap(leagueStartGwMap);

        const submittedUserIdsSet = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id));
        
        // Process league data
        const leagueDataMap: Record<string, LeagueData> = {};
        
        for (let i = 0; i < leagues.length; i++) {
          const league = leagues[i];
          let memberIds = membersByLeagueIdMap.get(league.id) ?? [];
          
          // Fallback: if membersByLeagueIdMap is empty but we have memberCounts, use member IDs from membersByLeague
          if (memberIds.length === 0) {
            const memberUserIds = membersByLeague.get(league.id) ?? [];
            if (memberUserIds.length > 0) {
              // Create minimal member objects from user IDs (fallback when users join fails)
              memberIds = memberUserIds.map(id => ({ id, name: `User ${id.slice(0, 8)}` }));
            }
          }
          
          if (memberIds.length === 0) continue;
          
          const leagueStartGw = leagueStartGwMap.get(league.id) ?? dbCurrentGw;
          const relevantGws = leagueStartGw === 0 
            ? gwsWithResults 
            : gwsWithResults.filter(gw => gw >= leagueStartGw);
          
          const picks = (allPicksResults[i].data ?? []) as PickRow[];
          
          // If no relevant GWs, create minimal leagueData entry (for new leagues with no picks yet)
          if (relevantGws.length === 0) {
            // Still create leagueData entry with empty sortedMemberIds to prevent loading hang
            leagueDataMap[league.id] = {
              id: league.id,
              members: memberIds,
              userPosition: null,
              positionChange: null,
              submittedMembers: submittedUserIdsSet,
              sortedMemberIds: memberIds.map(m => m.id), // Use member order as fallback
              latestGwWinners: [],
              latestRelevantGw: null
            };
            continue;
          }
          
          // CRITICAL: Filter picks to ONLY include relevant GWs for this league
          // This ensures we only count points from GWs that matter for THIS mini-league
          const relevantGwsSet = new Set(relevantGws);
          const filteredPicks = picks.filter((p: PickRow) => relevantGwsSet.has(p.gw));
          
          const picksByUserGw = new Map<string, Map<number, Map<number, "H" | "D" | "A">>>();
          
          filteredPicks.forEach(p => {
            if (!picksByUserGw.has(p.user_id)) {
              picksByUserGw.set(p.user_id, new Map());
            }
            const userGwMap = picksByUserGw.get(p.user_id)!;
            if (!userGwMap.has(p.gw)) {
              userGwMap.set(p.gw, new Map());
            }
            userGwMap.get(p.gw)!.set(p.fixture_index, p.pick);
          });
          
          // Calculate per-GW scores and unicorns (same as Home page)
          const perGw = new Map<number, Map<string, { user_id: string; score: number; unicorns: number }>>();
          const gwWinners = new Map<number, Set<string>>();
          
          relevantGws.forEach((g) => {
            const map = new Map<string, { user_id: string; score: number; unicorns: number }>();
            memberIds.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
            perGw.set(g, map);
          });
          
          const picksByGwIdx = new Map<string, PickRow[]>();
          filteredPicks.forEach((p: PickRow) => {
            const key = `${p.gw}:${p.fixture_index}`;
            const arr = picksByGwIdx.get(key) ?? [];
            arr.push(p);
            picksByGwIdx.set(key, arr);
          });
          
          const memberIdsSet = new Set(memberIds.map(m => m.id));
          
          // Build outcomeByGwAndIdx exactly like Home page (reuse relevantGwsSet from above)
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
          
          relevantGws.forEach((g) => {
            const gwOutcomes = outcomeByGwAndIdx.get(g)!;
            const map = perGw.get(g)!;
            
            gwOutcomes.forEach((out: "H" | "D" | "A", idx: number) => {
              const key = `${g}:${idx}`;
              const thesePicks = (picksByGwIdx.get(key) ?? []).filter((p: PickRow) => memberIdsSet.has(p.user_id));
              const correctUsers: string[] = [];
              
              thesePicks.forEach((p: PickRow) => {
                if (p.pick === out) {
                  const row = map.get(p.user_id);
                  if (row) {
                    row.score += 1;
                    correctUsers.push(p.user_id);
                  }
                }
              });
              
              if (correctUsers.length === 1 && memberIds.length >= 3) {
                const row = map.get(correctUsers[0]);
                if (row) row.unicorns += 1;
              }
            });
          });
          
          // Calculate MLT points, OCP, and unicorns (same as Home page)
          const mltPts = new Map<string, number>();
          const ocp = new Map<string, number>();
          const unis = new Map<string, number>();
          memberIds.forEach((m) => {
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
          
          // Build ML table rows and sort (same as Home page)
          const mltRows = memberIds.map((m) => ({
            user_id: m.id,
            name: m.name,
            mltPts: mltPts.get(m.id) ?? 0,
            unicorns: unis.get(m.id) ?? 0,
            ocp: ocp.get(m.id) ?? 0,
          }));
          
          const sortedMltRows = [...mltRows].sort((a, b) =>
            b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
          );
          
          const sortedMemberIds = sortedMltRows.map(r => r.user_id);
          
          const userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
          const userPosition = userIndex !== -1 ? userIndex + 1 : null;
          const prevPosition = userPosition && userPosition > 1 ? userPosition - 1 : null;
          const positionChange: 'up' | 'down' | 'same' | null = prevPosition === null ? null : 
            userPosition! < prevPosition ? 'up' : userPosition! > prevPosition ? 'down' : 'same';
          
          const latestRelevantGw = relevantGws.length > 0 ? Math.max(...relevantGws) : dbCurrentGw;
          const latestGwWinnersSet = latestRelevantGw !== null ? (gwWinners.get(latestRelevantGw) ?? new Set<string>()) : new Set<string>();
          const latestGwWinners = Array.from(latestGwWinnersSet);
          
          leagueDataMap[league.id] = {
            id: league.id,
            members: memberIds,
            userPosition: userPosition || null,
            positionChange,
            submittedMembers: submittedUserIdsSet,
            sortedMemberIds: sortedMemberIds, // CRITICAL: This must match ML table order
            latestGwWinners,
            latestRelevantGw
          };
        }

        if (alive) {
          setLeagueData(leagueDataMap);
          setLeagueDataLoading(false);
          setHasCache(true);
          
          // Cache the processed data for next time
          // Note: We don't cache leagues/unreadByLeague here - they're managed by useLeagues
          try {
            // Convert Sets to Arrays for JSON serialization
            const cacheableLeagueData: Record<string, any> = {};
            for (const [leagueId, data] of Object.entries(leagueDataMap)) {
              cacheableLeagueData[leagueId] = {
                ...data,
                submittedMembers: data.submittedMembers ? (data.submittedMembers instanceof Set ? Array.from(data.submittedMembers) : data.submittedMembers) : undefined,
                latestGwWinners: data.latestGwWinners ? (data.latestGwWinners instanceof Set ? Array.from(data.latestGwWinners) : data.latestGwWinners) : undefined,
              };
            }
            
            setCached(cacheKey, {
              rows: rows, // Save current rows for member counts
              currentGw: gwToDisplay, // Use viewing GW, not published GW
              leagueSubmissions: submissionStatus,
              leagueData: cacheableLeagueData,
              memberCounts: newMemberCounts,
            }, CACHE_TTL.TABLES);
          } catch (cacheError) {
            // Failed to cache data (non-critical)
          }
        }
      } catch (e: any) {
        if (alive) {
          setError(e?.message ?? "Failed to load league data.");
          setLeagueDataLoading(false);
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, leagues, leaguesLoading, hasCache]);
  
  // Process results to create outcome map
  const outcomeByGwIdx = useMemo(() => {
    const outcomeMap = new Map<string, "H" | "D" | "A">();
    
    // Add all results from app_gw_results
    for (const r of baseResults) {
      const out = rowToOutcome(r);
      if (out) outcomeMap.set(`${r.gw}:${r.fixture_index}`, out);
    }
    
    return outcomeMap;
  }, [baseResults]);
  
  // Recalculate league data when outcomes change (reactive to live score updates)
  useEffect(() => {
    // Skip if still loading initial data - let the initial effect handle it
    if (leagueDataLoading) {
      return;
    }
    
    // Skip if leagueData is not yet populated (initial load still in progress)
    if (Object.keys(leagueData).length === 0) {
      return;
    }
    
    if (!user?.id || leagues.length === 0 || membersByLeagueId.size === 0) {
      return;
    }
    
    const updatedGwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
    
    // Skip if no results loaded yet - wait for initial effect to load them
    if (updatedGwsWithResults.length === 0) {
      return;
    }
    
    const fixturesByGw = new Map<number, string[]>();
    allFixturesData.forEach((f) => {
      const arr = fixturesByGw.get(f.gw) ?? [];
      arr.push(f.kickoff_time);
      fixturesByGw.set(f.gw, arr);
    });
    
    
    // Start with existing leagueData to preserve entries we can't process
    const leagueDataMap: Record<string, LeagueData> = { ...leagueData };
    
    for (const league of leagues) {
      let memberIds = membersByLeagueId.get(league.id) ?? [];
      
      // Note: Reactive effect doesn't have access to membersByLeague fallback
      // If membersByLeagueId is empty for a league, we can't create leagueData for it
      // This should be rare since the reactive effect only runs when membersByLeagueId has data
      if (memberIds.length === 0) {
        continue;
      }
      
      const leagueStartGw = leagueStartGwMap.get(league.id) ?? currentGw ?? 1;
      const relevantGws = updatedGwsWithResults.filter(gw => gw >= leagueStartGw);
      
      const picks = picksData.get(league.id) ?? [];
      
      // If no relevant GWs, create minimal leagueData entry (for new leagues with no picks yet)
      if (relevantGws.length === 0) {
        // Still create leagueData entry with empty sortedMemberIds to prevent loading hang
        leagueDataMap[league.id] = {
          id: league.id,
          members: memberIds,
          userPosition: null,
          positionChange: null,
          submittedMembers: new Set(memberIds.filter(m => submittedUserIdsSet.has(m.id)).map(m => m.id)),
          sortedMemberIds: memberIds.map(m => m.id), // Use member order as fallback
          latestGwWinners: [],
          latestRelevantGw: null
        };
        continue;
      }
      
      // If no picks but we have relevant GWs, skip calculation (will be handled when picks load)
      if (picks.length === 0) {
        continue;
      }
      
      // CRITICAL: Filter picks to ONLY include relevant GWs for this league
      // This ensures we only count points from GWs that matter for THIS mini-league
      const relevantGwsSetForFilter = new Set(relevantGws);
      const filteredPicks = picks.filter((p: PickRow) => relevantGwsSetForFilter.has(p.gw));
      
      const picksByUserGw = new Map<string, Map<number, Map<number, "H" | "D" | "A">>>();
      
      filteredPicks.forEach(p => {
        if (!picksByUserGw.has(p.user_id)) {
          picksByUserGw.set(p.user_id, new Map());
        }
        const userGwMap = picksByUserGw.get(p.user_id)!;
        if (!userGwMap.has(p.gw)) {
          userGwMap.set(p.gw, new Map());
        }
        userGwMap.get(p.gw)!.set(p.fixture_index, p.pick);
      });
      
      // Calculate per-GW scores and unicorns (same as Home page)
      const perGw = new Map<number, Map<string, { user_id: string; score: number; unicorns: number }>>();
      const gwWinners = new Map<number, Set<string>>();
      
      relevantGws.forEach((g) => {
        const map = new Map<string, { user_id: string; score: number; unicorns: number }>();
        memberIds.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
        perGw.set(g, map);
      });
      
      const picksByGwIdx = new Map<string, PickRow[]>();
      filteredPicks.forEach((p: PickRow) => {
        const key = `${p.gw}:${p.fixture_index}`;
        const arr = picksByGwIdx.get(key) ?? [];
        arr.push(p);
        picksByGwIdx.set(key, arr);
      });
      
      const memberIdsSet = new Set(memberIds.map(m => m.id));
      
      // Build outcomeByGwAndIdx exactly like Home page (reuse relevantGwsSetForFilter from above)
      const outcomeByGwAndIdx = new Map<number, Map<number, "H" | "D" | "A">>();
      relevantGws.forEach((g) => {
        outcomeByGwAndIdx.set(g, new Map<number, "H" | "D" | "A">());
      });
      outcomeByGwIdx.forEach((out: "H" | "D" | "A", key: string) => {
        const [gwStr, idxStr] = key.split(":");
        const g = parseInt(gwStr, 10);
        const idx = parseInt(idxStr, 10);
        if (relevantGwsSetForFilter.has(g)) {
          outcomeByGwAndIdx.get(g)?.set(idx, out);
        }
      });
      
      relevantGws.forEach((g) => {
        const gwOutcomes = outcomeByGwAndIdx.get(g)!;
        const map = perGw.get(g)!;
        
        gwOutcomes.forEach((out: "H" | "D" | "A", idx: number) => {
          const key = `${g}:${idx}`;
          const thesePicks = (picksByGwIdx.get(key) ?? []).filter((p: PickRow) => memberIdsSet.has(p.user_id));
          const correctUsers: string[] = [];
          
          thesePicks.forEach((p: PickRow) => {
            if (p.pick === out) {
              const row = map.get(p.user_id);
              if (row) {
                row.score += 1;
                correctUsers.push(p.user_id);
              }
            }
          });
          
          if (correctUsers.length === 1 && memberIds.length >= 3) {
            const row = map.get(correctUsers[0]);
            if (row) row.unicorns += 1;
          }
        });
      });
      
      // Calculate MLT points, OCP, and unicorns (same as Home page)
      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      memberIds.forEach((m) => {
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
      
      // Build ML table rows and sort (same as Home page)
      const mltRows = memberIds.map((m) => ({
        user_id: m.id,
        name: m.name,
        mltPts: mltPts.get(m.id) ?? 0,
        unicorns: unis.get(m.id) ?? 0,
        ocp: ocp.get(m.id) ?? 0,
      }));
      
          const sortedMltRows = [...mltRows].sort((a, b) =>
            b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
          );
          
          const sortedMemberIds = sortedMltRows.map(r => r.user_id);
      
      const userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
      const userPosition = userIndex !== -1 ? userIndex + 1 : null;
      const prevPosition = userPosition !== null && userPosition > 1 ? userPosition - 1 : null;
      const positionChange: 'up' | 'down' | 'same' | null = prevPosition === null || userPosition === null ? null : 
        userPosition < prevPosition ? 'up' : userPosition > prevPosition ? 'down' : 'same';
      
      const latestRelevantGw = relevantGws.length > 0 ? Math.max(...relevantGws) : currentGw;
      const latestGwWinnersSet = latestRelevantGw !== null ? (gwWinners.get(latestRelevantGw) ?? new Set<string>()) : new Set<string>();
      const latestGwWinners = Array.from(latestGwWinnersSet);
      
      // Get submitted members from submittedUserIdsSet
      const submittedMembers = new Set<string>();
      memberIds.forEach(member => {
        if (submittedUserIdsSet.has(member.id)) {
          submittedMembers.add(member.id);
        }
      });
      
          leagueDataMap[league.id] = {
            id: league.id,
            members: memberIds,
            userPosition: userPosition || null,
            positionChange,
            submittedMembers: submittedMembers,
            sortedMemberIds: sortedMemberIds, // CRITICAL: This must match ML table order
            latestGwWinners,
            latestRelevantGw
          };
    }
    
    setLeagueData(leagueDataMap);
  }, [user?.id, leagues, picksData, membersByLeagueId, leagueStartGwMap, allFixturesData, outcomeByGwIdx, currentGw, submittedUserIdsSet]);


  const joinLeague = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !user?.id) return;
    setError("");
    try {
      const { data, error } = await supabase
        .from("leagues")
        .select("id, name, created_at")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setError("League code not found.");
        return;
      }

      // Check if user is already in 20 mini-leagues (max limit)
      const userLeagues = await fetchUserLeagues(user.id);
      if (userLeagues.length >= 20) {
        setError("You're already in 20 mini-leagues, which is the maximum. Leave a league before joining another.");
        return;
      }

      // Check if league has been running for more than 4 gameweeks
      const currentGw = dbCurrentGwFromHook;
      if (currentGw !== null) {
        // Calculate league start GW
        const leagueStartGw = await resolveLeagueStartGw(
          { id: data.id, name: data.name, created_at: data.created_at },
          currentGw
        );

        // Check if league has been running for 4+ gameweeks
        // If current_gw - league_start_gw >= 4, the league is locked
        if (currentGw - leagueStartGw >= 4) {
          setError("This league has been running for more than 4 gameweeks. New members can only be added during the first 4 gameweeks.");
          return;
        }
      }

      const { data: members, error: membersError } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", data.id);

      if (membersError) throw membersError;
      if (members && members.length >= 8) {
        setError("League is full (max 8 members).");
        return;
      }

      await supabase.from("league_members").upsert(
        { league_id: data.id, user_id: user.id },
        { onConflict: "league_id,user_id" }
      );
      
      // Send notification to other members
      const userName = user.user_metadata?.display_name || user.email || 'Someone';
      try {
        const response = await fetch('/.netlify/functions/notifyLeagueMemberJoin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId: data.id,
            userId: user.id,
            userName: userName,
          }),
        });
        
        // Check if response has content before trying to parse JSON
        const text = await response.text();
        let result: any;
        try {
          result = text ? JSON.parse(text) : { error: 'Empty response body' };
        } catch (parseError) {
          console.error('[Tables] Failed to parse notification response. Status:', response.status, 'Text:', text, 'Error:', parseError);
          result = { error: 'Invalid JSON response', status: response.status, raw: text.substring(0, 200) };
        }
        
        if (!response.ok) {
          console.error('[Tables] Notification function returned error:', response.status, result);
        } else {
          console.log('[Tables] Join notification sent:', JSON.stringify({
            sent: result.sent,
            recipients: result.recipients,
            ok: result.ok,
            breakdown: result.breakdown,
          }, null, 2));
        }
        } catch (notifError) {
          // Non-critical - notification failures don't block join
        }
      
      setJoinCode("");
      setIsCreateJoinTrayOpen(false);
      // Invalidate cache and refresh leagues
      if (user?.id) {
        invalidateUserCache(user.id);
        refreshLeagues();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league.");
    }
  }, [joinCode, user?.id, refreshLeagues, dbCurrentGwFromHook]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl lg:max-w-[1024px] mx-auto px-4 lg:px-6 py-4 pb-16">
        <div className="flex items-center justify-between">
          <PageHeader title="Mini Leagues" as="h2" />
          <button
            onClick={() => setIsCreateJoinTrayOpen(true)}
            className="w-10 h-10 rounded-full bg-[#1C8376] text-white flex items-center justify-center hover:bg-[#156b60] transition-colors touch-manipulation"
            aria-label="Create League"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <p className="mt-2 mb-6 text-sm text-slate-600 w-full">
          Create or join a private league with friends. Let the rivalry begin.
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {!isDataReady ? (
          <div className="mt-6 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
          </div>
        ) : (
          <>
            <div className="mt-6">
              {rows.length === 0 ? (
                <div className="p-6 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-slate-600 mb-3">You aren't in any mini-leagues yet.</div>
                  <button
                    onClick={() => setIsCreateJoinTrayOpen(true)}
                    className="w-full px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg no-underline border-0 cursor-pointer"
                  >
                    Create or Join
                  </button>
                </div>
              ) : (
                <div className={rows.length >= 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-3" : "space-y-3"}>
                  {rows.map((r) => {
                    const leagueDataForCard = leagueData[r.id];
                    // Only show loading if we have members but no data yet
                    const isLoadingForThisLeague = memberCounts[r.id] > 0 && !leagueDataForCard;
                    
                    return (
                      <MiniLeagueCard
                        key={r.id}
                        row={r}
                        data={leagueDataForCard}
                        unread={unreadByLeague?.[r.id] ?? 0}
                        submissions={leagueSubmissions[r.id]}
                        leagueDataLoading={isLoadingForThisLeague}
                        currentGw={currentGw}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {rows.length > 0 && (
              <div id="create-join-section" className="mt-10 mb-3">
                <button
                  onClick={() => setIsCreateJoinTrayOpen(true)}
                  className="w-full px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg"
                >
                  Create or Join
                </button>
              </div>
            )}
          </>
        )}

        {/* Create/Join Tray */}
        <CreateJoinTray
          isOpen={isCreateJoinTrayOpen}
          onClose={() => {
            setIsCreateJoinTrayOpen(false);
            setJoinCode('');
            setError('');
          }}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          onJoin={joinLeague}
          joinError={error}
        />
      </div>
    </div>
  );
}
