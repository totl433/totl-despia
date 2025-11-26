import { useEffect, useState, useMemo, memo } from "react";
import { Link } from "react-router-dom";
import { getLeagueAvatarUrl, getDefaultMlAvatar, getDeterministicLeagueAvatar } from "../lib/leagueAvatars";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

type League = { id: string; name: string; code: string; created_at: string; avatar?: string | null; start_gw?: number | null };
type LeagueRow = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  submittedCount?: number;
  avatar?: string | null;
  created_at?: string | null;
  start_gw?: number | null;
};
type LeagueMember = { id: string; name: string };
type LeagueData = {
  id: string;
  members: LeagueMember[];
  userPosition: number | null;
  positionChange: 'up' | 'down' | 'same' | null;
  submittedMembers?: Set<string>; // Set of user IDs who have submitted for current GW
  sortedMemberIds?: string[]; // Member IDs in ML table order (1st to last)
  latestGwWinners?: Set<string>; // Members who topped the most recent completed GW
  latestRelevantGw?: number | null; // The GW number that latestGwWinners is from (needed to know when to hide shiny chips)
};


// Helper function to convert number to ordinal (1st, 2nd, 3rd, etc.)
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (typeof r.home_goals === "number" && typeof r.away_goals === "number") {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}

function toStringSet(value?: Set<string> | string[] | undefined) {
  if (!value) return new Set<string>();
  return value instanceof Set ? value : new Set(value);
}

// Module-level cache for Tables page data
type TablesPageCache = {
  rows: LeagueRow[];
  leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
  leagueData: Record<string, LeagueData>;
  unreadByLeague: Record<string, number>;
  lastFetched: number;
  userId: string | null;
};

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
let tablesPageCache: TablesPageCache | null = null;

