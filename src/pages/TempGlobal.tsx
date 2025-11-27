import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { LeaderboardTabs } from "../components/LeaderboardTabs";

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

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [latestGw, setLatestGw] = useState<number | null>(null);
  const [overall, setOverall] = useState<OverallRow[]>([]);
  const [gwPoints, setGwPoints] = useState<GwPointsRow[]>([]);
  const [prevOcp, setPrevOcp] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"overall" | "form5" | "form10" | "lastgw">(validTab);

  // Sync activeTab with URL param
  useEffect(() => {
    if (!tabParam) {
      setSearchParams({ tab: "lastgw" }, { replace: true });
    }
    if (validTab !== activeTab) {
      setActiveTab(validTab);
    }
  }, [validTab, tabParam, activeTab, setSearchParams]);

  // Update URL when tab changes
  const handleTabChange = useCallback((tab: "overall" | "form5" | "form10" | "lastgw") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  }, [setSearchParams]);

  // Fetch data - optimized parallel queries
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // Parallel fetch all data
        const [latestResult, gpResult, ocpResult] = await Promise.all([
          supabase.from("gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
          supabase.from("v_ocp_overall").select("user_id, name, ocp")
        ]);
        
        if (latestResult.error) throw latestResult.error;
        if (gpResult.error) throw gpResult.error;
        if (ocpResult.error) throw ocpResult.error;

        const gw = latestResult.data?.gw ?? 1;
        if (!alive) return;
        
        setLatestGw(gw);
        setGwPoints((gpResult.data as GwPointsRow[]) ?? []);
        setOverall((ocpResult.data as OverallRow[]) ?? []);

        // Calculate previous OCP totals
        if (gw && gw > 1) {
          const prevList = (gpResult.data as GwPointsRow[] | null)?.filter(r => r.gw < gw) ?? [];
          const totals: Record<string, number> = {};
          for (const r of prevList) {
            totals[r.user_id] = (totals[r.user_id] ?? 0) + (r.points ?? 0);
          }
          if (alive) setPrevOcp(totals);
        } else {
          if (alive) setPrevOcp({});
        }
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load leaderboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Calculate ranks
  const ranksFromScores = useCallback((scores: Record<string, number>): Record<string, number> => {
    const ids = Object.keys(scores);
    ids.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a.localeCompare(b));
    const out: Record<string, number> = {};
    ids.forEach((id, i) => (out[id] = i + 1));
    return out;
  }, []);

  const currRanks = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const o of overall) {
      scores[o.user_id] = (o.ocp ?? 0);
    }
    for (const g of gwPoints) {
      if (!(g.user_id in scores)) scores[g.user_id] = g.points ?? 0;
    }
    return ranksFromScores(scores);
  }, [overall, gwPoints, ranksFromScores]);

  const prevRanks = useMemo(() => ranksFromScores(prevOcp), [prevOcp, ranksFromScores]);

  // Helper function to create form rows
  const createFormRows = useMemo(() => {
    return (weeks: number) => {
      if (!latestGw || latestGw < weeks) return [];
      
      const startGw = latestGw - weeks + 1;
      const formGwPoints = gwPoints.filter(gp => gp.gw >= startGw && gp.gw <= latestGw);
      
      const userFormData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
      
      for (const o of overall) {
        userFormData.set(o.user_id, {
          user_id: o.user_id,
          name: o.name ?? "User",
          formPoints: 0,
          weeksPlayed: new Set()
        });
      }
      
      for (const gp of formGwPoints) {
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
      }
      
      const completeFormPlayers = Array.from(userFormData.values())
        .filter(user => {
          for (let g = startGw; g <= latestGw; g++) {
            if (!user.weeksPlayed.has(g)) return false;
          }
          return true;
        })
        .map(user => ({
          user_id: user.user_id,
          name: user.name,
          formPoints: user.formPoints,
          gamesPlayed: weeks
        }))
        .sort((a, b) => (b.formPoints - a.formPoints) || a.name.localeCompare(b.name));
      
      return completeFormPlayers;
    };
  }, [overall, gwPoints, latestGw]);

  const form5Rows = useMemo(() => createFormRows(5), [createFormRows]);
  const form10Rows = useMemo(() => createFormRows(10), [createFormRows]);
  
  // Last GW leaderboard
  const lastGwRows = useMemo(() => {
    if (!latestGw) return [];
    
    const lastGwPoints = gwPoints.filter(gp => gp.gw === latestGw);
    const userMap = new Map(overall.map(o => [o.user_id, o.name ?? "User"]));
    
    const sorted = lastGwPoints
      .map(gp => ({
        user_id: gp.user_id,
        name: userMap.get(gp.user_id) ?? "User",
        points: gp.points,
      }))
      .sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name));
    
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
  }, [gwPoints, latestGw, overall]);

  // Overall rows
  const rows = useMemo(() => {
    const currentGwPoints = gwPoints.filter(gp => gp.gw === latestGw);
    const byUserThisGw = new Map<string, number>();
    for (const r of currentGwPoints) {
      byUserThisGw.set(r.user_id, r.points);
    }

    const merged = overall.map((o) => ({
      user_id: o.user_id,
      name: o.name ?? "User",
      this_gw: byUserThisGw.get(o.user_id) ?? 0,
      ocp: o.ocp ?? 0,
    }));

    for (const g of currentGwPoints) {
      if (!merged.find((m) => m.user_id === g.user_id)) {
        merged.push({
          user_id: g.user_id,
          name: "User",
          this_gw: g.points,
          ocp: g.points,
        });
      }
    }

    merged.sort((a, b) => (b.ocp - a.ocp) || a.name.localeCompare(b.name));
    return merged;
  }, [overall, gwPoints, latestGw]);

  // Get current tab rows
  const currentRows = useMemo(() => {
    if (activeTab === "overall") return rows;
    if (activeTab === "form5") return form5Rows;
    if (activeTab === "form10") return form10Rows;
    return lastGwRows;
  }, [activeTab, rows, form5Rows, form10Rows, lastGwRows]);

  // Prevent body scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Scroll to top when tab changes
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Prevent scrolling past header
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop < 0) {
        container.scrollTop = 0;
      }
      requestAnimationFrame(() => {
        if (container.scrollTop < 0) {
          container.scrollTop = 0;
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: false });
    container.addEventListener('touchmove', handleScroll, { passive: false });
    
    const handleWheel = (e: WheelEvent) => {
      if (container.scrollTop <= 0 && e.deltaY < 0) {
        e.preventDefault();
        e.stopPropagation();
        container.scrollTop = 0;
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop <= 0) {
        const touch = e.touches[0];
        if (touch) {
          const startY = touch.clientY;
          const handleTouchMove = (e2: TouchEvent) => {
            const touch2 = e2.touches[0];
            if (touch2 && touch2.clientY < startY) {
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

  // Scroll to user's row
  useEffect(() => {
    if (!loading && user?.id && tableContainerRef.current && userRowRef.current) {
      const userIndex = currentRows.findIndex(r => r.user_id === user.id);
      const userRank = userIndex >= 0 ? (currentRows[userIndex] as any).rank || userIndex + 1 : null;
      
      if (userRank !== null && userRank <= 8) {
        return;
      }
      
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = 0;
      }
      
      const timer = setTimeout(() => {
        const container = tableContainerRef.current;
        const row = userRowRef.current;
        if (container && row) {
          setTimeout(() => {
            if (container && row) {
              const rowTopRelativeToContainer = row.offsetTop;
              const containerHeight = container.clientHeight;
              const rowHeight = row.offsetHeight;
              const targetScrollTop = rowTopRelativeToContainer - (containerHeight / 2) + (rowHeight / 2);
              
              container.style.scrollBehavior = 'smooth';
              container.scrollTop = targetScrollTop;
              
              setTimeout(() => {
                if (container) {
                  container.style.scrollBehavior = 'auto';
                }
              }, 1000);
            }
          }, 500);
        }
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [loading, user?.id, activeTab, currentRows]);

  return (
    <div className="fixed inset-0 bg-slate-50 overflow-hidden flex flex-col">
      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
          25% { opacity: 0.8; transform: scale(1.1) rotate(-5deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(5deg); }
          75% { opacity: 0.9; transform: scale(1.05) rotate(-3deg); }
        }
        .sparkle-trophy {
          animation: sparkle 2s ease-in-out infinite;
          filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
        }
        .sparkle-trophy svg {
          filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.8));
        }
        @keyframes flash {
          0%, 100% { background-color: rgb(209, 250, 229); }
          25% { background-color: rgb(167, 243, 208); }
          50% { background-color: rgb(209, 250, 229); }
          75% { background-color: rgb(167, 243, 208); }
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
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Leaderboard</h2>
          <p className="mt-2 mb-6 text-sm text-slate-600 w-full">
            See how you rank against every TotL player in the world. - COMPONENT VERSION
          </p>

          {/* Tabs */}
          <LeaderboardTabs activeTab={activeTab} onTabChange={handleTabChange} />

          {/* Form tab subtitles */}
          {activeTab === "overall" && (
            <div className="text-center mb-2">
              <div className="text-sm text-slate-600">All players overall</div>
            </div>
          )}
          
          {activeTab === "form5" && (
            <div className="text-center mb-2">
              {latestGw && latestGw >= 5 ? (
                <div className="text-sm text-slate-600">Completed the last 5 Rounds</div>
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
                <div className="text-sm text-slate-600">Completed the last 10 Rounds</div>
              ) : (
                <div className="text-sm text-amber-600 font-medium">
                  ⚠️ Watch this space! Complete 10 GW in a row to see the 10 Week Form Leaderboard.
                </div>
              )}
            </div>
          )}
        
          {activeTab === "lastgw" && (
            <div className="text-center mb-2">
              <div className="text-sm text-slate-600">Players who completed GW{latestGw}</div>
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
            <div className="text-slate-500">Loading…</div>
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
          ) : currentRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
              No leaderboard data yet.
            </div>
          ) : (
            <LeaderboardTable
              ref={tableContainerRef}
              rows={currentRows}
              activeTab={activeTab}
              currentUserId={user?.id}
              prevRanks={prevRanks}
              currRanks={currRanks}
              latestGw={latestGw}
              userRowRef={userRowRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}
