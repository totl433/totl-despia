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
import { scheduleDeadlineReminder, scheduleLiveGameNotification, scheduleGameweekStartingSoon } from "../lib/notifications";
// Score update notifications now handled server-side by sendScoreNotifications function


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

// Helper function to format minute display
function formatMinuteDisplay(status: string, minute: number | null | undefined): string {
  if (status === 'FINISHED') {
    return 'FT';
  }
  if (status === 'PAUSED') {
    return 'HT';
  }
  if (status === 'IN_PLAY') {
    if (minute === null || minute === undefined) {
      return 'LIVE';
    }
    // First half: 1-45 minutes
    if (minute >= 1 && minute <= 45) {
      return 'First Half';
    }
    // Stoppage time in first half: > 45 but before halftime (typically 45-50)
    // Show "45+" until status becomes PAUSED (halftime)
    if (minute > 45 && minute <= 50) {
      return '45+';
    }
    // Second half: after halftime, typically minute > 50
    if (minute > 50) {
      return 'Second Half';
    }
  }
  // Fallback
  return 'LIVE';
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
  api_match_id?: number | null;
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
  const navigationKeyRef = useRef(0);
  
  // Live scores for test API fixtures
  const [liveScores, setLiveScores] = useState<Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }>>({});
  // Track previous scores to avoid duplicate notifications
  const prevScoresRef = useRef<Record<number, { homeScore: number; awayScore: number }>>({});
  // Track if "Game Week Starting Soon" notification has been scheduled
  const gameweekStartingSoonScheduledRef = useRef(false);
  // Track API pull history for debugging (fixture_index -> array of pulls)
  const apiPullHistoryRef = useRef<Record<number, Array<{
    timestamp: Date;
    minute: number | null;
    status: string;
    homeScore: number;
    awayScore: number;
    kickoffTime: string | null;
    apiMinute: number | null | undefined;
    diffMinutes: number | null;
    halftimeEndTime: string | null;
    halftimeEndMinute: number | null;
    minutesSinceHalftimeEnd: number | null;
  }>>>({});
  const [expandedDebugLog, setExpandedDebugLog] = useState<Record<number, boolean>>({});
  const [isInApiTestLeague, setIsInApiTestLeague] = useState(false);
  const [showLiveOnly, setShowLiveOnly] = useState(false);

  // Fetch live score from Supabase ONLY (updated by scheduled Netlify function)
  // NO API calls from client - all API calls go through the scheduled function
  const fetchLiveScore = async (apiMatchId: number, kickoffTime?: string | null) => {
    try {
      console.log('[Home] fetchLiveScore called for matchId:', apiMatchId, 'kickoffTime:', kickoffTime);
      
      // Read from Supabase live_scores table (updated by scheduled Netlify function)
      const { data: liveScore, error } = await supabase
        .from('live_scores')
        .select('*')
        .eq('api_match_id', apiMatchId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No row found - scheduled function hasn't run yet or game hasn't started
          console.log('[Home] No live score found in Supabase for match', apiMatchId, '- scheduled function may not have run yet');
          return null;
        }
        console.error('[Home] Error fetching live score from Supabase:', error);
        return null;
      }
      
      if (!liveScore) {
        console.warn('[Home] No live score data in Supabase');
        return null;
      }
      
      console.log('[Home] Live score from Supabase:', liveScore);
      
      const homeScore = liveScore.home_score ?? 0;
      const awayScore = liveScore.away_score ?? 0;
      const status = liveScore.status || 'SCHEDULED';
      let minute = liveScore.minute;
      
      // If minute is not provided, calculate from kickoff time (fallback)
      if ((minute === null || minute === undefined) && (status === 'IN_PLAY' || status === 'PAUSED') && kickoffTime) {
        try {
          const matchStart = new Date(kickoffTime);
          const now = new Date();
          const diffMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60));
          
          if (diffMinutes > 0 && diffMinutes < 120) {
            if (status === 'PAUSED') {
              minute = null;
            } else if (status === 'IN_PLAY') {
              if (diffMinutes <= 50) {
                minute = diffMinutes;
              } else {
                minute = 46 + Math.max(0, diffMinutes - 50);
              }
            }
          }
        } catch (e) {
          console.warn('[Home] Error calculating minute from kickoff time:', e);
        }
      }
      
      const result = { homeScore, awayScore, status, minute, retryAfter: null as number | null };
      console.log('[Home] Returning score data from Supabase:', result);
      return result;
    } catch (error: any) {
      console.error('[Home] Error fetching live score from Supabase:', error?.message || error, error?.stack);
      return null;
    }
  };

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
      
      // Check if user is in API Test league
      const isInApiTestLeague = userLeagues.some((league) => league.name === "API Test");
      
      if (alive) {
        setLeagues(ls);
        setGw(currentGw);
        setIsInApiTestLeague(isInApiTestLeague);
        leagueIdsRef.current = new Set(ls.map((l) => l.id));
      }

      // PARALLEL QUERY 2: Fetch fixtures, picks, results, and submission status for current GW
      // For API Test league members, use test API data for GW 1
      let fixturesResult, picksResult, resultsResult, submissionResult;
      let thisGwFixtures: Fixture[];
      let userPicks: PickRow[];
      let gwResults: ResultRow[];
      let submitted: boolean;
      
      if (isInApiTestLeague) {
        // Fetch from test API tables - include api_match_id for live scores
        [fixturesResult, picksResult, resultsResult, submissionResult] = await Promise.all([
          supabase.from("test_api_fixtures").select("id,test_gw,fixture_index,api_match_id,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time").eq("test_gw", 1).order("fixture_index", { ascending: true }),
          supabase.from("test_api_picks").select("user_id,matchday,fixture_index,pick").eq("user_id", user.id).eq("matchday", 1),
          supabase.from("gw_results").select("gw,fixture_index,result").eq("gw", 1), // Results still use gw_results with gw=1
          supabase.from("test_api_submissions").select("submitted_at").eq("user_id", user.id).eq("matchday", 1).maybeSingle(),
        ]);
        
        // Map test_gw/matchday to gw for consistency
        const testFixtures = (fixturesResult.data as any[]) ?? [];
        thisGwFixtures = testFixtures.map(f => ({ ...f, gw: f.test_gw })) as Fixture[];
        
        // Validate picks - only use picks that match ALL current fixtures
        // If picks don't match (e.g., old Brazil picks vs new PL fixtures), ignore them
        const testPicks = (picksResult.data as any[]) ?? [];
        if (testPicks.length > 0 && thisGwFixtures.length > 0) {
          const currentFixtureIndices = new Set(thisGwFixtures.map(f => f.fixture_index));
          const picksForCurrentFixtures = testPicks.filter((p: any) => currentFixtureIndices.has(p.fixture_index));
          
          // Only use picks if all fixtures have picks and no extra picks exist
          const allFixturesHavePicks = thisGwFixtures.every(f => picksForCurrentFixtures.some((p: any) => p.fixture_index === f.fixture_index));
          const noExtraPicks = picksForCurrentFixtures.length === thisGwFixtures.length;
          const picksAreValid = allFixturesHavePicks && noExtraPicks && picksForCurrentFixtures.length > 0;
          
          if (picksAreValid) {
            userPicks = picksForCurrentFixtures.map(p => ({ ...p, gw: p.matchday })) as PickRow[];
          } else {
            // Picks don't match current fixtures - ignore them
            console.log('[Home] Picks found but don\'t match current fixtures - ignoring old picks');
            userPicks = [];
          }
        } else {
          userPicks = testPicks.map(p => ({ ...p, gw: p.matchday })) as PickRow[];
        }
        
        gwResults = (resultsResult.data as ResultRow[]) ?? [];
        submitted = !!submissionResult.data?.submitted_at;
      } else {
        // Regular fixtures
        [fixturesResult, picksResult, resultsResult, submissionResult] = await Promise.all([
          supabase.from("fixtures").select("id,gw,fixture_index,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time").eq("gw", currentGw).order("fixture_index", { ascending: true }),
          supabase.from("picks").select("user_id,gw,fixture_index,pick").eq("user_id", user.id).eq("gw", currentGw),
          supabase.from("gw_results").select("gw,fixture_index,result").eq("gw", currentGw),
          supabase.from("gw_submissions").select("submitted_at").eq("user_id", user.id).eq("gw", currentGw).maybeSingle(),
        ]);
        
        thisGwFixtures = (fixturesResult.data as Fixture[]) ?? [];
        userPicks = (picksResult.data as PickRow[]) ?? [];
        gwResults = (resultsResult.data as ResultRow[]) ?? [];
        submitted = !!submissionResult.data?.submitted_at;
      }

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

    // Populate picksMap - show picks even if not submitted (for test API users)
      const map: Record<number, "H" | "D" | "A"> = {};
      userPicks.forEach((p) => {
        map[p.fixture_index] = p.pick;
        console.log('[Home] Pick loaded:', { fixture_index: p.fixture_index, pick: p.pick, user_id: p.user_id });
      });
      console.log('[Home] Picks map:', map);
      console.log('[Home] Fixtures:', thisGwFixtures.map(f => ({ fixture_index: f.fixture_index, home: f.home_name || f.home_team, away: f.away_name || f.away_team })));

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
      // Set all data atomically to prevent flickering
      setGwSubmitted(submitted);
      setGwScore(score);
      setResultsMap(currentResultsMap);
      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setUnreadByLeague(unreadCounts);
      setLeagueSubmissions(submissionStatus);
      // Use setTimeout to ensure state updates are batched and prevent flickering
      setTimeout(() => {
        if (alive) {
          setLoading(false);
        }
      }, 0);
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
      isInitialMountRef.current = true;
      await fetchHomeData(true);
    },
    enabled: !!user?.id && !loading && !isInitialMountRef.current,
    enableMouse: true, // Enable mouse drag for testing in desktop browsers
  });

  // Create a stable key for fixtures to prevent unnecessary effect re-runs
  const fixturesKey = useMemo(() => 
    fixtures.map(f => `${f.fixture_index}-${f.api_match_id}`).join(','),
    [fixtures]
  );

  // Simple live score polling - poll fixtures whose kickoff has passed
  useEffect(() => {
    if (!isInApiTestLeague || !fixtures.length) return;
    
    const fixturesToPoll = fixtures.slice(0, 3).filter(f => f.api_match_id && f.kickoff_time);
    if (fixturesToPoll.length === 0) return;
    
    const intervals = new Map<number, ReturnType<typeof setInterval>>();
    
    // Simple polling function - reads from Supabase (no rate limits!)
    const startPolling = (fixture: Fixture) => {
      const fixtureIndex = fixture.fixture_index;
      if (intervals.has(fixtureIndex)) {
        console.log('[Home] Already polling fixture', fixtureIndex);
        return; // Already polling
      }
      
      console.log('[Home] Starting polling for fixture', fixtureIndex, 'api_match_id:', fixture.api_match_id);
      
      const poll = async () => {
        console.log('[Home] Polling fixture', fixtureIndex, 'from Supabase at', new Date().toISOString());
        const scoreData = await fetchLiveScore(fixture.api_match_id!, fixture.kickoff_time);
        
        // Check if we got no data (Supabase doesn't have it yet - scheduled function may not have run)
        if (!scoreData) {
          console.log(`[Home] No score data in Supabase for fixture ${fixtureIndex} - scheduled function may not have updated yet`);
          return; // Will retry on next poll
        }
        
        // No rate limiting needed - we're reading from Supabase, not calling API
        
        console.log('[Home] Got score data for fixture', fixtureIndex, ':', scoreData);
        const isFinished = scoreData.status === 'FINISHED';
        
        // Update live scores
        console.log('[Home] Updating liveScores for fixture', fixtureIndex);
        setLiveScores(prev => ({
          ...prev,
          [fixtureIndex]: {
            homeScore: scoreData.homeScore,
            awayScore: scoreData.awayScore,
            status: scoreData.status,
            minute: scoreData.minute ?? null
          }
        }));
        
        // Score change notifications are now handled server-side by sendScoreNotifications function
        // This runs every 2 minutes and checks the live_scores table for changes
        // Removed client-side notifications to avoid flakey behavior
        
        // Still track previous scores for local state management
        const prevScore = prevScoresRef.current[fixtureIndex];
        if (prevScore) {
          // Just update prev score, no notifications
        }
        
        // Update prev score
        prevScoresRef.current[fixtureIndex] = {
          homeScore: scoreData.homeScore,
          awayScore: scoreData.awayScore
        };
        
        // Stop polling if finished
        if (isFinished) {
          console.log(`[Home] Game ${fixtureIndex} finished - stopping polling`);
          const interval = intervals.get(fixtureIndex);
          if (interval) {
            clearInterval(interval);
            intervals.delete(fixtureIndex);
          }
          // NOTE: We intentionally do NOT auto-save final scores to gw_results here.
          // Main game GW results should ONLY come from the Admin results flow,
          // so that test API fixtures can never overwrite real game data.
        }
      };
      
      // Poll Supabase every 10 seconds (fast, no rate limits!)
      const interval = setInterval(poll, 10 * 1000); // Every 10 seconds - Supabase is fast!
      intervals.set(fixtureIndex, interval);
      
      // Poll immediately on mount
      poll();
    };
    
    // Check which fixtures should be polled
    const checkFixtures = () => {
      const now = new Date();
      fixturesToPoll.forEach(fixture => {
        if (!fixture.api_match_id || !fixture.kickoff_time) return;
        
        const fixtureIndex = fixture.fixture_index;
        const kickoffTime = new Date(fixture.kickoff_time);
        const kickoffHasPassed = kickoffTime.getTime() <= now.getTime();
        const isCurrentlyPolling = intervals.has(fixtureIndex);
        const currentScore = liveScores[fixtureIndex];
        const isFinished = currentScore?.status === 'FINISHED';
        
        // Stop if finished
        if (isFinished && isCurrentlyPolling) {
          console.log(`[Home] Stopping polling for fixture ${fixtureIndex} (finished)`);
          const interval = intervals.get(fixtureIndex);
          if (interval) {
            clearInterval(interval);
            intervals.delete(fixtureIndex);
          }
          return;
        }
        
        // Start polling if kickoff passed and not finished
        if (kickoffHasPassed && !isFinished && !isCurrentlyPolling) {
          startPolling(fixture);
        }
      });
    };
    
    // REMOVED: checkForMissingResults function
    // This was causing test API results to overwrite finished GW results in gw_results table
    // Main game GW results should ONLY come from Admin results screen, never auto-saved from API
    
    checkFixtures();
    const checkInterval = setInterval(checkFixtures, 60000); // Check every 1 minute (local check only, no API calls)
    
    // Schedule notifications (only once per fixture, localStorage prevents duplicates)
    fixturesToPoll.forEach((fixture) => {
      if (!fixture.api_match_id || !fixture.kickoff_time) return;
      const kickoffTime = new Date(fixture.kickoff_time);
      const now = new Date();
      const fixtureIndex = fixture.fixture_index;
      
      // Schedule "Game Starting Now" notification - localStorage prevents duplicates even if effect re-runs
      if (kickoffTime > now) {
        const homeName = fixture.home_name || fixture.home_team || 'Home';
        const awayName = fixture.away_name || fixture.away_team || 'Away';
        scheduleLiveGameNotification(fixture.kickoff_time, homeName, awayName);
      }
      
      if (fixtureIndex === 0 && fixture.kickoff_time) {
        const firstKickoff = new Date(fixture.kickoff_time);
        const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
        scheduleDeadlineReminder(deadlineTime.toISOString(), 1, 2);
        
        if (!gameweekStartingSoonScheduledRef.current) {
          scheduleGameweekStartingSoon(fixture.kickoff_time, 1);
          gameweekStartingSoonScheduledRef.current = true;
        }
      }
    });
    
    return () => {
      intervals.forEach(clearInterval);
      clearInterval(checkInterval);
    };
  }, [isInApiTestLeague, fixtures.length, fixturesKey]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    // Increment navigation key to force scroll containers to recreate
    navigationKeyRef.current += 1;
    
    // Always fetch fresh data
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
      leagues.forEach(league => {
        // Check LEAGUE_START_OVERRIDES first (matches League.tsx logic)
        const override = league.name && LEAGUE_START_OVERRIDES[league.name];
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
      
      // Fetch picks per league (like League page does) to avoid Supabase 1000 row limit
      // Store picks by league ID for lookup
      const picksByLeague = new Map<string, PickRow[]>();
      
      for (const league of leagues) {
        const members = membersByLeague[league.id] ?? [];
        if (members.length === 0) {
          picksByLeague.set(league.id, []);
          continue;
        }
        
        const leagueStartGw = leagueStartGws.get(league.id) ?? currentGw;
        const relevantGws = gwsWithResults.filter(g => g >= leagueStartGw);
        
        if (relevantGws.length === 0) {
          picksByLeague.set(league.id, []);
          continue;
        }
        
        const memberIds = members.map(m => m.id);
        const { data: leaguePicks } = await supabase
          .from("picks")
          .select("user_id,gw,fixture_index,pick")
          .in("user_id", memberIds)
          .in("gw", relevantGws);
        
        picksByLeague.set(league.id, (leaguePicks as PickRow[]) ?? []);
      }
      
      // Collect all member IDs for submissions batch
      const allMemberIds = new Set<string>();
      Object.values(membersByLeague).forEach(members => {
        members.forEach(m => allMemberIds.add(m.id));
      });
      
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
          
          // DEBUG: Log leagueStartGw and relevantGws for Prem Predictions
          if (league.name === 'Prem Predictions') {
            console.error(`🔴 PREM PREDICTIONS - leagueStartGw: ${leagueStartGw}, relevantGws:`, relevantGws, 'gwsWithResults:', gwsWithResults);
          }

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

          // Use picks fetched per league (avoids Supabase 1000 row limit)
          const picksAll = picksByLeague.get(league.id) ?? [];
          const memberIds = members.map(m => m.id);
          
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

                // Debug for Easy League GW 11
                if (league.name === 'Easy League' && g === 11) {
                  console.log(`🔵 Easy League GW 11 - Fixture ${idx}:`, {
                    outcome: out,
                    picksCount: thesePicks.length,
                    picks: thesePicks.map(p => ({ user_id: p.user_id, name: members.find(m => m.id === p.user_id)?.name || 'unknown', pick: p.pick })),
                    correctUsers: correctUsers.map(id => members.find(m => m.id === id)?.name || id)
                  });
                }

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
            // Find ALL players with the same top score AND unicorns (co-winners)
            const coTop = gwRows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
            const winners = new Set(coTop.map((r) => r.user_id));
            
            // Debug logging for ties - CRITICAL for debugging
            if (league.name === 'Easy League' && g === 11) {
              console.log(`🔵🔵🔵 EASY LEAGUE GW 11 CALCULATION 🔵🔵🔵`);
              const allRowsData = gwRows.map(r => ({ user_id: r.user_id, name: members.find(m => m.id === r.user_id)?.name || 'unknown', score: r.score, unicorns: r.unicorns }));
              console.log(`All gwRows (${gwRows.length} players):`, allRowsData);
              console.log(`Top player:`, { user_id: top.user_id, name: members.find(m => m.id === top.user_id)?.name || 'unknown', score: top.score, unicorns: top.unicorns });
              const coTopData = coTop.map(r => ({ user_id: r.user_id, name: members.find(m => m.id === r.user_id)?.name || 'unknown', score: r.score, unicorns: r.unicorns }));
              console.log(`coTop (filtered, ${coTop.length} players):`, coTopData);
              console.log(`winners Set (${winners.size} winners):`, Array.from(winners));
              console.log(`🔵🔵🔵 END EASY LEAGUE GW 11 CALCULATION 🔵🔵🔵`);
            }
            
            if (coTop.length > 1) {
              console.log(`[Home] GW ${g} has ${coTop.length} co-winners (tie):`, Array.from(winners));
              console.log(`[Home] GW ${g} co-winners details:`, coTop.map(r => ({ user_id: r.user_id, name: members.find(m => m.id === r.user_id)?.name || 'unknown', score: r.score, unicorns: r.unicorns })));
            } else {
              console.log(`[Home] GW ${g} single winner:`, top.user_id, `score: ${top.score}, unicorns: ${top.unicorns}`);
            }
            
            // CRITICAL: Ensure all co-winners are in the Set
            if (coTop.length !== winners.size) {
              console.error(`[Home] GW ${g} ERROR: coTop length (${coTop.length}) doesn't match winners Set size (${winners.size})!`);
            }
            
            gwWinners.set(g, winners);

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
          
          // DEBUG: Log stats BEFORE sorting for Prem Predictions
          if (league.name === 'Prem Predictions') {
            console.error(`🔴 PREM PREDICTIONS STATS BEFORE SORT:`, mltRows.map(r => ({
              name: r.name,
              mltPts: r.mltPts,
              unicorns: r.unicorns,
              ocp: r.ocp,
              userId: r.user_id
            })));
          }

          // DEBUG: Log the exact values BEFORE sorting for "Forget It"
          if (league.name?.toLowerCase().includes('forget')) {
            console.error(`[${league.name}] === BEFORE SORT ===`);
            mltRows.forEach((r, i) => {
              console.error(`${i + 1}. ${r.name}: mltPts=${r.mltPts}, unicorns=${r.unicorns}, ocp=${r.ocp}`);
            });
          }

          // Sort EXACTLY like League.tsx line 1268 - use the exact same expression
          // Create a NEW sorted array to avoid any mutation issues
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
              console.warn(`[${league.name}] User ${user.id} found in members but not in mltRows - adding with 0 stats`);
              sortedMltRows.push({
                user_id: user.id,
                name: members[memberMatch].name,
                mltPts: 0,
                unicorns: 0,
                ocp: 0
              });
              // Re-sort EXACTLY like League.tsx line 1268
              sortedMltRows.sort((a, b) => 
                b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
              );
              userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
            }
          }
          
          // CRITICAL: Extract sortedMemberIds from the FINAL sorted array (after any user additions)
          // This is the ML table order (1st to last) - EXACTLY matching League page
          const sortedMemberIds = sortedMltRows.map(r => r.user_id);

          // DEBUG: Log the exact values AFTER sorting for "Forget It" and "Prem Predictions"
          if (league.name?.toLowerCase().includes('forget') || league.name?.toLowerCase().includes('prem')) {
            console.error(`[${league.name}] === AFTER SORT ===`);
            console.error(`[${league.name}] leagueStartGw:`, leagueStartGw);
            console.error(`[${league.name}] relevantGws:`, Array.from(relevantGws));
            console.error(`[${league.name}] picksAll count:`, picksAll.length);
            console.error(`[${league.name}] picksAll by GW:`, Array.from(new Set(picksAll.map(p => p.gw))).sort());
            console.error(`[${league.name}] === BEFORE SORT (mltRows) ===`);
            mltRows.forEach((r, i) => {
              console.error(`${i + 1}. ${r.name}: mltPts=${r.mltPts}, unicorns=${r.unicorns}, ocp=${r.ocp}, user_id=${r.user_id}`);
            });
            console.error(`[${league.name}] === AFTER SORT (sortedMltRows) ===`);
            sortedMltRows.forEach((r, i) => {
              console.error(`${i + 1}. ${r.name}: mltPts=${r.mltPts}, unicorns=${r.unicorns}, ocp=${r.ocp}, user_id=${r.user_id}`);
            });
            console.error(`[${league.name}] sortedMemberIds:`, sortedMemberIds);
            console.error(`[${league.name}] sortedMemberNames:`, sortedMemberIds.map(id => members.find(m => m.id === id)?.name || id));
            console.error(`[${league.name}] sortedMemberInitials:`, sortedMemberIds.map(id => {
              const member = members.find(m => m.id === id);
              return member ? initials(member.name) : '?';
            }));
          }
          
          // CRITICAL DEBUG: Log the exact order for Prem Predictions
          if (league.name === 'Prem Predictions') {
            console.error(`🔴🔴🔴 PREM PREDICTIONS CALCULATED ORDER 🔴🔴🔴`);
            console.error(`sortedMemberIds:`, sortedMemberIds);
            console.error(`sortedMemberNames:`, sortedMemberIds.map(id => members.find(m => m.id === id)?.name || id));
            console.error(`sortedMemberInitials:`, sortedMemberIds.map(id => {
              const member = members.find(m => m.id === id);
              return member ? initials(member.name) : '?';
            }));
            console.error(`sortedMltRows (with positions):`, sortedMltRows.map((r, i) => ({
              position: i + 1,
              name: r.name,
              userId: r.user_id,
              mltPts: r.mltPts,
              unicorns: r.unicorns,
              ocp: r.ocp,
              initials: initials(r.name)
            })));
            console.error(`📊 PREM PREDICTIONS CURRENT STANDINGS:`);
            sortedMltRows.forEach((r, i) => {
              console.error(`${i + 1}. ${r.name} (${initials(r.name)}) - ID: ${r.user_id} - MLT Pts: ${r.mltPts}, Unicorns: ${r.unicorns}, OCP: ${r.ocp}`);
            });
          }
          
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
          
          // Debug: Log ALL GW winners for this league to see if there are ties in other GWs
          const allGwWinnersDetails = Array.from(gwWinners.entries()).map(([gw, winners]) => ({ 
            gw, 
            winners: Array.from(winners),
            winnerNames: Array.from(winners).map(id => members.find(m => m.id === id)?.name || id),
            isLatest: gw === latestRelevantGw
          }));
          console.log(`[${league.name}] All GW winners:`, allGwWinnersDetails);
          if (league.name === 'Easy League') {
            console.log(`[Easy League] DETAILED - Latest GW: ${latestRelevantGw}, All GWs with winners:`, allGwWinnersDetails);
          }
          
          // Debug: Log winners for this league
          if (latestGwWinners.size > 0) {
            console.log(`[${league.name}] Latest GW ${latestRelevantGw} winners:`, Array.from(latestGwWinners), 'Names:', Array.from(latestGwWinners).map(id => members.find(m => m.id === id)?.name || id));
          } else if (latestRelevantGw !== null) {
            console.warn(`[${league.name}] Latest GW ${latestRelevantGw} has NO winners! gwWinners map:`, Array.from(gwWinners.entries()).map(([gw, winners]) => ({ gw, winners: Array.from(winners) })));
          }
          
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
          
          // CRITICAL DEBUG: Verify stored data for Prem Predictions
          if (league.name === 'Prem Predictions') {
            console.error(`🔴🔴🔴 PREM PREDICTIONS STORING DATA 🔴🔴🔴`);
            console.error(`storedData.sortedMemberIds:`, storedData.sortedMemberIds);
            console.error(`storedData.sortedMemberIds length:`, storedData.sortedMemberIds?.length ?? 0);
            console.error(`storedData.members length:`, storedData.members.length);
            console.error(`storedData.sortedMemberIds initials:`, (storedData.sortedMemberIds || []).map(id => {
              const member = storedData.members.find(m => m.id === id);
              return member ? initials(member.name) : '?';
            }));
          }
          
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
        
        // CRITICAL: Create a completely new object to force React to detect the change
        const newLeagueData = Object.fromEntries(
          Object.entries(leagueDataMap).map(([id, data]) => [
            id,
            {
              ...data,
              sortedMemberIds: [...(data.sortedMemberIds || [])], // New array
              latestGwWinners: [...(data.latestGwWinners || [])], // New array
              members: [...(data.members || [])] // New array
            }
          ])
        );
        setLeagueData(newLeagueData);
        setLeagueDataLoading(false);
        
        // Debug: Log the final leagueData to verify it's correct
        console.log('[Home] Final leagueData set:', Object.keys(leagueDataMap).map(id => {
          const d = leagueDataMap[id];
          const league = leagues.find(l => l.id === id);
          return {
            leagueName: league?.name || id,
            sortedMemberIds: d.sortedMemberIds,
            latestGwWinners: d.latestGwWinners
          };
        }));
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
            <div 
              key={`leaderboard-scroll-${navigationKeyRef.current}`}
              className="overflow-x-auto -mx-4 px-4 scrollbar-hide" 
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none', 
                WebkitOverflowScrolling: 'touch', 
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x pinch-zoom'
              }}
            >
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
          ) : (loading || leagueDataLoading) && isInitialMountRef.current && leagues.length > 0 ? (
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
              key={`ml-scroll-${navigationKeyRef.current}-${leagues.length}`}
              className="overflow-x-auto -mx-4 px-4 scrollbar-hide" 
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none', 
                WebkitOverflowScrolling: 'touch', 
                overscrollBehaviorX: 'contain',
                overscrollBehaviorY: 'auto',
                touchAction: 'pan-x pan-y pinch-zoom'
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
                          // Force re-render when leagueData changes by using data in key
                          const dataKey = l.id;
                        const unread = unreadByLeague?.[l.id] ?? 0;
                        const badge = unread > 0 ? Math.min(unread, 99) : 0;
                        
                        return (
                            <div key={dataKey} className={index < batchLeagues.length - 1 ? 'relative' : ''}>
                              {index < batchLeagues.length - 1 && (
                                <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-10 pointer-events-none" />
                              )}
                              <Link
                                to={`/league/${l.code}`}
                                className="block p-4 !bg-white no-underline hover:text-inherit relative z-20"
                                style={{ 
                                  cursor: 'pointer', 
                                  position: 'relative',
                                  WebkitTapHighlightColor: 'transparent'
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
                                  
                                  <div className="flex-1 min-w-0 h-12 flex flex-col justify-between overflow-hidden">
                                    {/* League Name */}
                                    <div className="text-base font-semibold text-slate-900 truncate -mt-0.5">
                                      {l.name}
                                    </div>
                                    
                                    {/* Player Chips - ordered by ML table position (1st to last) */}
                                    <div className="flex items-center overflow-x-hidden overflow-y-hidden mt-1 py-0.5">
                                        {(() => {
                                          // Wait for calculation to complete
                                          if (leagueDataLoading) return null;
                                          
                                          const data = leagueData[l.id];
                                          if (!data) return null;
                                          
                                          const members = data.members || [];
                                          if (members.length === 0) return null;
                                          
                                          // CRITICAL: Use ML table order - MUST use sortedMemberIds from data
                                          const orderedMemberIds = data?.sortedMemberIds;
                                          
                                          // CRITICAL: If no sortedMemberIds, we can't render correctly
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
                                            .filter((m): m is LeagueMember => m !== undefined);
                                          
                                          // Convert Arrays back to Sets for checking (if they're Arrays)
                                          const submittedSet = data?.submittedMembers instanceof Set 
                                            ? data.submittedMembers 
                                            : new Set(data?.submittedMembers ?? []);
                                          const winnersSet = data?.latestGwWinners instanceof Set 
                                            ? data.latestGwWinners 
                                            : new Set(data?.latestGwWinners ?? []);
                                          
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
                                          const data = leagueData[l.id];
                                          if (!data) return null;
                                          const orderedMemberIds = data?.sortedMemberIds || data?.members?.map(m => m.id) || [];
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
        <div className="relative flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-slate-500 uppercase tracking-wide">
              Games
          </h2>
            <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center">
              <span className="text-[10px] text-slate-500 font-bold">i</span>
            </div>
          </div>
          {/* Centered toggle switch */}
          {(() => {
            // Check if any games are live - show filter toggle centered
            const fixturesToCheckForLive = isInApiTestLeague ? fixtures.slice(0, 3) : fixtures;
            const hasLiveGames = fixturesToCheckForLive.some(f => {
              const liveScore = liveScores[f.fixture_index];
              return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
            });
            
            if (!hasLiveGames) return null;
            
            return (
              <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                <span className={`text-[10px] font-medium transition-colors ${!showLiveOnly ? 'text-slate-700' : 'text-slate-400'}`}>ALL</span>
                <button
                  onClick={() => setShowLiveOnly(!showLiveOnly)}
                  className="relative inline-flex items-center rounded-full transition-colors focus:outline-none"
                  style={{
                    backgroundColor: showLiveOnly ? '#dc2626' : '#cbd5e1',
                    width: '48px',
                    height: '24px',
                    border: 'none'
                  }}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${showLiveOnly ? 'translate-x-6' : 'translate-x-0.5'}`}></span>
                </button>
                <span className={`text-[10px] font-medium transition-colors ${showLiveOnly ? 'text-slate-700' : 'text-slate-400'}`}>
                  LIVE
                </span>
              </div>
            );
          })()}
          <div className="flex items-center gap-2">
            {(() => {
              // Calculate live score for test API users (includes both live and finished games)
              let liveScoreCount = 0;
              let liveFixturesCount = 0;
              let finishedScoreCount = 0;
              let finishedFixturesCount = 0;
              let fixturesToCheck: typeof fixtures = [];
              if (isInApiTestLeague && fixtures.length > 0) {
                fixturesToCheck = fixtures.slice(0, 3); // Only first 3 fixtures
              fixturesToCheck.forEach(f => {
                const liveScore = liveScores[f.fixture_index];
                const isLive = liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
                const isFinished = liveScore && liveScore.status === 'FINISHED';
                  
                  // Count both live and finished games
                  if (liveScore && (isLive || isFinished)) {
                    if (isLive) liveFixturesCount++;
                    if (isFinished) finishedFixturesCount++;
                    const pick = picksMap[f.fixture_index];
                    // Determine if pick is correct based on live score
                    if (pick) {
                      let isCorrect = false;
                      if (pick === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrect = true;
                      else if (pick === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrect = true;
                      else if (pick === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrect = true;
                      if (isCorrect) {
                        liveScoreCount++;
                        if (isFinished) finishedScoreCount++;
                      }
                    }
                  }
                });
              }
              
              // Check if all games are finished
              const allFinished = fixturesToCheck.length > 0 && fixturesToCheck.every(f => {
                const liveScore = liveScores[f.fixture_index];
                return liveScore && liveScore.status === 'FINISHED';
              });
              
              // Show live score if there are live or finished matches
              if (isInApiTestLeague && fixturesToCheck.length > 0 && fixturesToCheck.some(f => {
                const liveScore = liveScores[f.fixture_index];
                return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
              })) {
                // If no live games but some finished games, show "Score X/Y" with clock icon
                if (liveFixturesCount === 0 && finishedFixturesCount > 0 && !allFinished) {
                  return (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white shadow-lg bg-slate-600 shadow-slate-500/30">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-medium opacity-90">Score</span>
                      <span className="flex items-baseline gap-0.5">
                        <span className="text-lg sm:text-xl font-extrabold">{finishedScoreCount}</span>
                        <span className="text-sm sm:text-base font-medium opacity-90">/</span>
                        <span className="text-base sm:text-lg font-semibold opacity-80">{finishedFixturesCount}</span>
                      </span>
                    </div>
                  );
                }
                
                return (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white shadow-lg ${allFinished ? 'bg-slate-600 shadow-slate-500/30' : 'bg-red-600 shadow-red-500/30'}`}>
                    {!allFinished && liveFixturesCount > 0 && (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    )}
                    {allFinished && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    )}
                    <span className="text-xs sm:text-sm font-medium opacity-90">{allFinished ? 'Score' : 'Live'}</span>
                    <span className="flex items-baseline gap-0.5">
                      <span className="text-lg sm:text-xl font-extrabold">{liveScoreCount}</span>
                      <span className="text-sm sm:text-base font-medium opacity-90">/</span>
                      <span className="text-base sm:text-lg font-semibold opacity-80">{fixturesToCheck.length}</span>
                    </span>
                  </div>
                );
              }
              
              // Show final score if available
              if (gwScore !== null && Object.keys(resultsMap).length > 0 && Object.keys(resultsMap).length === fixtures.length) {
                return (
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
                );
              }
              
              // Show make predictions button
              if (fixtures.length > 0 && !gwSubmitted && gwScore === null) {
                return (
                  <Link to="/new-predictions" className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors no-underline">Make your predictions</Link>
                );
              }
              
              return null;
            })()}
          </div>
        </div>
          {nextGwComing ? (
          <div className="mb-2">
            <span className="text-slate-600 font-semibold">GW{nextGwComing} coming soon</span>
            </div>
          ) : null}
            {loading ? (
              <div className="p-4 text-slate-500">Loading fixtures...</div>
            ) : fixtures.length === 0 ? (
              <div className="p-4 text-slate-500">No fixtures yet.</div>
            ) : (
          <div className="mt-6">
            {(() => {
              // Show all fixtures for all users
              let fixturesToShow = fixtures;
              
              // Filter to live games only if toggle is on
              if (showLiveOnly) {
                fixturesToShow = fixturesToShow.filter(f => {
                  const liveScore = liveScores[f.fixture_index];
                  return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
                });
              }
              
              // Group fixtures by date
              const grouped: Array<{ label: string; items: typeof fixturesToShow }> = [];
              const byDay = new Map<string, Fixture[]>();
              
              fixturesToShow.forEach((f) => {
                const d = f.kickoff_time ? new Date(f.kickoff_time) : null;
                const key = d ? d.toISOString().slice(0, 10) : "unknown";
                if (!byDay.has(key)) byDay.set(key, []);
                byDay.get(key)!.push(f);
              });
              
              // Sort by date and create groups
              const sortedKeys = [...byDay.keys()].sort((a, b) => {
                if (a === "unknown") return 1;
                if (b === "unknown") return -1;
                return a.localeCompare(b); // ISO date strings sort correctly
              });
              sortedKeys.forEach((key) => {
                const items = byDay.get(key)!;
                const d = items[0]?.kickoff_time ? new Date(items[0].kickoff_time) : null;
                const label = d 
                  ? d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
                  : "TBC";
                grouped.push({ label, items });
              });
              
              return grouped.map((group, groupIdx) => (
                <div key={groupIdx} className={groupIdx > 0 ? "mt-6" : ""}>
                  <div className="text-sm font-semibold text-slate-700 mb-3 px-1">
                    {group.label}
                  </div>
                  <div className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm">
                    {group.items.map((f, index) => {
                        const pick = picksMap[f.fixture_index];
                        console.log('[Home] Rendering fixture:', { fixture_index: f.fixture_index, pick, home: f.home_name, away: f.away_name });
                        // Prioritize full names over codes for display
                        const homeKey = f.home_name || f.home_team || f.home_code || "";
                        const awayKey = f.away_name || f.away_team || f.away_code || "";

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

                // Get live score if available
                const liveScore = liveScores[f.fixture_index];
                // PAUSED is halftime - include it for score counting but separate for animations
                const isLive = liveScore && liveScore.status === 'IN_PLAY';
                const isHalfTime = liveScore && (liveScore.status === 'PAUSED' || liveScore.status === 'HALF_TIME' || liveScore.status === 'HT');
                const isFinished = liveScore && liveScore.status === 'FINISHED';
                // For score counting purposes, include halftime as "ongoing"
                const isOngoing = isLive || isHalfTime;
                
                // Determine button states (use live score if available)
                const getButtonState = (side: "H" | "D" | "A") => {
                  const isPicked = pick === side;
                  // Only show correct result for live matches - for non-live, just show picked state
                  let isCorrectResult = false;
                  if (liveScore) {
                    // For live/finished matches, show which outcome is correct
                    if (side === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrectResult = true;
                    else if (side === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrectResult = true;
                    else if (side === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrectResult = true;
                  }
                  // Don't show results for non-live games - they should just show picked state
                  const isCorrect = isPicked && isCorrectResult;
                  // Wrong if picked but not correct result (for both live/halftime and finished games)
                  const isWrong = isPicked && (isOngoing || isFinished) && !isCorrectResult;
                  return { isPicked, isCorrectResult, isCorrect, isWrong };
                };

                const homeState = getButtonState("H");
                const drawState = getButtonState("D");
                const awayState = getButtonState("A");

                // Button styling helper
                const getButtonClass = (state: { isPicked: boolean; isCorrectResult: boolean; isCorrect: boolean; isWrong: boolean }) => {
                  const base = "h-16 rounded-xl border text-sm font-medium transition-all flex items-center justify-center select-none";
                  // Shiny gradient ONLY when game is FINISHED and pick is correct
                  if (state.isCorrect && isFinished) {
                    return `${base} bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-4 border-emerald-600 shadow-2xl shadow-yellow-400/40 transform scale-110 rotate-1 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]`;
                  } else if (state.isCorrect && isLive) {
                    // Live and correct - pulse in emerald green
                    return `${base} bg-emerald-600 text-white border-emerald-600 animate-pulse shadow-lg shadow-emerald-500/50`;
                  } else if (state.isCorrectResult && isFinished) {
                    // Correct outcome (but user didn't pick it) - grey with thick green border
                    return `${base} bg-slate-50 text-slate-600 border-4 border-emerald-600`;
                  } else if (state.isWrong && isFinished) {
                    // Wrong pick in finished game - grey background with flashing red border and strikethrough
                    return `${base} bg-slate-50 text-slate-600 border-4 animate-[flash-border_1s_ease-in-out_infinite]`;
                  } else if (state.isWrong && (isLive || isHalfTime)) {
                    // Wrong pick in live game - grey background with flashing red border, NO strikethrough until FT
                    return `${base} bg-slate-50 text-slate-600 border-4 animate-[flash-border_1s_ease-in-out_infinite]`;
                  } else if (state.isPicked) {
                    return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
                  } else {
                    return `${base} bg-slate-50 text-slate-600 border-slate-200`;
                  }
                };

                return (
                  <div key={f.id} className={index < fixturesToShow.length - 1 ? 'relative' : ''}>
                    {index < fixturesToShow.length - 1 && (
                      <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-10" />
                    )}
                    <div className="p-4 !bg-white relative z-0">
                      {/* LIVE indicator - red dot top left for live games, always says LIVE */}
                      {(isLive || isHalfTime) && (
                        <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pb-6">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-xs font-bold text-red-600">
                            LIVE
                          </span>
                        </div>
                      )}
                      {/* FT indicator for finished games - grey, no pulse */}
                      {isFinished && !isLive && !isHalfTime && (
                        <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pb-6">
                          <span className="text-xs font-semibold text-slate-500">
                            FT
                          </span>
                        </div>
                      )}
                      
                      {/* header: Home  score/kickoff  Away */}
                      <div className={`flex flex-col px-2 pb-3 ${isOngoing ? 'pt-4' : 'pt-1'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 flex-1 justify-end">
                            <div className={`break-words ${liveScore && (isOngoing || isFinished) && liveScore.homeScore > liveScore.awayScore ? 'font-bold' : 'font-medium'}`}>{homeName}</div>
                            <img 
                              src={`/assets/badges/${(f.home_code || homeKey).toUpperCase()}.png`} 
                              alt={homeName}
                              className="w-5 h-5"
                              onError={(e) => {
                                // Reduce opacity if badge fails to load, don't hide completely
                                (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
                              }}
                            />
                          </div>
                          <div className="px-4 flex items-center">
                            {liveScore && (isOngoing || isFinished) ? (
                              <span className="font-bold text-base text-slate-900">
                                {liveScore.homeScore} - {liveScore.awayScore}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-sm">{kickoff}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-1 justify-start">
                            <img 
                              src={`/assets/badges/${(f.away_code || awayKey).toUpperCase()}.png`} 
                              alt={awayName}
                              className="w-5 h-5"
                              onError={(e) => {
                                // Reduce opacity if badge fails to load, don't hide completely
                                (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
                              }}
                            />
                            <div className={`break-words ${liveScore && (isOngoing || isFinished) && liveScore.awayScore > liveScore.homeScore ? 'font-bold' : 'font-medium'}`}>{awayName}</div>
                          </div>
                        </div>
                        {liveScore && (isOngoing || isFinished) && (
                          <div className="flex justify-center mt-1">
                            <span className={`text-[10px] font-semibold ${isOngoing ? 'text-red-600' : 'text-slate-500'}`}>
                              {formatMinuteDisplay(liveScore.status, liveScore.minute)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* buttons: Home Win, Draw, Away Win */}
                      <div className="grid grid-cols-3 gap-3 relative">
                        <div className={`${getButtonClass(homeState)} flex items-center justify-center`}>
                          <span className={`${homeState.isCorrect ? "font-bold" : ""} ${homeState.isWrong && isFinished ? "line-through decoration-2 decoration-black" : ""}`}>Home Win</span>
                        </div>
                        <div className={`${getButtonClass(drawState)} flex items-center justify-center`}>
                          <span className={`${drawState.isCorrect ? "font-bold" : ""} ${drawState.isWrong && isFinished ? "line-through decoration-2 decoration-black" : ""}`}>Draw</span>
                        </div>
                        <div className={`${getButtonClass(awayState)} flex items-center justify-center`}>
                          <span className={`${awayState.isCorrect ? "font-bold" : ""} ${awayState.isWrong && isFinished ? "line-through decoration-2 decoration-black" : ""}`}>Away Win</span>
                        </div>
                      </div>
                                
                                {/* Debug API Pull History - only for API Test League */}
                                {isInApiTestLeague && apiPullHistoryRef.current[f.fixture_index] && apiPullHistoryRef.current[f.fixture_index].length > 0 && (
                                  <div className="mt-3 border-t border-slate-200 pt-3">
                                    <button
                                      onClick={() => setExpandedDebugLog(prev => ({ ...prev, [f.fixture_index]: !prev[f.fixture_index] }))}
                                      className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-700 py-1"
                                    >
                                      <span>🔍 API Pull History</span>
                                      <svg
                                        className={`w-4 h-4 transition-transform ${expandedDebugLog[f.fixture_index] ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {expandedDebugLog[f.fixture_index] && (
                                      <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                                        {apiPullHistoryRef.current[f.fixture_index].slice().reverse().map((pull, idx) => (
                                          <div key={idx} className="text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-200">
                                            <div className="flex justify-between items-start gap-2">
                                              <div className="flex-1">
                                                <div className="text-slate-600 font-semibold">
                                                  {pull.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </div>
                                                <div className="text-slate-500 mt-0.5">
                                                  Status: <span className="font-semibold">{pull.status}</span>
                                                </div>
                                                <div className="text-slate-500 mt-0.5">
                                                  Score: <span className="font-semibold">{pull.homeScore} - {pull.awayScore}</span>
                                                </div>
                                                <div className="text-slate-500 mt-0.5">
                                                  Calculated Min: <span className="font-semibold">{pull.minute !== null ? `${pull.minute}'` : 'null'}</span>
                                                </div>
                                                {pull.apiMinute !== null && pull.apiMinute !== undefined && (
                                                  <div className="text-slate-500 mt-0.5">
                                                    API Min: <span className="font-semibold">{pull.apiMinute}'</span>
                                                  </div>
                                                )}
                                                {pull.diffMinutes !== null && (
                                                  <div className="text-slate-500 mt-0.5">
                                                    Time since KO: <span className="font-semibold">{pull.diffMinutes} min</span>
                                                  </div>
                                                )}
                                                {pull.halftimeEndTime && (
                                                  <div className="text-slate-500 mt-0.5">
                                                    HT End: <span className="font-semibold">{new Date(pull.halftimeEndTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                  </div>
                                                )}
                                                {pull.halftimeEndMinute !== null && (
                                                  <div className="text-slate-500 mt-0.5">
                                                    HT End Min: <span className="font-semibold">{pull.halftimeEndMinute}'</span>
                                                  </div>
                                                )}
                                                {pull.minutesSinceHalftimeEnd !== null && (
                                                  <div className="text-slate-500 mt-0.5">
                                                    Min since HT: <span className="font-semibold">{pull.minutesSinceHalftimeEnd} min</span>
                                                  </div>
                                                )}
                                                {pull.kickoffTime && (
                                                  <div className="text-slate-400 mt-0.5 text-[9px]">
                                                    KO: {new Date(pull.kickoffTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                  </div>
                                </div>
                        );
                      })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
