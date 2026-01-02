import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import ScrollLogo from "../components/ScrollLogo";
import { LeaderboardsSection } from "../components/LeaderboardsSection";
import { MiniLeaguesSection } from "../components/MiniLeaguesSection";
import { GamesSection } from "../components/GamesSection";
import { resolveLeagueStartGw } from "../lib/leagueStart";
import type { Fixture as FixtureCardFixture, LiveScore as FixtureCardLiveScore } from "../components/FixtureCard";
import { useLiveScores } from "../hooks/useLiveScores";
import { getCached, setCached, removeCached, CACHE_TTL } from "../lib/cache";
import { useLeagues } from "../hooks/useLeagues";
import { calculateFormRank, calculateLastGwRank, calculateSeasonRank } from "../lib/helpers";
import { fireConfettiCannon } from "../lib/confettiCannon";
import { APP_ONLY_USER_IDS } from "../lib/appOnlyUsers";
import { useGameweekState } from "../hooks/useGameweekState";
import GameweekResultsModal, { type GwResults } from "../components/GameweekResultsModal";
import { fetchGwResults } from "../lib/fetchGwResults";

// Types (League type is now from useLeagues hook)
type LeagueMember = { id: string; name: string };
type LeagueDataInternal = {
  id: string;
  members: LeagueMember[];
  userPosition: number | null;
  positionChange: 'up' | 'down' | 'same' | null;
  submittedMembers?: string[] | Set<string>;
  sortedMemberIds?: string[];
  latestGwWinners?: string[] | Set<string>;
  latestRelevantGw?: number | null;
  webUserIds?: string[] | Set<string>; // User IDs who have picks in Web table (mirrored)
};

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };
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
  test_gw?: number | null;
};

function rowToOutcome(r: { result?: "H" | "D" | "A" | null }): "H" | "D" | "A" | null {
  return r.result === "H" || r.result === "D" || r.result === "A" ? r.result : null;
}

