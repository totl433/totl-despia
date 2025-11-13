// src/pages/Global.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

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
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // 1) latest GW from results
        const { data: latest, error: lErr } = await supabase
          .from("gw_results")
          .select("gw")
          .order("gw", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lErr) throw lErr;
        const gw = latest?.gw ?? 1;
        if (alive) setLatestGw(gw);

        // 2) all GW points (needed for form leaderboards)
        const { data: gp, error: gErr } = await supabase
          .from("v_gw_points")
          .select("user_id, gw, points")
          .order("gw", { ascending: true });
        if (gErr) throw gErr;

        // 3) overall
        const { data: ocp, error: oErr } = await supabase
          .from("v_ocp_overall")
          .select("user_id, name, ocp");
        if (oErr) throw oErr;

        if (!alive) return;
        setGwPoints((gp as GwPointsRow[]) ?? []);
        setOverall((ocp as OverallRow[]) ?? []);

        // 4) previous OCP totals (up to gw-1) to compute rank movement
        if (gw && gw > 1) {
          // Use the already fetched gwPoints data instead of making another query
          const prevList = (gp as GwPointsRow[] | null)?.filter(r => r.gw < gw) ?? [];
          
          const totals: Record<string, number> = {};
          prevList.forEach((r) => {
            totals[r.user_id] = (totals[r.user_id] ?? 0) + (r.points ?? 0);
          });
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
    return () => {
      alive = false;
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
  }, [gwPoints, latestGw, overall]);

  const rows = useMemo(() => {
    // Get current GW points only for the Overall tab
    const currentGwPoints = gwPoints.filter(gp => gp.gw === latestGw);
    const byUserThisGw = new Map<string, number>();
    currentGwPoints.forEach((r) => byUserThisGw.set(r.user_id, r.points));

    const merged = overall.map((o) => ({
      user_id: o.user_id,
      name: o.name ?? "User",
      this_gw: byUserThisGw.get(o.user_id) ?? 0,
      ocp: o.ocp ?? 0,
    }));

    // include users that have this GW points but not yet in overall
    currentGwPoints.forEach((g) => {
      if (!merged.find((m) => m.user_id === g.user_id)) {
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

  // Scroll to top when tab changes to ensure header is visible
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Animate scroll to user's row when data loads - starts at top then animates down
  useEffect(() => {
    if (!loading && user?.id && tableContainerRef.current && userRowRef.current) {
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
    <div className="min-h-screen bg-slate-50">
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
        .flash-user-row {
          animation: flash 1.5s ease-in-out 3;
        }
      `}</style>
      <div className="max-w-6xl mx-auto px-4 pb-0">
        {/* Fixed Header Section */}
        <div className="fixed top-0 left-0 right-0 z-30 bg-slate-50 pb-4 pt-4 shadow-sm">
          <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Leaderboard</h2>
          <p className="mt-2 mb-6 text-sm text-slate-600 w-full">
            See how you rank against every TotL player in the world.
          </p>

          {/* Tabs */}
          <div className="flex justify-center mb-6">
            <div className="flex rounded-xl bg-slate-100 p-1.5 border border-slate-200 shadow-sm">
              <button
                onClick={() => handleTabChange("lastgw")}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "lastgw"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                Last GW
              </button>
              <button
                onClick={() => handleTabChange("form5")}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "form5"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                5 Week
              </button>
              <button
                onClick={() => handleTabChange("form10")}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "form10"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                10 Week
              </button>
              <button
                onClick={() => handleTabChange("overall")}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "overall"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                Overall
              </button>
            </div>
          </div>

          {/* Form tab subtitles */}
          {activeTab === "overall" && (
            <div className="text-center mb-2">
              <div className="text-xs text-slate-600">
                Showing all players
              </div>
            </div>
          )}
          
          {activeTab === "form5" && (
            <div className="text-center mb-2">
              {latestGw && latestGw >= 5 ? (
                <div className="text-xs text-slate-600">
                  Showing all players who completed GW{Math.max(1, latestGw - 4)}-{latestGw}
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
                <div className="text-xs text-slate-600">
                  Showing all players who completed GW{Math.max(1, latestGw - 9)}-{latestGw}
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
              <div className="text-xs text-slate-600">
                Showing all players who completed GW{latestGw}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Spacer to account for fixed header */}
        <div style={{ height: '187px' }} className="sm:hidden" />
        <div style={{ height: '147px' }} className="hidden sm:block" />

        {err && (
          <div className="mb-6 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
        ) : (activeTab === "overall" ? rows : activeTab === "form5" ? form5Rows : activeTab === "form10" ? form10Rows : lastGwRows).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            No leaderboard data yet.
          </div>
        ) : (
          <div 
            ref={tableContainerRef}
            className="overflow-y-auto -mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-t border-b border-slate-200 bg-white shadow-sm"
            style={{ maxHeight: 'calc(100vh - 250px)', minHeight: '400px' }}
          >
            <table className="w-full text-sm text-slate-800 border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0" style={{ position: 'sticky', top: 0, zIndex: 25, backgroundColor: '#f1f5f9', display: 'table-header-group' }}>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th className="px-1 py-3 text-left font-semibold border-b border-slate-200" style={{ backgroundColor: '#f1f5f9', width: '40px' }}>#</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs border-b border-slate-200" style={{ backgroundColor: '#f1f5f9' }}>Player</th>
                  {activeTab === "overall" && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold border-b border-slate-200" style={{ backgroundColor: '#f1f5f9', width: '100px' }}></th>
                      <th className="px-1 py-3 text-center font-semibold border-b border-slate-200" style={{ backgroundColor: '#f1f5f9', width: '50px' }}>GW{latestGw || '?'}</th>
                      <th className="px-4 py-3 text-center font-semibold border-b border-slate-200" style={{ backgroundColor: '#f1f5f9', width: '100px' }}>OCP</th>
                    </>
                  )}
                  {(activeTab === "form5" || activeTab === "form10") && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold border-b border-slate-200" style={{ backgroundColor: '#f1f5f9', width: '100px' }}></th>
                      <th className="px-4 py-3 text-center font-semibold border-b border-slate-200" style={{ backgroundColor: '#f1f5f9', width: '100px' }}>PTS</th>
                    </>
                  )}
                  {activeTab === "lastgw" && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold border-b border-slate-200" style={{ backgroundColor: '#f1f5f9', width: '100px' }}></th>
                      <th className="px-4 py-3 text-center font-semibold border-b border-slate-200" style={{ backgroundColor: '#f1f5f9', width: '100px' }}>GW{latestGw || '?'}</th>
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
                  let zebra = "";
                  let highlight = "";
                  if (isMe) {
                    zebra = "";
                    highlight = "bg-emerald-200";
                  } else {
                    zebra = i % 2 === 0 ? "bg-white" : "bg-slate-50";
                    highlight = "";
                  }

                  let indicator = "";
                  let indicatorClass = "bg-gray-300"; // default (no change)
                  
                  // Only show rank movement indicators for overall tab
                  if (activeTab === "overall") {
                    const prev = prevRanks[r.user_id];
                    const curr = currRanks[r.user_id];
                    
                    // Check if player has played the current game week
                    const hasPlayedCurrentGw = gwPoints.some(gp => gp.user_id === r.user_id && gp.gw === latestGw);
                    
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
                      // Only show blue dot if they haven't played the current GW
                      if (!hasPlayedCurrentGw) {
                        indicator = ""; // new entrant - empty blue dot
                        indicatorClass = "bg-blue-500 text-white";
                      } else {
                        // They have played current GW but no previous rank (first week)
                        indicator = ""; // no change - empty circle
                        indicatorClass = "bg-gray-400";
                      }
                    }
                  }

                  return (
                    <tr 
                      key={r.user_id} 
                      ref={isMe ? userRowRef : null}
                      className={`border-t border-slate-200 ${zebra} ${highlight} ${isMe ? 'flash-user-row' : ''}`}
                    >
                      {/* Rank number only */}
                      <td className="px-2 py-3 text-left tabular-nums whitespace-nowrap">
                        <span>{currentRank}{isTied ? '=' : ''}</span>
                      </td>

                      {/* Player name with color-coded indicator */}
                      <td className="px-4 py-3">
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
                          <span className="font-bold text-sm text-slate-900 whitespace-nowrap">
                            {r.name}
                          </span>
                          {isMe && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 flex-shrink-0">
                              you
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Overall tab columns */}
                      {activeTab === "overall" && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold"></td>
                          <td className="px-1 py-3 text-center tabular-nums font-bold">
                            {'this_gw' in r ? r.this_gw : 0}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums font-bold">
                            {'ocp' in r ? r.ocp : 0}
                          </td>
                        </>
                      )}

                      {/* Form tab columns (both 5 Week and 10 Week) */}
                      {(activeTab === "form5" || activeTab === "form10") && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold"></td>
                          <td className="px-4 py-3 text-center tabular-nums font-bold">
                            {'formPoints' in r ? r.formPoints : 0}
                          </td>
                        </>
                      )}
                      
                      {/* Last GW tab columns */}
                      {activeTab === "lastgw" && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold"></td>
                          <td className="px-4 py-3 text-center tabular-nums font-bold">
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
        
        {/* Key for indicators */}
        <div className="mt-4 flex justify-center">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>New Player</span>
          </div>
        </div>
      </div>
    </div>
  );
}