import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getMediumName } from "../lib/teamNames";
import WhatsAppBanner from "../components/WhatsAppBanner";
import { getDeterministicLeagueAvatar, getGenericLeaguePhoto, getGenericLeaguePhotoPicsum } from "../lib/leagueAvatars";
import { LEAGUE_START_OVERRIDES } from "../lib/leagueStart";
import html2canvas from "html2canvas";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

// Module-level cache for home page data
type HomePageCache = {
  leagues: League[];
  leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
  leagueData: Record<string, LeagueData>;
  unreadByLeague: Record<string, number>;
  fixtures: Fixture[];
  gw: number;
  gwSubmitted: boolean;
  gwScore: number | null;
  picksMap: Record<number, "H" | "D" | "A">;
  resultsMap: Record<number, "H" | "D" | "A">;
  lastFetched: number;
  userId: string | null;
};

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
let homePageCache: HomePageCache | null = null;

// Don't clear cache on page load - preserve it across navigations
// Cache will expire naturally based on CACHE_DURATION

// Types
type League = { id: string; name: string; code: string; avatar?: string | null; created_at?: string | null; start_gw?: number | null };
type LeagueMember = { id: string; name: string };
type LeagueData = {
  id: string;
  members: LeagueMember[];
  userPosition: number | null;
  positionChange: 'up' | 'down' | 'same' | null;
  submittedMembers?: string[] | Set<string>; // Array or Set of user IDs who have submitted for current GW
  sortedMemberIds?: string[]; // Member IDs in ML table order (1st to last)
  latestGwWinners?: string[] | Set<string>; // Array or Set of members who topped the most recent completed GW
};

// Helper function to get initials from name
function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Helper function to convert result row to outcome
type ResultRowRaw = {
  gw: number;
  fixture_index: number;
  result?: "H" | "D" | "A" | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (typeof r.home_goals === "number" && typeof r.away_goals === "number") {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}
type Fixture = {
  id: string;
  gw: number;
  fixture_index: number;
  home_code?: string | null;
  away_code?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  kickoff_time?: string | null;
};

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };
type ResultRow = ResultRowRaw; // Alias for consistency with other files

// Results for outcome + helper to derive H/D/A if only goals exist