export default function HomePage() {
  const { user } = useAuth();
  
  // Initialize ALL state from cache synchronously to avoid any render gaps
  // We check localStorage directly to avoid waiting for user to be available
  const loadInitialStateFromCache = () => {
    // Try to get user ID from localStorage if user not available yet
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
    
    // NOTE: Leagues are handled by useLeagues hook, not this cache function
    if (typeof window === 'undefined' || !userId) {
      return {
        gw: 1,
        latestGw: null,
        gwPoints: [],
        allGwPoints: [],
        overall: [],
        lastGwRank: null,
        fixtures: [],
        userPicks: {},
        fixturesLoading: true,
        loading: true,
        leagueDataLoading: true,
        leaderboardDataLoading: true,
      };
    }
    
    try {
      // NOTE: Leagues are now handled by useLeagues hook - not cached here
      const cacheKey = `home:basic:${userId}`;
      const cached = getCached<{
        currentGw: number;
        latestGw: number;
        allGwPoints: Array<{user_id: string, gw: number, points: number}>;
        overall: Array<{user_id: string, name: string | null, ocp: number | null}>;
        lastGwRank: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null;
        fiveGwRank?: { rank: number; total: number; isTied: boolean } | null;
        tenGwRank?: { rank: number; total: number; isTied: boolean } | null;
        seasonRank?: { rank: number; total: number; isTied: boolean } | null;
        testGw?: number;
      }>(cacheKey);
      
      if (cached && cached.currentGw) {
        // Load fixtures from cache if available
        let fixtures: Fixture[] = [];
        let userPicks: Record<number, "H" | "D" | "A"> = {};
        let fixturesLoading = true;
        
        const fixturesCacheKey = `home:fixtures:${userId}:${cached.currentGw}`;
        try {
          const fixturesCached = getCached<{
            fixtures: Fixture[];
            userPicks: Record<number, "H" | "D" | "A">;
            liveScores?: Array<{ api_match_id: number; [key: string]: any }>;
          }>(fixturesCacheKey);
          
          if (fixturesCached && fixturesCached.fixtures && Array.isArray(fixturesCached.fixtures) && fixturesCached.fixtures.length > 0) {
            fixtures = fixturesCached.fixtures;
            userPicks = fixturesCached.userPicks || {};
            fixturesLoading = false;
            fixturesLoadedFromCacheRef.current = true;
            hasCheckedCacheRef.current = true;
          } else {
            hasCheckedCacheRef.current = true;
          }
        } catch (error) {
          // Error loading fixtures from cache (non-critical)
        }
        
        return {
          gw: cached.currentGw,
          latestGw: cached.latestGw,
          gwPoints: (cached.allGwPoints || []).filter(gp => gp.user_id === userId),
          allGwPoints: cached.allGwPoints || [],
          overall: cached.overall || [],
          lastGwRank: cached.lastGwRank || null,
          fiveGwRank: cached.fiveGwRank ?? null,
          tenGwRank: cached.tenGwRank ?? null,
          seasonRank: cached.seasonRank ?? null,
          fixtures,
          userPicks,
          fixturesLoading,
          loading: false,
          leagueDataLoading: false,
          leaderboardDataLoading: false,
        };
      }
    } catch (error) {
      // Error loading initial state from cache (non-critical)
    }
    
    return {
      gw: 1,
      latestGw: null,
      gwPoints: [],
      allGwPoints: [],
      overall: [],
      lastGwRank: null,
      fixtures: [],
      userPicks: {},
      fixturesLoading: true,
      loading: true,
      leagueDataLoading: true,
      leaderboardDataLoading: true,
    };
  };
  
  const initialState = loadInitialStateFromCache();
  
  // LEAGUES: Use centralized useLeagues hook (single source of truth)
  // This hook reads from cache pre-warmed by initialDataLoader and handles refresh
  const { 
    leagues, 
    unreadByLeague,
    refresh: refreshLeagues,
  } = useLeagues({ pageName: 'home' });
  
  // Listen for badge updates and refresh leagues immediately
  useEffect(() => {
    const handleBadgeUpdate = () => {
      refreshLeagues();
    };
    
    window.addEventListener('leagueBadgeUpdated', handleBadgeUpdate);
    return () => {
      window.removeEventListener('leagueBadgeUpdated', handleBadgeUpdate);
    };
  }, [refreshLeagues]);
  
  // Check if user is in API Test league
  const isInApiTestLeague = useMemo(() => {
    return leagues.some(l => l.name === 'API Test');
  }, [leagues]);
  
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>({});
  const [gw, setGw] = useState<number>(initialState.gw);
  const [latestGw, setLatestGw] = useState<number | null>(initialState.latestGw);
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsModalGw, setResultsModalGw] = useState<number | null>(null);
  const [preloadedResultsData, setPreloadedResultsData] = useState<GwResults | null>(null);
  const [preloadedResultsLoading, setPreloadedResultsLoading] = useState(false);
  
  // Use centralized game state system (PR.md rule 10)
  const { state: gameState, loading: gameStateLoading } = useGameweekState(gw);
  
  // Validate cached GW immediately on mount - check if it's stale
  // CRITICAL: Respect user's current_viewing_gw (GAME_STATE.md rule)
  // Users stay on previous GW results until they click the "GW ready" banner
  useEffect(() => {
    if (!user?.id) return;
    
    let alive = true;
    (async () => {
      try {
        // Get cached GW directly from cache (not from state, which might already be updated)
        const cacheKey = `home:basic:${user.id}`;
        const cached = getCached<{ currentGw?: number }>(cacheKey);
        const cachedGw = cached?.currentGw ?? initialState.gw;
        
        // Get app_meta.current_gw (the published GW)
        const { data: meta, error: metaError } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        if (!alive || metaError) return;
        
        const dbCurrentGw = meta?.current_gw ?? 1;
        
        // Get user's current_viewing_gw (which GW they're actually viewing)
        const { data: prefs } = await supabase
          .from("user_notification_preferences")
          .select("current_viewing_gw")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!alive) return;
        
        // Use current_viewing_gw if set, otherwise default to currentGw - 1 (previous GW)
        // This ensures users stay on previous GW results when a new GW is published
        const userViewingGw = prefs?.current_viewing_gw ?? (dbCurrentGw > 1 ? dbCurrentGw - 1 : dbCurrentGw);
        
        // Determine which GW to display
        // If user hasn't transitioned to new GW, show their viewing GW (previous GW)
        // Otherwise show the current GW
        const gwToDisplay = userViewingGw < dbCurrentGw ? userViewingGw : dbCurrentGw;
        
        if (cachedGw !== gwToDisplay) {
          // Clear all caches
          removeCached(cacheKey);
          if (cachedGw) {
            const oldFixturesCacheKey = `home:fixtures:${user.id}:${cachedGw}`;
            removeCached(oldFixturesCacheKey);
          }
          // Update GW to user's viewing GW (not necessarily the published GW)
          setGw(gwToDisplay);
        }
      } catch (error) {
        console.error('[Home] Error validating cached GW:', error);
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, initialState.gw]); // Only run once on mount

  // Check for confetti flag on mount and after navigation
  useEffect(() => {
    const checkConfetti = () => {
      const shouldShow = sessionStorage.getItem('showConfettiOnHome') === 'true';
      if (shouldShow) {
        // Clear the flag
        sessionStorage.removeItem('showConfettiOnHome');
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Trigger confetti after a tiny delay to ensure we're on the page and logo is rendered
        setTimeout(() => {
          // Get logo position
          if (logoContainerRef.current) {
            const logoRect = logoContainerRef.current.getBoundingClientRect();
            const logoCenterX = (logoRect.left + logoRect.width / 2) / window.innerWidth;
            const logoCenterY = (logoRect.top + logoRect.height / 2) / window.innerHeight;
            fireConfettiCannon({ x: logoCenterX, y: logoCenterY });
          } else {
            // Fallback to center if logo not found
            fireConfettiCannon();
          }
        }, 100);
      }
    };
    
    checkConfetti();
    // Also check on location change (in case we navigate via React Router)
    const timeout = setTimeout(checkConfetti, 100);
    return () => clearTimeout(timeout);
  }, []);

  // Pre-load results data when we detect RESULTS_PRE_GW state (during app initialization)
  // This should happen as early as possible, ideally during the Volley loading screen
  useEffect(() => {
    if (!user?.id || !gw) return;
    
    // Wait for game state to be determined
    if (gameStateLoading) return;
    
    // Only pre-load if we're in RESULTS_PRE_GW state (results are out)
    if (gameState !== 'RESULTS_PRE_GW') return;
    
    // Check if we've already shown the modal for this GW
    const localStorageKey = `gwResultsModalShown:${user.id}:${gw}`;
    const hasShownModal = localStorage.getItem(localStorageKey) === 'true';
    
    // Only pre-load if user hasn't seen the modal yet and we haven't already loaded
    if (hasShownModal || preloadedResultsData || preloadedResultsLoading) return;
    
    // Pre-fetch the results data immediately
    setPreloadedResultsLoading(true);
    fetchGwResults(user.id, gw)
      .then((data) => {
        setPreloadedResultsData(data);
        setPreloadedResultsLoading(false);
      })
      .catch((error) => {
        console.error('[Home] Error pre-loading results:', error);
        setPreloadedResultsLoading(false);
      });
  }, [user?.id, gameState, gameStateLoading, gw, preloadedResultsData, preloadedResultsLoading]);

  // Auto-open results modal once pre-loaded data is ready
  useEffect(() => {
    if (!user?.id || !gw) return;
    
    // Wait for game state to be determined
    if (gameStateLoading) return;
    
    // Only auto-open if we're in RESULTS_PRE_GW state (results are out)
    if (gameState !== 'RESULTS_PRE_GW') return;
    
    // Check if we've already shown the modal for this GW
    const localStorageKey = `gwResultsModalShown:${user.id}:${gw}`;
    const hasShownModal = localStorage.getItem(localStorageKey) === 'true';
    
    // Only open if we have pre-loaded data ready (wait for preloading to complete)
    // This ensures the modal opens with data ready, showing confetti immediately
    if (!hasShownModal && !showResultsModal && preloadedResultsData && !preloadedResultsLoading) {
      // Open the modal for this GW - data is already loaded!
      setResultsModalGw(gw);
      setShowResultsModal(true);
    }
  }, [user?.id, gameState, gameStateLoading, gw, showResultsModal, preloadedResultsData, preloadedResultsLoading]);

  // Track gw_results changes to trigger leaderboard recalculation
  const [gwResultsVersion, setGwResultsVersion] = useState(0);
  const [gwPoints, setGwPoints] = useState<Array<{user_id: string, gw: number, points: number}>>(initialState.gwPoints);
  const [loading, setLoading] = useState(initialState.loading);
  const [leagueDataLoading, setLeagueDataLoading] = useState(initialState.leagueDataLoading);
  const [leaderboardDataLoading, setLeaderboardDataLoading] = useState(initialState.leaderboardDataLoading);
  
  // Leaderboard rankings (initialized from cache if available)
  const [lastGwRank, setLastGwRank] = useState<{ rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null>(initialState.lastGwRank);
  const [fiveGwRank, setFiveGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(initialState.fiveGwRank ?? null);
  const [tenGwRank, setTenGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(initialState.tenGwRank ?? null);
  const [seasonRank, setSeasonRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(initialState.seasonRank ?? null);
  
  
  const [leagueData, setLeagueData] = useState<Record<string, LeagueDataInternal>>({});
  const [fixtures, setFixtures] = useState<Fixture[]>(initialState.fixtures);
  const [fixturesLoading, setFixturesLoading] = useState(initialState.fixturesLoading);
  const [userPicks, setUserPicks] = useState<Record<number, "H" | "D" | "A">>(initialState.userPicks);
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const fixturesLoadedFromCacheRef = useRef(initialState.fixtures.length > 0);
  const hasCheckedCacheRef = useRef(initialState.fixtures.length > 0);
  
  // Get api_match_ids from fixtures for real-time subscription
  const apiMatchIds = useMemo(() => {
    if (!fixtures?.length) return [];
    const ids: number[] = [];
    for (const f of fixtures) {
      if (f.api_match_id) ids.push(f.api_match_id);
    }
    return ids;
  }, [fixtures]);

  // Load live scores from cache synchronously to avoid render gap
  const cachedLiveScoresMap = useMemo(() => {
    if (!fixtures?.length || !user?.id) return new Map();
    
    try {
      // Use current GW for cache key (no test GWs)
      if (!gw) return new Map();
      
      const fixturesCacheKey = `home:fixtures:${user.id}:${gw}`;
      const cached = getCached<{
        fixtures: Fixture[];
        userPicks: Record<number, "H" | "D" | "A">;
        liveScores?: Array<{ api_match_id: number; [key: string]: any }>;
      }>(fixturesCacheKey);
      
      if (cached?.liveScores && Array.isArray(cached.liveScores)) {
        const map = new Map();
        cached.liveScores.forEach((score: any) => {
          if (score.api_match_id) {
            map.set(score.api_match_id, score);
          }
        });
        // Loaded live scores from cache
        return map;
      }
    } catch (error) {
      // Error loading live scores from cache (non-critical)
    }
    return new Map();
  }, [fixtures, user?.id]);

  // Subscribe to real-time live scores updates
  // CRITICAL: Pass current GW to ensure we fetch live scores for the current gameweek
  const { liveScores: liveScoresMapFromHook } = useLiveScores(
    gw, // Pass current GW instead of undefined
    apiMatchIds.length > 0 ? apiMatchIds : undefined
  );

  // Merge cached live scores with hook's live scores (hook takes precedence for real-time updates)
  const liveScoresMap = useMemo(() => {
    const merged = new Map(cachedLiveScoresMap);
    // Hook's data overrides cached data (more recent)
    liveScoresMapFromHook.forEach((score, apiMatchId) => {
      merged.set(apiMatchId, score);
    });
    return merged;
  }, [cachedLiveScoresMap, liveScoresMapFromHook]);

  // Cache live scores when they're available (for next visit)
  useEffect(() => {
    if (!user?.id || !fixtures.length || !liveScoresMap.size) return;
    
    // Use current GW for cache key (no test GWs)
    if (!gw) return;
    
    const fixturesCacheKey = `home:fixtures:${user.id}:${gw}`;
    try {
      // Get existing cache
      const existing = getCached<{
        fixtures: Fixture[];
        userPicks: Record<number, "H" | "D" | "A">;
        liveScores?: Array<any>;
      }>(fixturesCacheKey);
      
      if (existing) {
        // Convert Map to array for caching
        const liveScoresArray: Array<any> = [];
        liveScoresMap.forEach((score) => {
          liveScoresArray.push(score);
        });
        
        // Update cache with live scores
        setCached(fixturesCacheKey, {
          ...existing,
          liveScores: liveScoresArray.length > 0 ? liveScoresArray : undefined,
        }, CACHE_TTL.HOME);
      }
    } catch (error) {
      // Error caching live scores (non-critical)
    }
  }, [user?.id, fixtures, liveScoresMap]);

  // Fetch results from app_gw_results for fixtures without api_match_id
  const [gwResults, setGwResults] = useState<Record<number, "H" | "D" | "A">>({});
  
  useEffect(() => {
    if (!gw || !fixtures.length) {
      setGwResults({});
      return;
    }
    
    // Check if any fixtures don't have api_match_id (need to fetch from app_gw_results)
    const hasNonApiFixtures = fixtures.some(f => !f.api_match_id);
    if (!hasNonApiFixtures) {
      setGwResults({});
      return;
    }
    
    let alive = true;
    (async () => {
      try {
        const { data: results, error } = await supabase
          .from("app_gw_results")
          .select("fixture_index, result")
          .eq("gw", gw);
        
        if (!alive) return;
        
        if (!error && results) {
          const resultsMap: Record<number, "H" | "D" | "A"> = {};
          results.forEach((r: { fixture_index: number; result: "H" | "D" | "A" | null }) => {
            if (r.result === "H" || r.result === "D" || r.result === "A") {
              resultsMap[r.fixture_index] = r.result;
            }
          });
          setGwResults(resultsMap);
        }
      } catch (error) {
        // Error fetching results (non-critical)
      }
    })();
    
    return () => { alive = false; };
  }, [gw, fixtures]);

  // Convert Map to Record format - optimized
  // Merge live_scores (for API fixtures) with app_gw_results (for non-API fixtures)
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
      result?: "H" | "D" | "A" | null; // Add result for non-API fixtures
    }> = {};
    
    if (!fixtures?.length) return result;
    
    for (const fixture of fixtures) {
      if (fixture.api_match_id) {
        // API fixture: use live_scores
        const liveScore = liveScoresMap.get(fixture.api_match_id);
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
      } else {
        // Non-API fixture: use app_gw_results
        const resultValue = gwResults[fixture.fixture_index];
        if (resultValue) {
          // For non-API fixtures, we don't have actual scores, but we have the result
          // Set status to FINISHED and store the result
          result[fixture.fixture_index] = {
            homeScore: resultValue === "H" ? 1 : resultValue === "A" ? 0 : 0,
            awayScore: resultValue === "A" ? 1 : resultValue === "H" ? 0 : 0,
            status: 'FINISHED',
            minute: null,
            goals: null,
            red_cards: null,
            home_team: null,
            away_team: null,
            result: resultValue
          };
        }
      }
    }
    return result;
  }, [liveScoresMap, fixtures, gwResults]);

  // Fetch basic data (leagues, current GW, leaderboard data) - stale-while-revalidate pattern
  // State is already initialized from cache synchronously, so this only refreshes in background
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setLeaderboardDataLoading(false);
      setLeagueDataLoading(false);
      return;
    }
    
    let alive = true;
    const cacheKey = `home:basic:${user.id}`;
    
    // Check if we already loaded from cache (state was initialized from cache)
    // We have cached data if we have any rank data (leaderboard)
    const hasCachedLeaderboardData = lastGwRank !== null || fiveGwRank !== null || tenGwRank !== null || seasonRank !== null;
    
    // If we have cached data, skip fetching and just refresh in background silently
    // This ensures the page renders immediately with cached data
    if (hasCachedLeaderboardData) {
      // Data already loaded from cache, just refresh in background without blocking
      setLoading(false);
      setLeaderboardDataLoading(false);
    } else {
      // No cache found on init, fetching fresh data
      setLoading(true);
      setLeaderboardDataLoading(true);
    }
    
    // Always fetch fresh data in background (for cache refresh)
    // But don't block rendering if we have cached data
    (async () => {
      try {
        // Add timeout to prevent infinite hanging (15 seconds max)
        const fetchTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Data fetch timed out after 15 seconds')), 15000);
        });
        
        // Parallel fetch: leagues, GW data, points, and overall in one batch
        // App reads from app_* tables (includes both App and mirrored Web users)
        // NOTE: Leagues are now handled by useLeagues hook - no need to fetch here
        const fetchPromise = Promise.all([
          supabase.from("app_gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("app_meta").select("current_gw").eq("id", 1).maybeSingle(),
          supabase.from("app_v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
          supabase.from("app_v_ocp_overall").select("user_id, name, ocp")
        ]);
        
        const [latestGwResult, metaResult, allGwPointsResult, overallResult] = await Promise.race([
          fetchPromise,
          fetchTimeout
        ]) as any;
        
        if (!alive) return;
        
        // Process GW data (always use current GW, ignore test GWs)
        const lastCompletedGw = latestGwResult.data?.gw ?? metaResult.data?.current_gw ?? 1;
        const currentGw = metaResult.data?.current_gw ?? 1;
        
        // Update GW state (realtime subscription and mount validation handle stale cache)
        setGw(currentGw);
        // Set latestGw to the latest GW with results (not just current GW)
        const newLatestGw = latestGwResult.data?.gw ?? currentGw;
        
        // If the new latestGw is different from what we have, trigger a refetch
        if (newLatestGw !== latestGw && latestGw !== null) {
          setGwResultsVersion(prev => prev + 1);
        }
        
        setLatestGw(newLatestGw);
        
        // Process GW points
        let allPoints: Array<{user_id: string, gw: number, points: number}> = [];
        let lastGwRankData: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null = null;
        if (allGwPointsResult.error) {
          setGwPoints([]);
        } else {
          allPoints = (allGwPointsResult.data as Array<{user_id: string, gw: number, points: number}>) ?? [];
          setGwPoints(allPoints.filter(gp => gp.user_id === user.id));
          
          // Calculate Last GW ranking using shared helper (single source of truth)
          lastGwRankData = calculateLastGwRank(user.id, lastCompletedGw, allPoints);
          if (lastGwRankData) {
            setLastGwRank(lastGwRankData);
          }
        }
        
        // Process overall rankings
        let overallData: Array<{user_id: string, name: string | null, ocp: number | null}> = [];
        if (overallResult.error) {
          // Error fetching overall data
        } else {
          overallData = (overallResult.data as Array<{user_id: string, name: string | null, ocp: number | null}>) ?? [];
        }
        
        // Calculate form ranks using shared helpers (single source of truth)
        const fiveGwRankData = lastCompletedGw >= 5 
          ? calculateFormRank(user.id, lastCompletedGw - 4, lastCompletedGw, allPoints, overallData)
          : null;
        const tenGwRankData = lastCompletedGw >= 10
          ? calculateFormRank(user.id, lastCompletedGw - 9, lastCompletedGw, allPoints, overallData)
          : null;

        // Calculate season rank using shared helper (single source of truth)
        const seasonRankData = calculateSeasonRank(user.id, overallData);

        // Update state with calculated ranks
        if (alive) {
          setFiveGwRank(fiveGwRankData);
          setTenGwRank(tenGwRankData);
          setSeasonRank(seasonRankData);
        }

        // Cache the processed data for next time (including form ranks)
        // NOTE: Leagues are cached separately by useLeagues hook at `leagues:${userId}`
        try {
          setCached(cacheKey, {
            currentGw,
            latestGw: newLatestGw,
            allGwPoints: allPoints,
            overall: overallData,
            lastGwRank: lastGwRankData,
            fiveGwRank: fiveGwRankData,
            tenGwRank: tenGwRankData,
            seasonRank: seasonRankData,
          }, CACHE_TTL.HOME);
          // Cached data for next time
        } catch (cacheError) {
          // Failed to cache data (non-critical)
        }
        
        // Only update loading states if we didn't have cached data
        // If we had cached data, these are already false
        if (!hasCachedLeaderboardData) {
          setLoading(false);
          setLeaderboardDataLoading(false);
        }
      } catch (error: any) {
        console.error('[Home] Error fetching data:', error);
        if (alive) {
          // Only update loading states if we didn't have cached data
          if (!hasCachedLeaderboardData) {
            setLoading(false);
            setLeaderboardDataLoading(false);
          }
          setLeagueDataLoading(false);
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, lastGwRank, fiveGwRank, tenGwRank, seasonRank]);

  // Subscribe to app_meta changes to detect when current_gw changes
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('app_meta_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_meta',
          filter: 'id=eq.1'
        },
        (payload) => {
          const newCurrentGw = (payload.new as any)?.current_gw;
          if (newCurrentGw && typeof newCurrentGw === 'number') {
            const oldGw = gw;
            setGw(newCurrentGw);
            // Clear all caches to force fresh data fetch
            const cacheKey = `home:basic:${user.id}`;
            removeCached(cacheKey);
            // Clear fixtures cache for old GW
            if (oldGw) {
              const oldFixturesCacheKey = `home:fixtures:${user.id}:${oldGw}`;
              removeCached(oldFixturesCacheKey);
            }
            // Clear fixtures cache for new GW (will be repopulated)
            const newFixturesCacheKey = `home:fixtures:${user.id}:${newCurrentGw}`;
            removeCached(newFixturesCacheKey);
            // Trigger refetch by incrementing version
            setGwResultsVersion(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, gw]);

  // Fetch league data - optimized with caching
  useEffect(() => {
    if (!user?.id || !leagues.length || !gw) {
      setLeagueDataLoading(false);
      return;
    }
    
    let alive = true;
    const leagueDataCacheKey = `home:leagueData:${user.id}:${gw}`;
    let loadedFromCache = false;
    
    // 1. Load from cache immediately (if available)
    try {
      const cached = getCached<{
        leagueData: Record<string, LeagueDataInternal>;
        leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
      }>(leagueDataCacheKey);
      
      if (cached && cached.leagueData && Object.keys(cached.leagueData).length > 0) {
        // Check if cached data has webUserIds - if not, it's stale and we should skip cache
        // We need to check if ALL leagues have webUserIds defined (even if empty arrays)
        const allLeaguesHaveWebUserIds = Object.values(cached.leagueData).every((data: any) => 
          data.webUserIds !== undefined
        );
        
        if (allLeaguesHaveWebUserIds) {
          // Convert arrays back to Sets for submittedMembers and latestGwWinners
          const restoredLeagueData: Record<string, LeagueDataInternal> = {};
          for (const [leagueId, data] of Object.entries(cached.leagueData)) {
            restoredLeagueData[leagueId] = {
              ...data,
              submittedMembers: data.submittedMembers ? (Array.isArray(data.submittedMembers) ? new Set(data.submittedMembers) : data.submittedMembers) : undefined,
              latestGwWinners: data.latestGwWinners ? (Array.isArray(data.latestGwWinners) ? new Set(data.latestGwWinners) : data.latestGwWinners) : undefined,
              webUserIds: data.webUserIds ? (Array.isArray(data.webUserIds) ? new Set(data.webUserIds) : data.webUserIds) : undefined,
            };
          }
          setLeagueData(restoredLeagueData);
          setLeagueSubmissions(cached.leagueSubmissions || {});
          setLeagueDataLoading(false);
          loadedFromCache = true;
        } else {
          // Cache is stale (missing webUserIds) - invalidate it and fetch fresh data
          removeCached(leagueDataCacheKey);
        }
      }
    } catch (error) {
      // Error loading leagueData from cache (non-critical)
    }
    
    // 2. Fetch fresh data in background
    (async () => {
      try {
        if (!alive) return;
        // Only set loading state if we didn't load from cache
        if (!loadedFromCache) {
          setLeagueData({});
          setLeagueDataLoading(true);
        }
        
        const leagueIds = leagues.map(l => l.id);
        
        // Parallel fetch all league data
        // App reads from app_* tables (includes both App and mirrored Web users)
        const [membersResult, readsResult, submissionsResult, resultsResult, fixturesResult, webPicksResult, appPicksResult] = await Promise.all([
          supabase.from("league_members").select("league_id, user_id, users!inner(id, name)").in("league_id", leagueIds),
          supabase.from("league_message_reads").select("league_id, last_read_at").eq("user_id", user.id).in("league_id", leagueIds),
          supabase.from("app_gw_submissions").select("user_id").eq("gw", gw),
          supabase.from("app_gw_results").select("gw, fixture_index, result"),
          supabase.from("app_fixtures").select("gw, fixture_index, home_team, away_team, home_name, away_name, kickoff_time").in("gw", Array.from({ length: Math.min(20, latestGw || 20) }, (_, i) => i + 1)),
          // Fetch picks from Web table with timestamps to determine origin
          supabase.from("picks").select("user_id, gw, created_at").limit(10000),
          // Fetch picks from App table with timestamps to compare
          supabase.from("app_picks").select("user_id, gw, created_at").limit(10000),
        ]);
        
        if (!alive) return;
        
        // Process members
        const membersByLeague: Record<string, LeagueMember[]> = {};
        (membersResult.data ?? []).forEach((m: any) => {
          if (!membersByLeague[m.league_id]) {
            membersByLeague[m.league_id] = [];
          }
          membersByLeague[m.league_id].push({
            id: m.users.id,
            name: m.users.name
          });
        });
        
        // Optimize: use Set for faster lookups
        const allMemberIdsSet = new Set(Object.values(membersByLeague).flat().map(m => m.id));
        const submittedUserIds = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id).filter((id: string) => allMemberIdsSet.has(id)));
        
        // Identify Web users by comparing timestamps:
        // If picks in `picks` table were created BEFORE (or within 1 second of) picks in `app_picks`,
        // the user made picks on Web first (Web origin)
        // Build maps of earliest pick time per user+gw for each table
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
        
        // App-only user IDs (from shared constants) - keep this list for now as requested
        const appTestUserIds = new Set(APP_ONLY_USER_IDS);
        
        // Identify Web users: those whose picks in `picks` table were created 
        // BEFORE picks in `app_picks` table (Web origin)
        // If picks originated from App, app_picks will have earlier timestamps due to mirroring
        // IMPORTANT: Only check the CURRENT gameweek to avoid false positives from old migrated data
        // Historical gameweeks may have been migrated, making timestamp comparison unreliable
        const webUserIds = new Set<string>();
        
        // Use the current GW to determine origin (only check latest picks, not historical)
        // This avoids false positives from old migrated data where web picks predate app picks
        let gwToCheck = gw;
        if (!gwToCheck) {
          // Fallback: fetch current GW from database if state variable is not set
          const { data: meta } = await supabase.from("app_meta").select("current_gw").eq("id", 1).maybeSingle();
          gwToCheck = meta?.current_gw ?? 1;
        }
        
        // Only check the current gameweek for reliable origin detection
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
            // Also check they're league members and not app-only test users
            if (allMemberIdsSet.has(userId) && !appTestUserIds.has(userId)) {
              webUserIds.add(userId);
            }
          }
          // If no appTime exists, we can't reliably determine origin (could be data migration, etc.)
          // So we don't mark as web user to be safe
        });
        
        if (webPicksResult.error) {
          console.error('[Home] Error fetching web picks:', webPicksResult.error);
        }
        if (appPicksResult.error) {
          console.error('[Home] Error fetching app picks:', appPicksResult.error);
        }
        
        // Process unread counts
        const lastReadMap = new Map<string, string>();
        (readsResult.data ?? []).forEach((r: any) => {
          lastReadMap.set(r.league_id, r.last_read_at);
        });
        
        // Fetch picks per league in parallel
        // App reads from app_picks (includes both App and mirrored Web users)
        const picksPromises = leagues.map(async (league) => {
          const memberIds = (membersByLeague[league.id] ?? []).map(m => m.id);
          if (memberIds.length === 0) return { leagueId: league.id, picks: [] };
          const { data } = await supabase
            .from("app_picks")
            .select("user_id, gw, fixture_index, pick")
            .in("user_id", memberIds);
          return { leagueId: league.id, picks: (data ?? []) as PickRow[] };
        });
        
        // Fetch unread counts in parallel
        const unreadCountPromises = leagueIds.map(async (leagueId) => {
          const since = lastReadMap.get(leagueId) ?? "1970-01-01T00:00:00Z";
          const { count } = await supabase
            .from("league_messages")
            .select("id", { count: "exact", head: true })
            .eq("league_id", leagueId)
            .gte("created_at", since)
            .neq("user_id", user.id);
          return { leagueId, count: typeof count === "number" ? count : 0 };
        });
        
        const [unreadCountResults, picksResults] = await Promise.all([
          Promise.all(unreadCountPromises),
          Promise.all(picksPromises)
        ]);
        
        if (!alive) return;
        
        // Process outcomes
        const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
        (resultsResult.data ?? []).forEach((r: any) => {
          const out = rowToOutcome(r);
          if (out) outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
        });
        
        const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
        
        // If current GW has results, ensure it's included (GW has finished)
        // This ensures winners are calculated for the current GW once it finishes
        if (gw && !gwsWithResults.includes(gw)) {
          // Check if current GW has any results (might have finished but not yet in gwsWithResults)
          const currentGwResults = (resultsResult.data ?? []).filter((r: any) => r.gw === gw);
          if (currentGwResults.length > 0) {
            gwsWithResults.push(gw);
            gwsWithResults.sort((a, b) => a - b);
          }
        }
        const relevantFixtures = (fixturesResult.data ?? []).filter((f: any) => 
          gwsWithResults.length > 0 ? gwsWithResults.includes(f.gw) : f.gw === 1
        );
        
        // NOTE: Unread counts are now handled by useLeagues hook
        // This local calculation is kept only for internal use in this effect
        const unreadCounts: Record<string, number> = {};
        unreadCountResults.forEach(({ leagueId, count }) => {
          unreadCounts[leagueId] = count;
        });
        
        // Process picks
        const picksByLeague = new Map<string, PickRow[]>();
        picksResults.forEach(({ leagueId, picks }) => {
          picksByLeague.set(leagueId, picks);
        });
        
        
        // Calculate GW deadlines
        const gwDeadlines = new Map<number, Date>();
        relevantFixtures.forEach((f: any) => {
          if (f.kickoff_time && f.gw) {
            const kickoff = new Date(f.kickoff_time);
            const deadline = new Date(kickoff.getTime() - 75 * 60 * 1000);
            if (!gwDeadlines.has(f.gw) || deadline < gwDeadlines.get(f.gw)!) {
              gwDeadlines.set(f.gw, deadline);
            }
          }
        });
        
        // Calculate league start GWs using EXACT same logic as League.tsx
        // Use resolveLeagueStartGw which queries fixtures table (same as League page)
        const leagueStartGws = new Map<string, number>();
        const leagueStartGwPromises = leagues.map(async (league) => {
          const leagueStartGw = await resolveLeagueStartGw(league, gw);
          return { leagueId: league.id, leagueStartGw };
        });
        const leagueStartGwResults = await Promise.all(leagueStartGwPromises);
        leagueStartGwResults.forEach(({ leagueId, leagueStartGw }) => {
          leagueStartGws.set(leagueId, leagueStartGw);
        });
        
        // Process league data
        const leagueDataMap: Record<string, LeagueDataInternal> = {};
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
            return;
          }
          
          const leagueStartGw = leagueStartGws.get(league.id) ?? gw;
          
          // Include current GW if it has finished (moved to RESULTS_PRE_GW state)
          // This ensures winners are calculated for the current GW once it finishes
          const currentGwFinished = gwsWithResults.includes(gw);
          const allRelevantGws = leagueStartGw === 0 
            ? gwsWithResults 
            : gwsWithResults.filter(g => g >= leagueStartGw);
          
          // If current GW has results (finished), make sure it's included
          const relevantGws = currentGwFinished && !allRelevantGws.includes(gw)
            ? [...allRelevantGws, gw].sort((a, b) => a - b)
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
          
          const picksByGwIdx = new Map<string, PickRow[]>();
          picksAll.forEach((p: PickRow) => {
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
          
          const sortedMemberIds = sortedMltRows.map(r => r.user_id);
          const userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
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
        
        setLeagueSubmissions(submissionStatus);
        setLeagueData(leagueDataMap);
        // Only update loading state if we didn't load from cache
        if (!loadedFromCache) {
          setLeagueDataLoading(false);
        }
        
        // Cache the processed data for next time
        try {
          // Convert Sets to Arrays for JSON serialization
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
        } catch (cacheError) {
          // Failed to cache leagueData (non-critical)
        }
      } catch (error) {
        setLeagueDataLoading(false);
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, leagues, gw, gwResultsVersion]);

  /* ---------- Refetch data when gwResultsVersion changes (triggered by subscription) ---------- */
  useEffect(() => {
    if (!user?.id || gwResultsVersion === 0) return; // Skip initial render
    
    let alive = true;
    
    (async () => {
      try {
        // Refetch latest GW and leaderboard data when results change
        const [latestGwResult, allGwPointsResult] = await Promise.all([
          supabase.from("app_gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("app_v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
        ]);
        
        if (!alive) return;
        
        const newLatestGw = latestGwResult.data?.gw ?? null;
        const allPoints = (allGwPointsResult.data as Array<{user_id: string, gw: number, points: number}>) ?? [];
        
        // Update state - this will trigger rank recalculation in the existing effect (line 694)
        // The rank calculation effect will recalculate lastGwRank, fiveGwRank, tenGwRank, and seasonRank
        if (newLatestGw !== null && newLatestGw !== latestGw) {
          setLatestGw(newLatestGw);
        }
        setGwPoints(allPoints.filter(gp => gp.user_id === user.id));
        
        // Note: Don't update cache here - let the rank calculation effect update cache after ranks are recalculated
      } catch (e) {
        console.error('[Home] Error refetching data after results change:', e);
      }
    })();
    
    return () => { alive = false; };
  }, [gwResultsVersion, user?.id]);

  /* ---------- Subscribe to app_gw_results changes for real-time leaderboard updates ---------- */
  useEffect(() => {
    if (!user?.id) return;
    
    // Subscribe to changes in app_gw_results table to trigger leaderboard recalculation
    const channel = supabase
      .channel('home-gw-results-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'app_gw_results',
        },
        (_payload) => {
          // Clear cache to force fresh fetch
          const cacheKey = `home:basic:${user.id}`;
          try {
            removeCached(cacheKey);
            removeCached(`home:fixtures:${user.id}:${gw}`);
          } catch (e) {
            console.error('[Home] Cache clear failed:', e);
          }
          // Increment version to trigger recalculation
          setGwResultsVersion(prev => prev + 1);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[Home] Subscription error - realtime may not be enabled for app_gw_results');
        }
      });

    // Fallback: Check for updates when page becomes visible (in case subscription doesn't fire)
    const handleVisibilityChange = async () => {
      if (!document.hidden && user?.id) {
        try {
          const { data: latestGwResult } = await supabase
            .from("app_gw_results")
            .select("gw")
            .order("gw", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const newLatestGw = latestGwResult?.gw ?? null;
          if (newLatestGw !== null && newLatestGw !== latestGw) {
            // Clear cache and trigger refetch
            try {
              removeCached(`home:basic:${user.id}`);
              removeCached(`home:fixtures:${user.id}:${gw}`);
            } catch (e) {
              console.error('[Home] Cache clear failed on visibility change:', e);
            }
            setGwResultsVersion(prev => prev + 1);
          }
        } catch (e) {
          console.error('[Home] Error checking GW on visibility change:', e);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [user?.id, gw, latestGw]);

  // Fetch fixtures and picks - always uses current GW from app_meta (ignores test GWs)
  useEffect(() => {
    if (!user?.id || !gw) {
      setFixtures([]);
      setFixturesLoading(false);
      setUserPicks({});
      fixturesLoadedFromCacheRef.current = false;
      return;
    }
    
    // If fixtures were already loaded from basic cache, just refresh in background silently
    if (fixturesLoadedFromCacheRef.current && fixtures.length > 0) {
      // Fixtures already loaded from basic cache, refresh in background
      (async () => {
        try {
          const [fixturesResult, picksResult] = await Promise.all([
            supabase
              .from("app_fixtures")
              .select("id, gw, fixture_index, api_match_id, home_code, away_code, home_team, away_team, home_name, away_name, kickoff_time")
              .eq("gw", gw)
              .order("fixture_index", { ascending: true }),
            supabase
              .from("app_picks")
              .select("fixture_index, pick")
              .eq("gw", gw)
              .eq("user_id", user.id)
          ]);
          
          const fixturesData = fixturesResult.error ? [] : (fixturesResult.data ?? []) as Fixture[];
          const picksMap: Record<number, "H" | "D" | "A"> = {};
          
          if (!picksResult.error) {
            (picksResult.data ?? []).forEach((p: { fixture_index: number; pick: "H" | "D" | "A" }) => {
              picksMap[p.fixture_index] = p.pick;
            });
          }
          
          setFixtures(fixturesData);
          setUserPicks(picksMap);
          
          // Cache the data
          const fixturesCacheKey = `home:fixtures:${user.id}:${gw}`;
          try {
            const liveScoresArray: Array<any> = [];
            liveScoresMap.forEach((score) => {
              liveScoresArray.push(score);
            });
            
            setCached(fixturesCacheKey, {
              fixtures: fixturesData,
              userPicks: picksMap,
              liveScores: liveScoresArray.length > 0 ? liveScoresArray : undefined,
            }, CACHE_TTL.HOME);
          } catch (cacheError) {
            // Failed to cache (non-critical)
          }
        } catch (error) {
          // Error refreshing fixtures (non-critical)
        }
      })();
      return;
    }
    
    let alive = true;
    let loadedFromCache = false;
    
    // 1. Load from cache immediately (if available)
    (async () => {
      try {
        const fixturesCacheKey = `home:fixtures:${user.id}:${gw}`;
        
        // Try to load from cache
        try {
          const cached = getCached<{
            fixtures: Fixture[];
            userPicks: Record<number, "H" | "D" | "A">;
          }>(fixturesCacheKey);
          
          if (cached && cached.fixtures && Array.isArray(cached.fixtures) && cached.fixtures.length > 0) {
            setFixtures(cached.fixtures);
            setUserPicks(cached.userPicks || {});
            setFixturesLoading(false);
            loadedFromCache = true;
            fixturesLoadedFromCacheRef.current = true;
            hasCheckedCacheRef.current = true;
          } else {
            hasCheckedCacheRef.current = true;
          }
        } catch (error) {
          // Cache miss, continue to fetch
        }
        
        // 2. Fetch fresh data in background
        if (!loadedFromCache) {
          setFixturesLoading(true);
        }
        
        // Always load from app_fixtures using current GW
        const [fixturesResult, picksResult] = await Promise.all([
          supabase
            .from("app_fixtures")
            .select("id, gw, fixture_index, api_match_id, home_code, away_code, home_team, away_team, home_name, away_name, kickoff_time")
            .eq("gw", gw)
            .order("fixture_index", { ascending: true }),
          supabase
            .from("app_picks")
            .select("fixture_index, pick")
            .eq("gw", gw)
            .eq("user_id", user.id)
        ]);
        
        if (!alive) return;
        
        const fixturesData = fixturesResult.error ? [] : (fixturesResult.data ?? []) as Fixture[];
        const picksMap: Record<number, "H" | "D" | "A"> = {};
        
        if (!picksResult.error) {
          (picksResult.data ?? []).forEach((p: { fixture_index: number; pick: "H" | "D" | "A" }) => {
            picksMap[p.fixture_index] = p.pick;
          });
        }
        
        setFixtures(fixturesData);
        setUserPicks(picksMap);
        setFixturesLoading(false);
        fixturesLoadedFromCacheRef.current = false;
        hasCheckedCacheRef.current = true;
        
        // Cache the data
        try {
          const liveScoresArray: Array<any> = [];
          liveScoresMap.forEach((score) => {
            liveScoresArray.push(score);
          });
          
          setCached(fixturesCacheKey, {
            fixtures: fixturesData,
            userPicks: picksMap,
            liveScores: liveScoresArray.length > 0 ? liveScoresArray : undefined,
          }, CACHE_TTL.HOME);
        } catch (cacheError) {
          // Failed to cache (non-critical)
        }
      } catch (error) {
        if (alive) {
          setFixtures([]);
          setFixturesLoading(false);
          setUserPicks({});
          hasCheckedCacheRef.current = true;
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, gw]);

  // Load user submissions to check streak and whether to show pick buttons
  const [userSubmissions, setUserSubmissions] = useState<Set<number>>(new Set());
  
  useEffect(() => {
    if (!user?.id) {
      setUserSubmissions(new Set());
      return;
    }
    
    let alive = true;
    const loadSubmissions = async () => {
      // Get all submissions for the user
      const { data: submissions } = await supabase
        .from('app_gw_submissions')
        .select('gw')
        .eq('user_id', user.id)
        .order('gw', { ascending: false });
      
      if (alive && submissions) {
        setUserSubmissions(new Set(submissions.map((s: any) => s.gw)));
      }
    };
    
    loadSubmissions();
    
    // Listen for prediction submission events to update immediately
    const handleSubmission = () => {
      if (alive) {
        loadSubmissions();
      }
    };
    
    window.addEventListener('predictionsSubmitted', handleSubmission);
    
    return () => {
      alive = false;
      window.removeEventListener('predictionsSubmitted', handleSubmission);
    };
  }, [user?.id, gw]); // Also refresh when current GW changes

  // Check if user has submitted predictions for current GW
  const hasSubmittedCurrentGw = useMemo(() => {
    if (!user?.id || !gw) return false;
    return userSubmissions.has(gw);
  }, [user?.id, gw, userSubmissions]);

  // Calculate score component - memoized
  const scoreComponent = useMemo(() => {
    if (!fixtures.length) return null;
    
    const hasSubmittedPicks = Object.keys(userPicks).length > 0;
    let score = 0;
    let liveCount = 0;
    let finishedCount = 0;
    let allFinished = true;
    let hasAnyActive = false;
    let hasStartingSoonFixtures = false;
    const now = new Date();
    
    // Use centralized game state system (PR.md rule 10)
    // LIVE state means: first kickoff has happened AND last game hasn't finished
    const isInLiveWindow = gameState === 'LIVE';
    
    for (const f of fixtures) {
      const liveScore = liveScores[f.fixture_index];
      const pick = userPicks[f.fixture_index];
      const status = liveScore?.status;
      const isActive = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
      
      // Check if fixture is starting soon (has kickoff time in future, no live score yet)
      if (f.kickoff_time && !liveScore) {
        const kickoffTime = new Date(f.kickoff_time);
        if (kickoffTime > now) {
          hasStartingSoonFixtures = true;
        }
      }
      
      if (isActive) {
        hasAnyActive = true;
        if (status === 'IN_PLAY' || status === 'PAUSED') liveCount++;
        if (status === 'FINISHED') finishedCount++;
        if (status !== 'FINISHED') allFinished = false;
        
        if (pick && liveScore) {
          let isCorrect = false;
          // Check if we have a direct result (for non-API fixtures from app_gw_results)
          if ((liveScore as any).result) {
            isCorrect = (liveScore as any).result === pick;
          } else {
            // Use score comparison for API fixtures
            isCorrect = 
              (pick === 'H' && liveScore.homeScore > liveScore.awayScore) ||
              (pick === 'A' && liveScore.awayScore > liveScore.homeScore) ||
              (pick === 'D' && liveScore.homeScore === liveScore.awayScore);
          }
          if (isCorrect) score++;
        }
      } else {
        allFinished = false;
      }
    }
    
    // Wait for game state to load before rendering
    if (gameStateLoading) return null;
    
    if (!hasAnyActive && !hasSubmittedPicks && !hasStartingSoonFixtures && !isInLiveWindow) return null;
    
    const ScoreBadge = ({ score: s, label, bgColor, icon }: { score: number | string; label: string; bgColor: string; icon?: JSX.Element }) => (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white ${bgColor}`}>
        {icon}
        <span className="text-xs sm:text-sm font-medium opacity-90">{label}</span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-lg sm:text-xl font-extrabold">{s}</span>
          <span className="text-sm sm:text-base font-medium opacity-90">/</span>
          <span className="text-base sm:text-lg font-semibold opacity-80">{fixtures.length}</span>
        </span>
      </div>
    );
    
    // Starting Soon pill (shown after user has submitted)
    const StartingSoonBadge = () => (
      <div className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[40px] rounded-full bg-amber-500 text-white shadow-md shadow-amber-500/30 self-start">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs sm:text-sm font-medium">Starting soon</span>
      </div>
    );
    
    // Make Your Predictions CTA button (identical to GO button in banner)
    const MakePredictionsCTA = () => (
      <div className="flex items-center gap-1">
        <img 
          src="/assets/Animation/Volley-Pointing.gif" 
          alt="Volley pointing" 
          className="w-[57px] h-[57px] object-contain -mt-4"
          style={{ imageRendering: 'pixelated' }}
        />
        <Link
          to="/predictions"
          className="flex-shrink-0 px-4 py-2 bg-[#1C8376] text-white rounded-[20px] font-medium hover:bg-[#1C8376]/90 transition-colors flex items-center gap-1"
        >
          Go
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    );
    
    // Show "Make Your Predictions" CTA if no active games, fixtures are scheduled, and user hasn't submitted
    // Show "Starting soon" if user has already submitted
    // But don't show if we're in the live window (between first kickoff and last game ending)
    if (!hasAnyActive && hasStartingSoonFixtures && !isInLiveWindow) {
      // Check if user has submitted for current GW
      const hasSubmitted = hasSubmittedCurrentGw;
      return hasSubmitted ? <StartingSoonBadge /> : <MakePredictionsCTA />;
    }
    
    // If we're in the live window, show "Live" badge even if no games are currently active
    if (isInLiveWindow && !hasAnyActive) {
      const displayScore = hasSubmittedPicks ? score : "--";
      return (
        <div className="flex flex-col items-center gap-2">
          <ScoreBadge
            score={displayScore}
            label="Live"
            bgColor="bg-red-600"
            icon={<div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>}
          />
        </div>
      );
    }
    
    if (!hasAnyActive && hasSubmittedPicks && !isInLiveWindow) {
      return <ScoreBadge score="--" label="Score" bgColor="bg-amber-500 shadow-lg shadow-amber-500/30" />;
    }
    
    if (liveCount === 0 && finishedCount > 0 && !allFinished && !isInLiveWindow) {
      return (
        <div className="flex flex-col items-center gap-2">
          <ScoreBadge 
            score={score} 
            label="Score" 
            bgColor="bg-slate-600"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>
      );
    }
    
    // Show "Live" (red) if we're in the live window (between first kickoff and last game ending)
    // Show pulsing dot icon if games are actively in play
    return (
      <div className="flex flex-col items-center gap-2">
        <ScoreBadge
          score={score}
          label={isInLiveWindow ? 'Live' : 'Score'}
          bgColor={isInLiveWindow ? 'bg-red-600' : 'bg-slate-600'}
          icon={
            isInLiveWindow ? (
              liveCount > 0 ? (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              ) : undefined
            ) : undefined
          }
        />
      </div>
    );
  }, [isInApiTestLeague, fixtures, liveScores, userPicks, hasSubmittedCurrentGw, gameState, gameStateLoading]);

  // Check if there are any live games - optimized
  const hasLiveGames = useMemo(() => {
    if (!fixtures.length) return false;
    for (const f of fixtures) {
      const liveScore = liveScores[f.fixture_index];
      if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED')) {
        return true;
      }
    }
    return false;
  }, [fixtures, liveScores]);

  // Calculate streak data - optimized
  const userStreakData = useMemo(() => {
    if (!user?.id || !latestGw) return null;
    
    const userGwPoints = gwPoints.filter(gp => gp.user_id === user.id).sort((a, b) => b.gw - a.gw);
    
    // Calculate streak: check both points (for finished GWs) and submissions (for current/unfinished GWs)
    let streak = 0;
    let expectedGw = latestGw;
    
    // Create sets for faster lookup
    const userGwPointsSet = new Set(userGwPoints.map(gp => gp.gw));
    
    // Count consecutive gameweeks backwards from latestGw
    // A GW counts if user has either points (finished) OR submissions (played but not finished)
    while (expectedGw >= 1) {
      const hasPoints = userGwPointsSet.has(expectedGw);
      const hasSubmission = userSubmissions.has(expectedGw);
      
      if (hasPoints || hasSubmission) {
        streak++;
        expectedGw--;
      } else {
        // Break streak if we hit a GW with no points and no submission
        break;
      }
    }
    
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
      last10GwScores: last10GwScores.reverse()
    };
  }, [user?.id, gwPoints, latestGw, userSubmissions]);

  // Leagues from useLeagues hook are already sorted (by unread desc, then name asc)
  // and filtered (no API Test league) - just use them directly

  // Memoize filtered fixtures
  const fixturesToShow = useMemo(() => {
    if (!showLiveOnly) return fixtures;
    return fixtures.filter(f => {
      const liveScore = liveScores[f.fixture_index];
      return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
    });
  }, [fixtures, liveScores, showLiveOnly]);

  // Memoize fixture card data conversion
  const fixtureCards = useMemo(() => {
    return fixturesToShow.map((f) => {
      const fixtureCardFixture: FixtureCardFixture = {
        id: f.id,
        gw: f.gw,
        fixture_index: f.fixture_index,
        home_code: f.home_code,
        away_code: f.away_code,
        home_team: f.home_team,
        away_team: f.away_team,
        home_name: f.home_name,
        away_name: f.away_name,
        kickoff_time: f.kickoff_time,
        api_match_id: f.api_match_id ?? null,
      };
      
      const liveScoreData = liveScores[f.fixture_index];
      const fixtureCardLiveScore: FixtureCardLiveScore | null = liveScoreData ? {
        status: liveScoreData.status,
        minute: liveScoreData.minute ?? null,
        homeScore: liveScoreData.homeScore,
        awayScore: liveScoreData.awayScore,
        home_team: liveScoreData.home_team ?? null,
        away_team: liveScoreData.away_team ?? null,
        goals: liveScoreData.goals ?? undefined,
        red_cards: liveScoreData.red_cards ?? undefined,
      } : null;
      
      return { 
        fixture: fixtureCardFixture, 
        liveScore: fixtureCardLiveScore, 
        pick: userPicks[f.fixture_index]
      };
    });
  }, [fixturesToShow, liveScores, userPicks]);

  // Allow rendering if we have cached data OR if all loading is complete
  // This ensures the page renders immediately with cached data while fresh data loads in background
  const hasCachedData = (lastGwRank !== null || fiveGwRank !== null || tenGwRank !== null || seasonRank !== null) && 
                       Object.keys(leagueData).length > 0;
  const isDataReady = hasCachedData || (!loading && !leaderboardDataLoading && !leagueDataLoading);
  // NOTE: Unread counts refresh on focus is now handled by useLeagues hook

  return (
    <div className="max-w-6xl lg:max-w-[1024px] mx-auto px-4 lg:px-6 pt-2 pb-4 min-h-screen relative">
      {/* Logo header - hidden on desktop (logo is in DesktopNav) */}
      <div ref={logoContainerRef} className="relative mb-4 lg:hidden">
        <ScrollLogo />
      </div>
      
      {!isDataReady ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
        </div>
      ) : (
        <>
          {/* LEADERBOARDS */}
          <LeaderboardsSection
            lastGwRank={lastGwRank}
            fiveGwRank={fiveGwRank}
            tenGwRank={tenGwRank}
            seasonRank={seasonRank}
            userStreakData={userStreakData}
            latestGw={latestGw}
            currentGw={gw}
          />

          {/* Mini Leagues and Games - Side by side on desktop */}
          <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
            {/* Mini Leagues - 30% on desktop */}
            <div className="lg:w-[30%] lg:flex-shrink-0">
              <MiniLeaguesSection
                leagues={leagues}
                leagueData={leagueData}
                leagueSubmissions={leagueSubmissions}
                unreadByLeague={unreadByLeague}
                leagueDataLoading={leagueDataLoading}
                currentGw={gw}
                currentUserId={user?.id}
                gameState={gameState}
              />
            </div>

            {/* Games - 70% on desktop */}
            <div className="lg:w-[70%] lg:flex-shrink-0">
              <GamesSection
                isInApiTestLeague={isInApiTestLeague}
                fixtures={fixtures}
                fixtureCards={fixtureCards}
                hasLiveGames={hasLiveGames}
                showLiveOnly={showLiveOnly}
                onToggleLiveOnly={setShowLiveOnly}
                scoreComponent={scoreComponent}
                fixturesLoading={fixturesLoading}
                hasCheckedCache={hasCheckedCacheRef.current}
                currentGw={gw}
                showPickButtons={hasSubmittedCurrentGw}
                userPicks={userPicks}
                liveScores={liveScores}
                userName={user?.user_metadata?.display_name || user?.email || 'User'}
                globalRank={seasonRank?.rank}
                hasSubmitted={hasSubmittedCurrentGw}
              />
            </div>
          </div>

          {/* Bottom padding */}
          <div className="h-20"></div>
        </>
      )}

      {/* GameweekResultsModal */}
      {showResultsModal && resultsModalGw && (
        <GameweekResultsModal
          isOpen={showResultsModal}
          onClose={() => {
            // Mark modal as shown for this GW in localStorage
            if (user?.id && resultsModalGw) {
              const localStorageKey = `gwResultsModalShown:${user.id}:${resultsModalGw}`;
              localStorage.setItem(localStorageKey, 'true');
            }
            setShowResultsModal(false);
            setResultsModalGw(null);
            // Clear preloaded data after modal is closed
            setPreloadedResultsData(null);
          }}
          gw={resultsModalGw}
          nextGw={latestGw && latestGw > resultsModalGw ? latestGw : null}
          preloadedResults={preloadedResultsData}
        />
      )}

    </div>
  );
}
