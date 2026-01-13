import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import ScrollLogo from "../components/ScrollLogo";
import { LeaderboardsSection } from "../components/LeaderboardsSection";
import { MiniLeaguesSection } from "../components/MiniLeaguesSection";
import { GamesSection } from "../components/GamesSection";
import type { Fixture as FixtureCardFixture, LiveScore as FixtureCardLiveScore } from "../components/FixtureCard";
import { useLiveScores } from "../hooks/useLiveScores";
import { getCached, setCached, removeCached, getCacheTimestamp, CACHE_TTL } from "../lib/cache";
import { useLeagues } from "../hooks/useLeagues";
import { fireConfettiCannon } from "../lib/confettiCannon";
import { useGameweekState } from "../hooks/useGameweekState";
import { useCurrentGameweek } from "../hooks/useCurrentGameweek";
import type { GameweekState } from "../lib/gameweekState";
import GameweekResultsModal from "../components/GameweekResultsModal";
import { loadHomePageData } from "../lib/loadHomePageData";
import { calculateFormRank, calculateLastGwRank, calculateSeasonRank } from "../lib/helpers";

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
};

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

/**
 * HomePage - Main dashboard showing leaderboards, mini leagues, and games
 * 
 * LOADING STRATEGY:
 * - Load ALL data from cache synchronously on mount (zero loading if cache exists)
 * - Only show loading if cache is completely missing (not stale)
 * - Background refresh for stale cache (non-blocking)
 * - All data sources use cache-first approach
 */
