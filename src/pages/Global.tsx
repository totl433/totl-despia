// src/pages/Global.tsx
import { useEffect, useMemo, useState } from "react";
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Leaderboard</h1>
          <p className="mt-0 mb-6 text-xs text-slate-600">
            See how you rank against every<br />TotL player in the world.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => handleTabChange("lastgw")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "lastgw"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Last GW
            </button>
            <button
              onClick={() => handleTabChange("form5")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "form5"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              5 Week
            </button>
            <button
              onClick={() => handleTabChange("form10")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "form10"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              10 Week
            </button>
            <button
              onClick={() => handleTabChange("overall")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "overall"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Overall
            </button>
          </div>
        </div>

        {/* Form tab subtitles */}
        {activeTab === "form5" && (
          <div className="text-center mb-6">
            {latestGw && latestGw >= 5 ? (
              <div className="text-xs text-slate-600">
                Showing all players who have completed<br className="sm:hidden" /> the last 5 game weeks<br className="sm:hidden" /> (GW{Math.max(1, latestGw - 4)}-{latestGw})
              </div>
            ) : (
              <div className="text-sm text-amber-600 font-medium">
                ⚠️ Watch this space! Complete 5 GW<br className="sm:hidden" /> in a row to see the 5 Week Form Leaderboard.
              </div>
            )}
          </div>
        )}
        
        {activeTab === "form10" && (
          <div className="text-center mb-6">
            {latestGw && latestGw >= 10 ? (
              <div className="text-xs text-slate-600">
                Showing all players who have completed<br className="sm:hidden" /> the last 10 game weeks<br className="sm:hidden" /> (GW{Math.max(1, latestGw - 9)}-{latestGw})
              </div>
            ) : (
              <div className="text-sm text-amber-600 font-medium">
                ⚠️ Watch this space! Complete 10 GW<br className="sm:hidden" /> in a row to see the 10 Week Form Leaderboard.
              </div>
            )}
          </div>
        )}
        
        {activeTab === "lastgw" && (
          <div className="text-center mb-6">
            <div className="text-xs text-slate-600">
              Showing all players who completed GW{latestGw}
            </div>
          </div>
        )}

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
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm text-slate-800">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-1 py-3 text-left w-6 font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs">Player</th>
                  {activeTab === "overall" && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold">GW{latestGw || '?'}</th>
                      <th className="px-4 py-3 text-center font-semibold">OCP</th>
                    </>
                  )}
                  {(activeTab === "form5" || activeTab === "form10") && (
                    <th className="px-4 py-3 text-center font-semibold">Form Points</th>
                  )}
                  {activeTab === "lastgw" && (
                    <th className="px-4 py-3 text-center font-semibold">GW{latestGw}</th>
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
                  if (isTopRank) {
                    // Top rank gets special gradient background
                    zebra = "bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50";
                    highlight = "";
                  } else if (isMe) {
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
                    <tr key={r.user_id} className={`border-t border-slate-200 ${zebra} ${highlight} ${isTopRank ? 'relative' : ''}`}>
                      {/* Rank number only */}
                      <td className={`px-2 py-3 text-left tabular-nums whitespace-nowrap ${isTopRank ? 'relative bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]' : ''}`}>
                        {isTopRank ? (
                          <span className="flex items-center gap-1 relative z-10">
                            <span className="text-yellow-600 font-bold text-xl">🏆</span>
                            <span className="font-bold text-yellow-700">{currentRank}{isTied ? '=' : ''}</span>
                          </span>
                        ) : (
                          <span>{currentRank}{isTied ? '=' : ''}</span>
                        )}
                      </td>

                      {/* Player name with color-coded indicator */}
                      <td className={`px-4 py-3 ${isTopRank ? 'relative bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]' : ''}`}>
                        <div className={isTopRank ? 'relative z-10' : ''}>
                          {(indicator || indicatorClass) && activeTab === "overall" && (
                            <span
                              className={`mr-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${indicatorClass} align-middle`}
                              aria-hidden
                            >
                              {indicator}
                            </span>
                          )}
                          <span className={`align-middle font-bold text-xs ${isTopRank ? 'text-yellow-800 font-extrabold' : ''}`}>
                            {r.name}
                          </span>
                          {isMe && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              you
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Overall tab columns */}
                      {activeTab === "overall" && (
                        <>
                          <td className={`px-4 py-3 text-center tabular-nums font-bold ${isTopRank ? 'text-yellow-700 relative bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]' : ''}`}>
                            <span className={isTopRank ? 'relative z-10' : ''}>{'this_gw' in r ? r.this_gw : 0}</span>
                          </td>
                          <td className={`px-4 py-3 text-center font-bold ${isTopRank ? 'text-yellow-700 relative bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]' : ''}`}>
                            <span className={isTopRank ? 'relative z-10' : ''}>{'ocp' in r ? r.ocp : 0}</span>
                          </td>
                        </>
                      )}

                      {/* Form tab columns (both 5 Week and 10 Week) */}
                      {(activeTab === "form5" || activeTab === "form10") && (
                        <td className={`px-4 py-3 text-center font-bold ${isTopRank ? 'text-yellow-700 relative bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]' : ''}`}>
                          <span className={isTopRank ? 'relative z-10' : ''}>{'formPoints' in r ? r.formPoints : 0}</span>
                        </td>
                      )}
                      
                      {/* Last GW tab column */}
                      {activeTab === "lastgw" && (
                        <td className={`px-4 py-3 text-center font-bold tabular-nums ${isTopRank ? 'text-yellow-700 relative bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]' : ''}`}>
                          <span className={isTopRank ? 'relative z-10' : ''}>{'points' in r ? r.points : 0}</span>
                        </td>
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