export default function HomePage() {
  const { user } = useAuth();
  const [oldSchoolMode] = useState(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [_leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>({});
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [gw, setGw] = useState<number>(1);
  const [gwSubmitted, setGwSubmitted] = useState<boolean>(false);
  const [gwScore, setGwScore] = useState<number | null>(null);
  const [picksMap, setPicksMap] = useState<Record<number, "H" | "D" | "A">>({});
  const [resultsMap, setResultsMap] = useState<Record<number, "H" | "D" | "A">>({});
  const [loading, setLoading] = useState(true);
  const [leagueDataLoading, setLeagueDataLoading] = useState(true);
  const [_globalCount, setGlobalCount] = useState<number | null>(null);
  const [_globalRank, setGlobalRank] = useState<number | null>(null);
  const [_prevGlobalRank, setPrevGlobalRank] = useState<number | null>(null);
  const [nextGwComing, setNextGwComing] = useState<number | null>(null);
  const [_lastScore, setLastScore] = useState<number | null>(null);
  const [_lastScoreGw, setLastScoreGw] = useState<number | null>(null);
  const [latestGw, setLatestGw] = useState<number | null>(null);
  const [gwPoints, setGwPoints] = useState<Array<{user_id: string, gw: number, points: number}>>([]);
  
  // Leaderboard rankings for different time periods
  const [lastGwRank, setLastGwRank] = useState<{ rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null>(null);
  const [fiveGwRank, setFiveGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);
  const [tenGwRank, setTenGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);
  const [seasonRank, setSeasonRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);

  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});
  const [leagueData, setLeagueData] = useState<Record<string, LeagueData>>({});
  const leagueIdsRef = useRef<Set<string>>(new Set());
  const isInitialMountRef = useRef(true);

  // Extract data fetching into a reusable function for pull-to-refresh
  const fetchHomeData = useCallback(async (showLoading = true) => {
    if (!user?.id) {
        setLoading(false);
      return;
    }

    let alive = true;
    
    if (showLoading) {
        setLoading(true);
      }

    try {
      // PARALLEL QUERY 1: Fetch current GW and user's leagues simultaneously
      console.log('[Home] Starting data fetch for user:', user.id);
      
      // Use direct Supabase calls (same as original working code)
      // NOTE: Removed start_gw from select as it may not exist or cause 400 error
      const [currentGwResult, userLeaguesResult] = await Promise.all([
        supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle(),
        supabase.from("league_members").select("leagues(id,name,code,created_at)").eq("user_id", user.id),
      ]);
      
      console.log('[Home] Query results:', {
        currentGwError: currentGwResult.error,
        currentGwData: currentGwResult.data,
        leaguesError: userLeaguesResult.error,
        leaguesDataLength: userLeaguesResult.data?.length,
        leaguesData: userLeaguesResult.data,
      });
      
      const currentGw = (currentGwResult.data as any)?.current_gw ?? 1;

      const userLeagues = ((userLeaguesResult.data ?? []) as any[])
        .map((r) => r.leagues)
        .filter(Boolean) as League[];
      
      console.log('[Home] Processed leagues:', userLeagues.length);
      if (userLeagues.length > 0) {
        console.log('[Home] League names:', userLeagues.map(l => l.name));
        } else {
        console.warn('[Home] NO LEAGUES FOUND! Raw data:', userLeaguesResult.data);
          }

      // Assign avatars to leagues
      const ls: League[] = userLeagues.map((league) => ({
        ...league,
        avatar: getDeterministicLeagueAvatar(league.id),
      }));
      
      if (alive) {
        setLeagues(ls);
        setGw(currentGw);
        leagueIdsRef.current = new Set(ls.map((l) => l.id));
      }

      // PARALLEL QUERY 2: Fetch fixtures, picks, results, and submission status for current GW
      const [fixturesResult, picksResult, resultsResult, submissionResult] = await Promise.all([
        supabase.from("fixtures").select("id,gw,fixture_index,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time").eq("gw", currentGw).order("fixture_index", { ascending: true }),
        supabase.from("picks").select("user_id,gw,fixture_index,pick").eq("user_id", user.id).eq("gw", currentGw),
        supabase.from("gw_results").select("gw,fixture_index,result").eq("gw", currentGw),
        supabase.from("gw_submissions").select("submitted_at").eq("user_id", user.id).eq("gw", currentGw).maybeSingle(),
      ]);
      
      const thisGwFixtures = (fixturesResult.data as Fixture[]) ?? [];
      const userPicks = (picksResult.data as PickRow[]) ?? [];
      const gwResults = (resultsResult.data as ResultRow[]) ?? [];
      const submitted = !!submissionResult.data?.submitted_at;

    // Calculate score for current GW
        const outcomeByIdx = new Map<number, "H" | "D" | "A">();
    gwResults.forEach((r) => {
      const out = rowToOutcome(r);
      if (out) {
        outcomeByIdx.set(r.fixture_index, out);
          }
        });

        // Populate resultsMap for the current GW
        const currentResultsMap: Record<number, "H" | "D" | "A"> = {};
        outcomeByIdx.forEach((result, fixtureIndex) => {
          currentResultsMap[fixtureIndex] = result;
        });

    let score: number | null = null;
        if (outcomeByIdx.size > 0) {
      // Count correct picks
          let s = 0;
          userPicks.forEach((p) => {
            const out = outcomeByIdx.get(p.fixture_index);
            if (out && out === p.pick) s += 1;
          });
          score = s;
        }

    // Only populate picksMap if user has submitted
      const map: Record<number, "H" | "D" | "A"> = {};
      if (submitted) {
        userPicks.forEach((p) => (map[p.fixture_index] = p.pick));
      }

    if (!alive) return;

    // PARALLEL QUERY 3: Fetch latest GW with results, unread counts, and submission status
    const leagueIds = ls.map(l => l.id);
    
    const [lastGwResult, readsResult] = await Promise.all([
      supabase.from("gw_results").select("gw").order("gw", { ascending: false }).limit(1),
      leagueIds.length > 0 ? supabase.from("league_message_reads").select("league_id,last_read_at").eq("user_id", user.id) : Promise.resolve({ data: [], error: null }),
    ]);
    
    const lastGwWithResults = Array.isArray(lastGwResult.data) && lastGwResult.data.length ? (lastGwResult.data[0] as any).gw : null;
    
    // Fetch unread counts
    const unreadCounts: Record<string, number> = {};
    if (leagueIds.length > 0 && readsResult.data) {
        const lastRead = new Map<string, string>();
      (readsResult.data as any[]).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

      const countPromises = leagueIds.map(async (leagueId) => {
        const since = lastRead.get(leagueId) ?? "1970-01-01T00:00:00Z";
        const { data, count } = await supabase
            .from("league_messages")
            .select("id", { count: "exact" })
          .eq("league_id", leagueId)
            .gte("created_at", since);
        return [leagueId, typeof count === "number" ? count : (data?.length ?? 0)] as [string, number];
      });
      
      const counts = await Promise.all(countPromises);
      counts.forEach(([leagueId, count]) => {
        unreadCounts[leagueId] = count;
      });
          }
    
    // Fetch submission status - OPTIMIZED: Single query for all members, then single query for all submissions
      const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
    if (leagueIds.length > 0) {
      // OPTIMIZATION: Fetch all members in one query
      const membersResult = await supabase
            .from("league_members")
        .select("league_id,user_id")
        .in("league_id", leagueIds);
      
      // Group members by league
      const membersByLeague: Record<string, string[]> = {};
      leagueIds.forEach(id => membersByLeague[id] = []);
      (membersResult.data ?? []).forEach((row: any) => {
        if (!membersByLeague[row.league_id]) membersByLeague[row.league_id] = [];
        membersByLeague[row.league_id].push(row.user_id);
      });
            
      // OPTIMIZATION: Fetch all submissions in one query (if any members exist)
      const allMemberIds = Array.from(new Set(Object.values(membersByLeague).flat()));
      const { data: allSubmissions } = allMemberIds.length > 0 
        ? await supabase.from("gw_submissions").select("user_id").eq("gw", currentGw).in("user_id", allMemberIds)
        : { data: [] };
            
      const submittedUserIds = new Set((allSubmissions ?? []).map((s: any) => s.user_id));
      
      // Calculate submission status for each league
      Object.entries(membersByLeague).forEach(([leagueId, memberIds]) => {
        const totalCount = memberIds.length;
        const submittedCount = memberIds.filter(id => submittedUserIds.has(id)).length;
        submissionStatus[leagueId] = {
          allSubmitted: submittedCount === totalCount && totalCount > 0,
              submittedCount,
          totalCount,
            };
      });
    }

    // Calculate score for last GW with results
    if (lastGwWithResults !== null && lastGwWithResults !== currentGw) {
      const [lastGwResultsData, lastGwPicksData] = await Promise.all([
        supabase.from("gw_results").select("fixture_index,result").eq("gw", lastGwWithResults),
        supabase.from("picks").select("fixture_index,pick").eq("gw", lastGwWithResults).eq("user_id", user.id),
      ]);
      
      const lastGwResults = (lastGwResultsData.data as ResultRow[]) ?? [];
      const lastGwPicks = (lastGwPicksData.data as PickRow[]) ?? [];
      
      const outMap2 = new Map<number, "H" | "D" | "A">();
      lastGwResults.forEach(r => {
        const out = rowToOutcome(r);
        if (out) outMap2.set(r.fixture_index, out);
      });

      let myScore = 0;
      lastGwPicks.forEach((p) => {
        const out = outMap2.get(p.fixture_index);
        if (out && out === p.pick) myScore += 1;
      });

      if (alive) {
        setLastScoreGw(lastGwWithResults);
        setLastScore(myScore);
      }
    } else {
      if (alive) {
        setLastScoreGw(null);
        setLastScore(null);
        }
      }

    // Don't show "coming soon" message
    setNextGwComing(null);

    if (alive) {
      setGwSubmitted(submitted);
      setGwScore(score);
      setResultsMap(currentResultsMap);
      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setUnreadByLeague(unreadCounts);
      setLeagueSubmissions(submissionStatus);
      setLoading(false);
      
      // Update cache
      if (user.id) {
        homePageCache = {
          leagues: ls,
          leagueSubmissions: submissionStatus,
          leagueData: {}, // Will be updated when leagueData useEffect runs
          unreadByLeague: unreadCounts,
          fixtures: thisGwFixtures,
          gw: currentGw,
          gwSubmitted: submitted,
          gwScore: score,
          picksMap: map,
          resultsMap: currentResultsMap,
          lastFetched: Date.now(),
          userId: user.id,
        };
      }
    }
    } catch (error) {
      console.error('[Home] Error loading home page data:', error);
      if (alive) {
        setLoading(false);
        // Don't clear leagues if we already have them - just log the error
        // setLeagues([]); // REMOVED - don't clear existing leagues on error
        setFixtures([]);
        setGwSubmitted(false);
        setGwScore(null);
      }
    }
  }, [user?.id]); // Note: This function uses many state setters which are stable, so only user?.id is needed

  // Pull-to-refresh hook - only enable when user is loaded and not currently loading
  const {
    containerRef,
    pullDistance,
    isRefreshing,
    spinnerRotation,
    spinnerOpacity,
    shouldShowIndicator,
  } = usePullToRefresh({
    onRefresh: async () => {
      // Clear cache to force fresh fetch
      homePageCache = null;
      isInitialMountRef.current = true;
      await fetchHomeData(true);
    },
    enabled: !!user?.id && !loading && !isInitialMountRef.current,
    enableMouse: true, // Enable mouse drag for testing in desktop browsers
  });

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    // NON-BLOCKING cache: Show cached data immediately if available, but still fetch fresh data
    if (homePageCache && homePageCache.userId === user.id && homePageCache.leagues.length > 0) {
      const cacheAge = Date.now() - homePageCache.lastFetched;
      if (cacheAge < CACHE_DURATION) {
        // Show cached data immediately (non-blocking)
        setLeagues(homePageCache.leagues);
        setLeagueSubmissions(homePageCache.leagueSubmissions);
        setLeagueData(homePageCache.leagueData);
        setUnreadByLeague(homePageCache.unreadByLeague);
        setFixtures(homePageCache.fixtures || []);
        setGw(homePageCache.gw || 1);
        setGwSubmitted(homePageCache.gwSubmitted || false);
        setGwScore(homePageCache.gwScore || null);
        setPicksMap(homePageCache.picksMap || {});
        setResultsMap(homePageCache.resultsMap || {});
        leagueIdsRef.current = new Set(homePageCache.leagues.map((l) => l.id));
        setLoading(false);
        setLeagueDataLoading(false); // Cache has leagueData, so no need to wait
        isInitialMountRef.current = false; // Don't show skeleton
        
        // If cache is very fresh (< 30 seconds), skip background refresh entirely
        if (cacheAge < 30 * 1000) {
          // Skip fetch - cache is very fresh
          return;
        } else {
          // Cache is older, refresh in background (don't show loading)
          fetchHomeData(false);
          return;
        }
      }
    }
    
    // No cache or cache expired - fetch fresh data with loading state
    fetchHomeData(isInitialMountRef.current);
  }, [user?.id, fetchHomeData]);

  // Fetch member data and calculate positions for each league
  useEffect(() => {
    if (!leagues.length || !user?.id || !gw) {
      console.log('Skipping position calculation:', { leaguesLength: leagues.length, userId: user?.id, gw });
      setLeagueDataLoading(false);
      return;
    }
    
    console.log('Starting position calculation for', leagues.length, 'leagues');
    setLeagueDataLoading(true);
    
    let alive = true;
    (async () => {
      try {
        // Get current GW
        const { data: metaData } = await supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle();
      const currentGw = (metaData as any)?.current_gw ?? gw;
      
      // PARALLEL: Fetch all results and all league members in parallel
      const [allResultsData, membersData] = await Promise.all([
        supabase.from("gw_results").select("gw,fixture_index,result"),
        supabase.from("league_members").select("league_id,user_id,users(id,name)").in("league_id", leagues.map(l => l.id)),
      ]);
      
      const allResults = (allResultsData.data as ResultRow[]) ?? [];
      
      // Group members by league
      const membersByLeague: Record<string, LeagueMember[]> = {};
      leagues.forEach(l => membersByLeague[l.id] = []);
      (membersData.data ?? []).forEach((row: any) => {
        const leagueId = row.league_id;
        if (!membersByLeague[leagueId]) membersByLeague[leagueId] = [];
        membersByLeague[leagueId].push({
          id: row.user_id,
          name: row.users?.name || "Unknown",
        });
      });
      
      const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
      allResults.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out) return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
      });

      // Get ALL gameweeks with results (not filtered by league start)
      const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
      
      // OPTIMIZATION: Pre-fetch fixtures for all GWs to calculate leagueStartGw synchronously
      const { data: allFixtures } = await supabase
        .from("fixtures")
        .select("gw,kickoff_time")
        .in("gw", gwsWithResults.length > 0 ? gwsWithResults : [1]);
      
      // Build GW deadlines map for synchronous leagueStartGw calculation
      const gwDeadlines = new Map<number, Date>();
      (allFixtures ?? []).forEach((f: any) => {
        if (f.kickoff_time && f.gw) {
          const kickoff = new Date(f.kickoff_time);
          const deadline = new Date(kickoff.getTime() - 75 * 60 * 1000); // DEADLINE_BUFFER_MINUTES
          if (!gwDeadlines.has(f.gw) || deadline < gwDeadlines.get(f.gw)!) {
            gwDeadlines.set(f.gw, deadline);
          }
        }
      });
      
      // Calculate leagueStartGw for all leagues synchronously (like Tables.tsx)
      const leagueStartGws = new Map<string, number>();
      const specialLeagues = ["Prem Predictions"]; // Leagues that should include all historical data from GW1
      leagues.forEach(league => {
        // Special handling for leagues like "Prem Predictions" that should include all data from GW1
        if (league.name && specialLeagues.includes(league.name)) {
          leagueStartGws.set(league.id, 1);
          return;
        }
        const override = (league.name && (LEAGUE_START_OVERRIDES as any)[league.name]) as number | undefined;
        if (typeof override === "number") {
          leagueStartGws.set(league.id, override);
          return;
        }
        if (league.start_gw !== null && league.start_gw !== undefined) {
          leagueStartGws.set(league.id, league.start_gw);
          return;
        }
        if (league.created_at) {
          const leagueCreatedAt = new Date(league.created_at);
          for (const gw of gwsWithResults) {
            const deadline = gwDeadlines.get(gw);
            if (deadline && leagueCreatedAt <= deadline) {
              leagueStartGws.set(league.id, gw);
              return;
            }
          }
          if (gwsWithResults.length > 0) {
            leagueStartGws.set(league.id, Math.max(...gwsWithResults) + 1);
            return;
          }
        }
        leagueStartGws.set(league.id, currentGw);
      });
      
      // Collect all member IDs and relevant GWs for batching
      const allMemberIds = new Set<string>();
      const allRelevantGws = new Set<number>();
      leagues.forEach(league => {
        const members = membersByLeague[league.id] ?? [];
        members.forEach(m => allMemberIds.add(m.id));
        const leagueStartGw = leagueStartGws.get(league.id) ?? currentGw;
        gwsWithResults.filter(g => g >= leagueStartGw).forEach(g => allRelevantGws.add(g));
      });
      
      // BATCH: Fetch all picks for all members across all relevant GWs in one query
      const { data: allPicksBatch } = allMemberIds.size > 0 && allRelevantGws.size > 0
        ? await supabase
            .from("picks")
            .select("user_id,gw,fixture_index,pick")
            .in("user_id", Array.from(allMemberIds))
            .in("gw", Array.from(allRelevantGws))
        : { data: [] };
      
      const picksBatch = (allPicksBatch as PickRow[]) ?? [];
      
      // BATCH: Fetch all submissions for current GW in one query
      const { data: allSubmissionsBatch } = allMemberIds.size > 0
        ? await supabase
            .from("gw_submissions")
            .select("user_id")
            .eq("gw", currentGw)
            .in("user_id", Array.from(allMemberIds))
        : { data: [] };
      
      const submittedUserIdsBatch = new Set((allSubmissionsBatch ?? []).map((s: any) => s.user_id));

      const leagueDataMap: Record<string, LeagueData> = {};
      
      for (let i = 0; i < leagues.length; i++) {
        const league = leagues[i];
        try {
          const members: LeagueMember[] = (membersByLeague[league.id] ?? [])
            .filter((m: LeagueMember) => m.name !== "Unknown");

          if (members.length === 0) {
            leagueDataMap[league.id] = {
              id: league.id,
              members: [],
              userPosition: null,
              positionChange: null,
              sortedMemberIds: [],
              latestGwWinners: []
            };
            continue;
          }

          // Simple: Calculate ML table exactly like League page does, then find user's position
          if (outcomeByGwIdx.size === 0) {
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            leagueDataMap[league.id] = {
              id: league.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: null,
              positionChange: null,
              sortedMemberIds: alphabeticalIds,
              latestGwWinners: []
            };
            continue;
          }

          // Use pre-calculated leagueStartGw (synchronous, no DB query)
          const leagueStartGw = leagueStartGws.get(league.id) ?? currentGw;
          const relevantGws = gwsWithResults.filter(g => g >= leagueStartGw);

          if (relevantGws.length === 0) {
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            leagueDataMap[league.id] = {
              id: league.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: null,
              positionChange: null,
              sortedMemberIds: alphabeticalIds,
              latestGwWinners: []
            };
            continue;
          }

          // Use batched picks data (filtered for this league's members and relevant GWs)
          const memberIds = members.map(m => m.id);
          const picksAll = picksBatch.filter(p => 
            memberIds.includes(p.user_id) && relevantGws.includes(p.gw)
          );
          
          // DEBUG: Check picks data for "Forget It"
          if (league.name?.toLowerCase().includes('forget')) {
            const picksByUser = picksAll.reduce((acc: any, p: any) => {
              if (!acc[p.user_id]) acc[p.user_id] = [];
              acc[p.user_id].push(`${p.gw}:${p.fixture_index}`);
              return acc;
            }, {});
            console.error(`[${league.name}] PICKS DATA:`, {
              totalPicks: picksAll.length,
              picksByUser: Object.keys(picksByUser).map(uid => ({
                userId: uid,
                userName: members.find(m => m.id === uid)?.name,
                pickCount: picksByUser[uid].length,
                picks: picksByUser[uid].slice(0, 5) // First 5 picks
              }))
            });
          }
          
          // Calculate ML table - EXACT same logic as League page
            const perGw = new Map<number, Map<string, { user_id: string; score: number; unicorns: number }>>();
            const gwWinners = new Map<number, Set<string>>();
            relevantGws.forEach((g) => {
              const map = new Map<string, { user_id: string; score: number; unicorns: number }>();
              members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
              perGw.set(g, map);
            });

            relevantGws.forEach((g) => {
              const idxInGw = Array.from(outcomeByGwIdx.entries())
                .filter(([k]) => parseInt(k.split(":")[0], 10) === g)
                .map(([k, v]) => ({ idx: parseInt(k.split(":")[1], 10), out: v }));

              idxInGw.forEach(({ idx, out }) => {
                const thesePicks = picksAll.filter((p) => p.gw === g && p.fixture_index === idx);
                const correctUsers = thesePicks.filter((p) => p.pick === out).map((p) => p.user_id);

                const map = perGw.get(g)!;
                thesePicks.forEach((p) => {
                  if (p.pick === out) {
                    const row = map.get(p.user_id)!;
                    row.score += 1;
                  }
                });

                if (correctUsers.length === 1 && members.length >= 3) {
                  const uid = correctUsers[0];
                  const row = map.get(uid)!;
                  row.unicorns += 1;
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
            const gwRows = Array.from(perGw.get(g)!.values());
            gwRows.forEach((r) => {
                ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
                unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
              });

            gwRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
            if (!gwRows.length) return;

            const top = gwRows[0];
            const coTop = gwRows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
            gwWinners.set(g, new Set(coTop.map((r) => r.user_id)));

              if (coTop.length === 1) {
                mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
              } else {
                coTop.forEach((r) => {
                  mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
                });
              }
            });

          // Build ML table rows - EXACT same as League page
          const mltRows = members.map((m) => ({
              user_id: m.id,
              name: m.name,
              mltPts: mltPts.get(m.id) ?? 0,
              unicorns: unis.get(m.id) ?? 0,
              ocp: ocp.get(m.id) ?? 0,
            }));

          // DEBUG: Log the exact values BEFORE sorting for "Forget It"
          if (league.name?.toLowerCase().includes('forget')) {
            console.error(`[${league.name}] === BEFORE SORT ===`);
            mltRows.forEach((r, i) => {
              console.error(`${i + 1}. ${r.name}: mltPts=${r.mltPts}, unicorns=${r.unicorns}, ocp=${r.ocp}`);
            });
          }

          // Sort EXACTLY like League.tsx line 1189 - use the exact same expression
          // Create a NEW sorted array to avoid any mutation issues
          const sortedMltRows = [...mltRows].sort((a, b) => 
            b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
          );

          // DEBUG: Log the exact values AFTER sorting for "Forget It" and "Prem Predictions"
          if (league.name?.toLowerCase().includes('forget') || league.name?.toLowerCase().includes('prem')) {
            console.error(`[${league.name}] === AFTER SORT ===`);
            console.error(`[${league.name}] leagueStartGw:`, leagueStartGw);
            console.error(`[${league.name}] relevantGws:`, Array.from(relevantGws));
            console.error(`[${league.name}] picksAll count:`, picksAll.length);
            console.error(`[${league.name}] picksAll by GW:`, Array.from(new Set(picksAll.map(p => p.gw))).sort());
            sortedMltRows.forEach((r, i) => {
              console.error(`${i + 1}. ${r.name}: mltPts=${r.mltPts}, unicorns=${r.unicorns}, ocp=${r.ocp}, user_id=${r.user_id}`);
            });
            console.error(`[${league.name}] sortedMemberIds:`, sortedMltRows.map(r => r.user_id));
            console.error(`[${league.name}] sortedMemberNames:`, sortedMltRows.map(r => r.name));
            console.error(`[${league.name}] sortedMemberInitials:`, sortedMltRows.map(r => initials(r.name)));
          }

          // Find user's position - simple: index in sorted array + 1
          let userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
          
          // If not found, try to find by matching member IDs
          if (userIndex === -1) {
            const memberMatch = members.findIndex(m => m.id === user.id);
            if (memberMatch !== -1) {
              // User is in members but not in rows - add them with 0 stats
              console.warn(`[${league.name}] User ${user.id} found in members but not in mltRows - adding with 0 stats`);
              sortedMltRows.push({
                user_id: user.id,
                name: members[memberMatch].name,
                mltPts: 0,
                unicorns: 0,
                ocp: 0
              });
              // Re-sort EXACTLY like League.tsx line 1189
              sortedMltRows.sort((a, b) => 
                b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
              );
              userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
            }
          }
          
          // CRITICAL: Extract sortedMemberIds from the FINAL sorted array
          // This is the ML table order (1st to last) - EXACTLY matching League page
          const sortedMemberIds = sortedMltRows.map(r => r.user_id);
          
          // Debug logging
          console.log(`[${league.name}] Position calculation:`, {
            userId: user.id,
            userIndex,
            userPosition: userIndex !== -1 ? userIndex + 1 : null,
            rowsCount: sortedMltRows.length,
            rows: sortedMltRows.map((r, i) => ({ 
              index: i + 1, 
              name: r.name, 
              userId: r.user_id, 
              mltPts: r.mltPts, 
              unicorns: r.unicorns, 
              ocp: r.ocp 
            })),
            sortedMemberIds,
            memberIds: members.map(m => m.id),
            userInMembers: members.some(m => m.id === user.id),
            userInRows: sortedMltRows.some(r => r.user_id === user.id),
            leagueStartGw,
            relevantGws,
            picksCount: picksAll.length,
            currentGw
          });
          
          const userPosition = userIndex !== -1 ? userIndex + 1 : null;
          const latestRelevantGw = relevantGws.length ? Math.max(...relevantGws) : null;
          const latestGwWinners = latestRelevantGw !== null ? (gwWinners.get(latestRelevantGw) ?? new Set<string>()) : new Set<string>();
          
          // Use batched submissions data (filtered for this league's members)
          const submittedMembers = new Set<string>();
          memberIds.forEach(id => {
            if (submittedUserIdsBatch.has(id)) {
              submittedMembers.add(id);
            }
            });
          
          
          // Store data - CRITICAL: sortedMemberIds must be stored correctly
          // Convert Sets to Arrays for React state (Sets don't serialize well)
          const storedData: LeagueData = {
            id: league.id,
            members: members.sort((a, b) => a.name.localeCompare(b.name)), // Keep alphabetical for other uses
            userPosition,
            positionChange: null,
            submittedMembers: Array.from(submittedMembers), // Convert Set to Array for storage
            sortedMemberIds: [...sortedMemberIds], // Store COPY of ML table order from sortedMltRows
            latestGwWinners: Array.from(latestGwWinners) // Convert Set to Array for storage
          };
          
          leagueDataMap[league.id] = storedData;
        } catch (error) {
          console.error(`Error loading data for league ${league.id} (${league.name}):`, error);
          console.error('Error details:', error instanceof Error ? error.message : error);
          leagueDataMap[league.id] = {
            id: league.id,
            members: [],
            userPosition: null,
            positionChange: null,
            sortedMemberIds: [],
            latestGwWinners: []
          };
        }
      }
      
      if (alive) {
        console.log('Setting leagueData:', Object.keys(leagueDataMap).map(id => {
          const data = leagueDataMap[id];
          return { id, userPosition: data.userPosition, membersCount: data.members.length, hasSortedMemberIds: !!data.sortedMemberIds };
        }));
        
        // Debug for "Forget It" league - check if it's in leagueDataMap
        const forgetItLeague = leagues.find(l => l.name?.toLowerCase().includes('forget'));
        if (forgetItLeague && leagueDataMap[forgetItLeague.id]) {
          console.error(`[forget it] SETTING leagueData - Found in leagueDataMap:`, {
            leagueId: forgetItLeague.id,
            leagueName: forgetItLeague.name,
            data: leagueDataMap[forgetItLeague.id],
            sortedMemberIds: leagueDataMap[forgetItLeague.id].sortedMemberIds,
            membersCount: leagueDataMap[forgetItLeague.id].members.length
          });
        } else if (forgetItLeague) {
          console.error(`[forget it] SETTING leagueData - NOT FOUND in leagueDataMap!`, {
            leagueId: forgetItLeague.id,
            leagueName: forgetItLeague.name,
            leagueDataMapKeys: Object.keys(leagueDataMap)
          });
        }
        
        setLeagueData(leagueDataMap);
        setLeagueDataLoading(false);
        
        // Update cache with leagueData
        if (homePageCache && homePageCache.userId === user?.id) {
          homePageCache.leagueData = leagueDataMap;
          homePageCache.lastFetched = Date.now();
        }
      } else {
        // Component unmounted, but still set loading to false to prevent stuck skeleton
        setLeagueDataLoading(false);
      }
      } catch (error) {
        console.error('[Home] Error calculating league data:', error);
        if (alive) {
          setLeagueDataLoading(false);
        }
      }
    })();
    
    return () => {
      alive = false;
    };
  }, [leagues, user?.id, gw]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) Player count — prefer users head count; fall back to distinct pickers
        let countSet = false;
        try {
          const { count: usersCount } = await supabase
            .from("users")
            .select("id", { count: "exact", head: true });
          if (alive && typeof usersCount === "number") {
            setGlobalCount(usersCount);
            countSet = true;
          }
        } catch (_) { /* ignore */ }

        if (!countSet) {
          try {
            const { count: pickUsers } = await supabase
              .from("picks")
              .select("user_id", { count: "exact", head: true });
            if (alive && typeof pickUsers === "number") setGlobalCount(pickUsers);
          } catch (_) { /* ignore */ }
        }

        // 2) Rank — use same logic as Global page (v_ocp_overall)
        try {
          const { data: ocp } = await supabase
            .from("v_ocp_overall")
            .select("user_id, ocp")
            .order("ocp", { ascending: false });
          if (alive && Array.isArray(ocp) && ocp.length) {
            const idx = ocp.findIndex((row: any) => row.user_id === user?.id);
            if (idx !== -1) {
              console.log('Using v_ocp_overall (same as Global page):', idx + 1, 'from', ocp.length, 'players');
              setGlobalRank(idx + 1);
              
              // Also calculate previous rank (before latest GW)
              // We need to fetch gw_points to calculate previous rank
              try {
                const { data: gwPointsData } = await supabase
                  .from("v_gw_points")
                  .select("user_id, gw, points");
                
                if (gwPointsData && gwPointsData.length > 0) {
                  const latestGw = Math.max(...gwPointsData.map((r: any) => r.gw));
                  
                  // Calculate previous OCP (excluding latest GW)
                  const prevOcp = new Map<string, number>();
                  gwPointsData.forEach((r: any) => {
                    if (r.gw < latestGw) {
                      prevOcp.set(r.user_id, (prevOcp.get(r.user_id) || 0) + (r.points || 0));
                    }
                  });
                  
                  // Sort by previous OCP
                  const prevOrdered = Array.from(prevOcp.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
                  const prevIdx = prevOrdered.findIndex(([uid]) => uid === user?.id);
                  
                  if (prevIdx !== -1) {
                    console.log('Previous rank from v_gw_points:', prevIdx + 1);
                    if (alive) setPrevGlobalRank(prevIdx + 1);
                  }
                }
              } catch (e) {
                console.log('Could not calculate previous rank:', e);
              }
              
              return; // done
            }
          }
        } catch (_) { /* ignore */ }

        // 2c) compute from picks + gw_results (client-side)
        try {
          const [{ data: rs }, { data: pk }, { data: submissions }] = await Promise.all([
            supabase.from("gw_results").select("gw,fixture_index,result"),
            supabase.from("picks").select("user_id,gw,fixture_index,pick"),
            supabase.from("gw_submissions").select("user_id,gw,submitted_at"),
          ]);

          const results = (rs as Array<{gw:number, fixture_index:number, result:"H"|"D"|"A"|null}>) || [];
          const picksAll = (pk as Array<{user_id:string,gw:number,fixture_index:number,pick:"H"|"D"|"A"}>) || [];
          const subs = (submissions as Array<{user_id:string,gw:number,submitted_at:string}>) || [];

          // Build map of submitted users per GW
          const submittedMap = new Map<string, boolean>();
          subs.forEach(s => {
            if (s.submitted_at) {
              submittedMap.set(`${s.user_id}:${s.gw}`, true);
            }
          });

          // map gw:idx -> outcome
          const outMap = new Map<string, "H"|"D"|"A">();
          results.forEach(r => { if (r.result === "H" || r.result === "D" || r.result === "A") outMap.set(`${r.gw}:${r.fixture_index}`, r.result); });

          // Get latest GW with results
          const latestGw = Math.max(...results.map(r => r.gw));
          
          // Calculate current scores (all GWs) - only count picks from users who submitted
          const scores = new Map<string, number>();
          picksAll.forEach(p => {
            // Only count picks from users who have submitted for this GW
            if (!submittedMap.get(`${p.user_id}:${p.gw}`)) return;
            const out = outMap.get(`${p.gw}:${p.fixture_index}`);
            if (!out) return;
            if (p.pick === out) scores.set(p.user_id, (scores.get(p.user_id) || 0) + 1);
            else if (!scores.has(p.user_id)) scores.set(p.user_id, 0);
          });

          // Calculate previous scores (up to latest GW - 1) - only count picks from users who submitted
          const prevScores = new Map<string, number>();
          picksAll.forEach(p => {
            if (p.gw >= latestGw) return; // Skip latest GW
            // Only count picks from users who have submitted for this GW
            if (!submittedMap.get(`${p.user_id}:${p.gw}`)) return;
            const out = outMap.get(`${p.gw}:${p.fixture_index}`);
            if (!out) return;
            if (p.pick === out) prevScores.set(p.user_id, (prevScores.get(p.user_id) || 0) + 1);
            else if (!prevScores.has(p.user_id)) prevScores.set(p.user_id, 0);
          });

          if (scores.size) {
            const ordered = Array.from(scores.entries()).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
            const myIndex = ordered.findIndex(([uid]) => uid === user?.id);
            if (alive && myIndex !== -1) {
              console.log('Current rank calculation:', {
                myIndex,
                rank: myIndex + 1,
                myScore: scores.get(user?.id ?? ""),
                ordered: ordered.slice(0, 5).map(([uid, score]) => ({ uid: uid.slice(0, 8), score }))
              });
              setGlobalRank(myIndex + 1);
            }

            // Calculate previous rank if we have previous scores
            console.log('Previous scores debug:', {
              prevScoresSize: prevScores.size,
              latestGw,
              hasUserInPrevScores: prevScores.has(user?.id ?? ""),
              userPrevScore: prevScores.get(user?.id ?? "")
            });
            
            if (prevScores.size > 0) {
              const prevOrdered = Array.from(prevScores.entries()).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
              const prevMyIndex = prevOrdered.findIndex(([uid]) => uid === user?.id);
              console.log('Previous rank calculation:', {
                prevMyIndex,
                prevRank: prevMyIndex !== -1 ? prevMyIndex + 1 : 'not found',
                prevScore: prevScores.get(user?.id ?? ""),
                prevOrdered: prevOrdered.slice(0, 5).map(([uid, score]) => ({ uid: uid.slice(0, 8), score }))
              });
              if (alive && prevMyIndex !== -1) {
                setPrevGlobalRank(prevMyIndex + 1);
              }
            } else {
              console.log('No previous scores found - prevScores is empty');
            }
          }
        } catch (_) { /* ignore */ }
      } finally { /* no-op */ }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Calculate leaderboard rankings for different time periods using v_gw_points and v_ocp_overall
  useEffect(() => {
    if (!user?.id) return;
    
    let alive = true;
    (async () => {
      try {
        // Get latest GW from gw_results (same as Global page)
        const { data: latest, error: lErr } = await supabase
          .from("gw_results")
          .select("gw")
          .order("gw", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lErr) throw lErr;
        const latestGw = latest?.gw ?? null;
        if (!latestGw) return;

        // Get total fixtures for latest GW
        const { data: fixturesData } = await supabase
          .from("fixtures")
          .select("fixture_index")
          .eq("gw", latestGw);
        const totalFixtures = fixturesData ? [...new Set(fixturesData.map(f => f.fixture_index))].length : 10;

        // Fetch all GW points and overall data
        const [{ data: gwPointsData }, { data: overallData }] = await Promise.all([
          supabase.from("v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
          supabase.from("v_ocp_overall").select("user_id, name, ocp")
        ]);

        const gwPoints = (gwPointsData as Array<{user_id: string, gw: number, points: number}>) || [];
        const overall = (overallData as Array<{user_id: string, name: string | null, ocp: number}>) || [];
        const userMap = new Map(overall.map(o => [o.user_id, o.name ?? "User"]));
        
        // Store gwPoints and latestGw for streak calculation
        if (alive) {
          setGwPoints(gwPoints);
          if (gwPoints.length > 0) {
            const maxGw = Math.max(...gwPoints.map(gp => gp.gw));
            setLatestGw(maxGw);
          }
        }

        // Box 1: Last GW Leaderboard (same logic as Global page with joint ranking)
        const lastGwPoints = gwPoints.filter(gp => gp.gw === latestGw);
        if (lastGwPoints.length > 0 && alive) {
          const sorted = lastGwPoints
            .map(gp => ({
              user_id: gp.user_id,
              name: userMap.get(gp.user_id) ?? "User",
              points: gp.points ?? 0,
            }))
            .sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name));
          
          // Add joint ranking (same as Global page)
          let currentRank = 1;
          const ranked = sorted.map((player, index) => {
            if (index > 0 && sorted[index - 1].points !== player.points) {
              currentRank = index + 1;
            }
            return {
              ...player,
              rank: currentRank,
            };
          });
          
          const userEntry = ranked.find(gp => gp.user_id === user.id);
          if (userEntry) {
            // Check if this rank has multiple players
            const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
            const isTied = rankCount > 1;
            
            setLastGwRank({
              rank: userEntry.rank,
              total: lastGwPoints.length,
              score: userEntry.points,
              gw: latestGw,
              totalFixtures,
              isTied
            });
          }
        }

        // Box 2: Last 5 GWs - only players who played ALL 5 weeks (same logic as Global page)
        if (latestGw >= 5) {
          const fiveGwStart = latestGw - 4;
          const fiveGwPoints = gwPoints.filter(gp => gp.gw >= fiveGwStart && gp.gw <= latestGw);
          const fiveGwUserData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
          
          // Initialize with users from overall
          overall.forEach(o => {
            fiveGwUserData.set(o.user_id, {
              user_id: o.user_id,
              name: o.name ?? "User",
              formPoints: 0,
              weeksPlayed: new Set()
            });
          });
          
          // Add form points and track which weeks each user played
          fiveGwPoints.forEach(gp => {
            const user = fiveGwUserData.get(gp.user_id);
            if (user) {
              user.formPoints += gp.points ?? 0;
              user.weeksPlayed.add(gp.gw);
            } else {
              fiveGwUserData.set(gp.user_id, {
                user_id: gp.user_id,
                name: "User",
                formPoints: gp.points ?? 0,
                weeksPlayed: new Set([gp.gw])
              });
            }
          });
          
          // Only include players who have played ALL 5 weeks
          const sorted = Array.from(fiveGwUserData.values())
            .filter(user => {
              for (let gw = fiveGwStart; gw <= latestGw; gw++) {
                if (!user.weeksPlayed.has(gw)) return false;
              }
              return true;
            })
            .sort((a, b) => (b.formPoints - a.formPoints) || a.name.localeCompare(b.name));
          
          // Add joint ranking (same as Global page)
          let currentRank = 1;
          const ranked = sorted.map((player, index) => {
            if (index > 0 && sorted[index - 1].formPoints !== player.formPoints) {
              currentRank = index + 1;
            }
            return {
              ...player,
              rank: currentRank,
            };
          });
          
          if (ranked.length > 0 && alive) {
            const userEntry = ranked.find(u => u.user_id === user.id);
            if (userEntry) {
              // Check if this rank has multiple players
              const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
              const isTied = rankCount > 1;
              
              setFiveGwRank({
                rank: userEntry.rank,
                total: ranked.length,
                isTied
              });
            }
          }
        }

        // Box 3: Last 10 GWs - only players who played ALL 10 weeks (same logic as Global page)
        if (latestGw >= 10) {
          const tenGwStart = latestGw - 9;
          const tenGwPoints = gwPoints.filter(gp => gp.gw >= tenGwStart && gp.gw <= latestGw);
          const tenGwUserData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
          
          // Initialize with users from overall
          overall.forEach(o => {
            tenGwUserData.set(o.user_id, {
              user_id: o.user_id,
              name: o.name ?? "User",
              formPoints: 0,
              weeksPlayed: new Set()
            });
          });
          
          // Add form points and track which weeks each user played
          tenGwPoints.forEach(gp => {
            const user = tenGwUserData.get(gp.user_id);
            if (user) {
              user.formPoints += gp.points ?? 0;
              user.weeksPlayed.add(gp.gw);
            } else {
              tenGwUserData.set(gp.user_id, {
                user_id: gp.user_id,
                name: "User",
                formPoints: gp.points ?? 0,
                weeksPlayed: new Set([gp.gw])
              });
            }
          });
          
          // Only include players who have played ALL 10 weeks
          const sorted = Array.from(tenGwUserData.values())
            .filter(user => {
              for (let gw = tenGwStart; gw <= latestGw; gw++) {
                if (!user.weeksPlayed.has(gw)) return false;
              }
              return true;
            })
            .sort((a, b) => (b.formPoints - a.formPoints) || a.name.localeCompare(b.name));
          
          // Add joint ranking (same as Global page)
          let currentRank = 1;
          const ranked = sorted.map((player, index) => {
            if (index > 0 && sorted[index - 1].formPoints !== player.formPoints) {
              currentRank = index + 1;
            }
            return {
              ...player,
              rank: currentRank,
            };
          });
          
          if (ranked.length > 0 && alive) {
            const userEntry = ranked.find(u => u.user_id === user.id);
            if (userEntry) {
              // Check if this rank has multiple players
              const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
              const isTied = rankCount > 1;
              
              setTenGwRank({
                rank: userEntry.rank,
                total: ranked.length,
                isTied
              });
            }
          }
        }

        // Box 4: Overall/Season Rank (same logic as Global page with joint ranking)
        if (overall.length > 0 && alive) {
          const sorted = [...overall].sort((a, b) => (b.ocp ?? 0) - (a.ocp ?? 0) || (a.name ?? "User").localeCompare(b.name ?? "User"));
          
          // Add joint ranking (same as Global page)
          let currentRank = 1;
          const ranked = sorted.map((player, index) => {
            if (index > 0 && (sorted[index - 1].ocp ?? 0) !== (player.ocp ?? 0)) {
              currentRank = index + 1;
            }
            return {
              ...player,
              rank: currentRank,
            };
          });
          
          const userEntry = ranked.find(o => o.user_id === user.id);
          if (userEntry) {
            // Check if this rank has multiple players
            const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
            const isTied = rankCount > 1;
            
            setSeasonRank({
              rank: userEntry.rank,
              total: overall.length,
              isTied
            });
          }
        }
      } catch (e) {
        console.error('Error calculating leaderboard rankings:', e);
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id]);

  // Calculate streak and last 10 GW scores for current user
  const userStreakData = useMemo(() => {
    if (!user?.id || !latestGw) return null;
    
    // Get all GW points for this user, sorted by GW descending
    const userGwPoints = gwPoints
      .filter(gp => gp.user_id === user.id)
      .sort((a, b) => b.gw - a.gw);
    
    if (userGwPoints.length === 0) return null;
    
    // Calculate streak (consecutive weeks from latest GW going backwards)
    let streak = 0;
    let expectedGw = latestGw;
    const userGwSet = new Set(userGwPoints.map(gp => gp.gw));
    
    // Count consecutive weeks starting from latest GW
    while (expectedGw >= 1 && userGwSet.has(expectedGw)) {
      streak++;
      expectedGw--;
    }
    
    // Get last 10 gameweeks (or as many as available)
    const last10GwScores: Array<{ gw: number; score: number | null }> = [];
    const startGw = Math.max(1, latestGw - 9);
    for (let gw = latestGw; gw >= startGw; gw--) {
      const gwData = userGwPoints.find(gp => gp.gw === gw);
      last10GwScores.push({
        gw,
        score: gwData ? gwData.points : null
      });
    }
    
    return {
      streak,
      last10GwScores: last10GwScores.reverse() // Reverse to show oldest to newest
    };
  }, [user?.id, gwPoints, latestGw]);

  // Realtime: increment unread badge on new messages in any of my leagues
  useEffect(() => {
    const channel = supabase
      .channel(`home-unreads:${user?.id ?? "anon"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "league_messages" },
        (payload) => {
          try {
            const lg = (payload as any)?.new?.league_id as string | undefined;
            const sender = (payload as any)?.new?.user_id as string | undefined;
            if (!lg) return;
            if (!leagueIdsRef.current.has(lg)) return;
            if (sender && sender === user?.id) return;
            setUnreadByLeague((prev) => ({
              ...prev,
              [lg]: (prev?.[lg] ?? 0) + 1,
            }));
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // When window gains focus (e.g., user read chat and returns), resync unread counts
  useEffect(() => {
    const onFocus = async () => {
      try {
        const { data: reads } = await supabase
          .from("league_message_reads")
          .select("league_id,last_read_at")
          .eq("user_id", user?.id);

        const lastRead = new Map<string, string>();
        (reads ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

        const out: Record<string, number> = {};
        for (const leagueId of leagueIdsRef.current) {
          const since = lastRead.get(leagueId) ?? "1970-01-01T00:00:00Z";
          const { data: msgs, count } = await supabase
            .from("league_messages")
            .select("id", { count: "exact" })
            .eq("league_id", leagueId)
            .gte("created_at", since);
          out[leagueId] = typeof count === "number" ? count : (msgs?.length ?? 0);
        }
        setUnreadByLeague(out);
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);

  const Section: React.FC<{
    title: string;
    subtitle?: React.ReactNode;
    headerRight?: React.ReactNode;
    className?: string;
    boxed?: boolean; // if false, render children without the outer card
    icon?: React.ReactNode;
    children?: React.ReactNode;
  }> = ({ title, subtitle, headerRight, className, boxed = true, icon: _icon, children }) => (
    <section className={className ?? ""}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium text-slate-500 uppercase tracking-wide">
          {title}
        </h2>
          <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center">
            <span className="text-[10px] text-slate-500 font-bold">i</span>
          </div>
        </div>
        {headerRight && (
          <div>
            {headerRight}
          </div>
        )}
      </div>
      {subtitle && (
        <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
      )}
      {boxed ? (
        <div className="mt-3 rounded-2xl border bg-slate-50 overflow-hidden">{children}</div>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </section>
  );


  // Share predictions function
  const sharePredictions = async () => {
    if (!fixtures.length || gwScore === null) return;
    
    try {
      // Calculate score
      let correctCount = 0;
      fixtures.forEach(f => {
        const pick = picksMap[f.fixture_index];
        const result = resultsMap[f.fixture_index];
        if (pick && result && pick === result) correctCount++;
      });

      // Create a hidden container for the shareable image
      const shareContainer = document.createElement('div');
      shareContainer.style.position = 'absolute';
      shareContainer.style.left = '-9999px';
      shareContainer.style.width = '1080px';
      shareContainer.style.height = '1080px';
      shareContainer.style.backgroundColor = '#1C8376'; // TOTL green
      shareContainer.style.padding = '40px';
      shareContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      shareContainer.style.display = 'flex';
      shareContainer.style.flexDirection = 'column';
      shareContainer.style.boxSizing = 'border-box';
      document.body.appendChild(shareContainer);

      // Top section with logo and score
      const topSection = document.createElement('div');
      topSection.style.display = 'flex';
      topSection.style.flexDirection = 'column';
      topSection.style.alignItems = 'center';
      topSection.style.marginBottom = '30px';
      topSection.style.flexShrink = '0';

      // TOTL Logo - load and wait for it
      const logoImg = document.createElement('img');
      logoImg.crossOrigin = 'anonymous';
      logoImg.style.width = '200px';
      logoImg.style.height = 'auto';
      logoImg.style.marginBottom = '20px';
      logoImg.style.filter = 'brightness(0) invert(1)'; // Make logo white
      topSection.appendChild(logoImg);
      
      // Wait for logo to load
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve(); // Continue even if logo fails
        logoImg.src = '/assets/badges/totl-logo1.svg';
      });

      // Game Week and Score
      const scoreSection = document.createElement('div');
      scoreSection.style.textAlign = 'center';
      scoreSection.style.color = '#ffffff';
      scoreSection.innerHTML = `
        <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px; opacity: 0.95;">Game Week ${gw}</div>
        <div style="font-size: 96px; font-weight: 800; margin-bottom: 4px; line-height: 1;">${correctCount}<span style="font-size: 64px; opacity: 0.8;">/${fixtures.length}</span></div>
        <div style="font-size: 24px; font-weight: 600; opacity: 0.9;">Score</div>
      `;
      topSection.appendChild(scoreSection);
      shareContainer.appendChild(topSection);

      // Fixtures grid - 2 rows of 5
      const fixturesGrid = document.createElement('div');
      fixturesGrid.style.display = 'grid';
      fixturesGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
      fixturesGrid.style.gridTemplateRows = 'repeat(2, 1fr)';
      fixturesGrid.style.gap = '12px';
      fixturesGrid.style.flex = '1';
      fixturesGrid.style.minHeight = '0';

      // Sort fixtures by fixture_index to ensure correct order
      const sortedFixtures = [...fixtures].sort((a, b) => a.fixture_index - b.fixture_index);

      // Load all badge images first
      const badgePromises = sortedFixtures.map(f => {
        const homeKey = (f.home_code || f.home_name || f.home_team || "").toUpperCase();
        const awayKey = (f.away_code || f.away_name || f.away_team || "").toUpperCase();
        return Promise.all([
          new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img); // Return even if fails
            img.src = `/assets/badges/${homeKey}.png`;
          }),
          new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            img.src = `/assets/badges/${awayKey}.png`;
          })
        ]);
      });

      await Promise.all(badgePromises);

      sortedFixtures.forEach((f, _idx) => {
        const pick = picksMap[f.fixture_index];
        const result = resultsMap[f.fixture_index];
        const homeKey = (f.home_code || f.home_name || f.home_team || "").toUpperCase();
        const awayKey = (f.away_code || f.away_name || f.away_team || "").toUpperCase();
        const homeName = getMediumName(homeKey);
        const awayName = getMediumName(awayKey);
        const isCorrect = pick && result && pick === result;

        const fixtureCard = document.createElement('div');
        fixtureCard.style.backgroundColor = '#ffffff';
        fixtureCard.style.borderRadius = '16px';
        fixtureCard.style.padding = '16px';
        fixtureCard.style.display = 'flex';
        fixtureCard.style.flexDirection = 'column';
        fixtureCard.style.alignItems = 'center';
        fixtureCard.style.justifyContent = 'center';
        fixtureCard.style.gap = '10px';
        fixtureCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';

        // Teams with badges
        const teamsRow = document.createElement('div');
        teamsRow.style.display = 'flex';
        teamsRow.style.flexDirection = 'column';
        teamsRow.style.alignItems = 'center';
        teamsRow.style.gap = '8px';
        teamsRow.style.width = '100%';

        // Home team
        const homeTeam = document.createElement('div');
        homeTeam.style.display = 'flex';
        homeTeam.style.flexDirection = 'column';
        homeTeam.style.alignItems = 'center';
        homeTeam.style.gap = '4px';
        const homeBadge = document.createElement('img');
        homeBadge.src = `/assets/badges/${homeKey}.png`;
        homeBadge.style.width = '40px';
        homeBadge.style.height = '40px';
        homeBadge.style.objectFit = 'contain';
        homeBadge.onerror = () => { homeBadge.style.display = 'none'; };
        const homeNameDiv = document.createElement('div');
        homeNameDiv.textContent = homeName;
        homeNameDiv.style.fontSize = '14px';
        homeNameDiv.style.fontWeight = '600';
        homeNameDiv.style.color = '#0f172a';
        homeNameDiv.style.textAlign = 'center';
        homeNameDiv.style.lineHeight = '1.2';
        homeTeam.appendChild(homeBadge);
        homeTeam.appendChild(homeNameDiv);
        teamsRow.appendChild(homeTeam);

        // VS divider
        const vsDiv = document.createElement('div');
        vsDiv.textContent = 'vs';
        vsDiv.style.fontSize = '12px';
        vsDiv.style.color = '#64748b';
        vsDiv.style.fontWeight = '500';
        teamsRow.appendChild(vsDiv);

        // Away team
        const awayTeam = document.createElement('div');
        awayTeam.style.display = 'flex';
        awayTeam.style.flexDirection = 'column';
        awayTeam.style.alignItems = 'center';
        awayTeam.style.gap = '4px';
        const awayBadge = document.createElement('img');
        awayBadge.src = `/assets/badges/${awayKey}.png`;
        awayBadge.style.width = '40px';
        awayBadge.style.height = '40px';
        awayBadge.style.objectFit = 'contain';
        awayBadge.onerror = () => { awayBadge.style.display = 'none'; };
        const awayNameDiv = document.createElement('div');
        awayNameDiv.textContent = awayName;
        awayNameDiv.style.fontSize = '14px';
        awayNameDiv.style.fontWeight = '600';
        awayNameDiv.style.color = '#0f172a';
        awayNameDiv.style.textAlign = 'center';
        awayNameDiv.style.lineHeight = '1.2';
        awayTeam.appendChild(awayBadge);
        awayTeam.appendChild(awayNameDiv);
        teamsRow.appendChild(awayTeam);

        fixtureCard.appendChild(teamsRow);

        // Prediction dots
        const predRow = document.createElement('div');
        predRow.style.display = 'flex';
        predRow.style.justifyContent = 'center';
        predRow.style.gap = '8px';
        predRow.style.marginTop = '4px';
        
        ['H', 'D', 'A'].forEach((outcome) => {
          const dot = document.createElement('div');
          dot.style.width = '24px';
          dot.style.height = '24px';
          dot.style.borderRadius = '50%';
          dot.style.border = '2px solid #ffffff';
          
          if (pick === outcome) {
            if (isCorrect) {
              dot.style.background = 'linear-gradient(135deg, #fbbf24, #f97316, #ec4899, #9333ea)';
              dot.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.5)';
            } else {
              dot.style.backgroundColor = '#ef4444';
            }
          } else if (result === outcome) {
            dot.style.backgroundColor = '#d1d5db';
          } else {
            dot.style.backgroundColor = 'transparent';
            dot.style.border = '2px solid #e2e8f0';
          }
          
          predRow.appendChild(dot);
        });
        
        fixtureCard.appendChild(predRow);
        fixturesGrid.appendChild(fixtureCard);
      });

      shareContainer.appendChild(fixturesGrid);

      // Wait for all images to load
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate image
      const canvas = await html2canvas(shareContainer, {
        width: 1080,
        height: 1080,
        scale: 1,
        backgroundColor: '#1C8376', // TOTL green
        useCORS: true,
        logging: false,
        allowTaint: false,
      });

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          document.body.removeChild(shareContainer);
          return;
        }

        const file = new File([blob], `gw${gw}-predictions.png`, { type: 'image/png' });

        // Try Web Share API with file (works on iOS Safari and Android Chrome)
        if (navigator.share) {
          // Check if we're on a mobile device
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          
          if (isMobile) {
            // On mobile, try to share the file directly
            try {
              // Try with canShare check first
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                  files: [file],
                  title: `Game Week ${gw} Predictions`,
                  text: `My Game Week ${gw} predictions: ${correctCount}/${fixtures.length}`,
                });
                document.body.removeChild(shareContainer);
                return;
              }
              // If canShare doesn't work, try sharing anyway (some browsers support it but canShare returns false)
              await navigator.share({
                files: [file],
                title: `Game Week ${gw} Predictions`,
                text: `My Game Week ${gw} predictions: ${correctCount}/${fixtures.length}`,
              });
              document.body.removeChild(shareContainer);
              return;
            } catch (err: any) {
              // If user cancels, just return
              if (err.name === 'AbortError' || err.message?.includes('cancel')) {
                document.body.removeChild(shareContainer);
                return;
              }
              // If file sharing isn't supported, fall through to download
              console.log('File sharing not supported, falling back to download');
            }
          }
        }

        // Fallback: download the file (desktop or if share fails)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gw${gw}-predictions.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        document.body.removeChild(shareContainer);
      }, 'image/png');
    } catch (error) {
      console.error('Error sharing predictions:', error);
      alert('Failed to generate shareable image. Please try again.');
    }
  };

  const SkeletonLoader = () => (
    <>
      {/* Leaderboard Skeleton */}
      <Section title="Leaderboards" boxed={false}>
        <div className="grid grid-cols-2 gap-4">
          {/* Global Leaderboard Skeleton */}
          <div className="h-full rounded-3xl border-2 border-slate-200 bg-slate-50/80 p-4 sm:p-6 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-slate-200 flex-shrink-0" />
            </div>
            <div className="mt-2">
              <div className="h-6 w-32 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-5 w-16 bg-slate-200 rounded" />
              <div className="h-5 w-12 bg-slate-200 rounded" />
            </div>
          </div>
          {/* GW Card Skeleton */}
          <div className="h-full rounded-3xl border-2 border-slate-200 bg-amber-50/60 p-4 sm:p-6 animate-pulse relative">
            <div className="absolute top-4 left-4 h-4 w-12 bg-slate-200 rounded" />
            <div className="absolute bottom-4 left-4 h-4 w-32 bg-slate-200 rounded" />
            <div className="flex items-center justify-center h-full">
              <div className="h-16 w-16 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </Section>

      {/* Mini Leagues Skeleton */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-2" style={{ width: 'max-content' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="rounded-xl border bg-white overflow-hidden shadow-sm w-[320px] animate-pulse"
                    style={{ borderRadius: '12px' }}
                  >
                    <div className="p-4 bg-white relative">
                      <div className="flex items-start gap-3 relative">
                        {/* Avatar skeleton */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-200" />
                        <div className="flex-1 min-w-0 h-12 flex flex-col justify-between">
                          {/* League name skeleton */}
                          <div className="h-5 w-32 bg-slate-200 rounded -mt-0.5" />
                          {/* Player chips skeleton */}
                          <div className="flex items-center overflow-hidden">
                            {[1, 2, 3, 4].map((k) => (
                                <div
                                  key={k}
                                className={`chip-skeleton rounded-full bg-slate-200 flex-shrink-0 ${k > 1 ? 'chip-skeleton-overlap' : ''}`}
                                  style={{
                                  width: '24px',
                                  height: '24px',
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        {/* Badge skeleton - top right */}
                        <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                          <div className="h-6 w-6 rounded-full bg-slate-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Games Section Skeleton (if it exists) */}
      <section className="mt-8">
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mb-3" />
        <div className="rounded-2xl border bg-slate-50 overflow-hidden p-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white rounded-lg border border-slate-200 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    </>
  );

  return (
    <div 
      ref={containerRef}
      className={`max-w-6xl mx-auto px-4 py-4 min-h-screen relative ${oldSchoolMode ? 'oldschool-theme' : ''}`}
    >
      {/* Pull-to-refresh indicator */}
      {shouldShowIndicator && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
          style={{
            transform: `translateY(${Math.max(0, pullDistance - 40)}px)`,
            opacity: spinnerOpacity,
            transition: isRefreshing ? 'opacity 0.3s' : 'none',
          }}
        >
          <div
            className="w-8 h-8 rounded-full border-2 border-slate-400 border-t-transparent"
            style={{
              transform: `rotate(${isRefreshing ? spinnerRotation + 360 : spinnerRotation}deg)`,
              transition: isRefreshing ? 'transform 0.5s linear infinite' : 'none',
            }}
          />
        </div>
      )}
      <WhatsAppBanner />
      {(loading || leagueDataLoading) && isInitialMountRef.current ? (
        <SkeletonLoader />
      ) : (
        <>
          {/* Leaderboards */}
          <Section title="Leaderboards" boxed={false}>
            <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
                {/* Box 1: Last GW Leaderboard */}
                <Link to="/global?tab=lastgw" className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden cursor-pointer block">
                  <div className="p-3 h-full flex flex-col relative">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-baseline gap-[3px]" style={{ marginTop: '-4px' }}>
                        {lastGwRank ? (
                          <>
                            <span className="text-[#1C8376]" style={{ fontSize: '38px', fontWeight: 'normal', lineHeight: '1' }}>{lastGwRank.score}</span>
                            <div className="flex items-baseline gap-[4px]">
                              <span className="text-slate-500" style={{ fontSize: '18px', fontWeight: 'normal', lineHeight: '1' }}>/</span>
                              <span className="text-slate-500" style={{ fontSize: '18px', fontWeight: 'normal', lineHeight: '1' }}>{lastGwRank.totalFixtures}</span>
                            </div>
                          </>
                        ) : (
                          <span className="leading-none text-slate-900">—</span>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="mt-auto">
                      <div className="text-xs text-slate-500 mb-2">GAME WEEK {lastGwRank?.gw ?? '—'}</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-slate-900">
                          {lastGwRank && lastGwRank.total > 0 
                            ? `TOP ${Math.round((lastGwRank.rank / lastGwRank.total) * 100)}%`
                            : "—"}
                        </span>
              </div>
                    </div>
                  </div>
                </Link>

                {/* Box 2: 5-WEEK FORM */}
                <Link to="/global?tab=form5" className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden cursor-pointer block">
                  <div className="p-3 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <img src="/assets/5-week-form-badge.png" alt="5-Week Form Badge" className="w-[32px] h-[32px]" />
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="mt-auto">
                      <div className="text-xs text-slate-500 mb-2">5-WEEK FORM</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-slate-900">
                          {fiveGwRank && fiveGwRank.total > 0 
                            ? `TOP ${Math.round((fiveGwRank.rank / fiveGwRank.total) * 100)}%`
                            : "—"}
                        </span>
                    </div>
                    </div>
                  </div>
                </Link>

                {/* Box 3: 10-WEEK FORM */}
                <Link to="/global?tab=form10" className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden cursor-pointer block">
                  <div className="p-3 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <img src="/assets/10-week-form-badge.png" alt="10-Week Form Badge" className="w-[32px] h-[32px]" />
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="mt-auto">
                      <div className="text-xs text-slate-500 mb-2">10-WEEK FORM</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-slate-900">
                          {tenGwRank && tenGwRank.total > 0 
                            ? `TOP ${Math.round((tenGwRank.rank / tenGwRank.total) * 100)}%`
                            : "—"}
                        </span>
                    </div>
                    </div>
                  </div>
                </Link>

                {/* Box 4: SEASON RANK */}
                <Link to="/global?tab=overall" className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden cursor-pointer block">
                  <div className="p-3 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <img src="/assets/season-rank-badge.png" alt="Season Rank Badge" className="w-[32px] h-[32px]" />
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="mt-auto">
                      <div className="text-xs text-slate-500 mb-2">SEASON RANK</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-slate-900">
                          {seasonRank && seasonRank.total > 0 
                            ? `TOP ${Math.round((seasonRank.rank / seasonRank.total) * 100)}%`
                            : "—"}
                        </span>
                    </div>
                    </div>
                  </div>
                </Link>

                {/* Streak Box */}
                {userStreakData && (
                  <div className="flex-shrink-0 w-[340px] sm:w-[400px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow relative">
                    <div className="p-3 h-full flex flex-col">
                      {/* Spacer to push content down */}
                      <div className="flex-1"></div>
                      
                      {/* Bar Graph just above text */}
                      <div className="mb-2 relative" style={{ height: '70px' }}>
                        {(() => {
                          const scores = userStreakData.last10GwScores;
                          const playedScores = scores.filter(s => s.score !== null);
                          const maxScore = playedScores.length > 0 ? Math.max(...playedScores.map(s => s.score!)) : 10;
                          const minScore = 0;
                          const range = maxScore - minScore || 1;
                          const graphHeight = 60;
                          
                          return (
                            <div className="relative h-full">
                              {/* Bar Graph */}
                              <div className="flex items-end justify-between gap-1 h-full px-1">
                                {scores.map((gwData, _index) => {
                                  const isPlayed = gwData.score !== null;
                                  const isLatest = gwData.gw === latestGw;
                                  const score = gwData.score ?? 0;
                                  const barHeight = isPlayed ? ((score - minScore) / range) * graphHeight : 0;
                                  
                                  return (
                                    <div
                                      key={gwData.gw}
                                      className="flex flex-col items-center justify-end gap-1 flex-1 relative min-w-0"
                                    >
                                      {/* Score number above bar */}
                                      {isPlayed && (
                                        <div
                                          className={`text-xs font-bold mb-0.5 leading-none ${
                                            isLatest ? 'text-[#1C8376]' : 'text-slate-700'
                                          }`}
                                        >
                                          {score}
                                        </div>
                                      )}
                                      
                                      {/* Bar */}
                                      <div
                                        className={`w-full rounded-t transition-all ${
                                          isPlayed
                                            ? isLatest
                                              ? 'bg-[#1C8376]'
                                              : 'bg-slate-400'
                                            : 'bg-slate-200'
                                        }`}
                                        style={{
                                          height: `${barHeight}px`,
                                          minHeight: isPlayed ? '4px' : '0'
                                        }}
                                        title={isPlayed ? `GW${gwData.gw}: ${score}` : `GW${gwData.gw}: Not played`}
                                      />
                                      
                                      {/* GW label */}
                                      <div
                                        className={`text-[10px] font-medium leading-tight ${
                                          isPlayed
                                            ? isLatest
                                              ? 'text-[#1C8376] font-bold'
                                              : 'text-slate-700'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        GW{gwData.gw}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Bottom text row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" strokeWidth={2} />
                            <circle cx="12" cy="12" r="6" strokeWidth={2} />
                            <circle cx="12" cy="12" r="2" fill="currentColor" />
                          </svg>
                          <span className="text-sm font-semibold text-slate-900">
                            Your Streak{' '}
                            <span className="font-bold text-orange-500">
                              {userStreakData.streak > 0 
                                ? `${userStreakData.streak} ${userStreakData.streak === 1 ? 'Week' : 'Weeks'}`
                                : 'Start your streak!'}
                            </span>
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400">Last 10</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
        </div>
      </Section>

      {/* Mini Leagues section */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-slate-500 uppercase tracking-wide">
            Mini Leagues
          </h2>
            <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center">
              <span className="text-[10px] text-slate-500 font-bold">i</span>
            </div>
          </div>
        </div>
        <div>
          {(() => {
            console.log('[Home] Mini Leagues render check:', { loading, isInitialMount: isInitialMountRef.current, leaguesLength: leagues.length });
            return null;
          })()}
          {(loading || leagueDataLoading) && isInitialMountRef.current && leagues.length === 0 ? (
            <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="rounded-xl border bg-white overflow-hidden shadow-sm w-[320px] animate-pulse"
                        style={{ borderRadius: '12px' }}
                      >
                        <div className="p-4 bg-white relative">
                          <div className="flex items-start gap-3 relative">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-200" />
                            <div className="flex-1 min-w-0 h-12 flex flex-col justify-between">
                              <div className="h-5 w-32 bg-slate-200 rounded -mt-0.5" />
                              <div className="flex items-center overflow-hidden">
                                {[1, 2, 3, 4].map((k) => (
                                    <div
                                      key={k}
                                    className={`chip-skeleton rounded-full bg-slate-200 flex-shrink-0 ${k > 1 ? 'chip-skeleton-overlap' : ''}`}
                                      style={{
                                      width: '24px',
                                      height: '24px',
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                              <div className="h-6 w-6 rounded-full bg-slate-200" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : !loading && leagues.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border border-slate-200 text-center">
              <div className="text-slate-600 mb-3">You don't have any mini leagues yet.</div>
              <Link 
                to="/leagues" 
                className="inline-block px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg hover:bg-[#1C8376]/80 transition-colors no-underline"
              >
                Create one now!
              </Link>
            </div>
          ) : (
            <div 
              className="overflow-x-auto -mx-4 px-4 scrollbar-hide" 
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none', 
                WebkitOverflowScrolling: 'touch', 
                overscrollBehaviorX: 'contain'
              }}
            >
              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
                {(() => {
                  // Sort leagues: those with unread messages first, then alphabetically
                  const sortedLeagues = [...leagues].sort((a, b) => {
                    const unreadA = unreadByLeague?.[a.id] ?? 0;
                    const unreadB = unreadByLeague?.[b.id] ?? 0;
                    if (unreadA > 0 && unreadB === 0) return -1;
                    if (unreadA === 0 && unreadB > 0) return 1;
                    // If same unread status, sort alphabetically
                    return a.name.localeCompare(b.name);
                  });
                  
                  // Group into batches of 3
                  return Array.from({ length: Math.ceil(sortedLeagues.length / 3) }).map((_, batchIdx) => {
                    const startIdx = batchIdx * 3;
                    const batchLeagues = sortedLeagues.slice(startIdx, startIdx + 3);
                    
                    return (
                      <div key={batchIdx} className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm w-[320px]">
                        {batchLeagues.map((l, index) => {
                        const unread = unreadByLeague?.[l.id] ?? 0;
                        const badge = unread > 0 ? Math.min(unread, 99) : 0;
                        const data = leagueData[l.id];
                        
                        const members = data?.members || [];
                        
                  // DEBUG for all leagues - check data structure
                  if (l.name?.toLowerCase().includes('prem')) {
                          console.error(`[${l.name}] === RENDERING ===`);
                          console.error(`League ID:`, l.id);
                          console.error(`hasData:`, !!data);
                          console.error(`data?.sortedMemberIds:`, data?.sortedMemberIds);
                    console.error(`data?.sortedMemberIds length:`, data?.sortedMemberIds?.length);
                    console.error(`data?.submittedMembers:`, data?.submittedMembers);
                    console.error(`data?.submittedMembers type:`, typeof data?.submittedMembers);
                    console.error(`data?.submittedMembers is Set:`, data?.submittedMembers instanceof Set);
                    console.error(`data?.latestGwWinners:`, data?.latestGwWinners);
                    console.error(`data?.latestGwWinners type:`, typeof data?.latestGwWinners);
                    console.error(`data?.latestGwWinners is Set:`, data?.latestGwWinners instanceof Set);
                          console.error(`members count:`, members.length);
                    console.error(`members:`, members.map(m => ({ id: m.id, name: m.name })));
                        }
                        
                        return (
                            <div key={l.id} className={index < batchLeagues.length - 1 ? 'relative' : ''}>
                              {index < batchLeagues.length - 1 && (
                                <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-10 pointer-events-none" />
                              )}
                              <Link
                                to={`/league/${l.code}`}
                                className="block p-4 !bg-white no-underline hover:text-inherit relative z-20"
                                style={{ 
                                  pointerEvents: 'auto', 
                                  cursor: 'pointer', 
                                  position: 'relative',
                                  WebkitTapHighlightColor: 'transparent',
                                  touchAction: 'manipulation',
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none'
                                }}
                                onClick={(e) => {
                                  // Ensure click works
                                  e.stopPropagation();
                                }}
                              >
                                <div className="flex items-start gap-3 relative">
                                  {/* League Avatar Badge */}
                                  <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-slate-100">
                                    <img 
                                      src={getGenericLeaguePhoto(l.id, 96)} 
                                      alt={`${l.name} avatar`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        // Fallback to Picsum Photos if Unsplash fails
                                        const target = e.target as HTMLImageElement;
                                        const fallbackSrc = getGenericLeaguePhotoPicsum(l.id, 96);
                                        if (target.src !== fallbackSrc) {
                                          target.src = fallbackSrc;
                                        } else {
                                          // If Picsum also fails, show calendar icon
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent && !parent.querySelector('svg')) {
                                          parent.innerHTML = `
                                            <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                          `;
                                          }
                                        }
                                      }}
                                    />
                                  </div>
                                  
                                  <div className="flex-1 min-w-0 h-12 flex flex-col justify-between">
                                    {/* League Name */}
                                    <div className="text-base font-semibold text-slate-900 truncate -mt-0.5">
                                      {l.name}
                                    </div>
                                    
                                    {/* Player Chips - ordered by ML table position (1st to last) */}
                                    <div className="flex items-center overflow-hidden">
                                        {(() => {
                                          // CRITICAL: Use ML table order - MUST use sortedMemberIds from data
                                          const orderedMemberIds = data?.sortedMemberIds;
                                          
                                          // CRITICAL: If no sortedMemberIds, we can't render correctly - show error
                                          if (!orderedMemberIds || orderedMemberIds.length === 0) {
                                            // Fallback to alphabetical - but this shouldn't happen
                                            const alphabeticalMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
                                            
                                            // Convert Arrays back to Sets for checking (if they're Arrays)
                                            const submittedSet = data?.submittedMembers instanceof Set 
                                              ? data.submittedMembers 
                                              : new Set(data?.submittedMembers ?? []);
                                            const winnersSet = data?.latestGwWinners instanceof Set 
                                              ? data.latestGwWinners 
                                              : new Set(data?.latestGwWinners ?? []);
                                            
                                            return alphabeticalMembers.slice(0, 8).map((member, index) => {
                                              const hasSubmitted = submittedSet.has(member.id);
                                              const isLatestWinner = winnersSet.has(member.id);
                                              
                                              // GPU-optimized: Use CSS classes instead of inline styles
                                              let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
                                              
                                              if (isLatestWinner) {
                                                // Shiny chip for last GW winner (already GPU-optimized with transforms)
                                                chipClassName += ' bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]';
                                              } else if (hasSubmitted) {
                                                // Green = picked (GPU-optimized class)
                                                chipClassName += ' chip-green';
                                              } else {
                                                // Grey = not picked (GPU-optimized class)
                                                chipClassName += ' chip-grey';
                                              }
                                              
                                              // GPU-optimized: Use transform instead of marginLeft
                                              if (index > 0) {
                                                chipClassName += ' chip-overlap';
                                              }
                                              
                                              return (
                                          <div
                                            key={member.id}
                                                  className={chipClassName}
                                            title={member.name}
                                          >
                                            {initials(member.name)}
                                          </div>
                                              );
                                            });
                                          }
                                          
                                          // Map IDs to members in ML table order
                                          const orderedMembers = orderedMemberIds
                                            .map(id => members.find(m => m.id === id))
                                            .filter(Boolean) as LeagueMember[];
                                          
                                          // Convert Arrays back to Sets for checking (if they're Arrays)
                                          const submittedSet = data?.submittedMembers instanceof Set 
                                            ? data.submittedMembers 
                                            : new Set(data?.submittedMembers ?? []);
                                          const winnersSet = data?.latestGwWinners instanceof Set 
                                            ? data.latestGwWinners 
                                            : new Set(data?.latestGwWinners ?? []);
                                          
                                          // DEBUG: Log chip data - EXPANDED
                                          const chipStatus = orderedMembers.slice(0, 8).map(m => ({
                                            name: m.name,
                                            initials: initials(m.name),
                                            id: m.id,
                                            hasSubmitted: submittedSet.has(m.id),
                                            isLatestWinner: winnersSet.has(m.id),
                                            willBeShiny: winnersSet.has(m.id),
                                            willBeGreen: !winnersSet.has(m.id) && submittedSet.has(m.id),
                                            willBeGrey: !winnersSet.has(m.id) && !submittedSet.has(m.id)
                                          }));
                                          console.log(`[${l.name}] Chip data:`, {
                                            orderedMemberIds: orderedMemberIds.slice(0, 8),
                                            orderedMembersNames: orderedMembers.slice(0, 8).map(m => m.name),
                                            orderedMembersInitials: orderedMembers.slice(0, 8).map(m => initials(m.name)),
                                            submittedMembersArray: Array.from(submittedSet),
                                            latestGwWinnersArray: Array.from(winnersSet),
                                            chipStatus
                                          });
                                          
                                          // CRITICAL: Ensure we're using the exact order from sortedMemberIds
                                          return orderedMembers.slice(0, 8).map((member, index) => {
                                            const hasSubmitted = submittedSet.has(member.id);
                                            const isLatestWinner = winnersSet.has(member.id);
                                            
                                            // GPU-optimized: Use CSS classes instead of inline styles
                                            let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
                                            
                                            if (isLatestWinner) {
                                              // Shiny chip for last GW winner (already GPU-optimized with transforms)
                                              chipClassName += ' bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]';
                                            } else if (hasSubmitted) {
                                              // Green = picked (GPU-optimized class)
                                              chipClassName += ' chip-green';
                                            } else {
                                              // Grey = not picked (GPU-optimized class)
                                              chipClassName += ' chip-grey';
                                            }
                                            
                                            // GPU-optimized: Use transform instead of marginLeft
                                            if (index > 0) {
                                              chipClassName += ' chip-overlap';
                                            }
                                            
                                            return (
                                              <div
                                                key={member.id}
                                                className={chipClassName}
                                                title={member.name}
                                              >
                                                {initials(member.name)}
                                              </div>
                                            );
                                          });
                                        })()}
                                        {(() => {
                                          const orderedMemberIds = data?.sortedMemberIds || members.map(m => m.id);
                                          const totalMembers = orderedMemberIds.length;
                                          return totalMembers > 8 && (
                                            <div 
                                              className={`chip-container chip-grey rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${totalMembers > 1 ? 'chip-overlap' : ''}`}
                                              style={{ 
                                                width: '24px', 
                                                height: '24px',
                                            }}
                                          >
                                              +{totalMembers - 8}
                                          </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                  
                                {/* Unread Badge and Arrow - Top Right */}
                                <div className="absolute top-4 right-4 flex items-center gap-1.5 z-30 pointer-events-none">
                                    {badge > 0 && (
                                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold pointer-events-none">
                                        {badge}
                                      </span>
                                    )}
                                  <svg className="w-5 h-5 text-slate-400 flex-shrink-0 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Games (first GW) */}
      <section className="mt-[45px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-slate-500 uppercase tracking-wide">
              Games
          </h2>
            <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center">
              <span className="text-[10px] text-slate-500 font-bold">i</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gwScore !== null && (
              <button
                onClick={sharePredictions}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 transition-all cursor-pointer"
                title="Share your predictions"
              >
                <span className="text-xs sm:text-sm font-medium opacity-90">Score</span>
                <span className="flex items-baseline gap-0.5">
                  <span className="text-lg sm:text-xl font-extrabold">{gwScore}</span>
                  <span className="text-sm sm:text-base font-medium opacity-90">/</span>
                  <span className="text-base sm:text-lg font-semibold opacity-80">{fixtures.length}</span>
                </span>
                <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            )}
          {fixtures.length > 0 && !gwSubmitted && gwScore === null && (
              <Link to="/new-predictions" className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors no-underline">Make your predictions</Link>
          )}
        </div>
          </div>
          {nextGwComing ? (
          <div className="mb-2">
            <span className="text-slate-600 font-semibold">GW{nextGwComing} coming soon</span>
            </div>
          ) : null}
        {fixtures.length === 0 ? (
          <div className="p-4 text-slate-500">No fixtures yet.</div>
        ) : (
          <div className="mt-6">
            <div className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm">
              {fixtures.map((f, index) => {
                        const pick = picksMap[f.fixture_index];
                const result = resultsMap[f.fixture_index];
                        const homeKey = f.home_code || f.home_name || f.home_team || "";
                        const awayKey = f.away_code || f.away_name || f.away_team || "";

                        const homeName = getMediumName(homeKey);
                        const awayName = getMediumName(awayKey);

                const kickoff = f.kickoff_time
                                      ? (() => {
                                          const d = new Date(f.kickoff_time);
                                          const hh = String(d.getUTCHours()).padStart(2, '0');
                                          const mm = String(d.getUTCMinutes()).padStart(2, '0');
                                          return `${hh}:${mm}`;
                                        })()
                  : "—";

                // Determine button states
                const getButtonState = (side: "H" | "D" | "A") => {
                  const isPicked = pick === side;
                  const isCorrectResult = result === side;
                  const isCorrect = isPicked && isCorrectResult;
                  const isWrong = isPicked && result && result !== side;
                  return { isPicked, isCorrectResult, isCorrect, isWrong };
                };

                const homeState = getButtonState("H");
                const drawState = getButtonState("D");
                const awayState = getButtonState("A");

                // Button styling helper
                const getButtonClass = (state: { isPicked: boolean; isCorrectResult: boolean; isCorrect: boolean; isWrong: boolean }) => {
                  const base = "h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center select-none";
                  if (state.isCorrect) {
                    return `${base} bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white !border-0 !border-none shadow-2xl shadow-yellow-400/40 transform scale-110 rotate-1 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]`;
                  } else if (state.isCorrectResult) {
                    return `${base} bg-emerald-600 text-white border-emerald-600`;
                  } else if (state.isWrong) {
                    return `${base} bg-rose-100 text-rose-700 border-rose-200`;
                  } else if (state.isPicked) {
                    return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
                  } else {
                    return `${base} bg-slate-50 text-slate-600 border-slate-200`;
                  }
                };

                return (
                  <div key={f.id} className={index < fixtures.length - 1 ? 'relative' : ''}>
                    {index < fixtures.length - 1 && (
                      <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-10" />
                    )}
                    <div className="p-4 !bg-white relative z-0">
                      {/* header: Home  kickoff  Away */}
                      <div className="flex items-center px-2 pt-1 pb-3">
                        <div className="flex items-center gap-1 flex-1 justify-end">
                          <div className="truncate font-medium">{homeName}</div>
                          <img 
                            src={`/assets/badges/${(f.home_code || homeKey).toUpperCase()}.png`} 
                            alt={homeName}
                            className="w-5 h-5"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                                  </div>
                        <div className="text-slate-500 text-sm px-4">
                          {kickoff}
                                </div>
                        <div className="flex items-center gap-1 flex-1 justify-start">
                          <img 
                            src={`/assets/badges/${(f.away_code || awayKey).toUpperCase()}.png`} 
                            alt={awayName}
                            className="w-5 h-5"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="truncate font-medium">{awayName}</div>
                                </div>
                              </div>

                      {/* buttons: Home Win, Draw, Away Win */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className={getButtonClass(homeState)}>
                          <span className={homeState.isCorrect ? "font-bold" : ""}>Home Win</span>
                                  </div>
                        <div className={getButtonClass(drawState)}>
                          <span className={drawState.isCorrect ? "font-bold" : ""}>Draw</span>
                                </div>
                        <div className={getButtonClass(awayState)}>
                          <span className={awayState.isCorrect ? "font-bold" : ""}>Away Win</span>
                                  </div>
                                </div>
                                  </div>
                                </div>
                        );
                      })}
            </div>
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