export default function HomePage() {
  const { user } = useAuth();
  
  // Load initial state from cache synchronously (happens before first render)
  const loadInitialStateFromCache = () => {
    // CRITICAL: Only use user?.id from AuthContext - never fall back to localStorage
    // This ensures we don't load cache from a different user
    const userId: string | undefined = user?.id;
    
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
      // CRITICAL: Check user's viewing GW preference FIRST (pre-loaded by initialDataLoader)
      // This determines which GW the user is actually viewing (may be different from current GW)
      let userViewingGw: number | null = null;
      try {
        const prefsCache = getCached<{ current_viewing_gw: number | null }>(`user_notification_prefs:${userId}`);
        userViewingGw = prefsCache?.current_viewing_gw ?? null;
      } catch (e) {
        // Ignore cache errors
      }
      
      // Get current GW from cache (pre-loaded by initialDataLoader)
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
      
      // Determine which GW to display (user's viewing GW, or current GW if not set)
      const dbCurrentGw = cached?.currentGw ?? 1;
      const gwToDisplay = userViewingGw !== null && userViewingGw < dbCurrentGw 
        ? userViewingGw 
        : dbCurrentGw;
      
      if (cached && dbCurrentGw) {
        // Load fixtures from cache for the GW the user is viewing (not necessarily current GW)
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
        const fixturesCacheKey = `home:fixtures:${userId}:${gwToDisplay}`;
        
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
        let leaguePicks: Record<string, Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }>> = {};
        let leagueSubmissionsSet: Record<string, Set<string>> = {};
        let leagueRows: Record<string, Array<{ user_id: string; name: string; score: number; unicorns: number }>> = {};
        const leagueDataCacheKey = `home:leagueData:${userId}:${cached.currentGw}`;
        
        try {
          const leagueDataCached = getCached<{
            leagueData: Record<string, any>;
            leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
            leaguePicks?: Record<string, Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }>>;
            leagueSubmissionsSet?: Record<string, string[]>;
            leagueRows?: Record<string, Array<{ user_id: string; name: string; score: number; unicorns: number }>>;
          }>(leagueDataCacheKey);
          
          if (leagueDataCached?.leagueData) {
            // Check if all leagues have members (data is complete)
            const allLeaguesHaveMembers = Object.values(leagueDataCached.leagueData).every((data: any) => 
              data.members && Array.isArray(data.members) && data.members.length > 0
            );
            
            if (allLeaguesHaveMembers) {
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
              leaguePicks = leagueDataCached.leaguePicks || {};
              leagueRows = leagueDataCached.leagueRows || {};
              
              // Restore leagueSubmissionsSet from arrays
              if (leagueDataCached.leagueSubmissionsSet) {
                for (const [leagueId, userIds] of Object.entries(leagueDataCached.leagueSubmissionsSet)) {
                  leagueSubmissionsSet[leagueId] = new Set(userIds);
                }
              }
            }
          }
        } catch (error) {
          // Error loading league data from cache (non-critical)
        }
        
        return {
          gw: gwToDisplay, // Use viewing GW, not cached.currentGw
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
          leaguePicks,
          leagueSubmissionsSet,
          leagueRows,
          hasCache: fixtures.length > 0, // Only has cache if fixtures loaded successfully
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
  
  // Initialize ALL state synchronously from cache (happens before first render - zero loading if cache exists)
  const initialState = loadInitialStateFromCache();
  
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
  const [leagueRows, setLeagueRows] = useState<Record<string, Array<{ user_id: string; name: string; score: number; unicorns: number }>>>(initialState.leagueRows || {});
  
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const [gwResultsVersion, setGwResultsVersion] = useState(0);
  
  // Determine if we have cache (check if fixtures are loaded from cache)
  const hasCache = initialState.hasCache && fixtures.length > 0;
  const [basicDataLoading, setBasicDataLoading] = useState(!hasCache);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsModalGw, setResultsModalGw] = useState<number | null>(null);
  const [resultsModalLoading, setResultsModalLoading] = useState(false);
  
  // Use centralized hook for current gameweek (single source of truth)
  const { currentGw: dbCurrentGw } = useCurrentGameweek();
  
  // Use centralized hooks
  // Skip initial fetch if we have cache (leagues are pre-loaded)
  // Check cache synchronously (before useLeagues hook) to ensure skipInitialFetch is set correctly
  const hasLeaguesCache = (() => {
    if (!user?.id) return false;
    try {
      const cached = getCached<any[]>(`leagues:${user.id}`);
      return cached !== null && cached.length > 0;
    } catch {
      return false;
    }
  })();
  const { leagues, unreadByLeague, refresh: refreshLeagues, loading: leaguesLoading } = useLeagues({ 
    pageName: 'home',
    skipInitialFetch: hasLeaguesCache // Skip fetch if cache exists - data already loaded synchronously
  });
  
  // Load game state from cache immediately for instant LIVE detection
  const cachedGameState = useMemo(() => {
    if (!gw) return null;
    try {
      return getCached<GameweekState>(`gameState:${gw}`);
    } catch {
      return null;
    }
  }, [gw]);
  
  const { state: gameState } = useGameweekState(gw ?? null);
  // Use cached state immediately if available, otherwise use hook state
  const effectiveGameState = cachedGameState ?? gameState;
  
  // Load last GW game state for leaderboards (if different from current GW)
  const lastGwGameState = useMemo(() => {
    if (!lastGwRank?.gw || lastGwRank.gw === gw) return effectiveGameState;
    try {
      return getCached<GameweekState>(`gameState:${lastGwRank.gw}`);
    } catch {
      return null;
    }
  }, [lastGwRank?.gw, gw, effectiveGameState]);
  
  // Unified loading state - only block if we have NO data
  const isLoading = basicDataLoading && fixtures.length === 0;
  const isInApiTestLeague = useMemo(() => leagues.some(l => l.name === 'API Test'), [leagues]);
  
  // Listen for badge updates
  useEffect(() => {
    const handleBadgeUpdate = () => refreshLeagues();
    window.addEventListener('leagueBadgeUpdated', handleBadgeUpdate);
    return () => window.removeEventListener('leagueBadgeUpdated', handleBadgeUpdate);
  }, [refreshLeagues]);
  
  // Validate cached GW (respects user's current_viewing_gw)
  // CRITICAL: Only run if fixtures are missing (cache miss) - don't run if we have cache
  // Update displayed GW when dbCurrentGw changes (from useCurrentGameweek hook)
  useEffect(() => {
    if (!user?.id || !dbCurrentGw) return;
    
    // Check user's viewing GW preference
    const prefsCache = getCached<{ current_viewing_gw: number | null }>(`user_notification_prefs:${user.id}`);
    const userViewingGw = prefsCache?.current_viewing_gw ?? (dbCurrentGw > 1 ? dbCurrentGw - 1 : dbCurrentGw);
    const gwToDisplay = userViewingGw < dbCurrentGw ? userViewingGw : dbCurrentGw;
    
    // Only update if different
    if (gw !== gwToDisplay) {
      setGw(gwToDisplay);
    }
  }, [user?.id, dbCurrentGw, gw]);
  
  // Listen for GW changes from useCurrentGameweek hook
  useEffect(() => {
    const handleGwChange = (event: CustomEvent<{ oldGw: number | null; newGw: number }>) => {
      if (!user?.id) return;
      
      const { oldGw, newGw } = event.detail;
      console.log(`[Home] GW changed from ${oldGw} to ${newGw}, invalidating caches`);
      
      // Invalidate related caches
      const cacheKey = `home:basic:${user.id}`;
      removeCached(cacheKey);
      if (oldGw) {
        removeCached(`home:fixtures:${user.id}:${oldGw}`);
      }
      removeCached(`home:fixtures:${user.id}:${newGw}`);
      setGwResultsVersion(prev => prev + 1);
      
      // Update displayed GW
      const prefsCache = getCached<{ current_viewing_gw: number | null }>(`user_notification_prefs:${user.id}`);
      const userViewingGw = prefsCache?.current_viewing_gw ?? (newGw > 1 ? newGw - 1 : newGw);
      const gwToDisplay = userViewingGw < newGw ? userViewingGw : newGw;
      setGw(gwToDisplay);
    };
    
    window.addEventListener('currentGwChanged', handleGwChange as EventListener);
    return () => {
      window.removeEventListener('currentGwChanged', handleGwChange as EventListener);
    };
  }, [user?.id]);

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
  // Use ref to store previous map to prevent unnecessary re-renders
  const cachedLiveScoresMapPrevRef = useRef<Map<number, any>>(new Map());
  const cachedLiveScoresMap = useMemo(() => {
    if (!user?.id || !gw) {
      if (cachedLiveScoresMapPrevRef.current.size === 0) return cachedLiveScoresMapPrevRef.current;
      cachedLiveScoresMapPrevRef.current = new Map();
      return new Map();
    }
    
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
        
        // Only return new Map if content actually changed
        if (map.size !== cachedLiveScoresMapPrevRef.current.size ||
            Array.from(map.keys()).some(key => 
              JSON.stringify(map.get(key)) !== JSON.stringify(cachedLiveScoresMapPrevRef.current.get(key))
            )) {
          cachedLiveScoresMapPrevRef.current = map;
        return map;
        }
        return cachedLiveScoresMapPrevRef.current;
      }
    } catch (error) {
      // Error loading live scores from cache (non-critical)
    }
    
    if (cachedLiveScoresMapPrevRef.current.size === 0) return cachedLiveScoresMapPrevRef.current;
    cachedLiveScoresMapPrevRef.current = new Map();
    return new Map();
  }, [user?.id, gw]); // Remove fixtures dependency - load immediately

  // Subscribe to real-time live scores
  const { liveScores: liveScoresMapFromHook } = useLiveScores(
    gw,
    apiMatchIds.length > 0 ? apiMatchIds : undefined
  );

  // Merge cached live scores with hook's live scores
  // Prioritize cached data for instant display - cached data shows immediately, hook updates in background
  // Use ref to store previous map to prevent unnecessary re-renders
  const liveScoresMapPrevRef = useRef<Map<number, any>>(new Map());
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
    
    // Only return new Map if content actually changed
    if (merged.size !== liveScoresMapPrevRef.current.size ||
        Array.from(merged.keys()).some(key => 
          JSON.stringify(merged.get(key)) !== JSON.stringify(liveScoresMapPrevRef.current.get(key))
        ) ||
        Array.from(liveScoresMapPrevRef.current.keys()).some(key => !merged.has(key))) {
      liveScoresMapPrevRef.current = merged;
    return merged;
    }
    return liveScoresMapPrevRef.current;
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
    // If we have fixtures from cache, load gw_results from cache only
    if (fixtures.length > 0) {
      if (!gw) return;
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
      }
      return; // Pre-loader loaded everything - no additional fetching
    }
    
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
  // Use ref to prevent re-renders when hook updates with empty data
  const liveScoresPrevRef = useRef<Record<number, any>>({});
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
    
    // Only merge hook updates if they have meaningful data (not just empty Map)
    // This prevents re-renders when hook initializes with empty Map
    if (fixtures?.length && liveScoresMap.size > 0 && liveScoresMap.size > cachedLiveScoresMap.size) {
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
    
    // Only return new object if content actually changed (prevent unnecessary re-renders)
    const resultStr = JSON.stringify(result);
    const prevStr = JSON.stringify(liveScoresPrevRef.current);
    if (resultStr !== prevStr) {
      liveScoresPrevRef.current = result;
    return result;
    }
    return liveScoresPrevRef.current;
  }, [liveScoresFromCache, liveScoresMap, fixtures, gwResults, cachedLiveScoresMap.size]);

  // Track if data load is in progress to prevent race conditions
  const dataLoadInProgressRef = useRef(false);
  
  // Only load data if we don't have cache (fixtures.length === 0 means no cache)
  useEffect(() => {
    console.log('[Home] Data load effect:', { 
      userId: user?.id?.slice(0, 8), 
      gw, 
      fixturesLen: fixtures.length, 
      leaguesLen: leagues.length, 
      leaguesLoading, 
      hasLeaguesCache,
      dataLoadInProgress: dataLoadInProgressRef.current 
    });
    
    if (!user?.id || !gw) return;
    
    // If we already have fixtures AND leagueRows from cache, we're done - pre-loader completed
    // Check if leagueRows has any non-empty arrays (not just keys)
    const hasLeagueRows = Object.values(leagueRows).some(rows => Array.isArray(rows) && rows.length > 0);
    const hasLeagueRowsKeys = Object.keys(leagueRows).length > 0;
    
    console.log('[Home] Checking cache state:', {
      fixturesCount: fixtures.length,
      leagueRowsKeys: Object.keys(leagueRows).length,
      hasLeagueRows,
      hasLeagueRowsKeys,
      leagueRowsSample: Object.entries(leagueRows).slice(0, 2).map(([id, rows]) => ({ id, rowsCount: Array.isArray(rows) ? rows.length : 0 }))
    });
    
    if (fixtures.length > 0 && hasLeagueRows) {
      console.log('[Home] Cache complete, skipping loadHomePageData');
      setBasicDataLoading(false);
      return;
    }
    
    // If we have fixtures but no leagueRows (or empty leagueRows), we need to load data to calculate rows
    if (fixtures.length > 0 && !hasLeagueRows) {
      console.log('[Home] Have fixtures but no leagueRows (or empty rows), loading data...', {
        leaguesCount: leagues.length,
        leagueRowsKeysCount: Object.keys(leagueRows).length
      });
      // Continue to load data below
    }
    
    // CRITICAL: Wait for leagues to finish loading before calling loadHomePageData
    // If leagues are still loading, wait
    if (leaguesLoading) {
      console.log('[Home] Waiting for leagues to load...');
      return; // Still loading from API
    }
    
    // If leagues have finished loading:
    // - If leagues.length > 0: user has leagues, proceed
    // - If leagues.length === 0 AND hasLeaguesCache: user has no leagues (confirmed by cache), proceed
    // - If leagues.length === 0 AND !hasLeaguesCache: still loading or cache doesn't exist, wait
    if (leagues.length === 0 && !hasLeaguesCache) {
      console.log('[Home] No leagues and no cache, waiting...');
      // Still waiting for leagues to load or cache to be populated
      return;
    }
    
    // Prevent duplicate loads - if a load is already in progress, don't start another
    if (dataLoadInProgressRef.current) {
      console.log('[Home] Data load already in progress, skipping');
      return;
    }
    
    // No cache - need to load data
    setBasicDataLoading(true);
    dataLoadInProgressRef.current = true;
    
    // Capture current leagues to use in async function (prevents stale closure issues)
    const currentLeagues = [...leagues];
    const currentGw = gw;
    const currentUserId = user.id;
    
    console.log('[Home] Starting loadHomePageData...', { leagueCount: currentLeagues.length, gw: currentGw });
    
    (async () => {
      try {
        const data = await loadHomePageData(currentUserId, currentLeagues, currentGw);
        
        console.log('[Home] loadHomePageData complete:', { 
          fixturesCount: data.fixtures.length, 
          leagueDataKeys: Object.keys(data.leagueData).length 
        });
        
        // Update ALL state at once - single render
        setLatestGw(data.latestGw);
        setFixtures(data.fixtures);
        setUserPicks(data.userPicks);
        setGwPoints(data.gwPoints);
        setLastGwRank(data.lastGwRank);
        setFiveGwRank(data.fiveGwRank ?? null);
        setTenGwRank(data.tenGwRank ?? null);
        setSeasonRank(data.seasonRank ?? null);
        // Always set league data, even if empty - prevents infinite loading
        setLeagueData(data.leagueData);
        setLeagueSubmissions(data.leagueSubmissions);
        setLeagueRows(data.leagueRows);
        setBasicDataLoading(false);
      } catch (error: any) {
        console.error('[Home] Error loading data:', error);
        setBasicDataLoading(false);
      } finally {
        dataLoadInProgressRef.current = false;
      }
    })();
    
    // No cleanup needed - we use ref to track in-progress state instead of alive flag
    // This prevents race conditions where effect re-runs discard valid data
  }, [user?.id, gw, fixtures.length, leagues.length, leaguesLoading, hasLeaguesCache]);

  // Background refresh is now handled by loadHomePageData (checks cache freshness internally)

  // Note: app_meta subscription is now handled by useCurrentGameweek hook
  // This effect listens to the custom event dispatched by the hook

  // Fixtures and league data are now loaded by unified loadHomePageData function
  
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

  // Refetch data when gwResultsVersion changes (only if no cache from pre-loader)
  useEffect(() => {
    // If we have fixtures from cache, don't refetch
    if (fixtures.length > 0) {
      return;
    }
    
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
  }, [gwResultsVersion, user?.id, latestGw, fixtures.length]);
  
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
  }, [isInApiTestLeague, fixtures, liveScores, userPicks, hasSubmittedCurrentGw, effectiveGameState]);

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

  const userStreakData = useMemo(() => {
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

  // Calculate live scores for leaderboards from cached data (instant display)
  const currentGwLiveScore = useMemo(() => {
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
  
  const lastGwLiveScore = useMemo(() => {
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

  // Determine if we should show the GW results button
  // Show it when the current viewing GW has finished (state is RESULTS_PRE_GW)
  // CRITICAL: This must be called BEFORE any early returns to ensure consistent hook ordering
  // Don't wait for gameStateLoading - use cached state immediately
  const shouldShowGwResultsButton = useMemo(() => {
    if (!gw || !user?.id) return false;
    // Use cached state if available, don't wait for hook to load
    return effectiveGameState === 'RESULTS_PRE_GW';
  }, [gw, user?.id, effectiveGameState]);

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
      
      {/* Gameweek Results Button - Show when current viewing GW has finished */}
      {shouldShowGwResultsButton && (
        <button
          onClick={() => {
            setResultsModalGw(gw);
            setShowResultsModal(true);
            setResultsModalLoading(true);
          }}
          className="w-full mb-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all duration-200 transform active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed"
          disabled={resultsModalLoading}
        >
          <div className="flex items-center justify-between">
            <span className="text-lg whitespace-nowrap">Your Gameweek {gw} Results</span>
            {resultsModalLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white flex-shrink-0 ml-2"></div>
            ) : (
              <svg
                className="w-5 h-5 flex-shrink-0 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </div>
        </button>
      )}
      
          {/* LEADERBOARDS */}
          <LeaderboardsSection
            lastGwRank={lastGwRank}
            fiveGwRank={fiveGwRank}
            tenGwRank={tenGwRank}
            seasonRank={seasonRank}
            userStreakData={userStreakData}
            latestGw={latestGw}
            currentGw={gw}
        effectiveGameState={effectiveGameState}
        lastGwGameState={lastGwGameState}
        currentGwLiveScore={currentGwLiveScore}
        lastGwLiveScore={lastGwLiveScore}
          />

      {/* Mini Leagues and Games */}
          <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
        {/* Mini Leagues */}
            <div className="lg:w-[30%] lg:flex-shrink-0">
              <MiniLeaguesSection
                leagues={leagues}
                leagueData={leagueData}
                leagueSubmissions={leagueSubmissions}
                leagueRows={leagueRows}
                unreadByLeague={unreadByLeague}
            leagueDataLoading={false}
                currentGw={gw}
                currentUserId={user?.id}
            gameState={effectiveGameState}
            fixtures={fixtures}
            gwResults={gwResults}
              />
            </div>

        {/* Games */}
            <div className="lg:w-[70%] lg:flex-shrink-0">
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
          </div>

          {/* Bottom padding */}
          <div className="h-20"></div>
      
      {/* GameweekResultsModal */}
      {showResultsModal && resultsModalGw && (
        <GameweekResultsModal
          isOpen={showResultsModal}
          onClose={() => {
            setShowResultsModal(false);
            setResultsModalGw(null);
            setResultsModalLoading(false);
          }}
          gw={resultsModalGw}
          nextGw={latestGw && latestGw > resultsModalGw ? latestGw : null}
          onLoadingChange={(loading) => {
            setResultsModalLoading(loading);
          }}
        />
      )}
    </div>
  );
}
