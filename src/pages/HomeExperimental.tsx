import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import ScrollLogo from "../components/ScrollLogo";
import Section from "../components/Section";
import LeaderboardCircle from "../components/LeaderboardCircle";
import { MiniLeaguesSection } from "../components/MiniLeaguesSection";
import { GamesSection } from "../components/GamesSection";
import { resolveLeagueStartGw } from "../lib/leagueStart";
import type { Fixture as FixtureCardFixture, LiveScore as FixtureCardLiveScore } from "../components/FixtureCard";
import { useLiveScores } from "../hooks/useLiveScores";
import { getCached, setCached, removeCached, getCacheTimestamp, CACHE_TTL } from "../lib/cache";
import { useLeagues } from "../hooks/useLeagues";
import { calculateFormRank, calculateLastGwRank, calculateSeasonRank } from "../lib/helpers";
import { fireConfettiCannon } from "../lib/confettiCannon";
import { APP_ONLY_USER_IDS } from "../lib/appOnlyUsers";
import { useGameweekState } from "../hooks/useGameweekState";
import type { GameweekState } from "../lib/gameweekState";

// Types
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
  webUserIds?: string[] | Set<string>;
  seasonLeaderName?: string | null;
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

/**
 * HomeExperimental - Experimental HomePage design for testing new layouts
 * 
 * LOADING STRATEGY:
 * - Load ALL data from cache synchronously on mount (zero loading if cache exists)
 * - Only show loading if cache is completely missing (not stale)
 * - Background refresh for stale cache (non-blocking)
 * - All data sources use cache-first approach
 */
