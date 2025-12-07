// src/pages/Global.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getCached, setCached, removeCached, CACHE_TTL } from "../lib/cache";
import { useLiveScores } from "../hooks/useLiveScores";

type OverallRow = {
  user_id: string;
  name: string | null;
  ocp: number;
};

type GwPointsRow = {
  user_id: string;
  gw: number;
  points: number;
};

export default function GlobalLeaderboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const userRowRef = useRef<HTMLTableRowElement>(null);
  
  const tabParam = searchParams.get("tab");
  const validTab = (tabParam === "form5" || tabParam === "form10" || tabParam === "lastgw" || tabParam === "overall") 
    ? tabParam 
    : "lastgw";

  // Load initial state from cache synchronously to avoid loading spinner
  const loadInitialStateFromCache = () => {
    try {
      const cacheKey = `global:leaderboard`;
      const cached = getCached<{
        latestGw: number;
        gwPoints: GwPointsRow[];
        overall: OverallRow[];
        prevOcp: Record<string, number>;
      }>(cacheKey);
      
      if (cached && cached.gwPoints && Array.isArray(cached.gwPoints) && cached.gwPoints.length > 0) {
        return {
          loading: false,
          latestGw: cached.latestGw,
          gwPoints: cached.gwPoints,
          overall: cached.overall || [],
          prevOcp: cached.prevOcp || {},
        };
      }
    } catch (error) {
      // Error loading from cache (non-critical)
    }
    
    return {
      loading: true,
      latestGw: null as number | null,
      gwPoints: [] as GwPointsRow[],
      overall: [] as OverallRow[],
      prevOcp: {} as Record<string, number>,
    };
  };
  
  const initialState = loadInitialStateFromCache();
  
  const [loading, setLoading] = useState(initialState.loading);
  const [err, setErr] = useState<string>("");
  const [latestGw, setLatestGw] = useState<number | null>(initialState.latestGw);
  const [overall, setOverall] = useState<OverallRow[]>(initialState.overall);
  const [gwPoints, setGwPoints] = useState<GwPointsRow[]>(initialState.gwPoints);
  const [prevOcp, setPrevOcp] = useState<Record<string, number>>(initialState.prevOcp);
  const [activeTab, setActiveTab] = useState<"overall" | "form5" | "form10" | "lastgw">(validTab);
  // Track gw_results changes to trigger leaderboard recalculation
  const [gwResultsVersion, setGwResultsVersion] = useState(0);
  
  // Get current GW from app_meta for LIVE functionality (only used for lastgw tab)
  const [currentGwFromMeta, setCurrentGwFromMeta] = useState<number | null>(null);
  
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("app_meta").select("current_gw").eq("id", 1).maybeSingle();
      if (alive && data) {
        setCurrentGwFromMeta((data as any)?.current_gw ?? null);
      }
    })();
    return () => { alive = false; };
  }, []);
  
  // For LIVE functionality, use current_gw from meta if it has live scores, otherwise use latestGw
  const liveGw = currentGwFromMeta ?? latestGw;
  
  // Subscribe to live scores for the live GW (only used for lastgw tab)
  const { liveScores: liveScoresMap } = useLiveScores(
    liveGw || undefined,
    undefined // Fetch all live scores for the GW
  );
  
  // Check if current GW is live (has any live scores) - only relevant for lastgw tab
  const isCurrentGwLive = useMemo(() => {
    if (!liveGw || liveScoresMap.size === 0) return false;
    for (const score of liveScoresMap.values()) {
      if (score.gw === liveGw) {
        return true;
      }
    }
    return false;
  }, [liveGw, liveScoresMap]);
  
  // Fetch picks and calculate live scores for current GW
  const [liveCurrentGwPoints, setLiveCurrentGwPoints] = useState<GwPointsRow[]>([]);
  
  useEffect(() => {
    if (!liveGw || !isCurrentGwLive || liveScoresMap.size === 0) {
      setLiveCurrentGwPoints([]);
      return;
    }
    
    let alive = true;
    
    (async () => {
      // Convert live scores to outcomes
      const outcomes = new Map<number, "H" | "D" | "A">();
      liveScoresMap.forEach((liveScore) => {
        if (liveScore.gw === liveGw && liveScore.status === 'FINISHED') {
          const fixtureIndex = liveScore.fixture_index;
          if (liveScore.home_score !== null && liveScore.away_score !== null) {
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
      });
      
      if (outcomes.size === 0) {
        if (alive) setLiveCurrentGwPoints([]);
        return;
      }
      
      // Fetch all picks for current GW
      const { data: allPicks } = await supabase
        .from("app_picks")
        .select("user_id, fixture_index, pick")
        .eq("gw", liveGw);
      
      if (!alive || !allPicks) return;
      
      // Calculate points per user
      // First, initialize all users who have picks (to ensure we include users with 0 points)
      const userPoints = new Map<string, number>();
      const uniqueUserIds = new Set(allPicks.map(p => p.user_id));
      uniqueUserIds.forEach(userId => {
        userPoints.set(userId, 0);
      });
      
      // Then calculate points for correct predictions
      allPicks.forEach((pick) => {
        const outcome = outcomes.get(pick.fixture_index);
        if (outcome && pick.pick === outcome) {
          const current = userPoints.get(pick.user_id) || 0;
          userPoints.set(pick.user_id, current + 1);
        }
      });
      
      // Convert to GwPointsRow format
      const livePoints: GwPointsRow[] = Array.from(userPoints.entries()).map(([user_id, points]) => ({
        user_id,
        gw: liveGw,
        points,
      }));
      
      if (alive) {
        setLiveCurrentGwPoints(livePoints);
      }
    })();
    
    return () => { alive = false; };
  }, [liveGw, isCurrentGwLive, liveScoresMap]);

  // Sync activeTab with URL param and set default to lastgw if no tab specified
  useEffect(() => {
    if (!tabParam) {
      setSearchParams({ tab: "lastgw" }, { replace: true });
    }
    if (validTab !== activeTab) {
      setActiveTab(validTab);
    }
  }, [validTab, tabParam, activeTab, setSearchParams]);

  // Update URL when tab changes
  const handleTabChange = (tab: "overall" | "form5" | "form10" | "lastgw") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    let alive = true;
    const cacheKey = `global:leaderboard`;
    let loadedFromCache = false;
    
    // If we already loaded from cache in initial state, skip cache check here
    // Otherwise check cache again (in case cache was updated)
    if (initialState.loading) {
      try {
        const cached = getCached<{
          latestGw: number;
          gwPoints: GwPointsRow[];
          overall: OverallRow[];
          prevOcp: Record<string, number>;
        }>(cacheKey);
        
        if (cached && cached.gwPoints && Array.isArray(cached.gwPoints) && cached.gwPoints.length > 0) {
          // INSTANT RENDER from cache!
          // Loaded from cache
          setLatestGw(cached.latestGw);
          setGwPoints(cached.gwPoints);
          setOverall(cached.overall || []);
          setPrevOcp(cached.prevOcp || {});
          setLoading(false);
          loadedFromCache = true;
        }
      } catch (error) {
        // If cache is corrupted, just continue with fresh fetch
        // Error loading from cache (non-critical)
      }
    } else {
      loadedFromCache = true; // Already loaded from cache in initial state
    }
    
    // 2. Fetch fresh data in background
    (async () => {
      try {
        // Only set loading state if we didn't load from cache
        if (!loadedFromCache) {
          setLoading(true);
        }
        setErr("");

        // 1) latest GW from results - App reads from app_gw_results
        const { data: latest, error: lErr } = await supabase
          .from("app_gw_results")
          .select("gw")
          .order("gw", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lErr) throw lErr;
        const gw = latest?.gw ?? 1;
        if (alive) setLatestGw(gw);

        // 2) all GW points (needed for form leaderboards) - App reads from app_v_gw_points
        const { data: gp, error: gErr } = await supabase
          .from("app_v_gw_points")
          .select("user_id, gw, points")
          .order("gw", { ascending: true });
        if (gErr) throw gErr;

        // 3) overall - App reads from app_v_ocp_overall
        const { data: ocp, error: oErr } = await supabase
          .from("app_v_ocp_overall")
          .select("user_id, name, ocp");
        if (oErr) throw oErr;

        if (!alive) return;
        setGwPoints((gp as GwPointsRow[]) ?? []);
        setOverall((ocp as OverallRow[]) ?? []);

        // 4) previous OCP totals (up to gw-1) to compute rank movement
        let prevOcpData: Record<string, number> = {};
        if (gw && gw > 1) {
          // Use the already fetched gwPoints data instead of making another query
          const prevList = (gp as GwPointsRow[] | null)?.filter(r => r.gw < gw) ?? [];
          
          const totals: Record<string, number> = {};
          prevList.forEach((r) => {
            totals[r.user_id] = (totals[r.user_id] ?? 0) + (r.points ?? 0);
          });
          prevOcpData = totals;
          if (alive) setPrevOcp(totals);
        } else {
          if (alive) setPrevOcp({});
        }
        
        // Cache the processed data for next time
        try {
          setCached(cacheKey, {
            latestGw: gw,
            gwPoints: (gp as GwPointsRow[]) ?? [],
            overall: (ocp as OverallRow[]) ?? [],
            prevOcp: prevOcpData,
          }, CACHE_TTL.GLOBAL);
          // Cached data for next time
        } catch (cacheError) {
          // Failed to cache data (non-critical)
        }
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load leaderboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gwResultsVersion]);

  /* ---------- Subscribe to app_gw_results changes for real-time leaderboard updates ---------- */
  useEffect(() => {
    // Subscribe to changes in app_gw_results table to trigger leaderboard recalculation
    const channel = supabase
      .channel('global-gw-results-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'app_gw_results',
        },
        () => {
          // Clear cache to force fresh fetch
          const cacheKey = `global:leaderboard`;
          try {
            removeCached(cacheKey);
          } catch (e) {
            // Cache clear failed, non-critical
          }
          // Increment version to trigger recalculation
          setGwResultsVersion(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function ranksFromScores(scores: Record<string, number>): Record<string, number> {
    const ids = Object.keys(scores);
    ids.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a.localeCompare(b));
    const out: Record<string, number> = {};
    ids.forEach((id, i) => (out[id] = i + 1));
    return out;
  }

  const currRanks = useMemo(() => {
    const scores: Record<string, number> = {};
    overall.forEach((o) => {
      scores[o.user_id] = (o.ocp ?? 0);
    });
    // include users who only have this GW points (first-week players)
    gwPoints.forEach((g) => {
      if (!(g.user_id in scores)) scores[g.user_id] = g.points ?? 0;
    });
    return ranksFromScores(scores);
  }, [overall, gwPoints]);

  const prevRanks = useMemo(() => ranksFromScores(prevOcp), [prevOcp]);

  // Helper function to create form rows for a given number of weeks
  const createFormRows = useMemo(() => {
    return (weeks: number) => {
      if (!latestGw || latestGw < weeks) return [];
      
      // Get last N game weeks
      const startGw = latestGw - weeks + 1;
      const formGwPoints = gwPoints.filter(gp => gp.gw >= startGw && gp.gw <= latestGw);
      
      // Group by user and count weeks played
      const userFormData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
      
      // Initialize with users from overall
      overall.forEach(o => {
        userFormData.set(o.user_id, {
          user_id: o.user_id,
          name: o.name ?? "User",
          formPoints: 0,
          weeksPlayed: new Set()
        });
      });
      
      // Add form points and track which weeks each user played
      formGwPoints.forEach(gp => {
        const user = userFormData.get(gp.user_id);
        if (user) {
          user.formPoints += gp.points;
          user.weeksPlayed.add(gp.gw);
        } else {
          userFormData.set(gp.user_id, {
            user_id: gp.user_id,
            name: "User",
            formPoints: gp.points,
            weeksPlayed: new Set([gp.gw])
          });
        }
      });
      
      // Only include players who have played ALL N weeks
      const completeFormPlayers = Array.from(userFormData.values())
        .filter(user => {
          // Check if user played all N weeks
          for (let gw = startGw; gw <= latestGw; gw++) {
            if (!user.weeksPlayed.has(gw)) {
              return false;
            }
          }
          return true;
        })
        .map(user => ({
          user_id: user.user_id,
          name: user.name,
          formPoints: user.formPoints,
          gamesPlayed: weeks // Always N for complete form players
        }))
        .sort((a, b) => (b.formPoints - a.formPoints) || a.name.localeCompare(b.name));
      
      return completeFormPlayers;
    };
  }, [overall, gwPoints, latestGw]);

  // 5 Week Form leaderboard
  const form5Rows = useMemo(() => createFormRows(5), [createFormRows]);
  
  // 10 Week Form leaderboard
  const form10Rows = useMemo(() => createFormRows(10), [createFormRows]);
  
  // Last GW leaderboard - only players who completed the last gameweek
  // Use live scores if current GW is live (single source of truth)
  const lastGwRows = useMemo(() => {
    if (!latestGw) return [];
    
    // Use live scores if available, otherwise use database view
    const lastGwPoints = isCurrentGwLive && liveCurrentGwPoints.length > 0
      ? liveCurrentGwPoints
      : gwPoints.filter(gp => gp.gw === latestGw);
    
    const userMap = new Map(overall.map(o => [o.user_id, o.name ?? "User"]));
    
    const sorted = lastGwPoints
      .map(gp => ({
        user_id: gp.user_id,
        name: userMap.get(gp.user_id) ?? "User",
        points: gp.points,
      }))
      .sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name));
    
    // Add joint ranking
    let currentRank = 1;
    return sorted.map((player, index) => {
      if (index > 0 && sorted[index - 1].points !== player.points) {
        currentRank = index + 1;
      }
      return {
        ...player,
        rank: currentRank,
      };
    });
  }, [gwPoints, latestGw, overall, isCurrentGwLive, liveCurrentGwPoints]);

  const rows = useMemo(() => {
    // Get current GW points only for the Overall tab
    // Overall tab always uses database views (not live scores)
    const currentGwPoints = gwPoints.filter(gp => gp.gw === latestGw);
    const byUserThisGw = new Map<string, number>();
    currentGwPoints.forEach((r) => byUserThisGw.set(r.user_id, r.points));

    // Optimize: use Set to track which users are already in merged
    const mergedUserIds = new Set<string>();
    const merged = overall.map((o) => {
      mergedUserIds.add(o.user_id);
      return {
        user_id: o.user_id,
        name: o.name ?? "User",
        this_gw: byUserThisGw.get(o.user_id) ?? 0,
        ocp: o.ocp ?? 0,
      };
    });

    // include users that have this GW points but not yet in overall
    currentGwPoints.forEach((g) => {
      if (!mergedUserIds.has(g.user_id)) {
        mergedUserIds.add(g.user_id);
        merged.push({
          user_id: g.user_id,
          name: "User",
          this_gw: g.points,
          ocp: g.points,
        });
      }
    });

    // sort by OCP desc, then name
    merged.sort((a, b) => (b.ocp - a.ocp) || a.name.localeCompare(b.name));
    return merged;
  }, [overall, gwPoints, latestGw]);

  // Prevent body scrolling - lock the page
  useEffect(() => {
    // Lock body scroll when component mounts
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      // Restore body scroll when component unmounts
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Scroll to top when tab changes to ensure header is visible
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Prevent scrolling past the header row
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Aggressively prevent scrolling past the header
      if (container.scrollTop < 0) {
        container.scrollTop = 0;
      }
      // Also use requestAnimationFrame to ensure it stays at 0
      requestAnimationFrame(() => {
        if (container.scrollTop < 0) {
          container.scrollTop = 0;
        }
      });
    };

    // Use both scroll and touchmove events to catch all scroll scenarios
    container.addEventListener('scroll', handleScroll, { passive: false });
    container.addEventListener('touchmove', handleScroll, { passive: false });
    
    // Prevent on wheel events when at top
    const handleWheel = (e: WheelEvent) => {
      if (container.scrollTop <= 0 && e.deltaY < 0) {
        e.preventDefault();
        e.stopPropagation();
        container.scrollTop = 0;
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    // Also prevent touch scrolling past top
    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop <= 0) {
        const touch = e.touches[0];
        if (touch) {
          const startY = touch.clientY;
          const handleTouchMove = (e2: TouchEvent) => {
            const touch2 = e2.touches[0];
            if (touch2 && touch2.clientY < startY) {
              // Scrolling up when already at top - prevent it
              e2.preventDefault();
            }
          };
          container.addEventListener('touchmove', handleTouchMove, { passive: false });
          container.addEventListener('touchend', () => {
            container.removeEventListener('touchmove', handleTouchMove);
          }, { once: true });
        }
      }
    };
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchmove', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  // Animate scroll to user's row when data loads - starts at top then animates down
  useEffect(() => {
    if (!loading && user?.id && tableContainerRef.current && userRowRef.current) {
      // Find user's rank/index in the current tab's data
      const currentRows = activeTab === "overall" ? rows : activeTab === "form5" ? form5Rows : activeTab === "form10" ? form10Rows : lastGwRows;
      const userIndex = currentRows.findIndex(r => r.user_id === user.id);
      const userRank = userIndex >= 0 ? (currentRows[userIndex] as any).rank || userIndex + 1 : null;
      
      // If user is in top 8, skip scroll animation
      if (userRank !== null && userRank <= 8) {
        return;
      }
      
      // First, ensure we start at the top
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = 0;
      }
      
      // Use setTimeout to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        const container = tableContainerRef.current;
        const row = userRowRef.current;
        if (container && row) {
          // Wait a moment so users can see it starts at the top, then animate
          setTimeout(() => {
            if (container && row) {
              // Calculate position relative to the scrollable container
              const rowTopRelativeToContainer = row.offsetTop;
              const containerHeight = container.clientHeight;
              const rowHeight = row.offsetHeight;
              
              // Calculate target scroll position to center the row
              const targetScrollTop = rowTopRelativeToContainer - (containerHeight / 2) + (rowHeight / 2);
              
              // Enable smooth scrolling
              container.style.scrollBehavior = 'smooth';
              container.scrollTop = targetScrollTop;
              
              // Reset scroll behavior after animation completes
              setTimeout(() => {
                if (container) {
                  container.style.scrollBehavior = 'auto';
                }
              }, 1000);
            }
          }, 500); // Wait 500ms before starting scroll animation
        }
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [loading, user?.id, activeTab, rows, form5Rows, form10Rows, lastGwRows]);

  return (
    <div className="fixed inset-0 bg-slate-50 overflow-hidden flex flex-col">
      <style>{`
        @keyframes sparkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          25% {
            opacity: 0.8;
            transform: scale(1.1) rotate(-5deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.15) rotate(5deg);
          }
          75% {
            opacity: 0.9;
            transform: scale(1.05) rotate(-3deg);
          }
        }
        .sparkle-trophy {
          animation: sparkle 2s ease-in-out infinite;
          filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
        }
        .sparkle-trophy svg {
          filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.8));
        }
        @keyframes flash {
          0%, 100% {
            background-color: rgb(209, 250, 229);
          }
          25% {
            background-color: rgb(167, 243, 208);
          }
          50% {
            background-color: rgb(209, 250, 229);
          }
          75% {
            background-color: rgb(167, 243, 208);
          }
        }
        .flash-you-badge {
          animation: flash 1.5s ease-in-out 3;
        }
        .full-width-header-border::after {
          content: '';
          position: absolute;
          left: -1rem;
          right: -1rem;
          bottom: 0;
          height: 1px;
          background-color: #cbd5e1;
          z-index: 1;
        }
      `}</style>
      <div className="max-w-6xl mx-auto px-4 pb-0 flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0 bg-slate-50 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Leaderboard</h2>
            {activeTab === "lastgw" && isCurrentGwLive && liveGw && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                LIVE GW{liveGw}
              </span>
            )}
          </div>
          <p className="mt-2 mb-6 text-sm text-slate-600 w-full">
            See how you rank against every TotL player in the world.
          </p>

        {/* Tabs */}
        <div className="flex justify-center mb-6">
            <div className="flex rounded-full bg-slate-100 p-1.5 border border-slate-200 shadow-sm w-full max-w-md">
            <button
              onClick={() => handleTabChange("lastgw")}
                className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
                activeTab === "lastgw"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
                GW
            </button>
            <button
              onClick={() => handleTabChange("form5")}
                className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
                activeTab === "form5"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
                5
            </button>
            <button
              onClick={() => handleTabChange("form10")}
                className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
                activeTab === "form10"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
                10
            </button>
            <button
              onClick={() => handleTabChange("overall")}
                className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all flex items-center justify-center ${
                activeTab === "overall"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-5 h-5">
                  <g>
                    <path fill="currentColor" d="M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695 -2.1323 4.89 -4.8018 4.9941 -0.8777 1.5207 -2.4019 2.6195 -4.1982 2.9209V19h3c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1H8c-0.55228 0 -1 -0.4477 -1 -1s0.44772 -1 1 -1h3v-3.085c-1.7965 -0.3015 -3.32148 -1.4 -4.19922 -2.9209C4.13175 12.8895 2 10.6947 2 8V7c0 -1.10457 0.89543 -2 2 -2h2c0 -1.10457 0.89543 -2 2 -2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4 -1.7909 4 -4V5H8zM4 8c0 1.32848 0.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 0.2878 -0.0223 0.5706 -0.0615 0.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z" strokeWidth="1"></path>
                  </g>
                </svg>
            </button>
          </div>
        </div>

        {/* Form tab subtitles */}
          {activeTab === "overall" && (
            <div className="text-center mb-2">
              <div className="text-sm text-slate-600">
                All players overall
              </div>
            </div>
          )}
          
          {activeTab === "form5" && (
            <div className="text-center mb-2">
              {latestGw && latestGw >= 5 ? (
                <div className="text-sm text-slate-600">
                  Completed the last 5 Rounds
              </div>
            ) : (
              <div className="text-sm text-amber-600 font-medium">
                  ⚠️ Watch this space! Complete 5 GW in a row to see the 5 Week Form Leaderboard.
              </div>
            )}
          </div>
        )}
        
        {activeTab === "form10" && (
            <div className="text-center mb-2">
            {latestGw && latestGw >= 10 ? (
                <div className="text-sm text-slate-600">
                  Completed the last 10 Rounds
              </div>
            ) : (
              <div className="text-sm text-amber-600 font-medium">
                  ⚠️ Watch this space! Complete 10 GW in a row to see the 10 Week Form Leaderboard.
              </div>
            )}
          </div>
        )}
        
        {activeTab === "lastgw" && (
            <div className="text-center mb-2">
              <div className="text-sm text-slate-600">
                Players who completed GW{latestGw}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {err && (
            <div className="mb-6 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 flex-shrink-0">
            {err}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
          </div>
        ) : activeTab === "form5" && latestGw && latestGw < 5 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="text-lg font-semibold text-slate-700 mb-2">5 Week Form Leaderboard Coming Soon</div>
            <div className="text-slate-600">
              Complete 5 game weeks in a row to unlock the 5 Week Form Leaderboard and see who's in the best form!
            </div>
          </div>
        ) : activeTab === "form10" && latestGw && latestGw < 10 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="text-lg font-semibold text-slate-700 mb-2">10 Week Form Leaderboard Coming Soon</div>
            <div className="text-slate-600">
              Complete 10 game weeks in a row to unlock the 10 Week Form Leaderboard and see who's in the best form!
            </div>
          </div>
        ) : (activeTab === "overall" ? rows : activeTab === "form5" ? form5Rows : activeTab === "form10" ? form10Rows : lastGwRows).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            No leaderboard data yet.
          </div>
        ) : (
          <div 
            ref={tableContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden -mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-b border-slate-200 bg-slate-50 shadow-sm"
            style={{ 
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              minHeight: 0,
              paddingBottom: '100px',
              paddingLeft: '1rem',
              paddingRight: '1rem',
              backgroundColor: '#f8fafc',
              touchAction: 'pan-y'
            }}
          >
            <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: '#f8fafc' }}>
              <thead className="sticky top-0 full-width-header-border" style={{ 
                position: 'sticky', 
                top: 0, 
                zIndex: 25, 
                backgroundColor: '#f8fafc', 
                display: 'table-header-group'
              } as any}>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  <th className="py-3 text-left font-normal" style={{ backgroundColor: '#f8fafc', width: '45px', paddingLeft: '0.5rem', paddingRight: '0.5rem', color: '#64748b' }}>#</th>
                  <th className="px-4 py-3 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>Player</th>
                  {activeTab === "overall" && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold" style={{ backgroundColor: '#f8fafc', width: '40px', borderTop: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}></th>
                      <th className="px-1 py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '55px', color: '#64748b', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>GW{latestGw || '?'}</th>
                      <th className="py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '60px', paddingLeft: '0.5rem', paddingRight: '0.5rem', color: '#64748b' }}>OCP</th>
                    </>
                  )}
                  {(activeTab === "form5" || activeTab === "form10") && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold" style={{ backgroundColor: '#f8fafc', width: '40px', borderTop: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}></th>
                      <th className="py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '60px', paddingLeft: '0.5rem', paddingRight: '0.5rem', color: '#64748b' }}>PTS</th>
                    </>
                  )}
                  {activeTab === "lastgw" && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold" style={{ backgroundColor: '#f8fafc', width: '40px', borderTop: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}></th>
                      <th className="py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '60px', paddingLeft: '0.5rem', paddingRight: '0.5rem', color: '#64748b' }}>
                        <div className="flex items-center justify-center gap-1">
                          GW{liveGw || latestGw || '?'}
                          {isCurrentGwLive && liveGw && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                          )}
                        </div>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(activeTab === "overall" ? rows : activeTab === "form5" ? form5Rows : activeTab === "form10" ? form10Rows : lastGwRows).map((r, i, arr) => {
                  const isMe = r.user_id === user?.id;
                  
                  // Check if this rank has multiple players
                  const currentRank = 'rank' in r ? r.rank : i + 1;
                  const rankCount = arr.filter((item, index) => {
                    const itemRank = 'rank' in item ? item.rank : index + 1;
                    return itemRank === currentRank;
                  }).length;
                  const isTied = rankCount > 1;
                  const isTopRank = currentRank === 1;
                  
                  // Special styling for top-ranked players

                  let indicator = "";
                  let indicatorClass = "bg-gray-300"; // default (no change)
                  
                  // Only show rank movement indicators for overall tab
                  if (activeTab === "overall") {
                    const prev = prevRanks[r.user_id];
                    const curr = currRanks[r.user_id];
                    
                    if (curr && prev) {
                      if (curr < prev) {
                        indicator = "▲"; // moved up
                        indicatorClass = "bg-green-500 text-white";
                      } else if (curr > prev) {
                        indicator = "▼"; // moved down
                        indicatorClass = "bg-red-500 text-white";
                      } else {
                        indicator = "→"; // same position - right arrow
                        indicatorClass = "bg-gray-500 text-white";
                      }
                    } else if (curr && !prev) {
                        // They have played current GW but no previous rank (first week)
                        indicator = ""; // no change - empty circle
                        indicatorClass = "bg-gray-400";
                    }
                  }

                  return (
                    <tr 
                      key={r.user_id}
                      ref={isMe ? userRowRef : null}
                      className=""
                      style={{
                        ...(i > 0 ? { 
                          borderTop: '1px solid #e2e8f0',
                          position: 'relative',
                          backgroundColor: '#f8fafc'
                        } : { position: 'relative', backgroundColor: '#f8fafc' })
                      }}
                    >
                      {/* Rank number only */}
                      <td className="py-3 text-left tabular-nums whitespace-nowrap relative" style={{ 
                        width: '45px',
                        paddingLeft: '0.5rem', 
                        paddingRight: '0.5rem',
                        backgroundColor: '#f8fafc'
                      }}>
                          <span>{currentRank}{isTied ? '=' : ''}</span>
                      </td>

                      {/* Player name with color-coded indicator */}
                      <td className="px-4 py-3" style={{ backgroundColor: '#f8fafc' }}>
                        <div className="flex items-center gap-2">
                          {(indicator || indicatorClass) && activeTab === "overall" && (
                            <span
                              className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${indicatorClass} align-middle flex-shrink-0`}
                              aria-hidden
                            >
                              {indicator}
                            </span>
                          )}
                          {isTopRank && (
                            <span className="inline-flex items-center sparkle-trophy flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-4 h-4 text-yellow-500">
                                <g>
                                  <path fill="currentColor" d="M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695 -2.1323 4.89 -4.8018 4.9941 -0.8777 1.5207 -2.4019 2.6195 -4.1982 2.9209V19h3c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1H8c-0.55228 0 -1 -0.4477 -1 -1s0.44772 -1 1 -1h3v-3.085c-1.7965 -0.3015 -3.32148 -1.4 -4.19922 -2.9209C4.13175 12.8895 2 10.6947 2 8V7c0 -1.10457 0.89543 -2 2 -2h2c0 -1.10457 0.89543 -2 2 -2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4 -1.7909 4 -4V5H8zM4 8c0 1.32848 0.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 0.2878 -0.0223 0.5706 -0.0615 0.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z" strokeWidth="1"></path>
                                </g>
                              </svg>
                            </span>
                          )}
                          <span className="font-normal text-sm truncate min-w-0 whitespace-nowrap" style={{ color: 'rgb(0, 0, 0)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.name}
                          </span>
                          {isMe && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 flex-shrink-0 flash-you-badge">
                              you
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Overall tab columns */}
                      {activeTab === "overall" && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold" style={{ width: '40px', paddingLeft: '0.5rem', paddingRight: '0.5rem', backgroundColor: '#f8fafc' }}></td>
                          <td className="px-1 py-3 text-center tabular-nums font-bold" style={{ width: '55px', paddingLeft: '0.5rem', paddingRight: '0.5rem', backgroundColor: '#f8fafc' }}>
                            {'this_gw' in r ? r.this_gw : 0}
                          </td>
                          <td className="py-3 text-center tabular-nums font-bold" style={{ 
                            width: '60px',
                            paddingLeft: '0.5rem', 
                            paddingRight: '0.5rem',
                            backgroundColor: '#f8fafc'
                          }}>
                            {'ocp' in r ? r.ocp : 0}
                          </td>
                        </>
                      )}

                      {/* Form tab columns (both 5 Week and 10 Week) */}
                      {(activeTab === "form5" || activeTab === "form10") && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold" style={{ width: '40px', paddingLeft: '0.5rem', paddingRight: '0.5rem', backgroundColor: '#f8fafc' }}></td>
                          <td className="py-3 text-center tabular-nums font-bold" style={{ 
                            width: '60px',
                            paddingLeft: '0.5rem', 
                            paddingRight: '0.5rem',
                            backgroundColor: '#f8fafc'
                          }}>
                            {'formPoints' in r ? r.formPoints : 0}
                        </td>
                        </>
                      )}
                      
                      {/* Last GW tab columns */}
                      {activeTab === "lastgw" && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold" style={{ width: '40px', paddingLeft: '0.5rem', paddingRight: '0.5rem', backgroundColor: '#f8fafc' }}></td>
                          <td className="py-3 text-center tabular-nums font-bold" style={{ 
                            width: '60px',
                            paddingLeft: '0.5rem', 
                            paddingRight: '0.5rem',
                            backgroundColor: '#f8fafc'
                          }}>
                            {'points' in r ? r.points : 0}
                        </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
        
      </div>
    </div>
  );
}