export default function TablesPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [leagueDataLoading, setLeagueDataLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [error, setError] = useState("");
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>({});
  const [leagueData, setLeagueData] = useState<Record<string, LeagueData>>({});
  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});
  const [currentGw, setCurrentGw] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      // Require an authenticated user
      if (!user?.id) {
        setRows([]);
        setLoading(false);
        return;
      }

      // A) league IDs this user belongs to
      const { data: myMemberships, error: memErr } = await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", user.id);

      if (memErr) throw memErr;

      const leagueIds = (myMemberships ?? []).map((r: any) => r.league_id);
      if (!leagueIds.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      // B) fetch only those leagues
      let leagues: League[] = [];
      const { data: leaguesData, error: lErr } = await supabase
        .from("leagues")
        .select("id,name,code,created_at,avatar,start_gw")
        .in("id", leagueIds)
        .order("created_at", { ascending: true });

      if (lErr) {
        console.error("Error fetching leagues with avatar:", lErr);
        // Try without avatar field if it doesn't exist
        const { data: leaguesDataFallback, error: lErrFallback } = await supabase
          .from("leagues")
          .select("id,name,code,created_at")
          .in("id", leagueIds)
          .order("created_at", { ascending: true });
        if (lErrFallback) throw lErrFallback;
        leagues = (leaguesDataFallback ?? []) as any;
      } else {
        leagues = (leaguesData ?? []) as any;
      }

      // Assign avatars to leagues that don't have one (backfill - only once)
      // Use deterministic avatar based on league ID so it's consistent even if DB update fails
      // OPTIMIZED: Just assign locally, don't block on DB updates
      const leaguesNeedingAvatars = leagues.filter(l => !l.avatar || l.avatar === null || l.avatar === '');
      if (leaguesNeedingAvatars.length > 0) {
        // Assign locally immediately (non-blocking)
        leaguesNeedingAvatars.forEach(league => {
          league.avatar = getDeterministicLeagueAvatar(league.id);
        });
        
        // Update database in background (non-blocking, don't wait)
        void Promise.all(leaguesNeedingAvatars.map(league => {
          const avatar = getDeterministicLeagueAvatar(league.id);
          return Promise.resolve(supabase
            .from("leagues")
            .update({ avatar })
            .eq("id", league.id)
            .then(() => console.log(`Assigned avatar ${avatar} to league ${league.name}`))
          ).catch((err: any) => console.warn(`Failed to assign avatar to league ${league.id}:`, err));
        })).catch(() => {}); // Ignore errors in background update
      }

      if (!leagues.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      // C) members for those leagues
      const { data: memData, error: mErr } = await supabase
        .from("league_members")
        .select("league_id,user_id")
        .in("league_id", leagues.map((l) => l.id));

      if (mErr) throw mErr;

      const membersByLeague = new Map<string, string[]>();
      (memData ?? []).forEach((r: any) => {
        const arr = membersByLeague.get(r.league_id) ?? [];
        arr.push(r.user_id);
        membersByLeague.set(r.league_id, arr);
      });

      // D) determine current GW (match Home.tsx logic)
      const { data: fx } = await supabase
        .from("fixtures")
        .select("gw")
        .order("gw", { ascending: false });

      const fixturesList = (fx as Array<{ gw: number }>) ?? [];
      const currentGw = fixturesList.length
        ? Math.max(...fixturesList.map((f) => f.gw))
        : 1;

      // E) submission status per league (all members submitted?) - OPTIMIZED: batch query
      const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
      
      // Get all member IDs across all leagues
      const allMemberIds = Array.from(new Set(Array.from(membersByLeague.values()).flat()));
      
      // Check if API Test league exists and get current test GW
      const apiTestLeague = leagues.find(l => l.name === "API Test");
      let currentTestGw: number | null = null;
      let testApiSubmittedUserIds = new Set<string>();
      
      if (apiTestLeague) {
        // Fetch current test GW from meta table
        const { data: testMetaData } = await supabase
          .from("test_api_meta")
          .select("current_test_gw")
          .eq("id", 1)
          .maybeSingle();
        
        currentTestGw = testMetaData?.current_test_gw ?? 1;
        
        // Get API Test league member IDs
        const apiTestMemberIds = membersByLeague.get(apiTestLeague.id) ?? [];
        if (apiTestMemberIds.length > 0) {
          // Fetch test API submissions for current test GW
          const { data: testSubsData } = await supabase
            .from("test_api_submissions")
            .select("user_id")
            .eq("matchday", currentTestGw)
            .in("user_id", apiTestMemberIds)
            .not("submitted_at", "is", null);
          
          testApiSubmittedUserIds = new Set((testSubsData ?? []).map((s: any) => s.user_id));
        }
      }
      
      if (allMemberIds.length > 0) {
        // Single query for all regular submissions (excluding API Test league members)
        const regularMemberIds = apiTestLeague 
          ? allMemberIds.filter(id => !membersByLeague.get(apiTestLeague.id)?.includes(id))
          : allMemberIds;
        
        const { data: allSubmissions } = regularMemberIds.length > 0
          ? await supabase
              .from("gw_submissions")
              .select("user_id")
              .eq("gw", currentGw)
              .in("user_id", regularMemberIds)
          : { data: [] };

        const submittedUserIds = new Set((allSubmissions ?? []).map((s: any) => s.user_id));
        
        // Calculate submission status for each league
        for (const league of leagues) {
          const memberIds = membersByLeague.get(league.id) ?? [];
          const totalCount = memberIds.length;
          
          // Use test API submissions for API Test league, regular submissions for others
          const submittedCount = league.id === apiTestLeague?.id
            ? memberIds.filter(id => testApiSubmittedUserIds.has(id)).length
            : memberIds.filter(id => submittedUserIds.has(id)).length;
          
          submissionStatus[league.id] = {
            allSubmitted: submittedCount === totalCount && totalCount > 0,
            submittedCount,
            totalCount
          };
        }
      } else {
        // No members, set defaults
        for (const league of leagues) {
          submissionStatus[league.id] = {
            allSubmitted: false,
            submittedCount: 0,
            totalCount: 0
          };
        }
      }
      setLeagueSubmissions(submissionStatus);

      // G) Fetch unread message counts - OPTIMIZED: batch query
      const unreadCounts: Record<string, number> = {};
      try {
        const { data: reads } = await supabase
          .from("league_message_reads")
          .select("league_id,last_read_at")
          .eq("user_id", user.id);

        const lastRead = new Map<string, string>();
        (reads ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

        // Batch query: fetch all unread messages for all leagues at once
        const leagueIds = leagues.map(l => l.id);
        if (leagueIds.length > 0) {
          const sinceMap = new Map<string, string>();
          leagueIds.forEach(id => {
            sinceMap.set(id, lastRead.get(id) ?? "1970-01-01T00:00:00Z");
          });
          
          // Get the earliest timestamp to use as a filter
          const earliestSince = Math.min(...Array.from(sinceMap.values()).map(s => new Date(s).getTime()));
          const earliestSinceStr = new Date(earliestSince).toISOString();
          
          // Fetch all messages for all leagues since earliest read
          const { data: allMessages } = await supabase
            .from("league_messages")
            .select("id,league_id,created_at")
            .in("league_id", leagueIds)
            .gte("created_at", earliestSinceStr);
          
          // Count unread per league
          leagueIds.forEach(leagueId => {
            const since = sinceMap.get(leagueId)!;
            const unread = (allMessages ?? []).filter((m: any) => 
              m.league_id === leagueId && new Date(m.created_at) > new Date(since)
            ).length;
            unreadCounts[leagueId] = unread;
          });
        }
      } catch (e) {
        // Best effort - ignore errors
        console.warn("Failed to fetch unread counts:", e);
      }
      setUnreadByLeague(unreadCounts);

      // F) build rows
      const out: LeagueRow[] = leagues.map((l) => {
        const memberIds = membersByLeague.get(l.id) ?? [];
        return {
          id: l.id,
          name: l.name,
          code: l.code,
          memberCount: memberIds.length,
          avatar: l.avatar,
          created_at: l.created_at,
          start_gw: l.start_gw,
        };
      });

      // Sort rows: those with unread messages first
      out.sort((a, b) => {
        const unreadA = unreadCounts[a.id] ?? 0;
        const unreadB = unreadCounts[b.id] ?? 0;
        if (unreadA > 0 && unreadB === 0) return -1;
        if (unreadA === 0 && unreadB > 0) return 1;
        return 0; // Keep original order for leagues with same unread status
      });

      setRows(out);
      
      // Update cache
      if (user?.id) {
        tablesPageCache = {
          rows: out,
          leagueSubmissions: submissionStatus,
          leagueData: {}, // Will be updated when leagueData useEffect runs
          unreadByLeague: unreadCounts,
          lastFetched: Date.now(),
          userId: user.id,
        };
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load leagues.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    // Check cache first, but invalidate if test GW might have changed
    // (We can't easily check test GW in cache key, so we'll just reduce cache duration for now)
    if (tablesPageCache && tablesPageCache.userId === user.id && tablesPageCache.rows.length > 0) {
      const cacheAge = Date.now() - tablesPageCache.lastFetched;
      // Reduced cache duration to 30 seconds to avoid stale test GW data
      const effectiveCacheDuration = 30 * 1000; // 30 seconds instead of 2 minutes
      if (cacheAge < effectiveCacheDuration) {
        // Show cached data immediately (non-blocking)
        setRows(tablesPageCache.rows);
        setLeagueSubmissions(tablesPageCache.leagueSubmissions);
        setLeagueData(tablesPageCache.leagueData);
        setUnreadByLeague(tablesPageCache.unreadByLeague);
        setLoading(false);
        setLeagueDataLoading(false); // Cache has leagueData, so no need to wait
        
        // If cache is very fresh (< 30 seconds), skip background refresh entirely
        if (cacheAge < 30 * 1000) {
          return;
        } else {
          // Cache is older, refresh in background (don't show loading)
          load();
          return;
        }
      }
    }
    
    // No cache or cache expired - fetch fresh data
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fetch member data and calculate positions for each league
  useEffect(() => {
    if (!rows.length || !user?.id) {
      setLeagueDataLoading(false);
      return;
    }
    
    setLeagueDataLoading(true);
    let alive = true;
    (async () => {
      // OPTIMIZED: Fetch meta and results in parallel
      const [metaResult, allResultsResult] = await Promise.all([
        supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle(),
        supabase.from("gw_results").select("gw,fixture_index,result")
      ]);
      
      const currentGw = (metaResult.data as any)?.current_gw ?? 1;
      if (alive) setCurrentGw(currentGw);
      
      const { data: allResults } = allResultsResult;
      
      const resultList = (allResults as ResultRowRaw[]) ?? [];
      const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
      resultList.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out) return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
      });

      const leagueDataMap: Record<string, LeagueData> = {};
      
      // OPTIMIZED: Fetch all members for all leagues in parallel
      const allLeagueIds = rows.map(r => r.id);
      const { data: allMembersData } = await supabase
        .from("league_members")
        .select("league_id,user_id, users(id, name)")
        .in("league_id", allLeagueIds);
      
      // Group members by league
      const membersByLeagueId = new Map<string, LeagueMember[]>();
      (allMembersData ?? []).forEach((m: any) => {
        if (!m.users?.name) return; // Skip unknown users
        const arr = membersByLeagueId.get(m.league_id) ?? [];
        arr.push({
          id: m.user_id,
          name: m.users.name
        });
        membersByLeagueId.set(m.league_id, arr);
      });
      
      // OPTIMIZED: Batch fetch all league metadata and fixtures upfront
      const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
      
      // Fetch all league metadata in one query
      const { data: allLeaguesMeta } = await supabase
        .from("leagues")
        .select("id,name,created_at,start_gw")
        .in("id", allLeagueIds);
      
      const leaguesMetaMap = new Map<string, any>();
      (allLeaguesMeta ?? []).forEach((l: any) => {
        leaguesMetaMap.set(l.id, l);
      });
      
      // Fetch all fixtures for all GWs in one query (for start_gw calculation)
      const { data: allFixtures } = await supabase
        .from("fixtures")
        .select("gw,kickoff_time")
        .in("gw", gwsWithResults)
        .order("gw", { ascending: true })
        .order("kickoff_time", { ascending: true });
      
      // Group fixtures by GW
      const fixturesByGw = new Map<number, string[]>();
      (allFixtures ?? []).forEach((f: any) => {
        const arr = fixturesByGw.get(f.gw) ?? [];
        arr.push(f.kickoff_time);
        fixturesByGw.set(f.gw, arr);
      });
      
      // Calculate start_gw for all leagues in parallel (no DB queries)
      const allRelevantGwsSet = new Set<number>();
      const leagueStartGwMap = new Map<string, number>();
      
      for (const row of rows) {
        const meta = leaguesMetaMap.get(row.id);
          const league = {
            id: row.id,
          name: meta?.name ?? row.name,
          created_at: (meta?.created_at ?? row.created_at) || null,
          start_gw: meta?.start_gw ?? row.start_gw
        };
        
        // Calculate start_gw without making DB queries
        let leagueStartGw = currentGw;
        
        // Check override
        const LEAGUE_START_OVERRIDES: Record<string, number> = {
          "Prem Predictions": 0,
          "FC Football": 0,
          "Easy League": 0,
          "API Test": 999, // Special: API Test league uses test API data, not regular game data
          "The Bird league": 7,
          gregVjofVcarl: 8,
          "Let Down": 8,
        };
        
        const override = league.name ? LEAGUE_START_OVERRIDES[league.name] : undefined;
        if (typeof override === "number") {
          leagueStartGw = override;
        } else if (league.start_gw !== null && league.start_gw !== undefined) {
          leagueStartGw = league.start_gw;
        } else if (league.created_at && gwsWithResults.length > 0) {
          // Calculate based on creation date and fixture deadlines
          const leagueCreatedAt = new Date(league.created_at);
          const DEADLINE_BUFFER_MINUTES = 75;
          
          for (const gw of gwsWithResults) {
            const gwFixtures = fixturesByGw.get(gw);
            if (gwFixtures && gwFixtures.length > 0) {
              const firstKickoff = new Date(gwFixtures[0]);
              const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
              if (leagueCreatedAt <= deadlineTime) {
                leagueStartGw = gw;
                break;
              }
            }
          }
          
          if (leagueStartGw === currentGw && gwsWithResults.length > 0) {
            leagueStartGw = Math.max(...gwsWithResults) + 1;
          }
        }
        
        leagueStartGwMap.set(row.id, leagueStartGw);
        const relevantGws = gwsWithResults.filter(g => g >= leagueStartGw);
        relevantGws.forEach(gw => allRelevantGwsSet.add(gw));
      }
      
      // OPTIMIZED: Fetch all submissions for current GW in one query
      // CRITICAL: Separate regular submissions from Test API submissions
      const allMemberIdsArray = Array.from(new Set(Array.from(membersByLeagueId.values()).flat().map(m => m.id)));
      
      // Fetch regular submissions
      const { data: allSubmissionsData } = allMemberIdsArray.length > 0
        ? await supabase
            .from("gw_submissions")
            .select("user_id")
            .eq("gw", currentGw)
            .in("user_id", allMemberIdsArray)
        : { data: [] };
      
      const submittedUserIdsSet = new Set((allSubmissionsData ?? []).map((s: any) => s.user_id));
      
      // CRITICAL: Fetch and validate Test API submissions separately
      // Find API Test league members
      const apiTestLeague = rows.find(r => r.name === "API Test");
      const testApiSubmittedUserIds = new Set<string>();
      let currentTestGw = 1; // Default to 1, will be updated if API Test league exists
      if (apiTestLeague) {
        // Fetch current test GW from meta table
        const { data: testMetaData } = await supabase
          .from("test_api_meta")
          .select("current_test_gw")
          .eq("id", 1)
          .maybeSingle();
        
        currentTestGw = testMetaData?.current_test_gw ?? 1;
        
        const apiTestMemberIds = membersByLeagueId.get(apiTestLeague.id)?.map(m => m.id) ?? [];
        if (apiTestMemberIds.length > 0) {
          // Fetch test API submissions for current test GW
          const { data: testSubsData } = await supabase
            .from("test_api_submissions")
            .select("user_id,submitted_at")
            .eq("matchday", currentTestGw)
            .in("user_id", apiTestMemberIds)
            .not("submitted_at", "is", null);
          
          // Fetch picks for validation (for current test GW)
          const { data: testApiPicksForValidation } = await supabase
            .from("test_api_picks")
            .select("user_id,fixture_index")
            .eq("matchday", currentTestGw)
            .in("user_id", apiTestMemberIds);
          
          // Fetch current fixtures to validate picks match (for current test GW)
          const { data: currentTestFixtures } = await supabase
            .from("test_api_fixtures")
            .select("fixture_index")
            .eq("test_gw", currentTestGw)
            .order("fixture_index", { ascending: true });
          
          if (currentTestFixtures && testApiPicksForValidation && testSubsData) {
            const currentFixtureIndicesSet = new Set(currentTestFixtures.map(f => f.fixture_index));
            const requiredFixtureCount = currentFixtureIndicesSet.size;
            
            console.log(`[Tables] Checking Test API submissions for GW ${currentTestGw}:`, {
              currentTestGw,
              submissionCount: testSubsData.length,
              fixtureCount: requiredFixtureCount,
              fixtureIndices: Array.from(currentFixtureIndicesSet),
            });
            
            // Only count submissions if user has picks for ALL current fixtures
            // No cutoff date needed - we're already filtering by matchday (currentTestGw)
            testSubsData.forEach((sub: any) => {
              const userPicks = (testApiPicksForValidation ?? []).filter((p: any) => p.user_id === sub.user_id);
              const picksForCurrentFixtures = userPicks.filter((p: any) => currentFixtureIndicesSet.has(p.fixture_index));
              const hasAllRequiredPicks = picksForCurrentFixtures.length === requiredFixtureCount && requiredFixtureCount > 0;
              
              const uniqueFixtureIndices = new Set(picksForCurrentFixtures.map((p: any) => p.fixture_index));
              const hasExactMatch = uniqueFixtureIndices.size === requiredFixtureCount;
              
              console.log(`[Tables] User ${sub.user_id} submission check:`, {
                userPicksCount: userPicks.length,
                picksForCurrentFixtures: picksForCurrentFixtures.length,
                requiredCount: requiredFixtureCount,
                hasAllRequiredPicks,
                hasExactMatch,
                willBeCounted: hasAllRequiredPicks && hasExactMatch,
              });
              
              // Only count as submitted if user has picks for ALL current fixtures
              // We're already filtering by matchday, so no need for cutoff date
              if (hasAllRequiredPicks && hasExactMatch) {
                testApiSubmittedUserIds.add(sub.user_id);
              }
            });
            
            console.log(`[Tables] Final Test API submitted users for GW ${currentTestGw}:`, Array.from(testApiSubmittedUserIds));
          } else {
            console.log(`[Tables] Missing data for Test API validation:`, {
              hasCurrentTestFixtures: !!currentTestFixtures,
              hasTestApiPicks: !!testApiPicksForValidation,
              hasTestSubsData: !!testSubsData,
            });
          }
        }
      }
      
      // Process leagues in parallel
      await Promise.all(rows.map(async (row) => {
        try {
          // Get members from pre-fetched data
          const members = (membersByLeagueId.get(row.id) ?? []).filter((m: LeagueMember) => m.name !== "Unknown");
          
          // Special handling for "API Test" league - show zero points (test league)
          const leagueMeta = leaguesMetaMap.get(row.id);
          if (row.name === 'API Test' || leagueMeta?.name === 'API Test') {
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            
            // Check which members have submitted for Test API - use testApiSubmittedUserIds
            const submittedMembers = new Set<string>();
            members.forEach(member => {
              if (testApiSubmittedUserIds.has(member.id)) {
                submittedMembers.add(member.id);
              }
            });
            
            console.log(`[Tables] API Test league submittedMembers for GW ${currentTestGw ?? 'unknown'}:`, {
              testApiSubmittedUserIds: Array.from(testApiSubmittedUserIds),
              submittedMembers: Array.from(submittedMembers),
              memberIds: members.map(m => m.id),
            });
            
            leagueDataMap[row.id] = {
              id: row.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: alphabeticalIds.indexOf(user.id) + 1 || null,
              positionChange: null,
              sortedMemberIds: alphabeticalIds,
              latestGwWinners: new Set(),
              latestRelevantGw: null, // No results for API Test
              submittedMembers // Use Test API submissions
            };
            return; // Skip calculation - test league shows zero points
          }

          if (members.length === 0) {
            leagueDataMap[row.id] = {
              id: row.id,
              members: [],
              userPosition: null,
              positionChange: null,
              sortedMemberIds: [],
              latestGwWinners: new Set()
            };
            return; // Return early instead of continue
          }

          // Simple: Calculate ML table exactly like Home page does, then find user's position
          if (outcomeByGwIdx.size === 0) {
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            leagueDataMap[row.id] = {
              id: row.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: null,
              positionChange: null,
              sortedMemberIds: alphabeticalIds,
              latestGwWinners: new Set()
            };
            return; // Return early instead of continue
          }
          
          // Get league start GW from pre-calculated map
          const leagueStartGw = leagueStartGwMap.get(row.id) ?? currentGw;
          const relevantGws = gwsWithResults.filter(g => g >= leagueStartGw);

          if (relevantGws.length === 0) {
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            leagueDataMap[row.id] = {
              id: row.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: null,
              positionChange: null,
              sortedMemberIds: alphabeticalIds,
              latestGwWinners: new Set()
            };
            return; // Return early instead of continue
          }

          // FIXED: Fetch picks per league to avoid Supabase 1000-row limit
          const memberIds = members.map(m => m.id);
          const { data: leaguePicks } = await supabase
            .from("picks")
            .select("user_id,gw,fixture_index,pick")
            .in("user_id", memberIds)
            .in("gw", relevantGws);
          
          const picksAll: PickRow[] = (leaguePicks ?? []) as PickRow[];
          
          // Calculate ML table - EXACT same logic as Home page
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

          // Build ML table rows - EXACT same as Home page
          const mltRows = members.map((m) => ({
            user_id: m.id,
            name: m.name,
            mltPts: mltPts.get(m.id) ?? 0,
            unicorns: unis.get(m.id) ?? 0,
            ocp: ocp.get(m.id) ?? 0,
          }));

          // Sort EXACTLY like Home page - use the exact same expression
          const sortedMltRows = [...mltRows].sort((a, b) => 
            b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
          );

          // Find user's position - simple: index in sorted array + 1
          let userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
          
          // If not found, try to find by matching member IDs
          if (userIndex === -1) {
            const memberMatch = members.findIndex(m => m.id === user.id);
            if (memberMatch !== -1) {
              // User is in members but not in rows - add them with 0 stats
              sortedMltRows.push({
                user_id: user.id,
                name: members[memberMatch].name,
                mltPts: 0,
                unicorns: 0,
                ocp: 0
              });
              // Re-sort EXACTLY like Home page
              sortedMltRows.sort((a, b) => 
                b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
              );
              userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
            }
          }
          
          // CRITICAL: Extract sortedMemberIds from the FINAL sorted array
          // This is the ML table order (1st to last) - EXACTLY matching Home page
          const sortedMemberIds = sortedMltRows.map(r => r.user_id);
          
          // Debug logging - EXACT same as Home page
          console.log(`[${row.name}] Position calculation:`, {
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
          
          // Check which members have submitted for current GW - from pre-fetched data
          const submittedMembers = new Set<string>();
          memberIds.forEach(userId => {
            if (submittedUserIdsSet.has(userId)) {
              submittedMembers.add(userId);
            }
            });
          
          // Store data - CRITICAL: sortedMemberIds must be stored correctly
          const storedData: LeagueData = {
            id: row.id,
            members: members.sort((a, b) => a.name.localeCompare(b.name)), // Keep alphabetical for other uses
            userPosition,
            positionChange: null,
            submittedMembers,
            sortedMemberIds: [...sortedMemberIds], // Store COPY of ML table order from sortedMltRows
            latestGwWinners: new Set(latestGwWinners),
            latestRelevantGw: latestRelevantGw // Store the GW number that winners are from
          };
          
          leagueDataMap[row.id] = storedData;
        } catch (error) {
          console.error(`Error loading data for league ${row.id} (${row.name}):`, error);
          console.error('Error details:', error instanceof Error ? error.message : error);
          leagueDataMap[row.id] = {
            id: row.id,
            members: [],
            userPosition: null,
            positionChange: null,
            sortedMemberIds: [],
            latestGwWinners: new Set(),
            latestRelevantGw: null
          };
        }
      }));
      
      if (alive) {
        setLeagueData(leagueDataMap);
        setLeagueDataLoading(false);
        
        // Update cache with leagueData
        if (user?.id) {
          if (tablesPageCache && tablesPageCache.userId === user.id) {
            tablesPageCache.leagueData = leagueDataMap;
            tablesPageCache.lastFetched = Date.now();
          } else {
            // Initialize cache if it doesn't exist yet
            tablesPageCache = {
              rows: rows,
              leagueSubmissions: {},
              leagueData: leagueDataMap,
              unreadByLeague: {},
              lastFetched: Date.now(),
              userId: user.id,
            };
          }
        }
      }
    })();
    
    return () => {
      alive = false;
    };
  }, [rows, user?.id]);

  async function createLeague() {
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

      // Assign deterministic avatar based on league ID (after creation)
      const avatar = getDeterministicLeagueAvatar(data!.id);
      await supabase
        .from("leagues")
        .update({ avatar })
        .eq("id", data!.id);

      // creator becomes a member
      await supabase.from("league_members").insert({
        league_id: data!.id,
        user_id: user.id,
      });

      setLeagueName("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create league.");
    } finally {
      setCreating(false);
    }
  }

  async function joinLeague() {
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

      // Check if league is full (max 8 members)
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
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-4 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Mini Leagues</h2>
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

        {/* Leagues list */}
        <div className="mt-6">
          {loading || leagueDataLoading ? (
            <LeagueListSkeleton />
          ) : rows.length === 0 ? (
            <div className="px-4 py-4 text-sm">No leagues yet.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <MiniLeagueCard
                  key={r.id}
                  row={r}
                  data={leagueData[r.id]}
                  unread={unreadByLeague?.[r.id] ?? 0}
                  submissions={leagueSubmissions[r.id]}
                  leagueDataLoading={leagueDataLoading}
                  currentGw={currentGw}
                />
              ))}
            </div>
          )}
        </div>

        {/* separator */}
        <div id="create-join-section" className="mt-10 mb-3 text-xl font-extrabold text-slate-900">Create or Join</div>

        {/* Create / Join cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-2xl p-4 bg-white">
            <div className="text-sm font-medium mb-2">Create a league</div>
            <input
              className="border rounded px-3 py-2 w-full bg-white"
              placeholder="League name"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
            />
            <button
              className="mt-3 px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
              onClick={createLeague}
              disabled={creating || !leagueName.trim()}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>

          <div className="border rounded-2xl p-4 bg-white">
            <div className="text-sm font-medium mb-2">Join with code</div>
            <input
              className="border rounded px-3 py-2 w-full uppercase tracking-widest bg-white"
              placeholder="ABCDE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button
              className="mt-3 px-3 py-2 rounded border"
              onClick={joinLeague}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type MiniLeagueCardProps = {
  row: LeagueRow;
  data?: LeagueData;
  unread: number;
  submissions?: { allSubmitted: boolean; submittedCount: number; totalCount: number };
  leagueDataLoading: boolean;
  currentGw: number | null;
};

const MiniLeagueCard = memo(function MiniLeagueCard({
  row,
  data,
  unread,
  submissions,
  leagueDataLoading,
  currentGw,
}: MiniLeagueCardProps) {
  const members = data?.members ?? [];
  const userPosition = data?.userPosition;
  const badge = unread > 0 ? Math.min(unread, 99) : 0;

  const memberChips = useMemo(() => {
    if (leagueDataLoading || !data) return [];
    const baseMembers = data.members ?? [];
    if (!baseMembers.length) return [];

    const orderedMembers =
      data.sortedMemberIds && data.sortedMemberIds.length > 0
        ? data.sortedMemberIds
            .map((id) => baseMembers.find((m) => m.id === id))
            .filter((m): m is LeagueMember => m !== undefined)
        : [...baseMembers].sort((a, b) => a.name.localeCompare(b.name));

    const submittedSet = toStringSet(data.submittedMembers);
    const winnersSet = toStringSet(data.latestGwWinners);

    // Check if this is API Test league
    const isApiTestLeague = row.name === "API Test";
    
    return orderedMembers.slice(0, 8).map((member, index) => {
      const hasSubmitted = submittedSet.has(member.id);
      const isLatestWinner = winnersSet.has(member.id);

      // GPU-optimized: Use CSS classes instead of inline styles
      let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
      
      // Only show shiny chip if latestRelevantGw matches currentGw (same GW)
      // If currentGw > latestRelevantGw, a new GW has been published - hide shiny chips
      const shouldShowShiny = isLatestWinner && data.latestRelevantGw !== null && currentGw !== null && data.latestRelevantGw === currentGw;
      
      if (shouldShowShiny) {
        // Shiny chip for last GW winner (already GPU-optimized with transforms)
        chipClassName += ' bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]';
      } else if (hasSubmitted) {
        // Green = picked (GPU-optimized class)
        chipClassName += ' chip-green';
        // Add bold blue border for Test API submissions
        if (isApiTestLeague) {
          chipClassName += ' border-2 border-blue-600';
        }
      } else {
        // Grey = not picked (GPU-optimized class)
        chipClassName += ' chip-grey';
      }

      // GPU-optimized: Use transform instead of marginLeft
      if (index > 0) {
        chipClassName += ' chip-overlap';
      }

      return (
        <div key={member.id} className={chipClassName} title={member.name}>
          {initials(member.name)}
        </div>
      );
    });
  }, [data, leagueDataLoading, row.name, currentGw]);

  const extraMembers = useMemo(() => {
    if (!data) return 0;
    const orderedMemberIds =
      (data.sortedMemberIds && data.sortedMemberIds.length > 0
        ? data.sortedMemberIds
        : data.members?.map((m) => m.id)) ?? [];
    const totalMembers = orderedMemberIds.length;
    return totalMembers > 8 ? totalMembers - 8 : 0;
  }, [data]);

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm w-full" style={{ borderRadius: "12px" }}>
      <Link
        to={`/league/${row.code}`}
        className="block p-6 !bg-white no-underline hover:text-inherit relative z-20"
      >
        <div className="flex items-start gap-3 relative">
          {/* League Avatar Badge */}
          <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-slate-100">
            <img
              src={getLeagueAvatarUrl(row)}
              alt={`${row.name} avatar`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Fallback to default ML avatar if custom avatar fails
                const target = e.target as HTMLImageElement;
                const defaultAvatar = getDefaultMlAvatar(row.id);
                const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                if (target.src !== fallbackSrc) {
                  target.src = fallbackSrc;
                } else {
                  // If default also fails, show calendar icon
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

          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Line 1: League Name */}
            <div className="text-base font-semibold text-slate-900 truncate">{row.name}</div>

            {/* Line 2: All Submitted Status */}
            {submissions?.allSubmitted && (
              <span className="text-xs font-normal text-[#1C8376] whitespace-nowrap">All Submitted</span>
            )}

            {/* Line 3: Ranking (Member Count and User Position) */}
            <div className="flex items-center gap-2">
              {/* Member Count */}
              <div className="flex items-center gap-1">
                <svg
                  className="w-4 h-4 text-slate-500"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g clipPath="url(#clip0_4045_135263)">
                    <path
                      d="M14.0001 14V13.7C14.0001 13.0489 14.0001 12.7234 13.925 12.4571C13.7361 11.7874 13.2127 11.264 12.543 11.0751C12.2767 11 11.9512 11 11.3001 11H8.36675C7.71566 11 7.39011 11 7.12387 11.0751C6.45414 11.264 5.93072 11.7874 5.74184 12.4571C5.66675 12.7234 5.66675 13.0489 5.66675 13.7V14"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 11.6667V10.6C2 10.0422 2 9.76328 2.05526 9.53311C2.23083 8.80181 2.80181 8.23083 3.53311 8.05526C3.76328 8 4.04219 8 4.6 8H4.66667"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12.3334 6.33333C12.3334 7.622 11.2887 8.66667 10.0001 8.66667C8.71142 8.66667 7.66675 7.622 7.66675 6.33333C7.66675 5.04467 8.71142 4 10.0001 4C11.2887 4 12.3334 5.04467 12.3334 6.33333Z"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                    />
                    <path
                      d="M7.33325 2.92025C6.94237 2.36557 6.27397 2 5.51507 2C4.31009 2 3.33325 2.92165 3.33325 4.05857C3.33325 4.95488 3.94038 5.7174 4.7878 6"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_4045_135263">
                      <rect width="16" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
                <span className="text-sm font-semibold text-slate-900">{members.length}</span>
              </div>

              {/* User Position - ML Ranking */}
              {userPosition !== null && userPosition !== undefined ? (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-900">{ordinal(userPosition)}</span>
                  {data?.positionChange === "up" && <span className="text-green-600 text-xs">▲</span>}
                  {data?.positionChange === "down" && <span className="text-red-600 text-xs">▼</span>}
                  {data?.positionChange === "same" && <span className="text-slate-400 text-xs">—</span>}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-400">—</span>
                </div>
              )}
            </div>

            {/* Player Chips - ordered by ML table position (1st to last) */}
            <div className="flex items-center mt-1 py-0.5">
              {memberChips}
              {extraMembers > 0 && (
                <div
                  className={`chip-container chip-grey rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
                    extraMembers > 0 ? "chip-overlap" : ""
                  }`}
                  style={{
                    width: "24px",
                    height: "24px",
                  }}
                >
                  +{extraMembers}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unread Badge and Arrow - Top Right */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 z-30">
          {badge > 0 && (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold">
              {badge}
            </span>
          )}
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  );
});

const LeagueListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="rounded-xl border bg-white overflow-hidden shadow-sm w-full animate-pulse"
        style={{ borderRadius: "12px" }}
      >
        <div className="p-6 bg-white relative">
          <div className="flex items-start gap-3 relative">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-slate-200" />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="h-5 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-slate-200 rounded" />
                <div className="h-4 w-6 bg-slate-200 rounded" />
                <div className="h-4 w-4 bg-slate-200 rounded" />
                <div className="h-4 w-8 bg-slate-200 rounded" />
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
);

// simple 5-char code
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
  // worst case
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}