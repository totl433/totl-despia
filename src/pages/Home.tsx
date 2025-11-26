import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getMediumName, getTeamBadgePath, areTeamNamesSimilar } from "../lib/teamNames";
import { getLeagueAvatarUrl, getDefaultMlAvatar } from "../lib/leagueAvatars";
import { LEAGUE_START_OVERRIDES } from "../lib/leagueStart";
import html2canvas from "html2canvas";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { scheduleDeadlineReminder, scheduleGameweekStartingSoon } from "../lib/notifications";
import { LeaderboardCard } from "../components/LeaderboardCard";
import { StreakCard } from "../components/StreakCard";
import { useLiveScores } from "../hooks/useLiveScores";
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
  latestRelevantGw?: number | null; // The GW number that latestGwWinners is from (needed to know when to hide shiny chips)
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
// For test API fixtures, show actual minutes instead of "First Half"/"Second Half"
function formatMinuteDisplay(status: string, minute: number | null | undefined, isTestApi: boolean = false): string {
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
    // For test API, always show actual minutes
    if (isTestApi) {
      return `${minute}'`;
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
  home_crest?: string | null;
  away_crest?: string | null;
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
  const [leaderboardDataLoading, setLeaderboardDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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
  
  // Track previous scores to avoid duplicate notifications
  // const prevScoresRef = useRef<Record<number, { homeScore: number; awayScore: number }>>({});
  // Track if "Game Week Starting Soon" notification has been scheduled
  const gameweekStartingSoonScheduledRef = useRef(false);
  // Track if deadline reminder notification has been scheduled
  const deadlineReminderScheduledRef = useRef(false);
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

  // Get api_match_ids from fixtures for real-time subscription
  const apiMatchIds = useMemo(() => {
    if (!fixtures || fixtures.length === 0) return [];
    return fixtures
      .map(f => f.api_match_id)
      .filter((id): id is number => id !== null && id !== undefined);
  }, [fixtures]);

  // Subscribe to real-time live scores updates (replaces polling)
  // Subscribe to ALL gameweeks (undefined = all) so we catch updates for any GW
  // The hook will filter in the callback based on apiMatchIds
  const { liveScores: liveScoresMap } = useLiveScores(
    undefined, // Don't filter by GW - listen to all gameweeks
    apiMatchIds.length > 0 ? apiMatchIds : undefined
  );

  // Convert Map to Record format for backward compatibility with existing code
  const liveScores = useMemo(() => {
    const result: Record<number, { 
      homeScore: number; 
      awayScore: number; 
      status: string; 
      minute?: number | null;
      goals?: any[] | null;
      red_cards?: any[] | null;
      home_team?: string | null;
      away_team?: string | null;
    }> = {};
    if (!fixtures || fixtures.length === 0) return result;
    fixtures.forEach(fixture => {
      const apiMatchId = fixture.api_match_id;
      if (apiMatchId) {
        const liveScore = liveScoresMap.get(apiMatchId);
        if (liveScore) {
          result[fixture.fixture_index] = {
            homeScore: liveScore.home_score ?? 0,
            awayScore: liveScore.away_score ?? 0,
            status: liveScore.status || 'SCHEDULED',
            minute: liveScore.minute ?? null,
            goals: liveScore.goals ?? null,
            red_cards: liveScore.red_cards ?? null,
            home_team: liveScore.home_team ?? null,
            away_team: liveScore.away_team ?? null
          };
        }
      }
    });
      return result;
  }, [liveScoresMap, fixtures]);

  // Fetch live score from Supabase ONLY (updated by scheduled Netlify function)
  // NO API calls from client - all API calls go through the scheduled function
  // NOTE: This function is no longer used - we use useLiveScores hook instead
  // const fetchLiveScore = async (apiMatchId: number, kickoffTime?: string | null) => {
  //   try {
  //     // Read from Supabase live_scores table (updated by scheduled Netlify function)
  //     const { data: liveScore, error } = await supabase
  //       .from('live_scores')
  //       .select('*')
  //       .eq('api_match_id', apiMatchId)
  //       .single();
  //     
  //     if (error) {
  //       if (error.code === 'PGRST116') {
  //         // No row found - scheduled function hasn't run yet or game hasn't started
  //         return null;
  //       }
  //       console.error('[Home] Error fetching live score from Supabase:', error);
  //       return null;
  //     }
  //     
  //     if (!liveScore) {
  //       return null;
  //     }
  //     
  //     const homeScore = liveScore.home_score ?? 0;
  //     const awayScore = liveScore.away_score ?? 0;
  //     const status = liveScore.status || 'SCHEDULED';
  //     let minute = liveScore.minute;
  //     
  //     // If minute is not provided, calculate from kickoff time (fallback)
  //     if ((minute === null || minute === undefined) && (status === 'IN_PLAY' || status === 'PAUSED') && kickoffTime) {
  //       try {
  //         const matchStart = new Date(kickoffTime);
  //         const now = new Date();
  //         const diffMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60));
  //         
  //         if (diffMinutes > 0 && diffMinutes < 120) {
  //           if (status === 'PAUSED') {
  //             minute = null;
  //           } else if (status === 'IN_PLAY') {
  //             if (diffMinutes <= 50) {
  //               minute = diffMinutes;
  //             } else {
  //               minute = 46 + Math.max(0, diffMinutes - 50);
  //             }
  //           }
  //         }
  //       } catch (e) {
  //         // Ignore calculation errors
  //       }
  //     }
  //     
  //     const result = { homeScore, awayScore, status, minute, retryAfter: null as number | null };
  //     return result;
  //   } catch (error: any) {
  //     console.error('[Home] Error fetching live score from Supabase:', error?.message || error, error?.stack);
  //     return null;
  //   }
  // };

  // Extract data fetching into a reusable function for pull-to-refresh
  const fetchHomeData = useCallback(async (showLoading = true) => {
    if (!user?.id) {
        setLoading(false);
      return;
    }

    let alive = true;
    
    if (showLoading) {
        setLoading(true);
        setError(null);
      }

    try {
      // PARALLEL QUERY 1: Fetch current GW and user's leagues simultaneously
      // Use direct Supabase calls (same as original working code)
      // NOTE: Removed start_gw from select as it may not exist or cause 400 error
      const [currentGwResult, userLeaguesResult] = await Promise.all([
        supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle(),
        supabase.from("league_members").select("leagues(id,name,code,created_at,avatar)").eq("user_id", user.id),
      ]);
      
      // Check for errors in queries
      if (currentGwResult.error) {
        console.error('[Home] Error fetching current GW:', currentGwResult.error);
        throw new Error(`Failed to load current gameweek: ${currentGwResult.error.message}`);
      }
      
      if (userLeaguesResult.error) {
        console.error('[Home] Error fetching user leagues:', userLeaguesResult.error);
        throw new Error(`Failed to load leagues: ${userLeaguesResult.error.message}`);
      }
      
      const currentGw = (currentGwResult.data as any)?.current_gw ?? 1;

      const userLeagues = ((userLeaguesResult.data ?? []) as any[])
        .map((r) => r.leagues)
        .filter(Boolean) as League[];
      
      // Preserve avatar from database if it exists, otherwise use deterministic default
      // The getLeagueAvatarUrl helper will handle the logic
      const ls: League[] = userLeagues.map((league) => ({
        ...league,
        // Keep the avatar field from database (could be Supabase Storage URL, default filename, or null)
        // getLeagueAvatarUrl() will handle the fallback logic
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
        // Use current_test_gw from meta as primary source
        // This allows the app to show GW T2, T3, etc. when they're set as current
        let testGw: number | null = null;
        
        const { data: testMeta } = await supabase
          .from("test_api_meta")
          .select("current_test_gw")
          .eq("id", 1)
          .maybeSingle();
        
        testGw = testMeta?.current_test_gw ?? 1;
        
        // Verify that fixtures exist for this test_gw, otherwise fall back to GW T1
        if (testGw) {
          const { data: fixturesCheck } = await supabase
            .from("test_api_fixtures")
            .select("test_gw")
            .eq("test_gw", testGw)
            .limit(1)
            .maybeSingle();
          
          // If no fixtures for current_test_gw, fall back to GW T1
          if (!fixturesCheck && testGw !== 1) {
            const { data: t1Data } = await supabase
              .from("test_api_fixtures")
              .select("test_gw")
              .eq("test_gw", 1)
              .limit(1)
              .maybeSingle();
            
            if (t1Data) {
              testGw = 1; // Fallback to GW T1
            }
          }
        }
        
        if (!testGw) {
          setFixtures([]);
          setPicksMap({});
          return;
        }
        
        // Fetch from test API tables - include api_match_id for live scores
        // CRITICAL: For Test API, we DON'T use gw_results for score calculation
        // We only use live_scores (which is fetched later and checked via testApiResultsByFixtureIdx)
        // So set gwResults to empty array to ensure no score is calculated from old gw_results data
        [fixturesResult, picksResult, submissionResult] = await Promise.all([
          supabase.from("test_api_fixtures").select("id,test_gw,fixture_index,api_match_id,home_code,away_code,home_team,away_team,home_name,away_name,home_crest,away_crest,kickoff_time").eq("test_gw", testGw).order("fixture_index", { ascending: true }),
          supabase.from("test_api_picks").select("user_id,matchday,fixture_index,pick").eq("user_id", user.id).eq("matchday", testGw),
          supabase.from("test_api_submissions").select("submitted_at").eq("user_id", user.id).eq("matchday", testGw).maybeSingle(),
        ]);
        
        // Check for errors in test API queries
        if (fixturesResult.error) {
          console.error('[Home] Error fetching test API fixtures:', fixturesResult.error);
          throw new Error(`Failed to load fixtures: ${fixturesResult.error.message}`);
        }
        if (picksResult.error) {
          console.error('[Home] Error fetching test API picks:', picksResult.error);
          throw new Error(`Failed to load picks: ${picksResult.error.message}`);
        }
        if (submissionResult.error) {
          console.error('[Home] Error fetching test API submission:', submissionResult.error);
          throw new Error(`Failed to load submission: ${submissionResult.error.message}`);
        }
        
        // Map test_gw/matchday to gw for consistency
        const testFixtures = (fixturesResult.data as any[]) ?? [];
        thisGwFixtures = testFixtures.map(f => ({ ...f, gw: f.test_gw })) as Fixture[];
        
        // Validate picks - only use picks if user has submitted
        // CRITICAL: If user hit "Start Over", there should be no submission, so ignore ALL picks
        const hasSubmissionRecord = !!submissionResult.data?.submitted_at;
        const testPicks = (picksResult.data as any[]) ?? [];
        
        // SIMPLE RULE: If user hit "Start Over" (no submission), OR if picks don't match fixtures exactly, 
        // treat it as NOT submitted - don't show picks or scores
        // First, check if picks match current fixtures exactly
        let picksMatchCurrentFixtures = false;
        if (testPicks.length > 0 && thisGwFixtures.length > 0) {
          const currentFixtureIndices = new Set(thisGwFixtures.map(f => f.fixture_index));
          const picksForCurrentFixtures = testPicks.filter((p: any) => currentFixtureIndices.has(p.fixture_index));
          
          // Only consider valid if picks match ALL fixtures exactly
          const allFixturesHavePicks = thisGwFixtures.every(f => picksForCurrentFixtures.some((p: any) => p.fixture_index === f.fixture_index));
          const noExtraPicks = picksForCurrentFixtures.length === thisGwFixtures.length;
          picksMatchCurrentFixtures = allFixturesHavePicks && noExtraPicks && picksForCurrentFixtures.length === thisGwFixtures.length;
          
          if (picksMatchCurrentFixtures) {
            userPicks = picksForCurrentFixtures.map(p => ({ ...p, gw: p.matchday })) as PickRow[];
          } else {
            // Picks don't match current fixtures exactly - ignore them
            userPicks = [];
          }
        } else {
          // No picks or no fixtures - set empty
          userPicks = [];
        }
        
        // CRITICAL: For Test API, we don't use gw_results - set to empty array
        // Score will only be calculated from live_scores (via testApiResultsByFixtureIdx)
        gwResults = [];
        
        // CRITICAL: Only consider submitted if:
        // 1. Submission record exists AND
        // 2. Picks exist AND match ALL current fixtures EXACTLY
        // If EITHER fails, treat as NOT submitted - clear picks and hide everything
        // This ensures if user hit "Start Over" (no picks), we treat as NOT submitted
        const hasValidPicks = picksMatchCurrentFixtures && testPicks.length === thisGwFixtures.length;
        submitted = hasSubmissionRecord && hasValidPicks && testPicks.length > 0;
        
        // CRITICAL: If NOT submitted, clear picks to ensure nothing shows (no buttons, no scores)
        if (!submitted) {
          userPicks = [];
        }
        
        console.log('[Home] Test API submission check (FINAL):', {
          hasSubmissionRecord,
          submissionDate: submissionResult.data?.submitted_at,
          testPicksCount: testPicks.length,
          validUserPicksCount: userPicks.length,
          fixturesCount: thisGwFixtures.length,
          picksMatchCurrentFixtures,
          hasValidPicks,
          submitted,
          action: submitted ? 'SHOWING picks/score' : 'HIDING picks/score - NOT SUBMITTED'
        });
        
        // EXTRA CHECK: If userPicks is empty but submitted is true, something is wrong - force submitted = false
        if (submitted && userPicks.length === 0) {
          console.warn('[Home] Test API WARNING: submitted=true but userPicks is empty - forcing submitted=false');
          submitted = false;
        }
      } else {
        // Regular fixtures
        [fixturesResult, picksResult, resultsResult, submissionResult] = await Promise.all([
          supabase.from("fixtures").select("id,gw,fixture_index,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time").eq("gw", currentGw).order("fixture_index", { ascending: true }),
          supabase.from("picks").select("user_id,gw,fixture_index,pick").eq("user_id", user.id).eq("gw", currentGw),
          supabase.from("gw_results").select("gw,fixture_index,result").eq("gw", currentGw),
          supabase.from("gw_submissions").select("submitted_at").eq("user_id", user.id).eq("gw", currentGw).maybeSingle(),
        ]);
        
        // Check for errors in regular queries
        if (fixturesResult.error) {
          console.error('[Home] Error fetching fixtures:', fixturesResult.error);
          throw new Error(`Failed to load fixtures: ${fixturesResult.error.message}`);
        }
        if (picksResult.error) {
          console.error('[Home] Error fetching picks:', picksResult.error);
          throw new Error(`Failed to load picks: ${picksResult.error.message}`);
        }
        if (resultsResult.error) {
          console.error('[Home] Error fetching results:', resultsResult.error);
          throw new Error(`Failed to load results: ${resultsResult.error.message}`);
        }
        if (submissionResult.error) {
          console.error('[Home] Error fetching submission:', submissionResult.error);
          throw new Error(`Failed to load submission: ${submissionResult.error.message}`);
        }
        
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
        // Only calculate score if:
        // 1. There are results
        // 2. User has picks that match current fixtures
        // 3. User has submitted (for test API league, this means recent submission)
        // This ensures we don't show scores from old picks
        if (outcomeByIdx.size > 0 && userPicks.length > 0 && submitted) {
      // Count correct picks
          let s = 0;
          userPicks.forEach((p) => {
            const out = outcomeByIdx.get(p.fixture_index);
            if (out && out === p.pick) s += 1;
          });
          score = s;
        } else if (!submitted && isInApiTestLeague) {
          // For test API league, if not submitted, don't show score even if picks exist
          // This prevents showing scores from old unsubmitted picks
          score = null;
        } else if (isInApiTestLeague && outcomeByIdx.size === 0) {
          // CRITICAL: For Test API league, if no results yet (games haven't started), 
          // score should be null even if user has submitted picks
          // This prevents showing "Score 0/10" or "Score 3/10" before games start
          score = null;
        } else if (outcomeByIdx.size === 0 && userPicks.length === 0) {
          // No results and no picks - score should be null (show "Make predictions" button)
          score = null;
        }

      // Populate picksMap - only show picks if user has submitted (for test API league)
      // CRITICAL: For Test API league, ONLY show picks if submitted = true
      // If user hit "Start Over" (deleted submission), picks should NOT show
      const map: Record<number, "H" | "D" | "A"> = {};
      if (isInApiTestLeague) {
        // For Test API league: ONLY show picks if submitted
        // If no submission exists (hit Start Over), don't show any picks
        if (submitted) {
          userPicks.forEach((p) => {
            map[p.fixture_index] = p.pick;
          });
        } else {
          // No submission - clear any picks that might exist
          console.log('[Home] Test API: No submission, clearing picks from picksMap');
        }
      } else {
        // Regular leagues: always show picks
        userPicks.forEach((p) => {
          map[p.fixture_index] = p.pick;
        });
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

    // Show "coming soon" message if there are no fixtures for current GW
    // This means the next GW is coming soon
    if (thisGwFixtures.length === 0 && currentGw) {
      setNextGwComing(currentGw + 1);
    } else {
    setNextGwComing(null);
    }

    if (alive) {
      // Set all data atomically to prevent flickering
      setGwSubmitted(submitted);
      setGwScore(score);
      setResultsMap(currentResultsMap);
      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setUnreadByLeague(unreadCounts);
      setLeagueSubmissions(submissionStatus);
      setError(null); // Clear any previous errors on success
      setRetryCount(0); // Reset retry count on success
      // Mark initial mount as complete after successful load
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
      }
      // Use setTimeout to ensure state updates are batched and prevent flickering
      setTimeout(() => {
        if (alive) {
          setLoading(false);
        }
      }, 0);
    }
    } catch (error: any) {
      console.error('[Home] Error loading home page data:', error);
      if (alive) {
        setLoading(false);
        
        // On initial mount or if we don't have leagues yet, clear everything
        // This prevents showing stale data when there's an error
        if (isInitialMountRef.current || leagues.length === 0) {
          setLeagues([]);
          setFixtures([]);
          setGwSubmitted(false);
          setGwScore(null);
          setPicksMap({});
          setResultsMap({});
          setLeaderboardDataLoading(true); // Reset leaderboard loading on error
        } else {
          // If we have leagues, keep them but clear fixtures/score
          // This allows user to see their leagues even if current GW data fails
          setFixtures([]);
          setGwSubmitted(false);
          setGwScore(null);
        }
        
        // Set error message for user
        const errorMessage = error?.message || 'Failed to load data. Please check your connection.';
        setError(errorMessage);
        
        // Auto-retry up to 3 times with exponential backoff
        if (retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // 1s, 2s, 4s
          console.log(`[Home] Retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            fetchHomeData(false);
          }, delay);
        }
      }
    }
  }, [user?.id]); // Note: This function uses many state setters which are stable, so only user?.id is needed

  // Pull-to-refresh hook - DISABLED for now to fix link clicks on mobile
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
    enabled: false, // Disabled to fix link clicks on mobile
    enableMouse: false,
  });

  // Create a stable key for fixtures to prevent unnecessary effect re-runs (unused)
  // const fixturesKey = useMemo(() => 
  //   fixtures.map(f => `${f.fixture_index}-${f.api_match_id}`).join(','),
  // [fixtures]
  // );

  // Simple live score polling - poll fixtures whose kickoff has passed
  // Real-time live scores are now handled by useLiveScores hook above
  // No polling needed - scores update instantly when Netlify writes to live_scores table
  
  // Schedule notifications (only once per fixture, localStorage prevents duplicates)
  useEffect(() => {
    if (!isInApiTestLeague || !fixtures.length) return;
    
    const fixturesToPoll = fixtures.filter(f => f.api_match_id && f.kickoff_time);
    
    fixturesToPoll.forEach((fixture) => {
      if (!fixture.api_match_id || !fixture.kickoff_time) return;
      const fixtureIndex = fixture.fixture_index;
      
      // NOTE: Kickoff notifications are now handled server-side by sendScoreNotifications
      // which sends push notifications when games actually start (status changes to IN_PLAY)
      // This is more reliable than client-side scheduling based on kickoff time
      
      if (fixtureIndex === 0 && fixture.kickoff_time) {
        const firstKickoff = new Date(fixture.kickoff_time);
        const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
        
        if (!deadlineReminderScheduledRef.current) {
          scheduleDeadlineReminder(deadlineTime.toISOString(), 1, 2);
          deadlineReminderScheduledRef.current = true;
        }
        
        if (!gameweekStartingSoonScheduledRef.current) {
          scheduleGameweekStartingSoon(fixture.kickoff_time, 1);
          gameweekStartingSoonScheduledRef.current = true;
        }
      }
    });
  }, [isInApiTestLeague, fixtures]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      // Clear all data when user logs out
      setLeagues([]);
      setFixtures([]);
      setGwSubmitted(false);
      setGwScore(null);
      setPicksMap({});
      setResultsMap({});
      setError(null);
      return;
    }
    
    // On initial mount, clear all state to prevent showing stale data
    if (isInitialMountRef.current) {
      setLeagues([]);
      setFixtures([]);
      setGwSubmitted(false);
      setGwScore(null);
      setPicksMap({});
      setResultsMap({});
      setError(null);
      setRetryCount(0);
      setLeaderboardDataLoading(true);
    }
    
    // Increment navigation key to force scroll containers to recreate
    navigationKeyRef.current += 1;
    
    // Always fetch fresh data
    fetchHomeData(isInitialMountRef.current);
  }, [user?.id, fetchHomeData]);

  // Fetch member data and calculate positions for each league
  useEffect(() => {
    if (!leagues.length || !user?.id) {
      console.log('Skipping position calculation:', { leaguesLength: leagues.length, userId: user?.id });
      setLeagueDataLoading(false);
      return;
    }
    
    console.log('Starting position calculation for', leagues.length, 'leagues');
    setLeagueDataLoading(true);
    
    let alive = true;
    (async () => {
      try {
        // Get current GW from meta (don't depend on gw state)
        const { data: metaData } = await supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle();
        const currentGw = (metaData as any)?.current_gw ?? 1;
      
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
      // For API Test league, use test_api_picks and matchday=1
      const picksByLeague = new Map<string, PickRow[]>();
      
      // Check if API Test league exists
      const apiTestLeague = leagues.find(l => l.name === "API Test");
      
      // Fetch current test GW from meta table if API Test league exists
      let currentTestGw = 1; // Default to 1
      if (apiTestLeague) {
        const { data: testMetaData } = await supabase
          .from("test_api_meta")
          .select("current_test_gw")
          .eq("id", 1)
          .maybeSingle();
        currentTestGw = testMetaData?.current_test_gw ?? 1;
      }
      
      // Fetch test API fixtures and live scores if API Test league exists
      let testApiFixtures: any[] = [];
      let testApiLiveScores: Record<number, { homeScore: number; awayScore: number; status: string }> = {};
      let testApiResultsByFixtureIdx = new Map<number, "H" | "D" | "A">();
      
      if (apiTestLeague) {
        // Fetch test API fixtures for current test GW
        const { data: testFixturesData } = await supabase
          .from("test_api_fixtures")
          .select("fixture_index,api_match_id")
          .eq("test_gw", currentTestGw)
          .order("fixture_index", { ascending: true });
        
        testApiFixtures = testFixturesData ?? [];
        
        // Fetch live scores for test fixtures (first 3 fixtures only)
        if (testApiFixtures.length > 0) {
          const fixturesToCheck = testApiFixtures.filter(f => f.api_match_id);
          const apiMatchIds = fixturesToCheck.map(f => f.api_match_id);
          
          if (apiMatchIds.length > 0) {
            const { data: liveScoresData } = await supabase
              .from("live_scores")
              .select("api_match_id,home_score,away_score,status")
              .in("api_match_id", apiMatchIds);
            
            // Build results map from live scores
            (liveScoresData ?? []).forEach((score: any) => {
              const fixture = fixturesToCheck.find(f => f.api_match_id === score.api_match_id);
              if (fixture && (score.status === 'IN_PLAY' || score.status === 'PAUSED' || score.status === 'FINISHED')) {
                testApiLiveScores[fixture.fixture_index] = {
                  homeScore: score.home_score ?? 0,
                  awayScore: score.away_score ?? 0,
                  status: score.status
                };
                
                // Determine outcome from scores
                if (score.home_score > score.away_score) {
                  testApiResultsByFixtureIdx.set(fixture.fixture_index, 'H');
                } else if (score.away_score > score.home_score) {
                  testApiResultsByFixtureIdx.set(fixture.fixture_index, 'A');
                } else {
                  testApiResultsByFixtureIdx.set(fixture.fixture_index, 'D');
                }
              }
            });
          }
        }
      }
      
      for (const league of leagues) {
        const members = membersByLeague[league.id] ?? [];
        if (members.length === 0) {
          picksByLeague.set(league.id, []);
          continue;
        }
        
        // For API Test league, use test_api_picks with current test GW
        if (league.name === "API Test") {
          const memberIds = members.map(m => m.id);
          const { data: testApiPicks } = await supabase
            .from("test_api_picks")
            .select("user_id,matchday,fixture_index,pick")
            .eq("matchday", currentTestGw)
            .in("user_id", memberIds);
          
          // Convert test_api_picks to PickRow format (map matchday to gw=1 for consistency)
          const convertedPicks: PickRow[] = (testApiPicks ?? []).map((p: any) => ({
            user_id: p.user_id,
            gw: 1, // Map matchday to gw=1 for consistency
            fixture_index: p.fixture_index,
            pick: p.pick
          }));
          
          picksByLeague.set(league.id, convertedPicks);
          continue;
        }
        
        // Regular leagues: use picks table
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
      
      // BATCH: Fetch all submissions for current GW in one query (regular leagues)
      // CRITICAL: test_api_submissions should ONLY be used for API Test league
      // Regular leagues should ONLY use gw_submissions
      // We keep them separate to ensure proper isolation
      const { data: allSubmissionsData } = allMemberIds.size > 0
        ? await supabase
            .from("gw_submissions")
            .select("user_id")
            .eq("gw", currentGw)
            .in("user_id", Array.from(allMemberIds))
        : { data: [] };
      
      // CRITICAL: Only fetch test_api_submissions for API Test league members
      // This ensures test API submissions are ONLY used for API Test league
      // Keep them separate from regular submissions
      // IMPORTANT: Validate submissions the same way League.tsx does - ensure users have picks for ALL current fixtures
      const testApiSubmittedUserIds = new Set<string>();
      if (apiTestLeague) {
        const apiTestMemberIds = membersByLeague[apiTestLeague.id]?.map(m => m.id) ?? [];
        if (apiTestMemberIds.length > 0) {
          // Fetch submissions for current test GW
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
            const cutoffDate = new Date('2025-11-18T00:00:00Z'); // Same cutoff as League.tsx
            
            // Only count submissions if user has picks for ALL current fixtures AND submission is recent
            testSubsData.forEach((sub: any) => {
              const userPicks = (testApiPicksForValidation ?? []).filter((p: any) => p.user_id === sub.user_id);
              const picksForCurrentFixtures = userPicks.filter((p: any) => currentFixtureIndicesSet.has(p.fixture_index));
              const hasAllRequiredPicks = picksForCurrentFixtures.length === requiredFixtureCount && requiredFixtureCount > 0;
              
              const uniqueFixtureIndices = new Set(picksForCurrentFixtures.map((p: any) => p.fixture_index));
              const hasExactMatch = uniqueFixtureIndices.size === requiredFixtureCount;
              
              const submissionDate = sub.submitted_at ? new Date(sub.submitted_at) : null;
              const isRecentSubmission = submissionDate && submissionDate >= cutoffDate;
              
              // Only count as submitted if all conditions met
              if (hasAllRequiredPicks && hasExactMatch && isRecentSubmission) {
                testApiSubmittedUserIds.add(sub.user_id);
                console.log('[Home] ✅ API Test League: User', sub.user_id, 'is VALIDLY submitted for chips. Picks:', picksForCurrentFixtures.length, 'Required:', requiredFixtureCount);
              } else {
                const reasons = [];
                if (!hasAllRequiredPicks) reasons.push(`has ${picksForCurrentFixtures.length} picks (need ${requiredFixtureCount})`);
                if (!hasExactMatch) reasons.push(`duplicate/extra picks`);
                if (!isRecentSubmission) reasons.push(`old submission (${sub.submitted_at})`);
                console.log('[Home] ❌ API Test League: User', sub.user_id, 'is NOT validly submitted for chips. Reasons:', reasons.join(', '));
              }
            });
          }
        }
      }
      
      // Regular submissions for regular leagues ONLY
      const submittedUserIdsBatch = new Set((allSubmissionsData ?? []).map((s: any) => s.user_id));

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
              latestGwWinners: [],
              latestRelevantGw: null
            };
            continue;
          }

          // Check if this is API Test league
          const isApiTestLeague = league.name === "API Test";
          
          // For API Test league, use test API data and live scores
          if (isApiTestLeague) {
            // Check if we have results for current test fixtures (from live_scores)
            // Only show shiny chips if results exist for current fixtures
            const hasResultsForCurrentFixtures = testApiResultsByFixtureIdx.size > 0 && testApiFixtures.length > 0;
            
            // Use picks from test_api_picks
            const picksAll = picksByLeague.get(league.id) ?? [];
            const memberIds = members.map(m => m.id);
            
            if (!hasResultsForCurrentFixtures || picksAll.length === 0) {
              // No results for current fixtures or no picks - show alphabetical, no winners
              // BUT still include submittedMembers so chips can show green for submitted users
              const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
              const memberIds = members.map(m => m.id);
              
              // Use batched submissions data (filtered for this league's members)
              // CRITICAL: For API Test league, ONLY use test_api_submissions (NOT regular submissions)
              const submittedMembers = new Set<string>();
              memberIds.forEach(id => {
                // Only check test_api_submissions for API Test league
                if (testApiSubmittedUserIds.has(id)) {
                  submittedMembers.add(id);
                }
              });
              
              leagueDataMap[league.id] = {
                id: league.id,
                members: members.sort((a, b) => a.name.localeCompare(b.name)),
                userPosition: null,
                positionChange: null,
                sortedMemberIds: alphabeticalIds,
                submittedMembers: Array.from(submittedMembers),
                latestGwWinners: [],
                latestRelevantGw: null // null means no results for current fixtures - don't show shiny chips
              };
              continue;
            }
            
            // Calculate ML table from test API data
            // Use test_api_results (from live_scores) instead of gw_results
            const perGw = new Map<number, Map<string, { user_id: string; score: number; unicorns: number }>>();
            const gwWinners = new Map<number, Set<string>>();
            
            // For API Test, we only have GW 1 (matchday=1 maps to gw=1)
            const g = 1;
            const map = new Map<string, { user_id: string; score: number; unicorns: number }>();
            members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
            perGw.set(g, map);
            
            // Calculate scores from test API picks and results
            testApiResultsByFixtureIdx.forEach((out, fixtureIdx) => {
              const thesePicks = picksAll.filter((p) => p.gw === g && p.fixture_index === fixtureIdx);
              const correctUsers = thesePicks.filter((p) => p.pick === out).map((p) => p.user_id);
              
              const scoreMap = perGw.get(g)!;
              thesePicks.forEach((p) => {
                if (p.pick === out) {
                  const row = scoreMap.get(p.user_id)!;
                  row.score += 1;
                }
              });
              
              if (correctUsers.length === 1 && members.length >= 3) {
                const uid = correctUsers[0];
                const row = scoreMap.get(uid)!;
                row.unicorns += 1;
              }
            });
            
            // Calculate winners for test API GW 1
            const gwRows = Array.from(perGw.get(g)!.values());
            gwRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
            if (gwRows.length > 0) {
              const top = gwRows[0];
              const coTop = gwRows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
              const winners = new Set(coTop.map((r) => r.user_id));
              gwWinners.set(g, winners);
            }
            
            // Build ML table from test API data
            const mltPts = new Map<string, number>();
            const ocp = new Map<string, number>();
            const unis = new Map<string, number>();
            members.forEach((m) => {
              mltPts.set(m.id, 0);
              ocp.set(m.id, 0);
              unis.set(m.id, 0);
            });
            
            gwRows.forEach((r) => {
              ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
              unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
            });
            
            if (gwRows.length > 0) {
              const top = gwRows[0];
              const coTop = gwRows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
              if (coTop.length === 1) {
                mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
              } else {
                coTop.forEach((r) => {
                  mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
                });
              }
            }
            
            // Build ML table rows
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
            
            const sortedMemberIds = sortedMltRows.map(r => r.user_id);
            const userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
            const userPosition = userIndex !== -1 ? userIndex + 1 : null;
            
            // For API Test: latestRelevantGw should be 1 if we have results, null otherwise
            // This controls whether shiny chips show (only if latestRelevantGw === gw which is 1 for API Test)
            const latestRelevantGw = hasResultsForCurrentFixtures ? 1 : null;
            const latestGwWinners = hasResultsForCurrentFixtures && gwWinners.has(1) 
              ? Array.from(gwWinners.get(1) ?? new Set<string>())
              : [];
            
            // Use batched submissions data (filtered for this league's members)
            // CRITICAL: For API Test league, ONLY use test_api_submissions (NOT regular submissions)
            const submittedMembers = new Set<string>();
            memberIds.forEach(id => {
              // Only check test_api_submissions for API Test league
              if (testApiSubmittedUserIds.has(id)) {
                submittedMembers.add(id);
              }
            });
            
            leagueDataMap[league.id] = {
              id: league.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition,
              positionChange: null,
              submittedMembers: Array.from(submittedMembers),
              sortedMemberIds: [...sortedMemberIds],
              latestGwWinners,
              latestRelevantGw
            };
            continue;
          }
          
          // Regular leagues: Continue with existing logic
          // Simple: Calculate ML table exactly like League page does, then find user's position
          if (outcomeByGwIdx.size === 0) {
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            leagueDataMap[league.id] = {
              id: league.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: null,
              positionChange: null,
              sortedMemberIds: alphabeticalIds,
              latestGwWinners: [],
              latestRelevantGw: null
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
              latestGwWinners: [],
              latestRelevantGw: null
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
          // CRITICAL: For API Test league, ONLY use test_api_submissions (testApiSubmittedUserIds)
          // For regular leagues, ONLY use gw_submissions (submittedUserIdsBatch)
          // This ensures test API data NEVER affects regular leagues
          const submittedMembers = new Set<string>();
          if (isApiTestLeague) {
            // For API Test league, ONLY check test_api_submissions (NOT regular submissions)
            memberIds.forEach(id => {
              if (testApiSubmittedUserIds.has(id)) {
                submittedMembers.add(id);
              }
            });
          } else {
            // For regular leagues, ONLY check gw_submissions (NOT test API submissions)
            memberIds.forEach(id => {
              if (submittedUserIdsBatch.has(id)) {
                submittedMembers.add(id);
              }
            });
          }
          
          
          // Store data - CRITICAL: sortedMemberIds must be stored correctly
          // Convert Sets to Arrays for React state (Sets don't serialize well)
          const storedData: LeagueData = {
            id: league.id,
            members: members.sort((a, b) => a.name.localeCompare(b.name)), // Keep alphabetical for other uses
            userPosition,
            positionChange: null,
            submittedMembers: Array.from(submittedMembers), // Convert Set to Array for storage
            sortedMemberIds: [...sortedMemberIds], // Store COPY of ML table order from sortedMltRows
            latestGwWinners: Array.from(latestGwWinners), // Convert Set to Array for storage
            latestRelevantGw: latestRelevantGw // Store the GW number that winners are from
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
            latestGwWinners: [],
            latestRelevantGw: null
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
  }, [leagues, user?.id]);

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
    if (!user?.id) {
      setLeaderboardDataLoading(false);
      return;
    }
    
    setLeaderboardDataLoading(true);
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
        if (!latestGw) {
          // No results yet - still mark as loaded
          if (alive) {
            setLeaderboardDataLoading(false);
          }
          return;
        }

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
        console.log('[Home] Leaderboard calculation:', { latestGw, lastGwPointsCount: lastGwPoints.length, userId: user.id, gwPointsCount: gwPoints.length });
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
          console.log('[Home] Last GW userEntry:', { found: !!userEntry, totalRanked: ranked.length, userEntry });
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
      } finally {
        if (alive) {
          setLeaderboardDataLoading(false);
        }
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

  // Memoize sorted leagues to avoid re-sorting on every render
  const sortedLeagues = useMemo(() => {
    return [...leagues].sort((a, b) => {
      const unreadA = unreadByLeague?.[a.id] ?? 0;
      const unreadB = unreadByLeague?.[b.id] ?? 0;
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadA === 0 && unreadB > 0) return 1;
      // If same unread status, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [leagues, unreadByLeague]);

  // Memoize live games check
  const hasLiveGames = useMemo(() => {
    const fixturesToCheckForLive = fixtures;
    return fixturesToCheckForLive.some(f => {
      const liveScore = liveScores[f.fixture_index];
      return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
    });
  }, [isInApiTestLeague, fixtures, liveScores]);

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
        {headerRight && <div>{headerRight}</div>}
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


  // Simple skeleton loader
  const SkeletonLoader = () => (
    <>
      {/* LEADERBOARDS v0.1 Skeleton */}
      <Section title="LEADERBOARDS v0.1" boxed={false}>
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y pinch-zoom' }}>
          <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
          <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden animate-pulse">
                <div className="p-3 h-full flex flex-col relative">
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-10 w-16 bg-slate-200 rounded" />
                    <div className="h-4 w-4 bg-slate-200 rounded" />
                  </div>
                  <div className="mt-auto">
                    <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Mini Leagues Skeleton */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2 pt-5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-slate-500 uppercase tracking-wide">Mini Leagues</h2>
            <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center">
              <span className="text-[10px] text-slate-500 font-bold">i</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
          <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="rounded-xl border bg-white overflow-hidden shadow-sm w-[320px] animate-pulse" style={{ borderRadius: '12px' }}>
                    <div className="p-4 bg-white relative">
                      <div className="flex items-start gap-3 relative">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-200" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
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
      </section>
    </>
  );

  // Show skeleton until ALL data is ready
  const isDataReady = !loading && !leagueDataLoading && !leaderboardDataLoading && leagues.length > 0;

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
      {/* <WhatsAppBanner /> */}
      {error && retryCount >= 3 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-semibold text-red-900 mb-1">Failed to load data</div>
              <div className="text-sm text-red-700 mb-3">{error}</div>
              <button
                onClick={() => {
                  setError(null);
                  setRetryCount(0);
                  fetchHomeData(true);
                }}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
      
      {!isDataReady ? (
        <SkeletonLoader />
      ) : (
        <>
          {/* LEADERBOARDS v0.1 */}
          <Section title="LEADERBOARDS v0.1" boxed={false}>
            <div 
              key={`leaderboard-scroll-${navigationKeyRef.current}`}
              className="overflow-x-auto -mx-4 px-4 scrollbar-hide" 
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none', 
                WebkitOverflowScrolling: 'touch', 
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x pan-y pinch-zoom'
              }}
            >
              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
                {/* Box 1: Last GW Leaderboard */}
                <LeaderboardCard
                  title="Last GW"
                  linkTo="/global?tab=lastgw"
                  rank={lastGwRank?.rank ?? null}
                  total={lastGwRank?.total ?? null}
                  score={lastGwRank?.score}
                  gw={lastGwRank?.gw}
                  totalFixtures={lastGwRank?.totalFixtures}
                  variant="lastGw"
                />

                {/* Box 2: 5-WEEK FORM */}
                <LeaderboardCard
                  title="5-WEEK FORM"
                  badgeSrc="/assets/5-week-form-badge.png"
                  badgeAlt="5-Week Form Badge"
                  linkTo="/global?tab=form5"
                  rank={fiveGwRank?.rank ?? null}
                  total={fiveGwRank?.total ?? null}
                />

                {/* Box 3: 10-WEEK FORM */}
                <LeaderboardCard
                  title="10-WEEK FORM"
                  badgeSrc="/assets/10-week-form-badge.png"
                  badgeAlt="10-Week Form Badge"
                  linkTo="/global?tab=form10"
                  rank={tenGwRank?.rank ?? null}
                  total={tenGwRank?.total ?? null}
                />

                {/* Box 4: SEASON RANK */}
                <LeaderboardCard
                  title="SEASON RANK"
                  badgeSrc="/assets/season-rank-badge.png"
                  badgeAlt="Season Rank Badge"
                  linkTo="/global?tab=overall"
                  rank={seasonRank?.rank ?? null}
                  total={seasonRank?.total ?? null}
                />

                {/* Streak Box */}
                {userStreakData && (
                  <StreakCard
                    streak={userStreakData.streak}
                    last10GwScores={userStreakData.last10GwScores}
                    latestGw={latestGw ?? 1}
                  />
                )}
              </div>
        </div>
      </Section>

      {/* Mini Leagues section */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2 pt-5">
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
          {!loading && leagues.length === 0 ? (
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
                                      src={getLeagueAvatarUrl(l)} 
                                      alt={`${l.name} avatar`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      decoding="async"
                                      onError={(e) => {
                                        // Fallback to default ML avatar if custom avatar fails
                                        const target = e.target as HTMLImageElement;
                                        const defaultAvatar = getDefaultMlAvatar(l.id);
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
                                    {/* League Name */}
                                    <div className="text-base font-semibold text-slate-900 truncate -mt-0.5">
                                      {l.name}
                                    </div>
                                    
                                    {/* Player Chips - ordered by ML table position (1st to last) */}
                                    <div className="flex items-center py-0.5">
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
                                            
                                            const isApiTestLeague = l.name === "API Test";
                                            
                                            return alphabeticalMembers.slice(0, 8).map((member, index) => {
                                              const hasSubmitted = submittedSet.has(member.id);
                                              const isLatestWinner = winnersSet.has(member.id);
                                              
                                              // GPU-optimized: Use CSS classes instead of inline styles
                                              let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
                                              
                                              // Only show shiny chip if latestRelevantGw matches current GW (same GW)
                                              // If current GW > latestRelevantGw, a new GW has been published - hide shiny chips
                                              const shouldShowShiny = isLatestWinner && data.latestRelevantGw !== null && data.latestRelevantGw === gw;
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
                                          
                                          // Check if this is API Test league
                                          const isApiTestLeague = l.name === "API Test";
                                          
                                          // CRITICAL: Ensure we're using the exact order from sortedMemberIds
                                          return orderedMembers.slice(0, 8).map((member, index) => {
                                            const hasSubmitted = submittedSet.has(member.id);
                                            const isLatestWinner = winnersSet.has(member.id);
                                            
                                            // GPU-optimized: Use CSS classes instead of inline styles
                                            let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
                                            
                                            // Only show shiny chip if latestRelevantGw matches currentGw (same GW)
                                            // If currentGw > latestRelevantGw, a new GW has been published - hide shiny chips
                                            const shouldShowShiny = isLatestWinner && data.latestRelevantGw !== null && data.latestRelevantGw === gw;
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
          {hasLiveGames && (
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
          )}
          <div className="flex items-center gap-2">
            {(() => {
              // Calculate live score for test API users (includes both live and finished games)
              let liveScoreCount = 0;
              let liveFixturesCount = 0;
              let finishedScoreCount = 0;
              let finishedFixturesCount = 0;
              let fixturesToCheck: typeof fixtures = [];
              if (isInApiTestLeague && fixtures.length > 0) {
                fixturesToCheck = fixtures; // Use all fixtures in the active gameweek
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
                    <div className="flex flex-col items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white bg-slate-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium opacity-90">Score</span>
                        <span className="flex items-baseline gap-0.5">
                          <span className="text-lg sm:text-xl font-extrabold">{finishedScoreCount}</span>
                          <span className="text-sm sm:text-base font-medium opacity-90">/</span>
                          <span className="text-base sm:text-lg font-semibold opacity-80">{fixtures.length}</span>
                        </span>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="flex flex-col items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white ${allFinished ? 'bg-slate-600' : 'bg-red-600'}`}>
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
                        <span className="text-base sm:text-lg font-semibold opacity-80">{fixtures.length}</span>
                      </span>
                    </div>
                  </div>
                );
              }
              
              // For API Test league: Only show score when games have started/finished
              // CRITICAL: Don't show score if games haven't started yet (hasAnyLiveOrFinished = false)
              if (isInApiTestLeague && fixtures.length > 0 && gwSubmitted) {
                // Calculate current score from live scores for ALL fixtures
                const totalFixtures = fixtures.length;
                
                // Calculate score from live scores for all fixtures
                let calculatedScore = 0;
                let hasAnyLiveOrFinished = false;
                let allFinished = true;
                let completedGamesCount = 0;
                
                fixtures.forEach(f => {
                  const liveScore = liveScores[f.fixture_index];
                  const pick = picksMap[f.fixture_index];
                  if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
                    hasAnyLiveOrFinished = true;
                    if (liveScore.status === 'FINISHED') {
                      completedGamesCount++;
                    } else {
                      allFinished = false;
                    }
                    if (pick) {
                      let isCorrect = false;
                      if (pick === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrect = true;
                      else if (pick === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrect = true;
                      else if (pick === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrect = true;
                      if (isCorrect) calculatedScore++;
                    }
                  } else {
                    allFinished = false;
                  }
                });
                
                // CRITICAL: Only show score if games have started (hasAnyLiveOrFinished = true)
                // If no games have started but user has submitted, show "Score -- / 10" with "Game Week starting soon"
                if (hasAnyLiveOrFinished) {
                  // Show live score with live indicator
                  return (
                    <div className="flex flex-col items-center gap-2">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white ${allFinished ? 'bg-slate-600' : 'bg-red-600'}`}>
                        {!allFinished && (
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        )}
                        <span className="text-xs sm:text-sm font-medium opacity-90">{allFinished ? 'Score' : 'Live'}</span>
                        <span className="flex items-baseline gap-0.5">
                          <span className="text-lg sm:text-xl font-extrabold">{calculatedScore}</span>
                          <span className="text-sm sm:text-base font-medium opacity-90">/</span>
                          <span className="text-base sm:text-lg font-semibold opacity-80">{totalFixtures}</span>
                        </span>
                      </div>
                    </div>
                  );
                } else {
                  // No games started yet, but user has submitted - show "Score -- / 10"
                  // Style it similar to live score indicator but with a different color (amber) to indicate "coming soon"
                  // No pulsing dot - that's reserved for LIVE games only
                  return (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/30">
                      <span className="text-xs sm:text-sm font-medium opacity-90">Score</span>
                      <span className="flex items-baseline gap-0.5">
                        <span className="text-lg sm:text-xl font-extrabold">--</span>
                        <span className="text-sm sm:text-base font-medium opacity-90">/</span>
                        <span className="text-base sm:text-lg font-semibold opacity-80">{totalFixtures}</span>
                      </span>
                    </div>
                  );
                }
              }
              
              // Show final score if available (for regular users)
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
              
              // Show make predictions button - for API Test league, show "Make your TEST predictions" button
              if (fixtures.length > 0 && !gwSubmitted && gwScore === null) {
                if (isInApiTestLeague) {
                  return (
                    <Link to="/test-api-predictions" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all no-underline">
                      <span className="text-xs sm:text-sm font-semibold">Make your TEST predictions</span>
                    </Link>
                  );
                } else {
                  return (
                    <Link to="/new-predictions" className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors no-underline">Make your predictions</Link>
                  );
                }
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
                        // Always use medium names from teamNames.ts for consistency
                        const homeKey = f.home_team || f.home_name || f.home_code || "";
                        const awayKey = f.away_team || f.away_name || f.away_code || "";
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
                const getButtonClass = (state: { isPicked: boolean; isCorrectResult: boolean; isCorrect: boolean; isWrong: boolean }, _side?: "H" | "D" | "A") => {
                  const base = "h-16 rounded-xl border text-sm font-medium transition-all flex items-center justify-center select-none";
                  // PRIORITY: Check live/ongoing FIRST - never show shiny during live games
                  if (isLive || isOngoing) {
                    // Game is live or ongoing
                    if (state.isCorrect) {
                      // Live and correct - pulse in emerald green
                      return `${base} bg-emerald-600 text-white border-emerald-600 animate-pulse shadow-lg shadow-emerald-500/50`;
                    } else if (state.isWrong) {
                      // Wrong pick in live game - keep green tab but show strikethrough
                      return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
                    } else if (state.isPicked) {
                      // While game is live and picked but not correct yet - show green tab
                      return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
                    } else if (state.isCorrectResult && !state.isPicked) {
                      // Correct outcome (but user didn't pick it) - gently pulse to show it's currently correct
                      return `${base} bg-slate-50 text-slate-600 border-2 border-slate-300 animate-pulse`;
                    } else {
                      return `${base} bg-slate-50 text-slate-600 border-slate-200`;
                    }
                  } else if (isFinished) {
                    // Game is finished (not live)
                    if (state.isCorrect) {
                      // Shiny gradient for correct finished picks (no green border)
                      return `${base} bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-2xl shadow-yellow-400/40 transform scale-110 rotate-1 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]`;
                    } else if (state.isWrong) {
                      // Wrong pick in finished game - keep green tab with strikethrough
                      return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
                    } else if (state.isCorrectResult && !state.isPicked) {
                      // Correct outcome (but user didn't pick it) - grey with thick green border
                      return `${base} bg-slate-50 text-slate-600 border-4 border-emerald-600`;
                    } else if (state.isPicked) {
                      // Picked but result doesn't match (shouldn't happen if logic is correct)
                      return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
                    } else {
                      return `${base} bg-slate-50 text-slate-600 border-slate-200`;
                    }
                  } else {
                    // Game hasn't started yet
                    if (state.isPicked) {
                      // Picked but game hasn't started yet - show green tab
                      return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
                    } else {
                      return `${base} bg-slate-50 text-slate-600 border-slate-200`;
                    }
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
                      
                      {/* header: Home  score/kickoff  Away */}
                      <div className={`flex flex-col px-2 pb-3 ${isOngoing ? 'pt-4' : 'pt-1'}`}>
                        <div className="flex items-start justify-between">
                          {/* Home Team */}
                          <div className="flex-1 flex flex-col items-end">
                            <div className="flex items-center gap-1">
                            <div className={`break-words ${liveScore && (isOngoing || isFinished) && liveScore.homeScore > liveScore.awayScore ? 'font-bold' : 'font-medium'}`}>{homeName}</div>
                            <img 
                              src={f.home_crest || getTeamBadgePath(f.home_code || f.home_team || f.home_name || homeKey || '')} 
                              alt={homeName}
                              className="w-5 h-5"
                              onError={(e) => {
                                // If crest URL fails, fall back to local badge
                                const target = e.currentTarget as HTMLImageElement;
                                const fallbackSrc = getTeamBadgePath(f.home_code || f.home_team || f.home_name || homeKey || '');
                                if (target.src !== fallbackSrc) {
                                  target.src = fallbackSrc;
                                } else {
                                  target.style.opacity = "0.35";
                                }
                              }}
                            />
                          </div>
                            {/* Home Team Goals and Red Cards (chronologically sorted) */}
                            {liveScore && (isOngoing || isFinished) && (() => {
                              // Filter goals for home team
                              // Match by team name - use liveScore.home_team as the source of truth (already normalized)
                              const allGoals = liveScore.goals || [];
                              const homeGoals = allGoals.filter((goal: any) => {
                                if (!goal || !goal.team) return false;
                                const goalTeam = goal.team || '';
                                
                                // Primary match: compare normalized team names
                                // The goal.team is already normalized by pollLiveScores function
                                const normalizedGoalTeam = getMediumName(goalTeam);
                                const normalizedHomeTeam = liveScore.home_team ? getMediumName(liveScore.home_team) : homeName;
                                
                                // Try multiple matching strategies using shared utility
                                const matches = normalizedGoalTeam === normalizedHomeTeam ||
                                       normalizedGoalTeam === homeName ||
                                       normalizedGoalTeam === getMediumName(f.home_team || '') ||
                                       normalizedGoalTeam === getMediumName(f.home_name || '') ||
                                       goalTeam.toLowerCase() === (liveScore.home_team || '').toLowerCase() ||
                                       goalTeam.toLowerCase() === homeName.toLowerCase() ||
                                       goalTeam.toLowerCase() === (f.home_team || '').toLowerCase() ||
                                       goalTeam.toLowerCase() === (f.home_name || '').toLowerCase() ||
                                       areTeamNamesSimilar(goalTeam, homeName) ||
                                       areTeamNamesSimilar(goalTeam, normalizedHomeTeam) ||
                                       areTeamNamesSimilar(goalTeam, f.home_team || '') ||
                                       areTeamNamesSimilar(goalTeam, f.home_name || '') ||
                                       areTeamNamesSimilar(goalTeam, liveScore.home_team || '');
                                
                                // Debug logging for unmatched goals
                                if (!matches && allGoals.length > 0) {
                                  console.log('[Home] Goal team mismatch:', {
                                    goalTeam,
                                    normalizedGoalTeam,
                                    homeName,
                                    normalizedHomeTeam,
                                    liveScoreHomeTeam: liveScore.home_team,
                                    fixtureHomeTeam: f.home_team,
                                    fixtureHomeName: f.home_name
                                  });
                                }
                                
                                return matches;
                              });
                              
                              // Filter red cards for home team
                              const homeRedCards = (liveScore.red_cards || []).filter((card: any) => {
                                if (!card || !card.team) return false;
                                const cardTeam = card.team || '';
                                
                                // Use same robust matching logic as goals
                                const normalizedCardTeam = getMediumName(cardTeam);
                                const normalizedHomeTeam = liveScore.home_team ? getMediumName(liveScore.home_team) : homeName;
                                
                                return normalizedCardTeam === normalizedHomeTeam ||
                                       normalizedCardTeam === homeName ||
                                       normalizedCardTeam === getMediumName(f.home_team || '') ||
                                       normalizedCardTeam === getMediumName(f.home_name || '') ||
                                       cardTeam.toLowerCase() === (liveScore.home_team || '').toLowerCase() ||
                                       cardTeam.toLowerCase() === homeName.toLowerCase() ||
                                       cardTeam.toLowerCase() === (f.home_team || '').toLowerCase() ||
                                       cardTeam.toLowerCase() === (f.home_name || '').toLowerCase();
                              });
                              
                              // Create combined timeline of goals and red cards
                              type TimelineEvent = { type: 'goal' | 'red_card'; minute: number | null; scorer?: string; player?: string; minutes?: number[] };
                              const timeline: TimelineEvent[] = [];
                              
                              // Add goals (grouped by scorer)
                              const goalsByScorer = new Map<string, number[]>();
                              homeGoals.forEach((goal: any) => {
                                const scorer = goal.scorer || 'Unknown';
                                const minute = goal.minute;
                                if (!goalsByScorer.has(scorer)) {
                                  goalsByScorer.set(scorer, []);
                                }
                                if (minute !== null && minute !== undefined) {
                                  goalsByScorer.get(scorer)!.push(minute);
                                }
                              });
                              
                              // Add each goal group as a timeline event (use first minute for sorting)
                              goalsByScorer.forEach((minutes, scorer) => {
                                const sortedMinutes = minutes.sort((a, b) => a - b);
                                timeline.push({
                                  type: 'goal',
                                  minute: sortedMinutes[0],
                                  scorer,
                                  minutes: sortedMinutes,
                                });
                              });
                              
                              // Add red cards
                              homeRedCards.forEach((card: any) => {
                                timeline.push({
                                  type: 'red_card',
                                  minute: card.minute,
                                  player: card.player || 'Unknown',
                                });
                              });
                              
                              // Sort by minute (null minutes go to end)
                              timeline.sort((a, b) => {
                                if (a.minute === null) return 1;
                                if (b.minute === null) return -1;
                                return a.minute - b.minute;
                              });
                              
                              if (timeline.length === 0) return null;
                              
                              return (
                                <div className="mt-3 mb-2 flex flex-col items-end gap-0.5">
                                  {timeline.map((event, idx) => {
                                    if (event.type === 'goal') {
                                      return (
                                        <span key={idx} className="text-[11px] text-slate-600">
                                          {event.scorer} {event.minutes!.sort((a, b) => a - b).map(m => `${m}'`).join(', ')}
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span key={idx} className="text-[11px] text-slate-600">
                                          🟥 {event.player} {event.minute}'
                                        </span>
                                      );
                                    }
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                          
                          {/* Score / Kickoff Time */}
                          <div className="px-4 flex flex-col items-center">
                            {liveScore && (isOngoing || isFinished) ? (
                              <>
                              <span className="font-bold text-base text-slate-900">
                                {liveScore.homeScore} - {liveScore.awayScore}
                              </span>
                                <span className={`text-[10px] font-semibold mt-0.5 ${isOngoing ? 'text-red-600' : 'text-slate-500'}`}>
                                  {formatMinuteDisplay(liveScore.status, liveScore.minute, isInApiTestLeague)}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-500 text-sm">{kickoff}</span>
                            )}
                          </div>
                          
                          {/* Away Team */}
                          <div className="flex-1 flex flex-col items-start">
                            <div className="flex items-center gap-1">
                            <img 
                              src={f.away_crest || getTeamBadgePath(f.away_code || f.away_team || f.away_name || awayKey || '')} 
                              alt={awayName}
                              className="w-5 h-5"
                              onError={(e) => {
                                // If crest URL fails, fall back to local badge
                                const target = e.currentTarget as HTMLImageElement;
                                const fallbackSrc = getTeamBadgePath(f.away_code || f.away_team || f.away_name || awayKey || '');
                                if (target.src !== fallbackSrc) {
                                  target.src = fallbackSrc;
                                } else {
                                  target.style.opacity = "0.35";
                                }
                              }}
                            />
                            <div className={`break-words ${liveScore && (isOngoing || isFinished) && liveScore.awayScore > liveScore.homeScore ? 'font-bold' : 'font-medium'}`}>{awayName}</div>
                          </div>
                            {/* Away Team Goals and Red Cards (chronologically sorted) */}
                            {liveScore && (isOngoing || isFinished) && (() => {
                              // Filter goals for away team
                              // Match by team name - use liveScore.away_team as the source of truth (already normalized)
                              const awayGoals = (liveScore.goals || []).filter((goal: any) => {
                                if (!goal || !goal.team) return false;
                                const goalTeam = goal.team || '';
                                
                                // Primary match: compare normalized team names
                                // The goal.team is already normalized by pollLiveScores function
                                const normalizedGoalTeam = getMediumName(goalTeam);
                                const normalizedAwayTeam = liveScore.away_team ? getMediumName(liveScore.away_team) : awayName;
                                
                                // Try multiple matching strategies using shared utility
                                return normalizedGoalTeam === normalizedAwayTeam ||
                                       normalizedGoalTeam === awayName ||
                                       normalizedGoalTeam === getMediumName(f.away_team || '') ||
                                       normalizedGoalTeam === getMediumName(f.away_name || '') ||
                                       goalTeam.toLowerCase() === (liveScore.away_team || '').toLowerCase() ||
                                       goalTeam.toLowerCase() === awayName.toLowerCase() ||
                                       goalTeam.toLowerCase() === (f.away_team || '').toLowerCase() ||
                                       goalTeam.toLowerCase() === (f.away_name || '').toLowerCase() ||
                                       areTeamNamesSimilar(goalTeam, awayName) ||
                                       areTeamNamesSimilar(goalTeam, normalizedAwayTeam) ||
                                       areTeamNamesSimilar(goalTeam, f.away_team || '') ||
                                       areTeamNamesSimilar(goalTeam, f.away_name || '') ||
                                       areTeamNamesSimilar(goalTeam, liveScore.away_team || '');
                              });
                              
                              // Filter red cards for away team
                              const awayRedCards = (liveScore.red_cards || []).filter((card: any) => {
                                if (!card || !card.team) return false;
                                const cardTeam = card.team || '';
                                
                                // Use same robust matching logic as goals
                                const normalizedCardTeam = getMediumName(cardTeam);
                                const normalizedAwayTeam = liveScore.away_team ? getMediumName(liveScore.away_team) : awayName;
                                
                                return normalizedCardTeam === normalizedAwayTeam ||
                                       normalizedCardTeam === awayName ||
                                       normalizedCardTeam === getMediumName(f.away_team || '') ||
                                       normalizedCardTeam === getMediumName(f.away_name || '') ||
                                       cardTeam.toLowerCase() === (liveScore.away_team || '').toLowerCase() ||
                                       cardTeam.toLowerCase() === awayName.toLowerCase() ||
                                       cardTeam.toLowerCase() === (f.away_team || '').toLowerCase() ||
                                       cardTeam.toLowerCase() === (f.away_name || '').toLowerCase();
                              });
                              
                              // Create combined timeline of goals and red cards
                              type TimelineEvent = { type: 'goal' | 'red_card'; minute: number | null; scorer?: string; player?: string; minutes?: number[] };
                              const timeline: TimelineEvent[] = [];
                              
                              // Add goals (grouped by scorer)
                              const goalsByScorer = new Map<string, number[]>();
                              awayGoals.forEach((goal: any) => {
                                const scorer = goal.scorer || 'Unknown';
                                const minute = goal.minute;
                                if (!goalsByScorer.has(scorer)) {
                                  goalsByScorer.set(scorer, []);
                                }
                                if (minute !== null && minute !== undefined) {
                                  goalsByScorer.get(scorer)!.push(minute);
                                }
                              });
                              
                              // Add each goal group as a timeline event (use first minute for sorting)
                              goalsByScorer.forEach((minutes, scorer) => {
                                const sortedMinutes = minutes.sort((a, b) => a - b);
                                timeline.push({
                                  type: 'goal',
                                  minute: sortedMinutes[0],
                                  scorer,
                                  minutes: sortedMinutes,
                                });
                              });
                              
                              // Add red cards
                              awayRedCards.forEach((card: any) => {
                                timeline.push({
                                  type: 'red_card',
                                  minute: card.minute,
                                  player: card.player || 'Unknown',
                                });
                              });
                              
                              // Sort by minute (null minutes go to end)
                              timeline.sort((a, b) => {
                                if (a.minute === null) return 1;
                                if (b.minute === null) return -1;
                                return a.minute - b.minute;
                              });
                              
                              if (timeline.length === 0) return null;
                              
                              return (
                                <div className="mt-3 mb-2 flex flex-col items-start gap-0.5">
                                  {timeline.map((event, idx) => {
                                    if (event.type === 'goal') {
                                      return (
                                        <span key={idx} className="text-[11px] text-slate-600">
                                          {event.scorer} {event.minutes!.sort((a, b) => a - b).map(m => `${m}'`).join(', ')}
                            </span>
                                      );
                                    } else {
                                      return (
                                        <span key={idx} className="text-[11px] text-slate-600">
                                          🟥 {event.player} {event.minute}'
                                        </span>
                                      );
                                    }
                                  })}
                          </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* buttons: Home Win, Draw, Away Win - only show if user has made predictions (for Test API) or always show (for regular leagues) */}
                      {/* For Test API league: only show buttons if user has submitted (has picks in picksMap) */}
                      {/* For regular leagues: always show buttons */}
                      {(!isInApiTestLeague || pick !== undefined) && (
                        <div className="grid grid-cols-3 gap-3 relative">
                          <div className={`${getButtonClass(homeState, "H")} flex items-center justify-center`}>
                            <span className={`${homeState.isCorrect ? "font-bold" : ""} ${homeState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>Home Win</span>
                          </div>
                          <div className={`${getButtonClass(drawState, "D")} flex items-center justify-center`}>
                            <span className={`${drawState.isCorrect ? "font-bold" : ""} ${drawState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>Draw</span>
                          </div>
                          <div className={`${getButtonClass(awayState, "A")} flex items-center justify-center`}>
                            <span className={`${awayState.isCorrect ? "font-bold" : ""} ${awayState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>Away Win</span>
                          </div>
                        </div>
                      )}
                                
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
        {/* Bottom padding to prevent games from being hidden under bottom nav */}
        <div className="h-20"></div>
      </section>
        </>
      )}
    </div>
  );
}