export default function HomeExperimental() {
  const { user } = useAuth();
  
  // Load initial state from cache synchronously (happens before first render)
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
        gw: 1,
        latestGw: null,
        gwPoints: [],
        allGwPoints: [],
        overall: [],
        lastGwRank: null,
        fiveGwRank: null,
        tenGwRank: null,
        seasonRank: null,
        fixtures: [],
        userPicks: {},
        leagueData: {},
        leagueSubmissions: {},
        hasCache: false,
      };
    }
    
    try {
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
      }>(cacheKey);
      
      if (cached && cached.currentGw) {
        // Load fixtures from cache
        let fixtures: Fixture[] = [];
        let userPicks: Record<number, "H" | "D" | "A"> = {};
        let liveScores: Record<number, { 
          homeScore: number; 
          awayScore: number; 
          status: string; 
          minute?: number | null;
          goals?: any[] | null;
          red_cards?: any[] | null;
          home_team?: string | null;
          away_team?: string | null;
          result?: "H" | "D" | "A" | null;
        }> = {};
        const fixturesCacheKey = `home:fixtures:${userId}:${cached.currentGw}`;
        
        try {
          const fixturesCached = getCached<{
            fixtures: Fixture[];
            userPicks: Record<number, "H" | "D" | "A">;
            liveScores?: Array<{ api_match_id: number; fixture_index?: number; [key: string]: any }>;
          }>(fixturesCacheKey);
          
          if (fixturesCached?.fixtures?.length) {
            fixtures = fixturesCached.fixtures;
            userPicks = fixturesCached.userPicks || {};
            
            // Convert cached live scores to Record format immediately
            if (fixturesCached.liveScores?.length) {
              const apiMatchIdToFixtureIndex = new Map<number, number>();
              fixturesCached.fixtures.forEach((f: any) => {
                if (f.api_match_id) {
                  apiMatchIdToFixtureIndex.set(f.api_match_id, f.fixture_index);
                }
              });
              
              fixturesCached.liveScores.forEach((score: any) => {
                let fixtureIndex = score.fixture_index;
                if (!fixtureIndex && score.api_match_id) {
                  fixtureIndex = apiMatchIdToFixtureIndex.get(score.api_match_id);
                }
                
                if (fixtureIndex !== undefined) {
                  liveScores[fixtureIndex] = {
                    homeScore: score.home_score ?? 0,
                    awayScore: score.away_score ?? 0,
                    status: score.status || 'SCHEDULED',
                    minute: score.minute ?? null,
                    goals: score.goals ?? null,
                    red_cards: score.red_cards ?? null,
                    home_team: score.home_team ?? null,
                    away_team: score.away_team ?? null
                  };
                }
              });
            }
          }
        } catch (error) {
          // Error loading fixtures from cache (non-critical)
        }
        
        // Load league data from cache
        let leagueData: Record<string, LeagueDataInternal> = {};
        let leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
        const leagueDataCacheKey = `home:leagueData:v6:${userId}:${cached.currentGw}`; // v6: Ensure HP ordering matches /tables
        
        try {
          const leagueDataCached = getCached<{
            leagueData: Record<string, any>;
            leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
          }>(leagueDataCacheKey);
          
          if (leagueDataCached?.leagueData) {
            // Check if all leagues have webUserIds (data is complete)
            const allLeaguesHaveWebUserIds = Object.values(leagueDataCached.leagueData).every((data: any) => 
              data.webUserIds !== undefined
            );
            
            if (allLeaguesHaveWebUserIds) {
              // Restore Sets from arrays
              for (const [leagueId, data] of Object.entries(leagueDataCached.leagueData)) {
                leagueData[leagueId] = {
                  ...data,
                  submittedMembers: data.submittedMembers ? (Array.isArray(data.submittedMembers) ? new Set(data.submittedMembers) : data.submittedMembers) : undefined,
                  latestGwWinners: data.latestGwWinners ? (Array.isArray(data.latestGwWinners) ? new Set(data.latestGwWinners) : data.latestGwWinners) : undefined,
                  webUserIds: data.webUserIds ? (Array.isArray(data.webUserIds) ? new Set(data.webUserIds) : data.webUserIds) : undefined,
                };
              }
              leagueSubmissions = leagueDataCached.leagueSubmissions || {};
            }
          }
        } catch (error) {
          // Error loading league data from cache (non-critical)
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
          liveScores,
          leagueData,
          leagueSubmissions,
          hasCache: true,
        };
      }
    } catch (error) {
      // Error loading from cache (non-critical)
    }
    
    return {
      gw: 1,
      latestGw: null,
      gwPoints: [],
      allGwPoints: [],
      overall: [],
      lastGwRank: null,
      fiveGwRank: null,
      tenGwRank: null,
      seasonRank: null,
      fixtures: [],
      userPicks: {},
      liveScores: {},
      leagueData: {},
      leagueSubmissions: {},
      hasCache: false,
    };
  };
  
  const initialState = loadInitialStateFromCache();
  
  // State initialized from cache
  const [gw, setGw] = useState<number>(initialState.gw);
  const [latestGw, setLatestGw] = useState<number | null>(initialState.latestGw);
  const [gwPoints, setGwPoints] = useState<Array<{user_id: string, gw: number, points: number}>>(initialState.gwPoints);
  const [lastGwRank, setLastGwRank] = useState<{ rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null>(initialState.lastGwRank);
  const [fiveGwRank, setFiveGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(initialState.fiveGwRank ?? null);
  const [tenGwRank, setTenGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(initialState.tenGwRank ?? null);
  const [seasonRank, setSeasonRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(initialState.seasonRank ?? null);
  const [fixtures, setFixtures] = useState<Fixture[]>(initialState.fixtures);
  const [userPicks, setUserPicks] = useState<Record<number, "H" | "D" | "A">>(initialState.userPicks);
  const [liveScoresFromCache] = useState<Record<number, { 
    homeScore: number; 
    awayScore: number; 
    status: string; 
    minute?: number | null;
    goals?: any[] | null;
    red_cards?: any[] | null;
    home_team?: string | null;
    away_team?: string | null;
    result?: "H" | "D" | "A" | null;
  }>>(initialState.liveScores || {});
  const [leagueData, setLeagueData] = useState<Record<string, LeagueDataInternal>>(initialState.leagueData);
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>(initialState.leagueSubmissions);
  
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const [gwResultsVersion, setGwResultsVersion] = useState(0);
  const [basicDataLoading, setBasicDataLoading] = useState(!initialState.hasCache);
  
  // Use centralized hooks
  const { leagues, unreadByLeague, loading: leaguesLoading, refresh: refreshLeagues } = useLeagues({ pageName: 'home' });
  
  // Load game state from cache immediately for instant LIVE detection
  const cachedGameState = useMemo(() => {
    if (!gw) return null;
    try {
      return getCached<GameweekState>(`gameState:${gw}`);
    } catch {
      return null;
    }
  }, [gw]);
  
  const { state: gameState, loading: gameStateLoading } = useGameweekState(gw);
  // Use cached state immediately if available, otherwise use hook state
  const effectiveGameState = cachedGameState ?? gameState;
  
  // Load last GW game state for leaderboards (if different from current GW)
  const _lastGwGameState = useMemo(() => {
    if (!lastGwRank?.gw || lastGwRank.gw === gw) return effectiveGameState;
    try {
      return getCached<GameweekState>(`gameState:${lastGwRank.gw}`);
    } catch {
      return null;
    }
  }, [lastGwRank?.gw, gw, effectiveGameState]);
  void _lastGwGameState; // Suppress unused variable warning
  void _lastGwGameState; // Suppress unused variable warning
  
  // Unified loading state - block render until ALL critical data is ready
  const isLoading = basicDataLoading || leaguesLoading || gameStateLoading;
  const isInApiTestLeague = useMemo(() => leagues.some(l => l.name === 'API Test'), [leagues]);
  
  // Listen for badge updates
  useEffect(() => {
    const handleBadgeUpdate = () => refreshLeagues();
    window.addEventListener('leagueBadgeUpdated', handleBadgeUpdate);
    return () => window.removeEventListener('leagueBadgeUpdated', handleBadgeUpdate);
  }, [refreshLeagues]);
  
  // Validate cached GW (respects user's current_viewing_gw)
  useEffect(() => {
    if (!user?.id) return;
    
    let alive = true;
    (async () => {
      try {
        const cacheKey = `home:basic:${user.id}`;
        const cached = getCached<{ currentGw?: number }>(cacheKey);
        const cachedGw = cached?.currentGw ?? initialState.gw;
        
        const { data: meta, error: metaError } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        if (!alive || metaError) return;
        
        const dbCurrentGw = meta?.current_gw ?? 1;
        
        const { data: prefs } = await supabase
          .from("user_notification_preferences")
          .select("current_viewing_gw")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!alive) return;
        
        const userViewingGw = prefs?.current_viewing_gw ?? (dbCurrentGw > 1 ? dbCurrentGw - 1 : dbCurrentGw);
        const gwToDisplay = userViewingGw < dbCurrentGw ? userViewingGw : dbCurrentGw;
        
        if (cachedGw !== gwToDisplay) {
          removeCached(cacheKey);
          if (cachedGw) {
            removeCached(`home:fixtures:${user.id}:${cachedGw}`);
          }
          setGw(gwToDisplay);
        }
      } catch (error) {
        console.error('[Home] Error validating cached GW:', error);
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, initialState.gw]);

  // Confetti check
  useEffect(() => {
    const checkConfetti = () => {
      const shouldShow = sessionStorage.getItem('showConfettiOnHome') === 'true';
      if (shouldShow) {
        sessionStorage.removeItem('showConfettiOnHome');
        window.scrollTo({ top: 0, behavior: 'instant' });
        setTimeout(() => {
          if (logoContainerRef.current) {
            const logoRect = logoContainerRef.current.getBoundingClientRect();
            const logoCenterX = (logoRect.left + logoRect.width / 2) / window.innerWidth;
            const logoCenterY = (logoRect.top + logoRect.height / 2) / window.innerHeight;
            fireConfettiCannon({ x: logoCenterX, y: logoCenterY });
          } else {
            fireConfettiCannon();
          }
        }, 100);
      }
    };
    
    checkConfetti();
    const timeout = setTimeout(checkConfetti, 100);
    return () => clearTimeout(timeout);
  }, []);

  // Get api_match_ids for live scores subscription
  const apiMatchIds = useMemo(() => {
    if (!fixtures?.length) return [];
    return fixtures.map(f => f.api_match_id).filter((id): id is number => id !== null && id !== undefined);
  }, [fixtures]);

  // Load live scores from cache synchronously (don't depend on fixtures - load immediately)
  const cachedLiveScoresMap = useMemo(() => {
    if (!user?.id || !gw) return new Map();
    
    try {
      const fixturesCacheKey = `home:fixtures:${user.id}:${gw}`;
      const cached = getCached<{
        fixtures: Fixture[];
        userPicks: Record<number, "H" | "D" | "A">;
        liveScores?: Array<{ api_match_id: number; [key: string]: any }>;
      }>(fixturesCacheKey);
      
      if (cached?.liveScores?.length) {
        const map = new Map();
        cached.liveScores.forEach((score: any) => {
          if (score.api_match_id) {
            map.set(score.api_match_id, score);
          }
        });
        return map;
      }
    } catch (error) {
      // Error loading live scores from cache (non-critical)
    }
    return new Map();
  }, [user?.id, gw]); // Remove fixtures dependency - load immediately

  // Subscribe to real-time live scores
  const { liveScores: liveScoresMapFromHook } = useLiveScores(
    gw,
    apiMatchIds.length > 0 ? apiMatchIds : undefined
  );

  // Merge cached live scores with hook's live scores
  // Prioritize cached data for instant display - cached data shows immediately, hook updates in background
  const liveScoresMap = useMemo(() => {
    // Always start with cached data first (available synchronously on mount)
    const merged = new Map(cachedLiveScoresMap);
    
    // Only merge hook data if it has content (don't overwrite with empty Map)
    // This ensures cached data displays instantly, then hook updates merge in
    if (liveScoresMapFromHook.size > 0) {
    liveScoresMapFromHook.forEach((score, apiMatchId) => {
      merged.set(apiMatchId, score);
    });
    }
    
    return merged;
  }, [cachedLiveScoresMap, liveScoresMapFromHook]);

  // Cache live scores when available
  useEffect(() => {
    if (!user?.id || !fixtures.length || !liveScoresMap.size || !gw) return;
    
    const fixturesCacheKey = `home:fixtures:${user.id}:${gw}`;
    try {
      const existing = getCached<{
        fixtures: Fixture[];
        userPicks: Record<number, "H" | "D" | "A">;
        liveScores?: Array<any>;
      }>(fixturesCacheKey);
      
      if (existing) {
        const liveScoresArray: Array<any> = [];
        liveScoresMap.forEach((score) => {
          liveScoresArray.push(score);
        });
        
        setCached(fixturesCacheKey, {
          ...existing,
          liveScores: liveScoresArray.length > 0 ? liveScoresArray : undefined,
        }, CACHE_TTL.HOME);
      }
    } catch (error) {
      // Error caching live scores (non-critical)
    }
  }, [user?.id, fixtures, liveScoresMap, gw]);
  
  // Load results from cache immediately, then refresh in background
  const [gwResults, setGwResults] = useState<Record<number, "H" | "D" | "A">>(() => {
    if (!gw) return {};
    try {
      const cached = getCached<Array<{ fixture_index: number; result: "H" | "D" | "A" }>>(`home:gwResults:${gw}`);
      if (cached) {
        const resultsMap: Record<number, "H" | "D" | "A"> = {};
        cached.forEach((r) => {
          if (r.result === "H" || r.result === "D" || r.result === "A") {
            resultsMap[r.fixture_index] = r.result;
          }
        });
        return resultsMap;
      }
    } catch {
      // Ignore cache errors
    }
    return {};
  });
  
  useEffect(() => {
    if (!gw || !fixtures.length) {
      setGwResults({});
      return;
    }
    
    const hasNonApiFixtures = fixtures.some(f => !f.api_match_id);
    if (!hasNonApiFixtures) {
      setGwResults({});
      return;
    }
    
    // Check cache first
    const cacheKey = `home:gwResults:${gw}`;
    const cached = getCached<Array<{ fixture_index: number; result: "H" | "D" | "A" }>>(cacheKey);
    if (cached) {
      const resultsMap: Record<number, "H" | "D" | "A"> = {};
      cached.forEach((r) => {
        if (r.result === "H" || r.result === "D" || r.result === "A") {
          resultsMap[r.fixture_index] = r.result;
        }
      });
      setGwResults(resultsMap);
      
      // Check if cache is stale for background refresh
      const cacheTimestamp = getCacheTimestamp(cacheKey);
      const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
      const isCacheStale = cacheAge > 5 * 60 * 1000; // 5 minutes
      
      if (!isCacheStale) return; // Cache is fresh, skip fetch
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
          const resultsArray: Array<{ fixture_index: number; result: "H" | "D" | "A" }> = [];
          results.forEach((r: { fixture_index: number; result: "H" | "D" | "A" | null }) => {
            if (r.result === "H" || r.result === "D" || r.result === "A") {
              resultsMap[r.fixture_index] = r.result;
              resultsArray.push({ fixture_index: r.fixture_index, result: r.result });
            }
          });
          setGwResults(resultsMap);
          
          // Cache results
          setCached(cacheKey, resultsArray, CACHE_TTL.HOME);
        }
      } catch (error) {
        // Error fetching results (non-critical)
      }
    })();
    
    return () => { alive = false; };
  }, [gw, fixtures]);

  // Merge live scores: start with cached data (from initialState), then merge hook updates
  // liveScoresFromCache state already contains data loaded synchronously from cache
  const liveScores = useMemo(() => {
    // Start with cached data (available immediately on mount)
    const result: Record<number, { 
      homeScore: number; 
      awayScore: number; 
      status: string; 
      minute?: number | null;
      goals?: any[] | null;
      red_cards?: any[] | null;
      home_team?: string | null;
      away_team?: string | null;
      result?: "H" | "D" | "A" | null;
    }> = { ...liveScoresFromCache };
    
    // Merge in real-time updates from hook (background refresh)
    if (fixtures?.length && liveScoresMap.size > 0) {
    for (const fixture of fixtures) {
      if (fixture.api_match_id) {
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
          // Handle non-API fixtures with gwResults
        const resultValue = gwResults[fixture.fixture_index];
        if (resultValue) {
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
    }
    
    return result;
  }, [liveScoresFromCache, liveScoresMap, fixtures, gwResults]);

  // Fetch basic data (only if cache is missing - NOT if stale)
  useEffect(() => {
    if (!user?.id || initialState.hasCache) return; // Skip if we have cache
    
    let alive = true;
    const cacheKey = `home:basic:${user.id}`;
    
    (async () => {
      try {
        const fetchTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Data fetch timed out')), 15000);
        });
        
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
        
        const currentGw = metaResult.data?.current_gw ?? 1;
        const newLatestGw = latestGwResult.data?.gw ?? currentGw;
        
        setGw(currentGw);
        setLatestGw(newLatestGw);
        
        let allPoints: Array<{user_id: string, gw: number, points: number}> = [];
        let lastGwRankData: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null = null;
        
        if (!allGwPointsResult.error) {
          allPoints = (allGwPointsResult.data as Array<{user_id: string, gw: number, points: number}>) ?? [];
          setGwPoints(allPoints.filter(gp => gp.user_id === user.id));
          lastGwRankData = calculateLastGwRank(user.id, newLatestGw, allPoints);
          if (lastGwRankData) setLastGwRank(lastGwRankData);
        }
        
        let overallData: Array<{user_id: string, name: string | null, ocp: number | null}> = [];
        if (!overallResult.error) {
          overallData = (overallResult.data as Array<{user_id: string, name: string | null, ocp: number | null}>) ?? [];
        }
        
        const fiveGwRankData = newLatestGw >= 5 
          ? calculateFormRank(user.id, newLatestGw - 4, newLatestGw, allPoints, overallData)
          : null;
        const tenGwRankData = newLatestGw >= 10
          ? calculateFormRank(user.id, newLatestGw - 9, newLatestGw, allPoints, overallData)
          : null;
        const seasonRankData = calculateSeasonRank(user.id, overallData);

        if (alive) {
          setFiveGwRank(fiveGwRankData);
          setTenGwRank(tenGwRankData);
          setSeasonRank(seasonRankData);
        }

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
        } catch (cacheError) {
          // Failed to cache (non-critical)
        }
        
        setBasicDataLoading(false);
      } catch (error: any) {
        console.error('[Home] Error fetching data:', error);
        if (alive) setBasicDataLoading(false);
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, initialState.hasCache]);
  
  // Background refresh for stale cache (non-blocking, no loading state)
  useEffect(() => {
    if (!user?.id || !initialState.hasCache) return; // Only refresh if we had cache
    
    let alive = true;
    const cacheKey = `home:basic:${user.id}`;
    const cacheTimestamp = getCacheTimestamp(cacheKey);
    const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
    const isCacheStale = cacheAge > 5 * 60 * 1000; // 5 minutes
    
    if (!isCacheStale) return; // Cache is fresh, no refresh needed
    
    // Background refresh (silent, no loading state)
    (async () => {
      try {
        const [latestGwResult, metaResult, allGwPointsResult, overallResult] = await Promise.all([
          supabase.from("app_gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("app_meta").select("current_gw").eq("id", 1).maybeSingle(),
          supabase.from("app_v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
          supabase.from("app_v_ocp_overall").select("user_id, name, ocp")
        ]);
        
        if (!alive) return;
        
        const currentGw = metaResult.data?.current_gw ?? 1;
        const newLatestGw = latestGwResult.data?.gw ?? currentGw;
        
        const allPoints = (allGwPointsResult.data as Array<{user_id: string, gw: number, points: number}>) ?? [];
        const overallData = (overallResult.data as Array<{user_id: string, name: string | null, ocp: number | null}>) ?? [];
        
        const lastGwRankData = calculateLastGwRank(user.id, newLatestGw, allPoints);
        const fiveGwRankData = newLatestGw >= 5 
          ? calculateFormRank(user.id, newLatestGw - 4, newLatestGw, allPoints, overallData)
          : null;
        const tenGwRankData = newLatestGw >= 10
          ? calculateFormRank(user.id, newLatestGw - 9, newLatestGw, allPoints, overallData)
          : null;
        const seasonRankData = calculateSeasonRank(user.id, overallData);
        
        // Update state silently
        setLatestGw(newLatestGw);
        setGwPoints(allPoints.filter(gp => gp.user_id === user.id));
        setLastGwRank(lastGwRankData);
        setFiveGwRank(fiveGwRankData);
        setTenGwRank(tenGwRankData);
        setSeasonRank(seasonRankData);
        
        // Update cache
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
        } catch (cacheError) {
          // Failed to cache (non-critical)
        }
      } catch (error) {
        // Silent fail for background refresh
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, initialState.hasCache]);

  // Subscribe to app_meta changes
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
            const cacheKey = `home:basic:${user.id}`;
            removeCached(cacheKey);
            if (oldGw) {
              removeCached(`home:fixtures:${user.id}:${oldGw}`);
            }
            removeCached(`home:fixtures:${user.id}:${newCurrentGw}`);
            setGwResultsVersion(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, gw]);

  // Fetch fixtures and picks (cache-first, only fetch if missing)
  useEffect(() => {
    if (!user?.id || !gw) {
      setFixtures([]);
      setUserPicks({});
      return;
    }
    
    let alive = true;
    const fixturesCacheKey = `home:fixtures:${user.id}:${gw}`;
    
    (async () => {
      try {
        const cached = getCached<{
          fixtures: Fixture[];
          userPicks: Record<number, "H" | "D" | "A">;
          liveScores?: Array<{ api_match_id: number; [key: string]: any }>;
        }>(fixturesCacheKey);
        
        if (cached?.fixtures?.length) {
          // Cache exists - check if stale
          const cacheTimestamp = getCacheTimestamp(fixturesCacheKey);
          const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
          const isCacheStale = cacheAge > 2 * 60 * 1000; // 2 minutes
          
          // Use cache immediately
          setFixtures(cached.fixtures);
          setUserPicks(cached.userPicks || {});
          
          if (!isCacheStale) return; // Cache is fresh, skip fetch
          
          // Background refresh for stale cache
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
          
          return;
        }
        
        // Cache miss - fetch now
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
          setUserPicks({});
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, gw, liveScoresMap]);
  
  // Fetch league data (cache-first, only fetch if missing)
  useEffect(() => {
    if (!user?.id || !leagues.length || !gw) {
      return;
    }
    
    let alive = true;
    const leagueDataCacheKey = `home:leagueData:v6:${user.id}:${gw}`; // v6: Ensure HP ordering matches /tables
    
    // Check cache first
      const cached = getCached<{
      leagueData: Record<string, any>;
        leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
      }>(leagueDataCacheKey);
      
    if (cached?.leagueData && Object.keys(cached.leagueData).length > 0) {
        const allLeaguesHaveWebUserIds = Object.values(cached.leagueData).every((data: any) => 
          data.webUserIds !== undefined
        );
        
        if (allLeaguesHaveWebUserIds) {
        // Restore Sets from arrays
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
        
        // Check if cache is stale for background refresh
        const cacheTimestamp = getCacheTimestamp(leagueDataCacheKey);
        const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
        const isCacheStale = cacheAge > 5 * 60 * 1000; // 5 minutes
        
        if (!isCacheStale) return; // Cache is fresh, skip fetch
      }
    }
    
    // Fetch league data (cache miss or stale cache - background refresh)
    (async () => {
      try {
        const leagueIds = leagues.map(l => l.id);
        
        const [membersResult, , submissionsResult, resultsResult, , webPicksResult, appPicksResult] = await Promise.all([
          supabase.from("league_members").select("league_id, user_id, users!inner(id, name)").in("league_id", leagueIds),
          supabase.from("league_message_reads").select("league_id, last_read_at").eq("user_id", user.id).in("league_id", leagueIds),
          supabase.from("app_gw_submissions").select("user_id").eq("gw", gw),
          supabase.from("app_gw_results").select("gw, fixture_index, result"),
          supabase.from("app_fixtures").select("gw, fixture_index, home_team, away_team, home_name, away_name, kickoff_time").in("gw", Array.from({ length: Math.min(20, latestGw || 20) }, (_, i) => i + 1)),
          supabase.from("picks").select("user_id, gw, created_at").limit(10000),
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
        
        const allMemberIdsSet = new Set(Object.values(membersByLeague).flat().map(m => m.id));
        const submittedUserIds = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id).filter((id: string) => allMemberIdsSet.has(id)));
        
        // Identify Web users
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
          const [userId, gwStr] = key.split(':');
          const gwNum = parseInt(gwStr, 10);
          if (gwNum !== gw) return;
          const appTime = appPicksEarliest.get(key);
          if (appTime && (webTime.getTime() - appTime.getTime()) < -500) {
            if (allMemberIdsSet.has(userId) && !appTestUserIds.has(userId)) {
              webUserIds.add(userId);
            }
          }
        });
        
        // Fetch picks per league
        const picksPromises = leagues.map(async (league) => {
          const memberIds = (membersByLeague[league.id] ?? []).map(m => m.id);
          if (memberIds.length === 0) return { leagueId: league.id, picks: [] };
          const { data } = await supabase
            .from("app_picks")
            .select("user_id, gw, fixture_index, pick")
            .in("user_id", memberIds);
          return { leagueId: league.id, picks: (data ?? []) as PickRow[] };
        });
        
        const picksResults = await Promise.all(picksPromises);
        
        // Process outcomes
        const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
        (resultsResult.data ?? []).forEach((r: any) => {
          const out = rowToOutcome(r);
          if (out) outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
        });
        
        const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
        
        if (gw && !gwsWithResults.includes(gw)) {
          const currentGwResults = (resultsResult.data ?? []).filter((r: any) => r.gw === gw);
          if (currentGwResults.length > 0) {
            gwsWithResults.push(gw);
            gwsWithResults.sort((a, b) => a - b);
          }
        }
        
        // Process picks
        const picksByLeague = new Map<string, PickRow[]>();
        picksResults.forEach(({ leagueId, picks }) => {
          picksByLeague.set(leagueId, picks);
        });
        
        // Calculate league start GWs
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
              webUserIds: Array.from(memberIds.filter(id => webUserIds.has(id))),
              seasonLeaderName: sortedMembers.length > 0 ? sortedMembers[0].name : null
            };
            return;
          }
          
          const leagueStartGw = leagueStartGws.get(league.id) ?? gw;
          const currentGwFinished = gwsWithResults.includes(gw);
          const allRelevantGws = leagueStartGw === 0 
            ? gwsWithResults 
            : gwsWithResults.filter(g => g >= leagueStartGw);
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
              webUserIds: Array.from(memberIds.filter(id => webUserIds.has(id))),
              seasonLeaderName: sortedMembers.length > 0 ? sortedMembers[0].name : null
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
          
          // Calculate season leader (sorted by OCP descending, then name ascending)
          const sortedByOcp = [...mltRows].sort((a, b) => 
            b.ocp - a.ocp || a.name.localeCompare(b.name)
          );
          const seasonLeaderName = sortedByOcp.length > 0 ? sortedByOcp[0].name : null;
          
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
            webUserIds: leagueWebUserIds,
            seasonLeaderName
          };
        });
        
        if (alive) {
        setLeagueSubmissions(submissionStatus);
        setLeagueData(leagueDataMap);
        
          // Cache the processed data
        try {
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
            // Failed to cache (non-critical)
          }
        }
      } catch (error) {
        // Silent fail for background refresh
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, leagues, gw, gwResultsVersion, latestGw]);
  
  // Subscribe to app_gw_results changes
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('home-gw-results-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_gw_results',
        },
        (_payload) => {
          const cacheKey = `home:basic:${user.id}`;
          try {
            removeCached(cacheKey);
            removeCached(`home:fixtures:${user.id}:${gw}`);
          } catch (e) {
            console.error('[Home] Cache clear failed:', e);
          }
          setGwResultsVersion(prev => prev + 1);
        }
      )
      .subscribe();
    
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

  // Refetch data when gwResultsVersion changes
  useEffect(() => {
    if (!user?.id || gwResultsVersion === 0) return;
    
    let alive = true;
    
    (async () => {
      try {
        const [latestGwResult, allGwPointsResult] = await Promise.all([
          supabase.from("app_gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("app_v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
        ]);
        
        if (!alive) return;
        
        const newLatestGw = latestGwResult.data?.gw ?? null;
        const allPoints = (allGwPointsResult.data as Array<{user_id: string, gw: number, points: number}>) ?? [];
        
        if (newLatestGw !== null && newLatestGw !== latestGw) {
          setLatestGw(newLatestGw);
        }
        setGwPoints(allPoints.filter(gp => gp.user_id === user.id));
        
        // Recalculate ranks
        const { getCached } = await import("../lib/cache");
        const cacheKey = `home:basic:${user.id}`;
        const cached = getCached<{ overall: Array<{user_id: string, name: string | null, ocp: number | null}> }>(cacheKey);
        const overallData = cached?.overall || [];
        
        const lastGwRankData = calculateLastGwRank(user.id, newLatestGw || latestGw || 1, allPoints);
        const fiveGwRankData = (newLatestGw || latestGw || 1) >= 5 
          ? calculateFormRank(user.id, (newLatestGw || latestGw || 1) - 4, newLatestGw || latestGw || 1, allPoints, overallData)
          : null;
        const tenGwRankData = (newLatestGw || latestGw || 1) >= 10
          ? calculateFormRank(user.id, (newLatestGw || latestGw || 1) - 9, newLatestGw || latestGw || 1, allPoints, overallData)
          : null;
        const seasonRankData = calculateSeasonRank(user.id, overallData);
        
        setLastGwRank(lastGwRankData);
        setFiveGwRank(fiveGwRankData);
        setTenGwRank(tenGwRankData);
        setSeasonRank(seasonRankData);
      } catch (e) {
        console.error('[Home] Error refetching data after results change:', e);
      }
    })();
    
    return () => { alive = false; };
  }, [gwResultsVersion, user?.id, latestGw]);
  
  // Load user submissions from cache immediately, then refresh in background
  const [userSubmissions, setUserSubmissions] = useState<Set<number>>(() => {
    if (!user?.id) return new Set();
    try {
      const cached = getCached<number[]>(`home:userSubmissions:${user.id}`);
      return cached ? new Set(cached) : new Set();
    } catch {
      return new Set();
    }
  });
  
  useEffect(() => {
    if (!user?.id) {
      setUserSubmissions(new Set());
      return;
    }
    
    // Check cache first
    const cached = getCached<number[]>(`home:userSubmissions:${user.id}`);
    if (cached) {
      setUserSubmissions(new Set(cached));
    }
    
    let alive = true;
    const loadSubmissions = async () => {
      const { data: submissions } = await supabase
        .from('app_gw_submissions')
        .select('gw')
        .eq('user_id', user.id)
        .order('gw', { ascending: false });
      
      if (alive && submissions) {
        const gws = submissions.map((s: any) => s.gw);
        setUserSubmissions(new Set(gws));
        // Update cache
        setCached(`home:userSubmissions:${user.id}`, gws, CACHE_TTL.HOME);
      }
    };
    
    // Only fetch if cache is missing or stale (background refresh)
    if (!cached) {
    loadSubmissions();
    } else {
      // Background refresh for stale cache
      const cacheTimestamp = getCacheTimestamp(`home:userSubmissions:${user.id}`);
      const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
      const isCacheStale = cacheAge > 5 * 60 * 1000; // 5 minutes
      if (isCacheStale) {
        loadSubmissions();
      }
    }
    
    const handleSubmission = () => {
      if (alive) loadSubmissions();
    };
    
    window.addEventListener('predictionsSubmitted', handleSubmission);
    
    return () => {
      alive = false;
      window.removeEventListener('predictionsSubmitted', handleSubmission);
    };
  }, [user?.id, gw]);

  const hasSubmittedCurrentGw = useMemo(() => {
    if (!user?.id || !gw) return false;
    return userSubmissions.has(gw);
  }, [user?.id, gw, userSubmissions]);

  // Calculate score component
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
    
    const isInLiveWindow = effectiveGameState === 'LIVE';
    
    for (const f of fixtures) {
      const liveScore = liveScores[f.fixture_index];
      const pick = userPicks[f.fixture_index];
      const status = liveScore?.status;
      const isActive = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
      
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
          if ((liveScore as any).result) {
            isCorrect = (liveScore as any).result === pick;
          } else {
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
    
    const StartingSoonBadge = () => (
      <div className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[40px] rounded-full bg-amber-500 text-white shadow-md shadow-amber-500/30 self-start">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs sm:text-sm font-medium">Starting soon</span>
      </div>
    );
    
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
          className="flex-shrink-0 px-4 py-2 bg-[#1C8376] text-white rounded-[20px] font-medium flex items-center gap-1"
        >
          Go
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    );
    
    if (!hasAnyActive && hasStartingSoonFixtures && !isInLiveWindow) {
      const hasSubmitted = hasSubmittedCurrentGw;
      return hasSubmitted ? <StartingSoonBadge /> : <MakePredictionsCTA />;
    }
    
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
  }, [isInApiTestLeague, fixtures, liveScores, userPicks, hasSubmittedCurrentGw, effectiveGameState, gameStateLoading]);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _userStreakData = useMemo(() => {
    if (!user?.id || !latestGw) return null;
    
    const userGwPoints = gwPoints.filter(gp => gp.user_id === user.id).sort((a, b) => b.gw - a.gw);
    
    let streak = 0;
    let expectedGw = latestGw;
    const userGwPointsSet = new Set(userGwPoints.map(gp => gp.gw));
    
    while (expectedGw >= 1) {
      const hasPoints = userGwPointsSet.has(expectedGw);
      const hasSubmission = userSubmissions.has(expectedGw);
      
      if (hasPoints || hasSubmission) {
        streak++;
        expectedGw--;
      } else {
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
  void _userStreakData; // Suppress unused variable warning
  
  // Calculate live scores for leaderboards from cached data (instant display)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _currentGwLiveScore = useMemo(() => {
    if (!gw || effectiveGameState !== 'LIVE' || !user?.id) return null;
    
    try {
      const fixturesCacheKey = `home:fixtures:${user.id}:${gw}`;
      const cached = getCached<{
        fixtures: any[];
        userPicks: Record<number, "H" | "D" | "A">;
        liveScores?: Array<{ api_match_id: number; fixture_index?: number; gw: number; status: string; home_score: number; away_score: number; [key: string]: any }>;
      }>(fixturesCacheKey);
      
      if (cached?.liveScores?.length && cached?.userPicks && cached?.fixtures?.length) {
        const outcomes = new Map<number, "H" | "D" | "A">();
        
        cached.liveScores.forEach((liveScore) => {
          if (liveScore.gw === gw) {
            if (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED') {
              const fixtureIndex = liveScore.fixture_index;
              if (fixtureIndex !== undefined && liveScore.home_score !== null && liveScore.away_score !== null) {
                let outcome: "H" | "D" | "A";
                if (liveScore.home_score > liveScore.away_score) {
                  outcome = "H";
                } else if (liveScore.home_score < liveScore.away_score) {
                  outcome = "A";
                } else {
                  outcome = "D";
                }
                outcomes.set(fixtureIndex, outcome);
              }
            }
          }
        });
        
        if (outcomes.size === 0) return null;
        
        let score = 0;
        Object.entries(cached.userPicks).forEach(([fixtureIndexStr, pick]) => {
          const fixtureIndex = parseInt(fixtureIndexStr, 10);
          const outcome = outcomes.get(fixtureIndex);
          if (outcome && pick === outcome) {
            score++;
          }
        });
        
        return { score, totalFixtures: cached.fixtures.length };
      }
    } catch (error) {
      // Error loading from cache (non-critical)
    }
    return null;
  }, [gw, effectiveGameState, user?.id]);
  void _currentGwLiveScore; // Suppress unused variable warning
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _lastGwLiveScore = useMemo(() => {
    if (!lastGwRank?.gw || !lastGwRank || effectiveGameState !== 'LIVE' || !user?.id) return null;
    
    try {
      const fixturesCacheKey = `home:fixtures:${user.id}:${lastGwRank.gw}`;
      const cached = getCached<{
        fixtures: any[];
        userPicks: Record<number, "H" | "D" | "A">;
        liveScores?: Array<{ api_match_id: number; fixture_index?: number; gw: number; status: string; home_score: number; away_score: number; [key: string]: any }>;
      }>(fixturesCacheKey);
      
      if (cached?.liveScores?.length && cached?.userPicks) {
        const outcomes = new Map<number, "H" | "D" | "A">();
        
        cached.liveScores.forEach((liveScore) => {
          if (liveScore.gw === lastGwRank.gw) {
            if (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED') {
              const fixtureIndex = liveScore.fixture_index;
              if (fixtureIndex !== undefined && liveScore.home_score !== null && liveScore.away_score !== null) {
                let outcome: "H" | "D" | "A";
                if (liveScore.home_score > liveScore.away_score) {
                  outcome = "H";
                } else if (liveScore.home_score < liveScore.away_score) {
                  outcome = "A";
                } else {
                  outcome = "D";
                }
                outcomes.set(fixtureIndex, outcome);
              }
            }
          }
        });
        
        if (outcomes.size === 0) return null;
        
        let score = 0;
        Object.entries(cached.userPicks).forEach(([fixtureIndexStr, pick]) => {
          const fixtureIndex = parseInt(fixtureIndexStr, 10);
          const outcome = outcomes.get(fixtureIndex);
          if (outcome && pick === outcome) {
            score++;
          }
        });
        
        return { score, totalFixtures: lastGwRank.totalFixtures };
      }
    } catch (error) {
      // Error loading from cache (non-critical)
    }
    return null;
  }, [lastGwRank?.gw, lastGwRank, effectiveGameState, user?.id]);
  void _lastGwLiveScore; // Suppress unused variable warning
  
  const fixturesToShow = useMemo(() => {
    // Note: showLiveOnly toggle removed - always show all fixtures
    return fixtures;
  }, [fixtures]);
  
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

  // Only show loading if cache is completely missing (not stale)
  if (isLoading) {
    return (
      <div className="max-w-6xl lg:max-w-[1024px] mx-auto px-4 lg:px-6 pt-2 pb-4 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/assets/Animation/Volley-Keepy-Uppies.gif" 
            alt="Loading..." 
            className="w-24 h-24 mx-auto mb-4"
          />
          <div className="text-slate-500 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl lg:max-w-[1024px] mx-auto px-4 lg:px-6 pt-2 pb-4 min-h-screen relative">
      {/* Logo header */}
      <div ref={logoContainerRef} className="relative mb-4 lg:hidden">
        <ScrollLogo />
      </div>
      
      {/* Mini Leagues */}
          <div className="mt-6">
            <MiniLeaguesSection
              leagues={leagues}
              leagueData={leagueData}
              leagueSubmissions={leagueSubmissions}
              leagueRows={{}}
              unreadByLeague={unreadByLeague}
              leagueDataLoading={false}
              currentGw={gw}
              currentUserId={user?.id}
              gameState={effectiveGameState}
              hideLiveTables={true}
              hidePlayerChips={true}
              showSeasonLeader={true}
            />
          </div>

          {/* LEADERBOARDS */}
          <Section 
            title="Leaderboards" 
            className="mt-6"
            infoTitle="Leaderboards"
            infoDescription={`The leaderboards are where all TOTL players are ranked. Your position is based on OCP (Overall Correct Predictions).

Joined late? No stress — after 5 and 10 weeks you'll show up in the Form leaderboards.

How To Play →`}
          >
            <div className="flex flex-row gap-2 sm:gap-3 lg:gap-4 justify-between items-start w-full mt-4">
              <LeaderboardCircle
                to="/global?tab=lastgw"
                rank={lastGwRank?.rank ?? null}
                total={lastGwRank?.total ?? null}
                label="GW"
                bgColor="bg-blue-500"
                gw={lastGwRank?.gw ?? null}
              />
              <LeaderboardCircle
                to="/global?tab=form5"
                rank={fiveGwRank?.rank ?? null}
                total={fiveGwRank?.total ?? null}
                label="5 Form"
                bgColor="bg-emerald-500"
              />
              <LeaderboardCircle
                to="/global?tab=form10"
                rank={tenGwRank?.rank ?? null}
                total={tenGwRank?.total ?? null}
                label="10 Form"
                bgColor="bg-teal-500"
              />
              <LeaderboardCircle
                to="/global?tab=overall"
                rank={seasonRank?.rank ?? null}
                total={seasonRank?.total ?? null}
                label="Overall"
                bgColor="bg-[#1C8376]"
              />
            </div>
          </Section>

      {/* Games */}
          <div className="mt-6">
            <GamesSection
              isInApiTestLeague={isInApiTestLeague}
              fixtures={fixtures}
              fixtureCards={fixtureCards}
              hasLiveGames={hasLiveGames}
              showLiveOnly={false}
              onToggleLiveOnly={() => {}}
              scoreComponent={scoreComponent}
              fixturesLoading={false}
              hasCheckedCache={true}
              currentGw={gw}
              showPickButtons={hasSubmittedCurrentGw}
              userPicks={userPicks}
              liveScores={liveScores}
              userName={user?.user_metadata?.display_name || user?.email || 'User'}
              globalRank={seasonRank?.rank}
              hasSubmitted={hasSubmittedCurrentGw}
            />
          </div>

          {/* Bottom padding */}
          <div className="h-20"></div>
    </div>
  );
}
