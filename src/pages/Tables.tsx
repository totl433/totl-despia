import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDeterministicLeagueAvatar, getLeagueAvatarPath } from "../lib/leagueAvatars";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

type League = { id: string; name: string; code: string; created_at: string; avatar?: string | null };
type LeagueRow = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  submittedCount?: number;
  avatar?: string | null;
};
type LeagueMember = { id: string; name: string };
type LeagueData = {
  id: string;
  members: LeagueMember[];
  userPosition: number | null;
  positionChange: 'up' | 'down' | 'same' | null;
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

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (typeof r.home_goals === "number" && typeof r.away_goals === "number") {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}

export default function TablesPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [error, setError] = useState("");
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>({});
  const [leagueData, setLeagueData] = useState<Record<string, LeagueData>>({});

  async function load() {
    setLoading(true);
    setError("");

    try {
      // Require an authenticated user
      if (!user?.id) {
        setRows([]);
        setLoading(false);
        return;
      }

      // A) league IDs this user belongs to
      const { data: myMemberships, error: memErr } = await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", user.id);

      if (memErr) throw memErr;

      const leagueIds = (myMemberships ?? []).map((r: any) => r.league_id);
      if (!leagueIds.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      // B) fetch only those leagues
      let leagues: League[] = [];
      const { data: leaguesData, error: lErr } = await supabase
        .from("leagues")
        .select("id,name,code,created_at,avatar")
        .in("id", leagueIds)
        .order("created_at", { ascending: true });

      if (lErr) {
        console.error("Error fetching leagues with avatar:", lErr);
        // Try without avatar field if it doesn't exist
        const { data: leaguesDataFallback, error: lErrFallback } = await supabase
          .from("leagues")
          .select("id,name,code,created_at")
          .in("id", leagueIds)
          .order("created_at", { ascending: true });
        if (lErrFallback) throw lErrFallback;
        leagues = (leaguesDataFallback ?? []) as any;
      } else {
        leagues = (leaguesData ?? []) as any;
      }

      // Assign avatars to leagues that don't have one (backfill - only once)
      // Use deterministic avatar based on league ID so it's consistent even if DB update fails
      const leaguesNeedingAvatars = leagues.filter(l => !l.avatar || l.avatar === null || l.avatar === '');
      if (leaguesNeedingAvatars.length > 0) {
        console.log(`Assigning avatars to ${leaguesNeedingAvatars.length} leagues`);
        // Update each league with a deterministic avatar (only if it doesn't have one)
        for (const league of leaguesNeedingAvatars) {
          // Use deterministic avatar based on league ID - same league always gets same avatar
          const avatar = getDeterministicLeagueAvatar(league.id);
          
          // Try to update database
          const { error: updateError } = await supabase
            .from("leagues")
            .update({ avatar })
            .eq("id", league.id);
          
          if (!updateError) {
            // Update succeeded - update local array
            league.avatar = avatar;
            console.log(`Assigned avatar ${avatar} to league ${league.name}`);
          } else {
            console.warn(`Failed to assign avatar to league ${league.id} (${league.name}):`, updateError.message);
            // Even if DB update fails, assign locally using deterministic method
            // This ensures the same league always shows the same avatar
            league.avatar = avatar;
          }
        }
      }

      if (!leagues.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      // C) members for those leagues
      const { data: memData, error: mErr } = await supabase
        .from("league_members")
        .select("league_id,user_id")
        .in("league_id", leagues.map((l) => l.id));

      if (mErr) throw mErr;

      const membersByLeague = new Map<string, string[]>();
      (memData ?? []).forEach((r: any) => {
        const arr = membersByLeague.get(r.league_id) ?? [];
        arr.push(r.user_id);
        membersByLeague.set(r.league_id, arr);
      });

      // D) determine current GW (match Home.tsx logic)
      const { data: fx } = await supabase
        .from("fixtures")
        .select("gw")
        .order("gw", { ascending: false });

      const fixturesList = (fx as Array<{ gw: number }>) ?? [];
      const currentGw = fixturesList.length
        ? Math.max(...fixturesList.map((f) => f.gw))
        : 1;

      // E) submission status per league (all members submitted?)
      const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
      for (const league of leagues) {
        try {
          const memberIds = membersByLeague.get(league.id) ?? [];
          const totalCount = memberIds.length;
          if (totalCount > 0) {
            const { data: submissions } = await supabase
              .from("gw_submissions")
              .select("user_id")
              .eq("gw", currentGw)
              .in("user_id", memberIds);

            const submittedCount = submissions?.length || 0;
            submissionStatus[league.id] = {
              allSubmitted: submittedCount === totalCount,
              submittedCount,
              totalCount
            };
          } else {
            submissionStatus[league.id] = {
              allSubmitted: false,
              submittedCount: 0,
              totalCount: 0
            };
          }
        } catch {
          submissionStatus[league.id] = {
            allSubmitted: false,
            submittedCount: 0,
            totalCount: 0
          };
        }
      }
      setLeagueSubmissions(submissionStatus);

      // G) Fetch unread message counts
      const unreadCounts: Record<string, number> = {};
      try {
        const { data: reads } = await supabase
          .from("league_message_reads")
          .select("league_id,last_read_at")
          .eq("user_id", user.id);

        const lastRead = new Map<string, string>();
        (reads ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

        for (const league of leagues) {
          const since = lastRead.get(league.id) ?? "1970-01-01T00:00:00Z";
          const { data: msgs, count } = await supabase
            .from("league_messages")
            .select("id", { count: "exact" })
            .eq("league_id", league.id)
            .gte("created_at", since);
          unreadCounts[league.id] = typeof count === "number" ? count : (msgs?.length ?? 0);
        }
      } catch (e) {
        // Best effort - ignore errors
        console.warn("Failed to fetch unread counts:", e);
      }

      // F) build rows
      const out: LeagueRow[] = leagues.map((l) => {
        const memberIds = membersByLeague.get(l.id) ?? [];
        return {
          id: l.id,
          name: l.name,
          code: l.code,
          memberCount: memberIds.length,
          avatar: l.avatar,
        };
      });

      // Sort rows: those with unread messages first
      out.sort((a, b) => {
        const unreadA = unreadCounts[a.id] ?? 0;
        const unreadB = unreadCounts[b.id] ?? 0;
        if (unreadA > 0 && unreadB === 0) return -1;
        if (unreadA === 0 && unreadB > 0) return 1;
        return 0; // Keep original order for leagues with same unread status
      });

      setRows(out);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load leagues.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fetch member data and calculate positions for each league
  useEffect(() => {
    if (!rows.length || !user?.id) return;
    
    let alive = true;
    (async () => {
      // Get latest GW with results
      const { data: latestGwData } = await supabase
        .from("gw_results")
        .select("gw")
        .order("gw", { ascending: false })
        .limit(1);
      const latestGwWithResults = latestGwData && latestGwData.length ? (latestGwData[0] as any).gw : null;

      // Get all results
      const { data: allResults } = await supabase
        .from("gw_results")
        .select("gw,fixture_index,result,home_goals,away_goals");
      
      const resultList = (allResults as ResultRowRaw[]) ?? [];
      const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
      resultList.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out) return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
      });

      const leagueDataMap: Record<string, LeagueData> = {};
      
      for (const row of rows) {
        try {
          // Fetch members with their names
          const { data: membersData } = await supabase
            .from("league_members")
            .select("user_id, users(id, name)")
            .eq("league_id", row.id);
          
          const members: LeagueMember[] = (membersData ?? [])
            .map((m: any) => ({
              id: m.user_id,
              name: m.users?.name || "Unknown"
            }))
            .filter((m: LeagueMember) => m.name !== "Unknown");

          if (members.length === 0) {
            leagueDataMap[row.id] = {
              id: row.id,
              members: [],
              userPosition: null,
              positionChange: null
            };
            continue;
          }

          const memberIds = members.map(m => m.id);
          
          // Get all picks for league members
          const { data: allPicks } = await supabase
            .from("picks")
            .select("user_id,gw,fixture_index,pick")
            .in("user_id", memberIds);
          
          const picksAll = (allPicks as PickRow[]) ?? [];
          
          // Calculate positions for current state (all GWs)
          const calculatePosition = (excludeGw: number | null = null) => {
            const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
            const relevantGws = excludeGw ? gwsWithResults.filter(gw => gw < excludeGw) : gwsWithResults;
            
            if (relevantGws.length === 0) return null;

            const perGw = new Map<number, Map<string, { user_id: string; score: number; unicorns: number }>>();
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
              const rows = Array.from(perGw.get(g)!.values());
              rows.forEach((r) => {
                ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
                unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
              });

              rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
              if (!rows.length) return;

              const top = rows[0];
              const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);

              if (coTop.length === 1) {
                mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
              } else {
                coTop.forEach((r) => {
                  mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
                });
              }
            });

            const rows = members.map((m) => ({
              user_id: m.id,
              name: m.name,
              mltPts: mltPts.get(m.id) ?? 0,
              unicorns: unis.get(m.id) ?? 0,
              ocp: ocp.get(m.id) ?? 0,
            }));

            rows.sort((a, b) => b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name));

            const userIndex = rows.findIndex(r => r.user_id === user.id);
            return userIndex !== -1 ? userIndex + 1 : null;
          };

          const currentPosition = calculatePosition();
          const previousPosition = latestGwWithResults ? calculatePosition(latestGwWithResults) : null;
          
          // Fallback to alphabetical position if no results yet
          let finalPosition = currentPosition;
          if (finalPosition === null) {
            const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
            const userIndex = sortedMembers.findIndex(m => m.id === user.id);
            if (userIndex !== -1) {
              finalPosition = userIndex + 1;
            } else {
              // User should be in members, but if not found, set to null
              finalPosition = null;
            }
          }
          
          let positionChange: 'up' | 'down' | 'same' | null = null;
          if (finalPosition !== null && previousPosition !== null) {
            if (finalPosition < previousPosition) {
              positionChange = 'up'; // Improved (lower number is better)
            } else if (finalPosition > previousPosition) {
              positionChange = 'down'; // Got worse (higher number is worse)
            } else {
              positionChange = 'same';
            }
          }
          
          leagueDataMap[row.id] = {
            id: row.id,
            members: members.sort((a, b) => a.name.localeCompare(b.name)),
            userPosition: finalPosition,
            positionChange
          };
        } catch (error) {
          console.warn(`Error loading data for league ${row.id}:`, error);
          leagueDataMap[row.id] = {
            id: row.id,
            members: [],
            userPosition: null,
            positionChange: null
          };
        }
      }
      
      if (alive) {
        setLeagueData(leagueDataMap);
      }
    })();
    
    return () => {
      alive = false;
    };
  }, [rows, user?.id]);

  async function createLeague() {
    if (!leagueName.trim() || !user?.id) return;
    setCreating(true);
    setError("");
    try {
      const name = leagueName.trim();
      const code = await genCode();
      const { data, error } = await supabase
        .from("leagues")
        .insert({ name, code })
        .select("id,code")
        .single();
      if (error) throw error;

      // Assign deterministic avatar based on league ID (after creation)
      const avatar = getDeterministicLeagueAvatar(data!.id);
      await supabase
        .from("leagues")
        .update({ avatar })
        .eq("id", data!.id);

      // creator becomes a member
      await supabase.from("league_members").insert({
        league_id: data!.id,
        user_id: user.id,
      });

      setLeagueName("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create league.");
    } finally {
      setCreating(false);
    }
  }

  async function joinLeague() {
    const code = joinCode.trim().toUpperCase();
    if (!code || !user?.id) return;
    setError("");
    try {
      const { data, error } = await supabase
        .from("leagues")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setError("League code not found.");
        return;
      }

      // Check if league is full (max 8 members)
      const { data: members, error: membersError } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", data.id);

      if (membersError) throw membersError;

      if (members && members.length >= 8) {
        setError("League is full (max 8 members).");
        return;
      }

      await supabase.from("league_members").upsert(
        { league_id: data.id, user_id: user.id },
        { onConflict: "league_id,user_id" }
      );
      setJoinCode("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Mini Leagues</h1>
          <p className="mt-0 mb-6 text-sm text-slate-600">
            Create or join a private league<br />and battle it out with your friends.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Leagues list */}
        <div className="mt-6">
          {loading ? (
            <div className="px-4 py-4 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-4 text-sm">No leagues yet.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const data = leagueData[r.id];
                const members = data?.members || [];
                const userPosition = data?.userPosition;
                
                return (
                  <div key={r.id} className="rounded-xl border bg-white overflow-hidden shadow-sm w-[320px]">
                    <Link 
                      to={`/league/${r.code}`} 
                      className="block p-4 bg-white no-underline hover:text-inherit"
                    >
                      <div className="flex items-start gap-3">
                        {/* League Avatar Badge */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center overflow-hidden">
                          <img 
                            src={getLeagueAvatarPath(r.avatar)} 
                            alt={`${r.name} avatar`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to calendar icon if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('svg')) {
                                parent.innerHTML = `
                                  <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                `;
                              }
                            }}
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* League Name */}
                          <div className="text-lg font-semibold text-slate-900">
                            {r.name}
                          </div>
                          
                          {/* Submission Status */}
                          {leagueSubmissions[r.id] && (
                            <div className="text-xs font-normal text-slate-600 mt-0.5 mb-4">
                              {leagueSubmissions[r.id].allSubmitted ? (
                                <span className="text-[#1C8376]">All Submitted</span>
                              ) : (
                                <span>{leagueSubmissions[r.id].submittedCount} submitted</span>
                              )}
                            </div>
                          )}
                          
                          {/* Member Count */}
                          <div className={`text-xs mb-4 ${r.memberCount >= 8 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                            {r.memberCount} member{r.memberCount === 1 ? "" : "s"}
                            {r.memberCount >= 8 && " (Full)"}
                          </div>
                          
                          {/* Member Info Row */}
                          <div className="flex items-center gap-3">
                            {/* Member Count Icon */}
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-slate-500" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g clipPath="url(#clip0_4045_135263)">
                                  <path d="M14.0001 14V13.7C14.0001 13.0489 14.0001 12.7234 13.925 12.4571C13.7361 11.7874 13.2127 11.264 12.543 11.0751C12.2767 11 11.9512 11 11.3001 11H8.36675C7.71566 11 7.39011 11 7.12387 11.0751C6.45414 11.264 5.93072 11.7874 5.74184 12.4571C5.66675 12.7234 5.66675 13.0489 5.66675 13.7V14" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M2 11.6667V10.6C2 10.0422 2 9.76328 2.05526 9.53311C2.23083 8.80181 2.80181 8.23083 3.53311 8.05526C3.76328 8 4.04219 8 4.6 8H4.66667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M12.3334 6.33333C12.3334 7.622 11.2887 8.66667 10.0001 8.66667C8.71142 8.66667 7.66675 7.622 7.66675 6.33333C7.66675 5.04467 8.71142 4 10.0001 4C11.2887 4 12.3334 5.04467 12.3334 6.33333Z" stroke="currentColor" strokeWidth="1.33333"/>
                                  <path d="M7.33325 2.92025C6.94237 2.36557 6.27397 2 5.51507 2C4.31009 2 3.33325 2.92165 3.33325 4.05857C3.33325 4.95488 3.94038 5.7174 4.7878 6" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round"/>
                                </g>
                                <defs>
                                  <clipPath id="clip0_4045_135263">
                                    <rect width="16" height="16" fill="white"/>
                                  </clipPath>
                                </defs>
                              </svg>
                              <span className="text-sm font-semibold text-slate-900">{members.length}</span>
                            </div>
                            
                            {/* User Position */}
                            {userPosition !== null && userPosition !== undefined && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span className="text-sm font-semibold text-slate-900">{userPosition}</span>
                                {data?.positionChange === 'up' && (
                                  <span className="text-green-600 text-xs">▲</span>
                                )}
                                {data?.positionChange === 'down' && (
                                  <span className="text-red-600 text-xs">▼</span>
                                )}
                                {data?.positionChange === 'same' && (
                                  <span className="text-slate-400 text-xs">—</span>
                                )}
                              </div>
                            )}
                            
                            {/* Member Initials */}
                            <div className="flex items-center flex-1 overflow-hidden">
                              {members.slice(0, 8).map((member, index) => (
                                <div
                                  key={member.id}
                                  className="rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                                  style={{ 
                                    marginLeft: index > 0 ? '-2px' : '0', 
                                    width: '18px', 
                                    height: '18px',
                                    backgroundColor: '#F2F2F7',
                                    border: '0.5px solid #D9D9D9',
                                    color: '#ADADB1'
                                  }}
                                  title={member.name}
                                >
                                  {initials(member.name)}
                                </div>
                              ))}
                              {members.length > 8 && (
                                <div 
                                  className="rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                                  style={{ 
                                    marginLeft: members.length > 1 ? '-2px' : '0', 
                                    width: '18px', 
                                    height: '18px',
                                    backgroundColor: '#F2F2F7',
                                    border: '0.5px solid #D9D9D9',
                                    color: '#ADADB1'
                                  }}
                                >
                                  +{members.length - 8}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* View Button */}
                        <div className="flex-shrink-0">
                          <div className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors">
                            View
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* separator */}
        <div className="mt-10 mb-3 text-xl font-extrabold text-slate-900">Create or Join</div>

        {/* Create / Join cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-2xl p-4 bg-white">
            <div className="text-sm font-medium mb-2">Create a league</div>
            <input
              className="border rounded px-3 py-2 w-full bg-white"
              placeholder="League name"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
            />
            <button
              className="mt-3 px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
              onClick={createLeague}
              disabled={creating || !leagueName.trim()}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>

          <div className="border rounded-2xl p-4 bg-white">
            <div className="text-sm font-medium mb-2">Join with code</div>
            <input
              className="border rounded px-3 py-2 w-full uppercase tracking-widest bg-white"
              placeholder="ABCDE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button
              className="mt-3 px-3 py-2 rounded border"
              onClick={joinLeague}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// simple 5-char code
async function genCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMPQRSTVWXYZ23456789";
  for (let t = 0; t < 6; t++) {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const { data } = await supabase
      .from("leagues")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!data) return code;
  }
  // worst case
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}