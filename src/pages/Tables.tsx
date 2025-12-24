import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { MiniLeagueCard } from "../components/MiniLeagueCard";
import type { LeagueRow, LeagueData } from "../components/MiniLeagueCard";
import { getDeterministicLeagueAvatar } from "../lib/leagueAvatars";
import { resolveLeagueStartGw } from "../lib/leagueStart";
import { getCached, setCached, CACHE_TTL, invalidateUserCache } from "../lib/cache";
import { useLeagues } from "../hooks/useLeagues";
import { PageHeader } from "../components/PageHeader";

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
      
      if (cached) {
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
        // NOTE: sortedMemberIds is NOT loaded from cache - it must be recalculated to ensure correct MLT order
        const restoredLeagueData: Record<string, LeagueData> = {};
        if (cached.leagueData) {
          for (const [leagueId, data] of Object.entries(cached.leagueData)) {
            restoredLeagueData[leagueId] = {
              ...data,
              submittedMembers: data.submittedMembers ? (Array.isArray(data.submittedMembers) ? new Set(data.submittedMembers) : new Set()) : undefined,
              latestGwWinners: data.latestGwWinners ? (Array.isArray(data.latestGwWinners) ? new Set(data.latestGwWinners) : new Set()) : undefined,
              // CRITICAL: sortedMemberIds is NOT loaded from cache - it will be recalculated in the initial effect
              // This ensures the order always matches the MLT table (same as Home page)
              sortedMemberIds: undefined,
            };
          }
        }
        
        return {
          memberCounts,
          leagueDataLoading: false,
          currentGw: cached.currentGw,
          leagueSubmissions: cached.leagueSubmissions || {},
          leagueData: restoredLeagueData,
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
    };
  };
  
  const initialState = loadInitialStateFromCache();
  
  // Member counts are fetched separately since useLeagues doesn't provide them
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>(initialState.memberCounts);
  const [leagueDataLoading, setLeagueDataLoading] = useState(initialState.leagueDataLoading);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [error, setError] = useState("");
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
  
  // Simple check: is everything ready (including chips)?
  const isDataReady = useMemo(() => {
    // Must have leagues loaded
    if (leaguesLoading) return false;
    
    // Must have league data loaded
    if (leagueDataLoading) return false;
    
    // If we have leagues, check that leagueData is complete for leagues with members
    if (leagues.length > 0) {
      // Check if we have data for all leagues that have members
      const leaguesWithMembers = leagues.filter(l => (memberCounts[l.id] ?? 0) > 0);
      if (leaguesWithMembers.length > 0) {
        // All leagues with members must have complete leagueData with sortedMemberIds
        const allHaveData = leaguesWithMembers.every(league => {
          const data = leagueData[league.id];
          return data && 
                 data.members && 
                 data.members.length > 0 && 
                 data.sortedMemberIds && 
                 data.sortedMemberIds.length > 0;
        });
        if (!allHaveData) return false;
      }
    }
    
    return true;
  }, [leaguesLoading, leagueDataLoading, leagues, memberCounts, leagueData]);

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
    
    // Fetch member data and other Tables-specific data in background
    (async () => {
      try {
        // Step 1: Get current GW
        const [fixturesResult, metaResult] = await Promise.all([
          supabase.from("app_fixtures").select("gw").order("gw", { ascending: false }).limit(1),
          supabase.from("app_meta").select("current_gw").eq("id", 1).maybeSingle()
        ]);
        
        if (!alive) return;

        const fixturesList = (fixturesResult.data as Array<{ gw: number }>) ?? [];
        const fetchedCurrentGw = fixturesList.length ? Math.max(...fixturesList.map((f) => f.gw)) : 1;
        const metaGw = (metaResult.data as any)?.current_gw ?? fetchedCurrentGw;
        setCurrentGw(fetchedCurrentGw);

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
        
        // Step 3: Fetch submissions
        const [submissionsResult] = await Promise.all([
          allMemberIds.length > 0
            ? supabase.from("app_gw_submissions").select("user_id").eq("gw", fetchedCurrentGw).in("user_id", allMemberIds).limit(10000)
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
        (allMembersWithUsersResult.data ?? []).forEach((m: any) => {
          if (!m.users?.name) return;
          const arr = membersByLeagueIdMap.get(m.league_id) ?? [];
          arr.push({ id: m.user_id, name: m.users.name });
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
          const leagueStartGw = await resolveLeagueStartGw(league, metaGw);
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
          
          const leagueStartGw = leagueStartGwMap.get(league.id) ?? metaGw;
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
            console.warn(`[Tables] WARNING: ${league.name} may have hit Supabase 1000 row limit! Got exactly 1000 picks.`, {
              memberIds: memberIds.length,
              relevantGws: relevantGws.length,
              estimatedPicks: memberIds.length * relevantGws.length * 10 // rough estimate
            });
          }
          
          return { data: picks, error: null };
        });

        const allPicksResults = await Promise.all(picksPromises);
        if (!alive) return;
        
        // Check for Supabase errors or data limits
        for (let i = 0; i < leagues.length; i++) {
          const league = leagues[i];
          const result = allPicksResults[i];
          if (result.error) {
            console.error(`[Tables] Supabase error fetching picks for ${league.name}:`, result.error);
          }
          const picksCount = (result.data ?? []).length;
          const memberIds = membersByLeagueIdMap.get(league.id) ?? [];
          const leagueStartGw = leagueStartGwMap.get(league.id) ?? metaGw;
          const relevantGws = leagueStartGw === 0 
            ? gwsWithResults 
            : gwsWithResults.filter(gw => gw >= leagueStartGw);
          
          if (league.name?.toLowerCase().includes('forget')) {
            console.log(`[Tables Initial] ${league.name} picks query result:`, {
              picksCount,
              memberIdsCount: memberIds.length,
              relevantGws,
              error: result.error,
              dataLength: result.data?.length ?? 0,
              limit: 10000
            });
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
          const memberIds = membersByLeagueIdMap.get(league.id) ?? [];
          
          if (memberIds.length === 0) continue;
          
          const leagueStartGw = leagueStartGwMap.get(league.id) ?? metaGw;
          const relevantGws = leagueStartGw === 0 
            ? gwsWithResults 
            : gwsWithResults.filter(gw => gw >= leagueStartGw);
          
          const picks = (allPicksResults[i].data ?? []) as PickRow[];
          
          // Skip MLT calculation if no relevant GWs (picks can be empty for new leagues)
          if (relevantGws.length === 0) {
            if (league.name?.toLowerCase().includes('forget')) {
              console.log(`[Tables Initial] ${league.name} SKIPPING - relevantGws: ${relevantGws.length}, picks: ${picks.length}`);
            }
            continue;
          }
          
          // CRITICAL: Filter picks to ONLY include relevant GWs for this league
          // This ensures we only count points from GWs that matter for THIS mini-league
          const relevantGwsSet = new Set(relevantGws);
          
          // Debug: Check if picks query returned GW 1 picks
          if (league.name?.toLowerCase().includes('forget')) {
            const picksByGwBeforeFilter = new Map<number, number>();
            picks.forEach((p: PickRow) => {
              picksByGwBeforeFilter.set(p.gw, (picksByGwBeforeFilter.get(p.gw) ?? 0) + 1);
            });
            console.log(`[Tables Initial] ${league.name} picks BEFORE filter (from query):`, JSON.stringify(Object.fromEntries(picksByGwBeforeFilter)));
          }
          
          const filteredPicks = picks.filter((p: PickRow) => relevantGwsSet.has(p.gw));
          
          // Debug logging for "forget it" league (before building outcomeByGwAndIdx)
          if (league.name?.toLowerCase().includes('forget')) {
            const picksByGw = new Map<number, number>();
            filteredPicks.forEach((p: PickRow) => {
              picksByGw.set(p.gw, (picksByGw.get(p.gw) ?? 0) + 1);
            });
            console.log(`[Tables Initial] ${league.name} leagueStartGw: ${leagueStartGw}, relevantGws: [${relevantGws.join(',')}]`);
            console.log(`[Tables Initial] ${league.name} filtered picks by GW:`, JSON.stringify(Object.fromEntries(picksByGw)));
            console.log(`[Tables Initial] ${league.name} total picks before filter: ${picks.length}, after filter: ${filteredPicks.length}`);
          }
          
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
            // Double-check: ensure we only process picks from relevant GWs
            if (!relevantGwsSet.has(p.gw)) {
              if (league.name?.toLowerCase().includes('forget')) {
                console.error(`[Tables Initial] ERROR: ${league.name} pick from non-relevant GW ${p.gw}!`);
              }
              return;
            }
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
          
          // Debug logging for "forget it" league (after building outcomeByGwAndIdx)
          if (league.name?.toLowerCase().includes('forget')) {
            const outcomesByGw = new Map<number, number>();
            outcomeByGwAndIdx.forEach((outcomes, gw) => {
              outcomesByGw.set(gw, outcomes.size);
            });
            // Check if outcomeByGwIdx has GW 1
            const allOutcomeGws = new Set<number>();
            outcomeByGwIdx.forEach((_out, key) => {
              const g = parseInt(key.split(":")[0], 10);
              allOutcomeGws.add(g);
            });
            console.log(`[Tables Initial] ${league.name} outcomes by GW:`, JSON.stringify(Object.fromEntries(outcomesByGw)));
            console.log(`[Tables Initial] ${league.name} ALL outcome GWs in outcomeByGwIdx:`, Array.from(allOutcomeGws).sort((a,b) => a-b));
          }
          
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
            // Double-check: ensure we only process relevant GWs
            if (!relevantGwsSet.has(g)) {
              if (league.name?.toLowerCase().includes('forget')) {
                console.error(`[Tables Initial] ERROR: ${league.name} processing non-relevant GW ${g}!`);
              }
              return;
            }
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
            
            // Debug logging for "forget it" league
            if (league.name?.toLowerCase().includes('forget')) {
              console.log(`[Tables Initial] ${league.name} GW ${g} winner: ${coTop.map(r => memberIds.find(m => m.id === r.user_id)?.name || r.user_id).join(',')}, points: ${coTop.length === 1 ? 3 : 1} each`);
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
          
          // Debug logging for "forget it" league
          if (league.name?.toLowerCase().includes('forget')) {
            console.log(`[Tables] ${league.name} sortedMltRows:`, JSON.stringify(sortedMltRows.map((r, i) => ({
              position: i + 1,
              name: r.name,
              userId: r.user_id.slice(0, 8),
              mltPts: r.mltPts,
              unicorns: r.unicorns,
              ocp: r.ocp
            })), null, 2));
            console.log(`[Tables] ${league.name} sortedMemberIds:`, sortedMemberIds);
            console.log(`[Tables] ${league.name} relevantGws:`, relevantGws);
            console.log(`[Tables] ${league.name} picks count:`, picks.length);
          }
          
          const userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
          const userPosition = userIndex !== -1 ? userIndex + 1 : null;
          const prevPosition = userPosition && userPosition > 1 ? userPosition - 1 : null;
          const positionChange: 'up' | 'down' | 'same' | null = prevPosition === null ? null : 
            userPosition! < prevPosition ? 'up' : userPosition! > prevPosition ? 'down' : 'same';
          
          const latestRelevantGw = relevantGws.length > 0 ? Math.max(...relevantGws) : metaGw;
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
          
          // Debug logging for "forget it" league - verify data before storing
          if (league.name?.toLowerCase().includes('forget')) {
            console.log(`[Tables Initial] ${league.name} STORING leagueData:`, {
              sortedMemberIds: sortedMemberIds,
              sortedMemberNames: sortedMemberIds.map(id => memberIds.find(m => m.id === id)?.name || id),
              membersCount: memberIds.length,
              sortedMemberIdsCount: sortedMemberIds.length
            });
          }
        }

        if (alive) {
          console.log('[Tables] Initial load complete, setting leagueData for', Object.keys(leagueDataMap).length, 'leagues');
          setLeagueData(leagueDataMap);
          setLeagueDataLoading(false);
          
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
              currentGw: fetchedCurrentGw,
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
  }, [user?.id, leagues, leaguesLoading]);
  
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
      console.log(`[Tables Reactive] SKIPPING - user: ${!!user?.id}, leagues: ${leagues.length}, membersByLeagueId: ${membersByLeagueId.size}`);
      return;
    }
    
    const updatedGwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
    
    // Skip if no results loaded yet - wait for initial effect to load them
    if (updatedGwsWithResults.length === 0) {
      console.log(`[Tables Reactive] SKIPPING - no results loaded yet (outcomeByGwIdx size: ${outcomeByGwIdx.size})`);
      return;
    }
    
    console.log(`[Tables Reactive] RUNNING for ${leagues.length} leagues, ${updatedGwsWithResults.length} GWs with results`);
    
    const fixturesByGw = new Map<number, string[]>();
    allFixturesData.forEach((f) => {
      const arr = fixturesByGw.get(f.gw) ?? [];
      arr.push(f.kickoff_time);
      fixturesByGw.set(f.gw, arr);
    });
    
    
    const leagueDataMap: Record<string, LeagueData> = {};
    
    for (const league of leagues) {
      const memberIds = membersByLeagueId.get(league.id) ?? [];
      if (memberIds.length === 0) continue;
      
      const leagueStartGw = leagueStartGwMap.get(league.id) ?? currentGw ?? 1;
      const relevantGws = updatedGwsWithResults.filter(gw => gw >= leagueStartGw);
      
      const picks = picksData.get(league.id) ?? [];
      
      // Skip if no relevant GWs (picks can be empty for new leagues)
      if (relevantGws.length === 0) {
        if (league.name?.toLowerCase().includes('forget')) {
          console.log(`[Tables Reactive] ${league.name} SKIPPING - relevantGws: ${relevantGws.length}, leagueStartGw: ${leagueStartGw}, updatedGwsWithResults: [${updatedGwsWithResults.join(',')}]`);
        }
        continue;
      }
      
      // If no picks but we have relevant GWs, skip calculation (will be handled when picks load)
      if (picks.length === 0) {
        if (league.name?.toLowerCase().includes('forget')) {
          console.log(`[Tables Reactive] ${league.name} SKIPPING - no picks yet (relevantGws: ${relevantGws.length})`);
        }
        continue;
      }
      
      // CRITICAL: Filter picks to ONLY include relevant GWs for this league
      // This ensures we only count points from GWs that matter for THIS mini-league
      const relevantGwsSetForFilter = new Set(relevantGws);
      const filteredPicks = picks.filter((p: PickRow) => relevantGwsSetForFilter.has(p.gw));
      
      // Debug logging for "forget it" league
      if (league.name?.toLowerCase().includes('forget')) {
        const picksByGw = new Map<number, number>();
        filteredPicks.forEach((p: PickRow) => {
          picksByGw.set(p.gw, (picksByGw.get(p.gw) ?? 0) + 1);
        });
        console.log(`[Tables Reactive] ${league.name} filtered picks by GW:`, Object.fromEntries(picksByGw));
        console.log(`[Tables Reactive] ${league.name} total picks before filter: ${picks.length}, after filter: ${filteredPicks.length}`);
      }
      
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
      
      // Debug logging for "forget it" league
      if (league.name?.toLowerCase().includes('forget')) {
        console.log(`[Tables Reactive] ${league.name} sortedMltRows:`, JSON.stringify(sortedMltRows.map((r, i) => ({
          position: i + 1,
          name: r.name,
          userId: r.user_id.slice(0, 8),
          mltPts: r.mltPts,
          unicorns: r.unicorns,
          ocp: r.ocp
        })), null, 2));
        console.log(`[Tables Reactive] ${league.name} sortedMemberIds:`, sortedMemberIds);
        console.log(`[Tables Reactive] ${league.name} relevantGws:`, relevantGws);
        console.log(`[Tables Reactive] ${league.name} picks count:`, picks.length);
      }
      
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
      
      // Debug logging for "forget it" league - verify data before storing
      if (league.name?.toLowerCase().includes('forget')) {
        console.log(`[Tables Reactive] ${league.name} STORING leagueData:`, {
          sortedMemberIds: sortedMemberIds,
          sortedMemberNames: sortedMemberIds.map(id => memberIds.find(m => m.id === id)?.name || id),
          membersCount: memberIds.length,
          sortedMemberIdsCount: sortedMemberIds.length
        });
      }
    }
    
    setLeagueData(leagueDataMap);
  }, [user?.id, leagues, picksData, membersByLeagueId, leagueStartGwMap, allFixturesData, outcomeByGwIdx, currentGw, submittedUserIdsSet]);

  const createLeague = useCallback(async () => {
    if (!leagueName.trim() || !user?.id) return;
    setCreating(true);
    setError("");
    try {
      const name = leagueName.trim();
      const code = await genCode();
      const { data, error } = await supabase
        .from("leagues")
        .insert({ name, code })
        .select("id,code")
        .single();
      if (error) throw error;

      const avatar = getDeterministicLeagueAvatar(data!.id);
      await supabase.from("leagues").update({ avatar }).eq("id", data!.id);
      await supabase.from("league_members").insert({
        league_id: data!.id,
        user_id: user.id,
      });

      setLeagueName("");
      // Invalidate cache and refresh leagues
      if (user?.id) {
        invalidateUserCache(user.id);
        refreshLeagues();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to create league.");
    } finally {
      setCreating(false);
    }
  }, [leagueName, user?.id, refreshLeagues]);

  const joinLeague = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !user?.id) return;
    setError("");
    try {
      const { data, error } = await supabase
        .from("leagues")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setError("League code not found.");
        return;
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
      setJoinCode("");
      // Invalidate cache and refresh leagues
      if (user?.id) {
        invalidateUserCache(user.id);
        refreshLeagues();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league.");
    }
  }, [joinCode, user?.id, refreshLeagues]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-4 pb-16">
        <div className="flex items-center justify-between">
          <PageHeader title="Mini Leagues" as="h2" />
          {rows.length > 4 && (
            <button
              onClick={() => {
                const createSection = document.getElementById('create-join-section');
                if (createSection) {
                  createSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="text-[#1C8376] font-semibold text-sm hover:text-[#1C8376] no-underline flex items-center gap-1"
            >
              Create League
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-2 mb-6 text-sm text-slate-600 w-full">
          Create or join a private league and battle it out with your friends.
        </p>

        {error && (
          <div className="mt-4 rounded border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
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
                <div className="px-4 py-4 text-sm">No leagues yet.</div>
              ) : (
                <div className="space-y-3">
                  {rows.map((r) => {
                    const leagueDataForCard = leagueData[r.id];
                    // Debug logging for "forget it" league
                    if (r.name?.toLowerCase().includes('forget')) {
                      console.log(`[Tables Render] ${r.name} passing to MiniLeagueCard:`, {
                        sortedMemberIds: leagueDataForCard?.sortedMemberIds,
                        members: leagueDataForCard?.members?.map(m => ({ id: m.id, name: m.name })),
                        membersLength: leagueDataForCard?.members?.length,
                        sortedMemberIdsLength: leagueDataForCard?.sortedMemberIds?.length
                      });
                    }
                    return (
                      <MiniLeagueCard
                        key={r.id}
                        row={r}
                        data={leagueDataForCard}
                        unread={unreadByLeague?.[r.id] ?? 0}
                        submissions={leagueSubmissions[r.id]}
                        leagueDataLoading={false}
                        currentGw={currentGw}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div id="create-join-section" className="mt-10 mb-3 text-xl font-extrabold text-slate-900">Create or Join</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CreateLeagueForm
                leagueName={leagueName}
                setLeagueName={setLeagueName}
                creating={creating}
                onCreate={createLeague}
              />
              <JoinLeagueForm
                joinCode={joinCode}
                setJoinCode={setJoinCode}
                onJoin={joinLeague}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CreateLeagueForm({
  leagueName,
  setLeagueName,
  creating,
  onCreate,
}: {
  leagueName: string;
  setLeagueName: (name: string) => void;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="border rounded-2xl p-4 bg-white">
      <div className="text-sm font-medium mb-2">Create a league</div>
      <input
        className="border rounded px-3 py-2 w-full bg-white"
        placeholder="League name"
        value={leagueName}
        onChange={(e) => setLeagueName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !creating && leagueName.trim()) {
            onCreate();
          }
        }}
      />
      <button
        className="mt-3 px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
        onClick={onCreate}
        disabled={creating || !leagueName.trim()}
      >
        {creating ? "Creating…" : "Create"}
      </button>
    </div>
  );
}

function JoinLeagueForm({
  joinCode,
  setJoinCode,
  onJoin,
}: {
  joinCode: string;
  setJoinCode: (code: string) => void;
  onJoin: () => void;
}) {
  return (
    <div className="border rounded-2xl p-4 bg-white">
      <div className="text-sm font-medium mb-2">Join with code</div>
      <input
        className="border rounded px-3 py-2 w-full uppercase tracking-widest bg-white"
        placeholder="ABCDE"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && joinCode.trim()) {
            onJoin();
          }
        }}
      />
      <button
        className="mt-3 px-3 py-2 rounded border"
        onClick={onJoin}
      >
        Join
      </button>
    </div>
  );
}


async function genCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMPQRSTVWXYZ23456789";
  for (let t = 0; t < 6; t++) {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const { data } = await supabase
      .from("leagues")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!data) return code;
  }
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}
