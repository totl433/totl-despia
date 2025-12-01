import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import ScrollLogo from "../components/ScrollLogo";
import { LeaderboardsSection } from "../components/LeaderboardsSection";
import { MiniLeaguesSection } from "../components/MiniLeaguesSection";
import { GamesSection } from "../components/GamesSection";
import { LEAGUE_START_OVERRIDES } from "../lib/leagueStart";
import type { Fixture as FixtureCardFixture, LiveScore as FixtureCardLiveScore } from "../components/FixtureCard";
import { useLiveScores } from "../hooks/useLiveScores";
import { getCached, setCached, CACHE_TTL } from "../lib/cache";

// Types
type League = { id: string; name: string; code: string; avatar?: string | null; created_at?: string | null; start_gw?: number | null };
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
    
    if (typeof window === 'undefined' || !userId) {
      return {
        leagues: [],
        gw: 1,
        latestGw: null,
        gwPoints: [],
        allGwPoints: [],
        overall: [],
        lastGwRank: null,
        isInApiTestLeague: false,
        fixtures: [],
        userPicks: {},
        fixturesLoading: true,
        loading: true,
        leagueDataLoading: true,
        leaderboardDataLoading: true,
      };
    }
    
    try {
      if (!userId) {
        return {
          leagues: [],
          gw: 1,
          latestGw: null,
          gwPoints: [],
          allGwPoints: [],
          overall: [],
          lastGwRank: null,
          isInApiTestLeague: false,
          fixtures: [],
          userPicks: {},
          fixturesLoading: true,
          loading: true,
          leagueDataLoading: true,
          leaderboardDataLoading: true,
        };
      }
      
      const cacheKey = `home:basic:${userId}`;
      const cached = getCached<{
        leagues: League[];
        currentGw: number;
        latestGw: number;
        allGwPoints: Array<{user_id: string, gw: number, points: number}>;
        overall: Array<{user_id: string, name: string | null, ocp: number | null}>;
        lastGwRank: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null;
        isInApiTestLeague: boolean;
        testGw?: number;
      }>(cacheKey);
      
      if (cached && cached.leagues && Array.isArray(cached.leagues) && cached.leagues.length > 0) {
        // Load fixtures from cache if available
        let fixtures: Fixture[] = [];
        let userPicks: Record<number, "H" | "D" | "A"> = {};
        let fixturesLoading = true;
        
        if (cached.currentGw) {
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
        }
        
        return {
          leagues: cached.leagues,
          gw: cached.currentGw,
          latestGw: cached.latestGw,
          gwPoints: (cached.allGwPoints || []).filter(gp => gp.user_id === userId),
          allGwPoints: cached.allGwPoints || [],
          overall: cached.overall || [],
          lastGwRank: cached.lastGwRank || null,
          isInApiTestLeague: cached.isInApiTestLeague || false,
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
      leagues: [],
      gw: 1,
      latestGw: null,
      gwPoints: [],
      allGwPoints: [],
      overall: [],
      lastGwRank: null,
      isInApiTestLeague: false,
      fixtures: [],
      userPicks: {},
      fixturesLoading: true,
      loading: true,
      leagueDataLoading: true,
      leaderboardDataLoading: true,
    };
  };
  
  const initialState = loadInitialStateFromCache();
  
  const [leagues, setLeagues] = useState<League[]>(initialState.leagues);
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>({});
  const [gw, setGw] = useState<number>(initialState.gw);
  const [latestGw, setLatestGw] = useState<number | null>(initialState.latestGw);
  const [gwPoints, setGwPoints] = useState<Array<{user_id: string, gw: number, points: number}>>(initialState.gwPoints);
  const [loading, setLoading] = useState(initialState.loading);
  const [leagueDataLoading, setLeagueDataLoading] = useState(initialState.leagueDataLoading);
  const [leaderboardDataLoading, setLeaderboardDataLoading] = useState(initialState.leaderboardDataLoading);
  
  // Leaderboard rankings
  const [lastGwRank, setLastGwRank] = useState<{ rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null>(initialState.lastGwRank);
  const [fiveGwRank, setFiveGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);
  const [tenGwRank, setTenGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);
  const [seasonRank, setSeasonRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);
  
  // Additional data for form calculations
  const [allGwPoints, setAllGwPoints] = useState<Array<{user_id: string, gw: number, points: number}>>(initialState.allGwPoints);
  const [overall, setOverall] = useState<Array<{user_id: string, name: string | null, ocp: number | null}>>(initialState.overall);
  
  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});
  const [leagueData, setLeagueData] = useState<Record<string, LeagueDataInternal>>({});
  const [fixtures, setFixtures] = useState<Fixture[]>(initialState.fixtures);
  const [fixturesLoading, setFixturesLoading] = useState(initialState.fixturesLoading);
  const [isInApiTestLeague, setIsInApiTestLeague] = useState(initialState.isInApiTestLeague);
  const [userPicks, setUserPicks] = useState<Record<number, "H" | "D" | "A">>(initialState.userPicks);
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const fixturesLoadedFromCacheRef = useRef(initialState.fixtures.length > 0);
  const hasCheckedCacheRef = useRef(initialState.fixtures.length > 0 || initialState.isInApiTestLeague);
  
  // Get api_match_ids from fixtures for real-time subscription
  const apiMatchIds = useMemo(() => {
    if (!fixtures?.length) return [];
    const ids: number[] = [];
    for (const f of fixtures) {
      if (f.api_match_id) ids.push(f.api_match_id);
    }
    // Removed console.logs for production performance
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
  const { liveScores: liveScoresMapFromHook } = useLiveScores(
    undefined,
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
    const alreadyLoadedFromCache = leagues.length > 0 && !loading;
    
    if (alreadyLoadedFromCache) {
      // Already loaded from cache, refreshing in background
    } else {
      // No cache found on init, fetching fresh data
      // Only set loading if we didn't load from cache
      setLoading(true);
      setLeaderboardDataLoading(true);
      setLeagueDataLoading(true);
    }
    
    // 2. Fetch fresh data in background
    (async () => {
      try {
        // Parallel fetch: leagues, GW data, points, and overall in one batch
        // App reads from app_* tables (includes both App and mirrored Web users)
        const [membersResult, latestGwResult, metaResult, allGwPointsResult, overallResult] = await Promise.all([
          supabase.from("league_members").select("leagues(id, name, code, avatar, created_at)").eq("user_id", user.id),
          supabase.from("app_gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("app_meta").select("current_gw").eq("id", 1).maybeSingle(),
          supabase.from("app_v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
          supabase.from("app_v_ocp_overall").select("user_id, name, ocp")
        ]);
        
        if (!alive) return;
        
        // Process leagues
        let leaguesData: League[] = [];
        if (membersResult.error) {
          setLeagues([]);
        } else {
          leaguesData = (membersResult.data ?? [])
            .map((m: any) => m.leagues)
            .filter((l: any) => l !== null) as League[];
          setLeagues(leaguesData);
          setIsInApiTestLeague(leaguesData.some(l => l.name === "API Test"));
        }
        
        // Process GW data (always use current GW, ignore test GWs)
        const lastCompletedGw = latestGwResult.data?.gw ?? metaResult.data?.current_gw ?? 1;
        const currentGw = metaResult.data?.current_gw ?? 1;
        setGw(currentGw);
        setLatestGw(currentGw);
        
        // Process GW points
        let allPoints: Array<{user_id: string, gw: number, points: number}> = [];
        let lastGwRankData: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null = null;
        if (allGwPointsResult.error) {
          setAllGwPoints([]);
          setGwPoints([]);
        } else {
          allPoints = (allGwPointsResult.data as Array<{user_id: string, gw: number, points: number}>) ?? [];
          setAllGwPoints(allPoints);
          setGwPoints(allPoints.filter(gp => gp.user_id === user.id));
          
          // Calculate Last GW ranking inline
          const lastGwData = allPoints.filter(gp => gp.gw === lastCompletedGw);
          if (lastGwData.length > 0) {
            const sorted = [...lastGwData].sort((a, b) => b.points - a.points);
            let currentRank = 1;
            const ranked = sorted.map((player, index) => {
              if (index > 0 && sorted[index - 1].points !== player.points) {
                currentRank = index + 1;
              }
              return { ...player, rank: currentRank };
            });
            
            const userEntry = ranked.find(r => r.user_id === user.id);
            if (userEntry) {
              const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
              lastGwRankData = {
                rank: userEntry.rank,
                total: ranked.length,
                score: userEntry.points,
                gw: lastCompletedGw,
                totalFixtures: 10,
                isTied: rankCount > 1
              };
              setLastGwRank(lastGwRankData);
            }
          }
        }
        
        // Process overall rankings
        let overallData: Array<{user_id: string, name: string | null, ocp: number | null}> = [];
        if (overallResult.error) {
          setOverall([]);
        } else {
          overallData = (overallResult.data as Array<{user_id: string, name: string | null, ocp: number | null}>) ?? [];
          setOverall(overallData);
        }
        
        // Cache the processed data for next time
        try {
          setCached(cacheKey, {
            leagues: leaguesData,
            currentGw,
            latestGw: currentGw,
            allGwPoints: allPoints,
            overall: overallData,
            lastGwRank: lastGwRankData,
            isInApiTestLeague: leaguesData.some(l => l.name === "API Test")
          }, CACHE_TTL.HOME);
          // Cached data for next time
        } catch (cacheError) {
          // Failed to cache data (non-critical)
        }
        
        setLoading(false);
        setLeaderboardDataLoading(false);
      } catch (error) {
        if (alive) {
          setLoading(false);
          setLeaderboardDataLoading(false);
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id]);
  
  // Calculate form rankings and season rank - optimized
  // Use refs to track previous values and avoid unnecessary recalculations
  const prevAllGwPointsRef = useRef<string>('');
  const prevOverallRef = useRef<string>('');
  const prevLatestGwRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!user?.id || !latestGw) return;
    
    // If no data yet, set ranks to null and return early
    if (!allGwPoints.length || !overall.length) {
      setFiveGwRank(null);
      setTenGwRank(null);
      setSeasonRank(null);
      return;
    }
    
    // Check if data actually changed to avoid unnecessary recalculations
    const allGwPointsKey = JSON.stringify(allGwPoints.slice(0, 10)); // Sample for comparison
    const overallKey = JSON.stringify(overall.slice(0, 10)); // Sample for comparison
    
    if (
      prevAllGwPointsRef.current === allGwPointsKey &&
      prevOverallRef.current === overallKey &&
      prevLatestGwRef.current === latestGw
    ) {
      return; // Data hasn't changed, skip recalculation
    }
    
    prevAllGwPointsRef.current = allGwPointsKey;
    prevOverallRef.current = overallKey;
    prevLatestGwRef.current = latestGw;
    
    let alive = true;
    
    (async () => {
      try {
        const { data: lastCompletedGwData } = await supabase
          .from("app_gw_results")
          .select("gw")
          .order("gw", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const lastCompletedGw = lastCompletedGwData?.gw ?? latestGw;
        
        // Helper to calculate form rankings
        const calculateFormRank = (startGw: number, endGw: number, setRank: (r: { rank: number; total: number; isTied: boolean } | null) => void) => {
          if (endGw < startGw) return;
          
          const formPoints = allGwPoints.filter(gp => gp.gw >= startGw && gp.gw <= endGw);
          const userData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
          
          overall.forEach(o => {
            userData.set(o.user_id, {
              user_id: o.user_id,
              name: o.name ?? "User",
              formPoints: 0,
              weeksPlayed: new Set()
            });
          });
          
          formPoints.forEach(gp => {
            const user = userData.get(gp.user_id);
            if (user) {
              user.formPoints += gp.points ?? 0;
              user.weeksPlayed.add(gp.gw);
            }
          });
          
          const sorted = Array.from(userData.values())
            .filter(u => {
              for (let g = startGw; g <= endGw; g++) {
                if (!u.weeksPlayed.has(g)) return false;
              }
              return true;
            })
            .sort((a, b) => b.formPoints - a.formPoints || a.name.localeCompare(b.name));
          
          if (sorted.length > 0 && alive) {
            let currentRank = 1;
            const ranked = sorted.map((player, index) => {
              if (index > 0 && sorted[index - 1].formPoints !== player.formPoints) {
                currentRank = index + 1;
              }
              return { ...player, rank: currentRank };
            });
            
            const userEntry = ranked.find(u => u.user_id === user.id);
            if (userEntry) {
              const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
              setRank({
                rank: userEntry.rank,
                total: ranked.length,
                isTied: rankCount > 1
              });
            } else {
              // User doesn't have all required weeks, set to null to show "—"
              setRank(null);
            }
          } else {
            // No users with all required weeks, set to null
            setRank(null);
          }
        };
        
        // 5-WEEK FORM
        if (lastCompletedGw >= 5) {
          calculateFormRank(lastCompletedGw - 4, lastCompletedGw, setFiveGwRank);
        }
        
        // 10-WEEK FORM
        if (lastCompletedGw >= 10) {
          calculateFormRank(lastCompletedGw - 9, lastCompletedGw, setTenGwRank);
        }
        
        // SEASON RANK
        if (overall.length > 0 && alive) {
          const sorted = [...overall].sort((a, b) => (b.ocp ?? 0) - (a.ocp ?? 0) || (a.name ?? "User").localeCompare(b.name ?? "User"));
          let currentRank = 1;
          const ranked = sorted.map((player, index) => {
            if (index > 0 && (sorted[index - 1].ocp ?? 0) !== (player.ocp ?? 0)) {
              currentRank = index + 1;
            }
            return { ...player, rank: currentRank };
          });
          
          const userEntry = ranked.find(o => o.user_id === user.id);
          if (userEntry) {
            const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
            setSeasonRank({
              rank: userEntry.rank,
              total: overall.length,
              isTied: rankCount > 1
            });
          } else {
            // User not found in overall rankings, set to null
            setSeasonRank(null);
          }
        } else {
          // No overall data, set to null
          setSeasonRank(null);
        }
      } catch (e) {
        // Silent fail
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, latestGw, allGwPoints, overall]);

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
        // Convert arrays back to Sets for submittedMembers and latestGwWinners
        const restoredLeagueData: Record<string, LeagueDataInternal> = {};
        for (const [leagueId, data] of Object.entries(cached.leagueData)) {
          restoredLeagueData[leagueId] = {
            ...data,
            submittedMembers: data.submittedMembers ? (Array.isArray(data.submittedMembers) ? new Set(data.submittedMembers) : data.submittedMembers) : undefined,
            latestGwWinners: data.latestGwWinners ? (Array.isArray(data.latestGwWinners) ? new Set(data.latestGwWinners) : data.latestGwWinners) : undefined,
          };
        }
        setLeagueData(restoredLeagueData);
        setLeagueSubmissions(cached.leagueSubmissions || {});
        setLeagueDataLoading(false);
        loadedFromCache = true;
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
        const [membersResult, readsResult, submissionsResult, resultsResult, fixturesResult] = await Promise.all([
          supabase.from("league_members").select("league_id, user_id, users!inner(id, name)").in("league_id", leagueIds),
          supabase.from("league_message_reads").select("league_id, last_read_at").eq("user_id", user.id).in("league_id", leagueIds),
          supabase.from("app_gw_submissions").select("user_id").eq("gw", gw),
          supabase.from("app_gw_results").select("gw, fixture_index, result"),
          supabase.from("app_fixtures").select("gw, kickoff_time").in("gw", Array.from({ length: Math.min(20, latestGw || 20) }, (_, i) => i + 1))
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
        const relevantFixtures = (fixturesResult.data ?? []).filter((f: any) => 
          gwsWithResults.length > 0 ? gwsWithResults.includes(f.gw) : f.gw === 1
        );
        
        // Process unread counts
        const unreadCounts: Record<string, number> = {};
        unreadCountResults.forEach(({ leagueId, count }) => {
          unreadCounts[leagueId] = count;
        });
        setUnreadByLeague(unreadCounts);
        
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
        
        // Calculate league start GWs
        const leagueStartGws = new Map<string, number>();
        leagues.forEach(league => {
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
            for (const g of gwsWithResults) {
              const deadline = gwDeadlines.get(g);
              if (deadline && leagueCreatedAt <= deadline) {
                leagueStartGws.set(league.id, g);
                return;
              }
            }
            if (gwsWithResults.length > 0) {
              leagueStartGws.set(league.id, Math.max(...gwsWithResults) + 1);
              return;
            }
          }
          leagueStartGws.set(league.id, gw);
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
              latestRelevantGw: null
            };
            return;
          }
          
          const leagueStartGw = leagueStartGws.get(league.id) ?? gw;
          const relevantGws = leagueStartGw === 0 
            ? gwsWithResults 
            : gwsWithResults.filter(g => g >= leagueStartGw);
          
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
              latestRelevantGw: null
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
          
          leagueDataMap[league.id] = {
            id: league.id,
            members: sortedMembers,
            userPosition,
            positionChange: null,
            submittedMembers: Array.from(memberIds.filter(id => submittedUserIds.has(id))),
            sortedMemberIds,
            latestGwWinners: Array.from(latestGwWinners),
            latestRelevantGw
          };
        });
        
        setLeagueSubmissions(submissionStatus);
        setLeagueData(leagueDataMap);
        setLeagueDataLoading(false);
        
        // Cache the processed data for next time
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
  }, [user?.id, leagues, gw]);

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

  // Calculate score component - memoized
  const scoreComponent = useMemo(() => {
    if (!fixtures.length) return null;
    
    const hasSubmittedPicks = Object.keys(userPicks).length > 0;
    let score = 0;
    let liveCount = 0;
    let finishedCount = 0;
    let allFinished = true;
    let hasAnyActive = false;
    
    for (const f of fixtures) {
      const liveScore = liveScores[f.fixture_index];
      const pick = userPicks[f.fixture_index];
      const status = liveScore?.status;
      const isActive = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
      
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
    
    if (!hasAnyActive && !hasSubmittedPicks) return null;
    
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
    
    if (!hasAnyActive && hasSubmittedPicks) {
      return <ScoreBadge score="--" label="Score" bgColor="bg-amber-500 shadow-lg shadow-amber-500/30" />;
    }
    
    if (liveCount === 0 && finishedCount > 0 && !allFinished) {
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
          label={allFinished ? 'Score' : 'Live'}
          bgColor={allFinished ? 'bg-slate-600' : 'bg-red-600'}
          icon={
            allFinished ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            ) : liveCount > 0 ? (
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            ) : undefined
          }
        />
      </div>
    );
  }, [isInApiTestLeague, fixtures, liveScores, userPicks]);

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
    if (userGwPoints.length === 0) return null;
    
    let streak = 0;
    let expectedGw = latestGw;
    const userGwSet = new Set(userGwPoints.map(gp => gp.gw));
    
    while (expectedGw >= 1 && userGwSet.has(expectedGw)) {
      streak++;
      expectedGw--;
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
  }, [user?.id, gwPoints, latestGw]);

  // Sort leagues by unread - optimized, and filter out "API Test" league
  const sortedLeagues = useMemo(() => {
    if (!leagues.length) return [];
    return [...leagues]
      .filter(league => league.name !== 'API Test') // Hide API Test league
      .sort((a, b) => {
        const unreadA = unreadByLeague?.[a.id] ?? 0;
        const unreadB = unreadByLeague?.[b.id] ?? 0;
        if (unreadA > 0 && unreadB === 0) return -1;
        if (unreadA === 0 && unreadB > 0) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [leagues, unreadByLeague]);

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
      
      return { fixture: fixtureCardFixture, liveScore: fixtureCardLiveScore, pick: userPicks[f.fixture_index] };
    });
  }, [fixturesToShow, liveScores, userPicks]);

  const isDataReady = !loading && !leaderboardDataLoading && !leagueDataLoading;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-2 pb-4 min-h-screen relative">
      <ScrollLogo />
      
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
          />

          {/* Mini Leagues */}
          <MiniLeaguesSection
            leagues={sortedLeagues}
            leagueData={leagueData}
            leagueSubmissions={leagueSubmissions}
            unreadByLeague={unreadByLeague}
            leagueDataLoading={leagueDataLoading}
            currentGw={gw}
          />

          {/* Games */}
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
          />

          {/* Bottom padding */}
          <div className="h-20"></div>
        </>
      )}
    </div>
  );
}
