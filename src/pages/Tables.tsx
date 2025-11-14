import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDeterministicLeagueAvatar, getGenericLeaguePhoto, getGenericLeaguePhotoPicsum } from "../lib/leagueAvatars";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { resolveLeagueStartGw as getLeagueStartGw } from "../lib/leagueStart";

type League = { id: string; name: string; code: string; created_at: string; avatar?: string | null; start_gw?: number | null };
type LeagueRow = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  submittedCount?: number;
  avatar?: string | null;
  created_at?: string | null;
  start_gw?: number | null;
};
type LeagueMember = { id: string; name: string };
type LeagueData = {
  id: string;
  members: LeagueMember[];
  userPosition: number | null;
  positionChange: 'up' | 'down' | 'same' | null;
  submittedMembers?: Set<string>; // Set of user IDs who have submitted for current GW
  sortedMemberIds?: string[]; // Member IDs in ML table order (1st to last)
  latestGwWinners?: Set<string>; // Members who topped the most recent completed GW
};

// Helper function to get initials from name
function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Helper function to convert number to ordinal (1st, 2nd, 3rd, etc.)
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});

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
        .select("id,name,code,created_at,avatar,start_gw")
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
      setUnreadByLeague(unreadCounts);

      // F) build rows
      const out: LeagueRow[] = leagues.map((l) => {
        const memberIds = membersByLeague.get(l.id) ?? [];
        return {
          id: l.id,
          name: l.name,
          code: l.code,
          memberCount: memberIds.length,
          avatar: l.avatar,
          created_at: l.created_at,
          start_gw: l.start_gw,
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
      // Get current GW from meta table (same as Home page) - don't rely on state
      const { data: meta } = await supabase
        .from("meta")
        .select("current_gw")
        .eq("id", 1)
        .maybeSingle();
      const currentGw = (meta as any)?.current_gw ?? 1;
      
      // Get all results - EXACT same query as Home page
      const { data: allResults } = await supabase
        .from("gw_results")
        .select("gw,fixture_index,result");
      
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
          // Use row as league object - same structure as Home page
          // getLeagueStartGw will fetch start_gw if needed
          const league = {
            id: row.id,
            name: row.name,
            created_at: row.created_at || null,
            start_gw: undefined // Will be fetched by getLeagueStartGw if needed
          };

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
              positionChange: null,
              sortedMemberIds: [],
              latestGwWinners: new Set()
            };
            continue;
          }

          // Simple: Calculate ML table exactly like Home page does, then find user's position
          if (outcomeByGwIdx.size === 0) {
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            leagueDataMap[row.id] = {
              id: row.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: null,
              positionChange: null,
              sortedMemberIds: alphabeticalIds,
              latestGwWinners: new Set()
            };
            continue;
          }

          const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
          
          // Filter by league start GW (same as Home page) - use currentGw from meta
          const leagueStartGw = await getLeagueStartGw(league, currentGw);
          const relevantGws = gwsWithResults.filter(g => g >= leagueStartGw);

          if (relevantGws.length === 0) {
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            leagueDataMap[row.id] = {
              id: row.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: null,
              positionChange: null,
              sortedMemberIds: alphabeticalIds,
              latestGwWinners: new Set()
            };
            continue;
          }

          // Get picks for relevant GWs only - EXACT same as Home page
          const memberIds = members.map(m => m.id);
          const { data: allPicks } = await supabase
            .from("picks")
            .select("user_id,gw,fixture_index,pick")
            .in("user_id", memberIds)
            .in("gw", relevantGws);
          
          const picksAll = (allPicks as PickRow[]) ?? [];
          
          // Calculate ML table - EXACT same logic as Home page
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
            const coTop = gwRows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
            gwWinners.set(g, new Set(coTop.map((r) => r.user_id)));

            if (coTop.length === 1) {
              mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
            } else {
              coTop.forEach((r) => {
                mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
              });
            }
          });

          // Build ML table rows - EXACT same as Home page
          const mltRows = members.map((m) => ({
            user_id: m.id,
            name: m.name,
            mltPts: mltPts.get(m.id) ?? 0,
            unicorns: unis.get(m.id) ?? 0,
            ocp: ocp.get(m.id) ?? 0,
          }));

          // Sort EXACTLY like Home page - use the exact same expression
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
              sortedMltRows.push({
                user_id: user.id,
                name: members[memberMatch].name,
                mltPts: 0,
                unicorns: 0,
                ocp: 0
              });
              // Re-sort EXACTLY like Home page
              sortedMltRows.sort((a, b) => 
                b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
              );
              userIndex = sortedMltRows.findIndex(r => r.user_id === user.id);
            }
          }
          
          // CRITICAL: Extract sortedMemberIds from the FINAL sorted array
          // This is the ML table order (1st to last) - EXACTLY matching Home page
          const sortedMemberIds = sortedMltRows.map(r => r.user_id);
          
          // Debug logging - EXACT same as Home page
          console.log(`[${row.name}] Position calculation:`, {
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
          
          // Check which members have submitted for current GW (reuse memberIds from above)
          const { data: submissions } = await supabase
            .from("gw_submissions")
            .select("user_id")
            .eq("gw", currentGw)
            .in("user_id", memberIds);
          
          const submittedMembers = new Set<string>();
          if (submissions) {
            submissions.forEach((s: any) => {
              if (s.user_id) submittedMembers.add(s.user_id);
            });
          }
          
          // Store data - CRITICAL: sortedMemberIds must be stored correctly
          const storedData: LeagueData = {
            id: row.id,
            members: members.sort((a, b) => a.name.localeCompare(b.name)), // Keep alphabetical for other uses
            userPosition,
            positionChange: null,
            submittedMembers,
            sortedMemberIds: [...sortedMemberIds], // Store COPY of ML table order from sortedMltRows
            latestGwWinners: new Set(latestGwWinners)
          };
          
          leagueDataMap[row.id] = storedData;
        } catch (error) {
          console.error(`Error loading data for league ${row.id} (${row.name}):`, error);
          console.error('Error details:', error instanceof Error ? error.message : error);
          leagueDataMap[row.id] = {
            id: row.id,
            members: [],
            userPosition: null,
            positionChange: null,
            sortedMemberIds: [],
            latestGwWinners: new Set()
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
      <div className="max-w-6xl mx-auto px-4 py-4 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Mini Leagues</h2>
          {rows.length > 4 && (
            <button
              onClick={() => {
                const createSection = document.getElementById('create-join-section');
                if (createSection) {
                  createSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="text-[#1C8376] font-semibold text-sm hover:text-[#1C8376] no-underline flex items-center gap-1"
            >
              Create League
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-2 mb-6 text-sm text-slate-600 w-full">
          Create or join a private league and battle it out with your friends.
        </p>

        {error && (
          <div className="mt-4 rounded border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Leagues list */}
        <div className="mt-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-white overflow-hidden shadow-sm w-full animate-pulse"
                  style={{ borderRadius: '12px' }}
                >
                  <div className="p-4 bg-white">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-200" />
                      <div className="flex-1 min-w-0">
                        <div className="h-5 w-32 bg-slate-200 rounded mb-2" />
                        <div className="h-3 w-20 bg-slate-200 rounded mb-4" />
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-8 bg-slate-200 rounded" />
                          <div className="h-4 w-8 bg-slate-200 rounded" />
                          <div className="flex items-center flex-1 overflow-hidden">
                            {[1, 2, 3, 4].map((k) => (
                              <div
                                key={k}
                                className="rounded-full bg-slate-200 flex-shrink-0"
                                style={{
                                  marginLeft: k > 1 ? '-2px' : '0',
                                  width: '24px',
                                  height: '24px',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <div className="h-6 w-6 rounded-full bg-slate-200" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-4 text-sm">No leagues yet.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const data = leagueData[r.id];
                const members = data?.members || [];
                const userPosition = data?.userPosition;
                const unread = unreadByLeague?.[r.id] ?? 0;
                const badge = unread > 0 ? Math.min(unread, 99) : 0;
                
                return (
                  <div key={r.id} className="rounded-xl border bg-white overflow-hidden shadow-sm w-full" style={{ borderRadius: '12px' }}>
                    <Link 
                      to={`/league/${r.code}`} 
                      className="block p-4 !bg-white no-underline hover:text-inherit relative z-0"
                    >
                      <div className="flex items-center gap-3 relative">
                        {/* League Avatar Badge */}
                        <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-slate-100">
                          <img 
                            src={getGenericLeaguePhoto(r.id, 96)} 
                            alt={`${r.name} avatar`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to Picsum Photos if Unsplash fails
                              const target = e.target as HTMLImageElement;
                              const fallbackSrc = getGenericLeaguePhotoPicsum(r.id, 96);
                              if (target.src !== fallbackSrc) {
                                target.src = fallbackSrc;
                              } else {
                                // If Picsum also fails, show calendar icon
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
                        
                        <div className="flex-1 min-w-0 flex flex-col">
                          {/* League Name and Status Row */}
                          <div className="flex items-center gap-2">
                            <div className="text-base font-semibold text-slate-900 truncate">
                              {r.name}
                            </div>
                            {/* Submission Status */}
                            {leagueSubmissions[r.id] && leagueSubmissions[r.id].allSubmitted && (
                              <span className="text-xs font-normal text-[#1C8376] whitespace-nowrap">All Submitted</span>
                            )}
                          </div>
                          
                          {/* Player Chips and Info - ordered by ML table position (1st to last) */}
                          <div className="flex items-center gap-3 mt-1">
                            {/* Member Count and User Position - left of chips */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Member Count */}
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
                              
                              {/* User Position - ML Ranking */}
                              {userPosition !== null && userPosition !== undefined ? (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  <span className="text-sm font-semibold text-slate-900">{ordinal(userPosition)}</span>
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
                              ) : (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  <span className="text-sm font-semibold text-slate-400">—</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Player Chips Container - no gap, chips overlap */}
                            <div className="flex items-center overflow-hidden">
                              {(() => {
                              // CRITICAL: Use ML table order - MUST use sortedMemberIds from data
                              const orderedMemberIds = data?.sortedMemberIds;
                              
                              // CRITICAL: If no sortedMemberIds, we can't render correctly - show error
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
                                
                                return alphabeticalMembers.slice(0, 8).map((member, index) => {
                                  const hasSubmitted = submittedSet.has(member.id);
                                  const isLatestWinner = winnersSet.has(member.id);
                                  
                                  // GPU-optimized: Use CSS classes instead of inline styles
                                  let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
                                  
                                  if (isLatestWinner) {
                                    // Shiny chip for last GW winner (already GPU-optimized with transforms)
                                    chipClassName += ' bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]';
                                  } else if (hasSubmitted) {
                                    // Green = picked (GPU-optimized class)
                                    chipClassName += ' chip-green';
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
                                .filter(Boolean) as LeagueMember[];
                              
                              // Convert Arrays back to Sets for checking (if they're Arrays)
                              const submittedSet = data?.submittedMembers instanceof Set 
                                ? data.submittedMembers 
                                : new Set(data?.submittedMembers ?? []);
                              const winnersSet = data?.latestGwWinners instanceof Set 
                                ? data.latestGwWinners 
                                : new Set(data?.latestGwWinners ?? []);
                              
                              // CRITICAL: Ensure we're using the exact order from sortedMemberIds
                              return orderedMembers.slice(0, 8).map((member, index) => {
                                const hasSubmitted = submittedSet.has(member.id);
                                const isLatestWinner = winnersSet.has(member.id);
                                
                                // GPU-optimized: Use CSS classes instead of inline styles
                                let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
                                
                                if (isLatestWinner) {
                                  // Shiny chip for last GW winner (already GPU-optimized with transforms)
                                  chipClassName += ' bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]';
                                } else if (hasSubmitted) {
                                  // Green = picked (GPU-optimized class)
                                  chipClassName += ' chip-green';
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
                              const orderedMemberIds = data?.sortedMemberIds || members.map(m => m.id);
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
                        <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
                          {badge > 0 && (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold">
                              {badge}
                            </span>
                          )}
                          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
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
        <div id="create-join-section" className="mt-10 mb-3 text-xl font-extrabold text-slate-900">Create or Join</div>

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