import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getMediumName } from "../lib/teamNames";
import WhatsAppBanner from "../components/WhatsAppBanner";
import { getLeagueAvatarPath, getDeterministicLeagueAvatar } from "../lib/leagueAvatars";

// Module-level cache for home page data
type HomePageCache = {
  leagues: League[];
  leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
  leagueData: Record<string, LeagueData>;
  unreadByLeague: Record<string, number>;
  lastFetched: number;
  userId: string | null;
};

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
let homePageCache: HomePageCache | null = null;

// Types
type League = { id: string; name: string; code: string; avatar?: string | null };
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

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (typeof r.home_goals === "number" && typeof r.away_goals === "number") {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}
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
  kickoff_time?: string | null;
};

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };

// Results for outcome + helper to derive H/D/A if only goals exist


export default function HomePage() {
  const { user } = useAuth();
  const [oldSchoolMode] = useState(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>({});
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [gw, setGw] = useState<number>(1);
  const [gwSubmitted, setGwSubmitted] = useState<boolean>(false);
  const [gwScore, setGwScore] = useState<number | null>(null);
  const [picksMap, setPicksMap] = useState<Record<number, "H" | "D" | "A">>({});
  const [resultsMap, setResultsMap] = useState<Record<number, "H" | "D" | "A">>({});
  const [loading, setLoading] = useState(true);
  const [globalCount, setGlobalCount] = useState<number | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [prevGlobalRank, setPrevGlobalRank] = useState<number | null>(null);
  const [nextGwComing, setNextGwComing] = useState<number | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastScoreGw, setLastScoreGw] = useState<number | null>(null);

  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});
  const [leagueData, setLeagueData] = useState<Record<string, LeagueData>>({});
  const leagueIdsRef = useRef<Set<string>>(new Set());
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    let alive = true;
    
    // Check cache first - show cached data immediately if available
    if (homePageCache && homePageCache.userId === user?.id) {
      const cacheAge = Date.now() - homePageCache.lastFetched;
      if (cacheAge < CACHE_DURATION) {
        // Cache is valid - show it immediately
        setLeagues(homePageCache.leagues);
        setLeagueSubmissions(homePageCache.leagueSubmissions);
        setLeagueData(homePageCache.leagueData);
        setUnreadByLeague(homePageCache.unreadByLeague);
        leagueIdsRef.current = new Set(homePageCache.leagues.map((l) => l.id));
        setLoading(false);
        
        // If cache is older than 30 seconds, refresh in background
        if (cacheAge > 30 * 1000) {
          isInitialMountRef.current = false;
        } else {
          // Cache is fresh, skip fetching
          return () => { alive = false; };
        }
      }
    }
    
    (async () => {
      if (!isInitialMountRef.current) {
        // Background refresh - don't show loading spinner
        setLoading(false);
      } else {
        setLoading(true);
      }

      // User's leagues
      let ls: League[] = [];
      const { data: lm, error: lmError } = await supabase
        .from("league_members")
        .select("leagues(id,name,code,avatar)")
        .eq("user_id", user?.id);

      if (lmError) {
        console.error("Error fetching leagues:", lmError);
        // Try without avatar field if it doesn't exist
        const { data: lmFallback } = await supabase
          .from("league_members")
          .select("leagues(id,name,code)")
          .eq("user_id", user?.id);
        ls = (lmFallback as any[])?.map((r) => r.leagues).filter(Boolean) ?? [];
      } else {
        ls = (lm as any[])?.map((r) => r.leagues).filter(Boolean) ?? [];
      }
      
      // Assign avatars to leagues that don't have one (backfill - only once)
      // Use deterministic avatar based on league ID so it's consistent even if DB update fails
      const leaguesNeedingAvatars = ls.filter(l => !l.avatar || l.avatar === null || l.avatar === '');
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
            const leagueIndex = ls.findIndex(l => l.id === league.id);
            if (leagueIndex !== -1) {
              ls[leagueIndex].avatar = avatar;
              console.log(`Assigned avatar ${avatar} to league ${league.name}`);
            }
          } else {
            console.warn(`Failed to assign avatar to league ${league.id} (${league.name}):`, updateError.message);
            // Even if DB update fails, assign locally using deterministic method
            // This ensures the same league always shows the same avatar
            const leagueIndex = ls.findIndex(l => l.id === league.id);
            if (leagueIndex !== -1) {
              ls[leagueIndex].avatar = avatar;
            }
          }
        }
      }
      
      if (alive) setLeagues(ls);

      // Get current GW from meta table (published/active GW)
      const { data: meta } = await supabase
        .from("meta")
        .select("current_gw")
        .eq("id", 1)
        .maybeSingle();
      const currentGw = (meta as any)?.current_gw ?? 1;

      // All fixtures ordered by GW then index
      const { data: fx } = await supabase
        .from("fixtures")
        .select(
          "id,gw,fixture_index,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time"
        )
        .order("gw")
        .order("fixture_index");

      const fixturesList: Fixture[] = (fx as Fixture[]) ?? [];
      const thisGwFixtures = fixturesList.filter(f => f.gw === currentGw);
      setGw(currentGw);

      // Determine the most recent GW that has published results, and compute my score for it
      try {
        const { data: lastGwRows } = await supabase
          .from("gw_results")
          .select("gw")
          .order("gw", { ascending: false })
          .limit(1);

        const lastGwWithResults = Array.isArray(lastGwRows) && lastGwRows.length ? (lastGwRows[0] as any).gw as number : null;

        if (lastGwWithResults != null) {
          // fetch results for that GW
          const [{ data: rs2 }, { data: pk2 }] = await Promise.all([
            supabase.from("gw_results").select("fixture_index,result").eq("gw", lastGwWithResults),
            supabase.from("picks").select("fixture_index,pick").eq("gw", lastGwWithResults).eq("user_id", user?.id),
          ]);

          const outMap2 = new Map<number, "H" | "D" | "A">();
          (rs2 as Array<{ fixture_index: number; result: "H" | "D" | "A" | null }> | null)?.forEach(r => {
            if (r.result === "H" || r.result === "D" || r.result === "A") outMap2.set(r.fixture_index, r.result);
          });

          let myScore = 0;
          (pk2 as Array<{ fixture_index: number; pick: "H" | "D" | "A" }> | null)?.forEach(p => {
            const out = outMap2.get(p.fixture_index);
            if (out && out === p.pick) myScore += 1;
          });

          if (alive) {
            setLastScoreGw(lastGwWithResults);
            setLastScore(myScore);
          }
        } else {
          if (alive) {
            setLastScoreGw(null);
            setLastScore(null);
          }
        }
      } catch (_) {
        // ignore; leave lastScore/lastScoreGw as-is
      }

      // Don't show "coming soon" message - only show current active GW
      setNextGwComing(null);

      // Load this user's picks for that GW so we can show the dot under Home/Draw/Away
      let userPicks: PickRow[] = [];
      if (thisGwFixtures.length) {
        const { data: pk } = await supabase
          .from("picks")
          .select("user_id,gw,fixture_index,pick")
          .eq("user_id", user?.id)
          .eq("gw", currentGw);
        userPicks = (pk as PickRow[]) ?? [];
      }

      // Check if user has submitted (confirmed) their predictions
      let submitted = false;
      if (user?.id && thisGwFixtures.length > 0) {
        const { data: submission } = await supabase
          .from("gw_submissions")
          .select("submitted_at")
          .eq("user_id", user.id)
          .eq("gw", currentGw)
          .maybeSingle();
        
        submitted = !!submission?.submitted_at;
      }

      let score: number | null = null;
      if (thisGwFixtures.length) {
        // Prefer GW-scoped results so it works wherever fixture IDs differ
        const { data: rs } = await supabase
          .from("gw_results")
          .select("gw,fixture_index,result")
          .eq("gw", currentGw);
        const results = (rs as Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>) ?? [];

        // Build fixture_index -> outcome map directly
        const outcomeByIdx = new Map<number, "H" | "D" | "A">();
        results.forEach((r) => {
          if (r && (r.result === "H" || r.result === "D" || r.result === "A")) {
            outcomeByIdx.set(r.fixture_index, r.result);
          }
        });

        // Populate resultsMap for the current GW
        const currentResultsMap: Record<number, "H" | "D" | "A"> = {};
        outcomeByIdx.forEach((result, fixtureIndex) => {
          currentResultsMap[fixtureIndex] = result;
        });
        setResultsMap(currentResultsMap);

        if (outcomeByIdx.size > 0) {
          // count correct picks
          let s = 0;
          userPicks.forEach((p) => {
            const out = outcomeByIdx.get(p.fixture_index);
            if (out && out === p.pick) s += 1;
          });
          score = s;
        }
      }

      if (!alive) return;

      setGwSubmitted(submitted);
      setGwScore(score);

      // Only populate picksMap if user has submitted (confirmed) their predictions
      const map: Record<number, "H" | "D" | "A"> = {};
      if (submitted) {
        userPicks.forEach((p) => (map[p.fixture_index] = p.pick));
      }

      setLeagues(ls);
      leagueIdsRef.current = new Set(ls.map((l) => l.id));

      // unread-by-league (robust)
      try {
        let reads: any[] | null = null;
        try {
          const { data, error } = await supabase
            .from("league_message_reads")
            .select("league_id,last_read_at")
            .eq("user_id", user?.id);
          if (error) {
            console.warn("league_message_reads not accessible, defaulting to no reads", error?.message);
            reads = null;
          } else {
            reads = data as any[] | null;
          }
        } catch (err: any) {
          console.warn("league_message_reads query failed — defaulting to no reads", err?.message);
          reads = null;
        }

        const lastRead = new Map<string, string>();
        (reads ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

        const out: Record<string, number> = {};
        for (const lg of ls) {
          const since = lastRead.get(lg.id) ?? "1970-01-01T00:00:00Z";
          const { data: msgs, count, error } = await supabase
            .from("league_messages")
            .select("id", { count: "exact" })
            .eq("league_id", lg.id)
            .gte("created_at", since);
          if (error) {
            console.warn("unread count query error", lg.id, error?.message);
          }
          out[lg.id] = typeof count === "number" ? count : (msgs?.length ?? 0);
        }
        if (alive) {
          setUnreadByLeague(out);
          
          // Update cache with unreadByLeague
          if (homePageCache && homePageCache.userId === user?.id) {
            homePageCache.unreadByLeague = out;
            homePageCache.lastFetched = Date.now();
          }
        }
      } catch (e) {
        // best-effort; ignore errors
      }

      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setLoading(false);

      // Check submission status for each league
      const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
      for (const league of ls) {
        try {
          // Get all members of this league
          const { data: members } = await supabase
            .from("league_members")
            .select("user_id")
            .eq("league_id", league.id);
          
          if (members && members.length > 0) {
            const memberIds = members.map(m => m.user_id);
            const totalCount = memberIds.length;
            
            // Check how many members have submitted for current GW
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
        } catch (error) {
          console.warn(`Error checking submissions for league ${league.id}:`, error);
          submissionStatus[league.id] = {
            allSubmitted: false,
            submittedCount: 0,
            totalCount: 0
          };
        }
      }
      setLeagueSubmissions(submissionStatus);
      
      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setLoading(false);
      
      // Update cache with fresh data (leagueData will be updated in next useEffect)
      // Note: unreadByLeague is updated separately above
      if (alive && user?.id) {
        homePageCache = {
          leagues: ls,
          leagueSubmissions: submissionStatus,
          leagueData: {}, // Will be updated when leagueData useEffect runs
          unreadByLeague: {}, // Will be updated when unreadByLeague is set above
          lastFetched: Date.now(),
          userId: user.id,
        };
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Fetch member data and calculate positions for each league
  useEffect(() => {
    if (!leagues.length || !user?.id) return;
    
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
      
      for (const league of leagues) {
        try {
          // Fetch members with their names
          const { data: membersData } = await supabase
            .from("league_members")
            .select("user_id, users(id, name)")
            .eq("league_id", league.id);
          
          const members: LeagueMember[] = (membersData ?? [])
            .map((m: any) => ({
              id: m.user_id,
              name: m.users?.name || "Unknown"
            }))
            .filter((m: LeagueMember) => m.name !== "Unknown");

          if (members.length === 0) {
            leagueDataMap[league.id] = {
              id: league.id,
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
          
          leagueDataMap[league.id] = {
            id: league.id,
            members: members.sort((a, b) => a.name.localeCompare(b.name)),
            userPosition: finalPosition,
            positionChange
          };
        } catch (error) {
          console.warn(`Error loading data for league ${league.id}:`, error);
          leagueDataMap[league.id] = {
            id: league.id,
            members: [],
            userPosition: null,
            positionChange: null
          };
        }
      }
      
      if (alive) {
        setLeagueData(leagueDataMap);
        
        // Update cache with leagueData
        if (homePageCache && homePageCache.userId === user?.id) {
          homePageCache.leagueData = leagueDataMap;
          homePageCache.lastFetched = Date.now();
        }
      }
    })();
    
    return () => {
      alive = false;
    };
  }, [leagues, user?.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) Player count — prefer users head count; fall back to distinct pickers
        let countSet = false;
        try {
          const { count: usersCount } = await supabase
            .from("users")
            .select("id", { count: "exact", head: true });
          if (alive && typeof usersCount === "number") {
            setGlobalCount(usersCount);
            countSet = true;
          }
        } catch (_) { /* ignore */ }

        if (!countSet) {
          try {
            const { count: pickUsers } = await supabase
              .from("picks")
              .select("user_id", { count: "exact", head: true });
            if (alive && typeof pickUsers === "number") setGlobalCount(pickUsers);
          } catch (_) { /* ignore */ }
        }

        // 2) Rank — use same logic as Global page (v_ocp_overall)
        try {
          const { data: ocp } = await supabase
            .from("v_ocp_overall")
            .select("user_id, ocp")
            .order("ocp", { ascending: false });
          if (alive && Array.isArray(ocp) && ocp.length) {
            const idx = ocp.findIndex((row: any) => row.user_id === user?.id);
            if (idx !== -1) {
              console.log('Using v_ocp_overall (same as Global page):', idx + 1, 'from', ocp.length, 'players');
              setGlobalRank(idx + 1);
              
              // Also calculate previous rank (before latest GW)
              // We need to fetch gw_points to calculate previous rank
              try {
                const { data: gwPointsData } = await supabase
                  .from("v_gw_points")
                  .select("user_id, gw, points");
                
                if (gwPointsData && gwPointsData.length > 0) {
                  const latestGw = Math.max(...gwPointsData.map((r: any) => r.gw));
                  
                  // Calculate previous OCP (excluding latest GW)
                  const prevOcp = new Map<string, number>();
                  gwPointsData.forEach((r: any) => {
                    if (r.gw < latestGw) {
                      prevOcp.set(r.user_id, (prevOcp.get(r.user_id) || 0) + (r.points || 0));
                    }
                  });
                  
                  // Sort by previous OCP
                  const prevOrdered = Array.from(prevOcp.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
                  const prevIdx = prevOrdered.findIndex(([uid]) => uid === user?.id);
                  
                  if (prevIdx !== -1) {
                    console.log('Previous rank from v_gw_points:', prevIdx + 1);
                    if (alive) setPrevGlobalRank(prevIdx + 1);
                  }
                }
              } catch (e) {
                console.log('Could not calculate previous rank:', e);
              }
              
              return; // done
            }
          }
        } catch (_) { /* ignore */ }

        // 2c) compute from picks + gw_results (client-side)
        try {
          const [{ data: rs }, { data: pk }, { data: submissions }] = await Promise.all([
            supabase.from("gw_results").select("gw,fixture_index,result"),
            supabase.from("picks").select("user_id,gw,fixture_index,pick"),
            supabase.from("gw_submissions").select("user_id,gw,submitted_at"),
          ]);

          const results = (rs as Array<{gw:number, fixture_index:number, result:"H"|"D"|"A"|null}>) || [];
          const picksAll = (pk as Array<{user_id:string,gw:number,fixture_index:number,pick:"H"|"D"|"A"}>) || [];
          const subs = (submissions as Array<{user_id:string,gw:number,submitted_at:string}>) || [];

          // Build map of submitted users per GW
          const submittedMap = new Map<string, boolean>();
          subs.forEach(s => {
            if (s.submitted_at) {
              submittedMap.set(`${s.user_id}:${s.gw}`, true);
            }
          });

          // map gw:idx -> outcome
          const outMap = new Map<string, "H"|"D"|"A">();
          results.forEach(r => { if (r.result === "H" || r.result === "D" || r.result === "A") outMap.set(`${r.gw}:${r.fixture_index}`, r.result); });

          // Get latest GW with results
          const latestGw = Math.max(...results.map(r => r.gw));
          
          // Calculate current scores (all GWs) - only count picks from users who submitted
          const scores = new Map<string, number>();
          picksAll.forEach(p => {
            // Only count picks from users who have submitted for this GW
            if (!submittedMap.get(`${p.user_id}:${p.gw}`)) return;
            const out = outMap.get(`${p.gw}:${p.fixture_index}`);
            if (!out) return;
            if (p.pick === out) scores.set(p.user_id, (scores.get(p.user_id) || 0) + 1);
            else if (!scores.has(p.user_id)) scores.set(p.user_id, 0);
          });

          // Calculate previous scores (up to latest GW - 1) - only count picks from users who submitted
          const prevScores = new Map<string, number>();
          picksAll.forEach(p => {
            if (p.gw >= latestGw) return; // Skip latest GW
            // Only count picks from users who have submitted for this GW
            if (!submittedMap.get(`${p.user_id}:${p.gw}`)) return;
            const out = outMap.get(`${p.gw}:${p.fixture_index}`);
            if (!out) return;
            if (p.pick === out) prevScores.set(p.user_id, (prevScores.get(p.user_id) || 0) + 1);
            else if (!prevScores.has(p.user_id)) prevScores.set(p.user_id, 0);
          });

          if (scores.size) {
            const ordered = Array.from(scores.entries()).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
            const myIndex = ordered.findIndex(([uid]) => uid === user?.id);
            if (alive && myIndex !== -1) {
              console.log('Current rank calculation:', {
                myIndex,
                rank: myIndex + 1,
                myScore: scores.get(user?.id ?? ""),
                ordered: ordered.slice(0, 5).map(([uid, score]) => ({ uid: uid.slice(0, 8), score }))
              });
              setGlobalRank(myIndex + 1);
            }

            // Calculate previous rank if we have previous scores
            console.log('Previous scores debug:', {
              prevScoresSize: prevScores.size,
              latestGw,
              hasUserInPrevScores: prevScores.has(user?.id ?? ""),
              userPrevScore: prevScores.get(user?.id ?? "")
            });
            
            if (prevScores.size > 0) {
              const prevOrdered = Array.from(prevScores.entries()).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
              const prevMyIndex = prevOrdered.findIndex(([uid]) => uid === user?.id);
              console.log('Previous rank calculation:', {
                prevMyIndex,
                prevRank: prevMyIndex !== -1 ? prevMyIndex + 1 : 'not found',
                prevScore: prevScores.get(user?.id ?? ""),
                prevOrdered: prevOrdered.slice(0, 5).map(([uid, score]) => ({ uid: uid.slice(0, 8), score }))
              });
              if (alive && prevMyIndex !== -1) {
                setPrevGlobalRank(prevMyIndex + 1);
              }
            } else {
              console.log('No previous scores found - prevScores is empty');
            }
          }
        } catch (_) { /* ignore */ }
      } finally { /* no-op */ }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Realtime: increment unread badge on new messages in any of my leagues
  useEffect(() => {
    const channel = supabase
      .channel(`home-unreads:${user?.id ?? "anon"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "league_messages" },
        (payload) => {
          try {
            const lg = (payload as any)?.new?.league_id as string | undefined;
            const sender = (payload as any)?.new?.user_id as string | undefined;
            if (!lg) return;
            if (!leagueIdsRef.current.has(lg)) return;
            if (sender && sender === user?.id) return;
            setUnreadByLeague((prev) => ({
              ...prev,
              [lg]: (prev?.[lg] ?? 0) + 1,
            }));
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // When window gains focus (e.g., user read chat and returns), resync unread counts
  useEffect(() => {
    const onFocus = async () => {
      try {
        const { data: reads } = await supabase
          .from("league_message_reads")
          .select("league_id,last_read_at")
          .eq("user_id", user?.id);

        const lastRead = new Map<string, string>();
        (reads ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

        const out: Record<string, number> = {};
        for (const leagueId of leagueIdsRef.current) {
          const since = lastRead.get(leagueId) ?? "1970-01-01T00:00:00Z";
          const { data: msgs, count } = await supabase
            .from("league_messages")
            .select("id", { count: "exact" })
            .eq("league_id", leagueId)
            .gte("created_at", since);
          out[leagueId] = typeof count === "number" ? count : (msgs?.length ?? 0);
        }
        setUnreadByLeague(out);
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);

  const Section: React.FC<{
    title: string;
    subtitle?: React.ReactNode;
    headerRight?: React.ReactNode;
    className?: string;
    boxed?: boolean; // if false, render children without the outer card
    children?: React.ReactNode;
  }> = ({ title, subtitle, headerRight, className, boxed = true, children }) => (
    <section className={className ?? ""}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {headerRight && (
          <div>
            {headerRight}
          </div>
        )}
      </div>
      {subtitle && (
        <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
      )}
      {boxed ? (
        <div className="mt-3 rounded-2xl border bg-slate-50 overflow-hidden">{children}</div>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </section>
  );

  const Dot: React.FC<{ correct?: boolean }> = ({ correct }) => {
    if (correct === true) {
      return <span className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 shadow-xl shadow-yellow-400/40 ring-2 ring-yellow-300/60 transform scale-125 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]" />;
    } else if (correct === false) {
      return <span className="inline-block h-5 w-5 rounded-full bg-red-500 border-2 border-white shadow ring-1 ring-red-300" />;
    } else {
      return <span className="inline-block h-5 w-5 rounded-full bg-[#1C8376] border-2 border-white shadow ring-1 ring-emerald-300" />;
    }
  };

  const LeaderCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    subtitle?: React.ReactNode;
    footerLeft?: React.ReactNode;
    footerRight?: React.ReactNode;
    className?: string;
    to?: string;
    compactFooter?: boolean;
  }> = ({ title, icon, subtitle, footerLeft, footerRight, className, to, compactFooter }) => {
    const inner = (
      <div className={"h-full rounded-3xl border-2 border-[#1C8376]/20 bg-slate-50/80 p-4 sm:p-6 " + (className ?? "")}>
        <div className="flex items-start gap-3">
          <div className={"rounded-full bg-white shadow-inner flex items-center justify-center flex-shrink-0 " + (compactFooter ? "h-12 w-12 sm:h-14 sm:w-14" : "h-14 w-14 sm:h-16 sm:w-16")}>
            {icon}
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 whitespace-nowrap">{title}</div>
          {subtitle && (
            <div className="text-sm font-bold text-[#1C8376] mt-1">
              {subtitle}
            </div>
          )}
        </div>
        {(footerLeft || footerRight) && (
          <div className="mt-3 flex items-center gap-3 text-[#1C8376]">
            {footerLeft && (
              <div className={"flex items-center gap-1 " + (compactFooter ? "text-sm sm:text-base" : "text-lg sm:text-xl")}>
                {footerLeft}
              </div>
            )}
            {footerRight && (
              <div className={"flex items-center gap-1 " + (compactFooter ? "text-sm sm:text-base" : "text-lg sm:text-xl")}>
                {footerRight}
              </div>
            )}
          </div>
        )}
      </div>
    );
    if (to) {
      return (
        <Link to={to} className="no-underline block hover:bg-emerald-50/40 rounded-3xl">
          {inner}
        </Link>
      );
    }
    return inner;
  };

  const SkeletonLoader = () => (
    <>
      {/* Leaderboard Skeleton */}
      <Section title="The Leaderboard" boxed={false}>
        <div className="grid grid-cols-2 gap-4">
          {/* Global Leaderboard Skeleton */}
          <div className="h-full rounded-3xl border-2 border-slate-200 bg-slate-50/80 p-4 sm:p-6 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-slate-200 flex-shrink-0" />
            </div>
            <div className="mt-2">
              <div className="h-6 w-32 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-5 w-16 bg-slate-200 rounded" />
              <div className="h-5 w-12 bg-slate-200 rounded" />
            </div>
          </div>
          {/* GW Card Skeleton */}
          <div className="h-full rounded-3xl border-2 border-slate-200 bg-amber-50/60 p-4 sm:p-6 animate-pulse relative">
            <div className="absolute top-4 left-4 h-4 w-12 bg-slate-200 rounded" />
            <div className="absolute bottom-4 left-4 h-4 w-32 bg-slate-200 rounded" />
            <div className="flex items-center justify-center h-full">
              <div className="h-16 w-16 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </Section>

      {/* Mini Leagues Skeleton */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-2" style={{ width: 'max-content' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="rounded-xl border bg-white overflow-hidden shadow-sm w-[320px] animate-pulse"
                    style={{ borderRadius: '12px' }}
                  >
                    <div className="p-4 bg-white">
                      <div className="flex items-start gap-3">
                        {/* Avatar skeleton */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-200" />
                        <div className="flex-1 min-w-0">
                          {/* League name skeleton */}
                          <div className="h-5 w-32 bg-slate-200 rounded mb-2" />
                          {/* Submission status skeleton */}
                          <div className="h-3 w-20 bg-slate-200 rounded mb-4" />
                          {/* Member info skeleton */}
                          <div className="flex items-center gap-3">
                            <div className="h-4 w-8 bg-slate-200 rounded" />
                            <div className="h-4 w-8 bg-slate-200 rounded" />
                            <div className="flex items-center flex-1 overflow-hidden">
                              {[1, 2, 3].map((k) => (
                                <div
                                  key={k}
                                  className="rounded-full bg-slate-200 flex-shrink-0"
                                  style={{
                                    marginLeft: k > 1 ? '-2px' : '0',
                                    width: '18px',
                                    height: '18px',
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Badge skeleton */}
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <div className="h-6 w-6 rounded-full bg-slate-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Games Section Skeleton (if it exists) */}
      <section className="mt-8">
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mb-3" />
        <div className="rounded-2xl border bg-slate-50 overflow-hidden p-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white rounded-lg border border-slate-200 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    </>
  );

  const GWCard: React.FC<{ gw: number; score: number | null; submitted: boolean; }> = ({ gw, score, submitted }) => {
    const display = score !== null ? score : (submitted ? 0 : NaN);
    return (
      <div className="h-full rounded-3xl border-2 border-[#1C8376]/20 bg-amber-50/60 p-4 sm:p-6 relative flex items-center justify-center">
        {/* Corner badges */}
        <div className="absolute top-4 left-4 text-[#1C8376] text-sm sm:text-base font-semibold">
          GW{gw}
        </div>
        <div className="absolute bottom-4 left-4 text-[#1C8376] text-sm sm:text-base font-semibold">
          Last week's score
        </div>
        {/* Big score */}
        <div>
          {Number.isNaN(display) ? (
            <span className="text-5xl sm:text-6xl text-slate-900">—</span>
          ) : (
            <span className="text-5xl sm:text-6xl text-slate-900">{display}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`max-w-6xl mx-auto px-4 py-4 min-h-screen ${oldSchoolMode ? 'oldschool-theme' : ''}`}>
      <WhatsAppBanner />
      {loading && isInitialMountRef.current ? (
        <SkeletonLoader />
      ) : (
        <>
          {/* Leaderboards */}
          <Section title="The Leaderboard" boxed={false}>
        <div className="grid grid-cols-2 gap-4">
          <LeaderCard
            to="/global"
            title="TotL Global"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-[#1C8376]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            }
            subtitle={
              globalRank !== null && globalCount !== null && globalCount > 0 ? (
                <>Top {Math.round((globalRank / globalCount) * 100)}%</>
              ) : null
            }
            compactFooter
            footerLeft={
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-600" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                <span className="font-semibold">{globalCount ?? "—"}</span>
                <div className="flex items-center gap-1">
                  {(() => {
                    console.log('Rank indicator debug:', { globalRank, prevGlobalRank });
                    if (globalRank !== null && prevGlobalRank !== null) {
                      if (globalRank < prevGlobalRank) {
                        return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-xs font-bold">▲</span>;
                      } else if (globalRank > prevGlobalRank) {
                        return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold">▼</span>;
                      } else {
                        return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-500 text-white text-xs font-bold">→</span>;
                      }
                    }
                    return null;
                  })()}
                  <span className="font-semibold">{globalRank ?? "—"}</span>
                </div>
              </div>
            }
          />
          <GWCard gw={lastScoreGw ?? gw} score={lastScore} submitted={false} />
        </div>
      </Section>

      {/* Mini Leagues section */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Mini Leaguez
          </h2>
          {leagues.length > 4 && (
            <Link
              to="/tables"
              className="text-[#1C8376] font-semibold text-sm hover:text-[#1C8376] no-underline"
            >
              Show All
            </Link>
          )}
        </div>
        <div>
          {loading && isInitialMountRef.current && leagues.length === 0 ? (
            <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex gap-2" style={{ width: 'max-content' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="rounded-xl border bg-white overflow-hidden shadow-sm w-[320px] animate-pulse"
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
                                  {[1, 2, 3].map((k) => (
                                    <div
                                      key={k}
                                      className="rounded-full bg-slate-200 flex-shrink-0"
                                      style={{
                                        marginLeft: k > 1 ? '-2px' : '0',
                                        width: '18px',
                                        height: '18px',
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
                ))}
              </div>
            </div>
          ) : leagues.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border border-slate-200 text-center">
              <div className="text-slate-600 mb-3">You don't have any mini leagues yet.</div>
              <Link 
                to="/leagues" 
                className="inline-block px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg hover:bg-[#1C8376]/80 transition-colors no-underline"
              >
                Create one now!
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex gap-2" style={{ width: 'max-content' }}>
                {(() => {
                  // Sort leagues: those with unread messages first
                  const sortedLeagues = [...leagues].sort((a, b) => {
                    const unreadA = unreadByLeague?.[a.id] ?? 0;
                    const unreadB = unreadByLeague?.[b.id] ?? 0;
                    if (unreadA > 0 && unreadB === 0) return -1;
                    if (unreadA === 0 && unreadB > 0) return 1;
                    return 0; // Keep original order for leagues with same unread status
                  });
                  
                  return Array.from({ length: Math.ceil(sortedLeagues.length / 3) }).map((_, colIdx) => {
                    const startIdx = colIdx * 3;
                    const columnLeagues = sortedLeagues.slice(startIdx, startIdx + 3);
                    return (
                      <div key={colIdx} className="flex flex-col gap-2">
                        {columnLeagues.map((l) => {
                        const unread = unreadByLeague?.[l.id] ?? 0;
                        const badge = unread > 0 ? Math.min(unread, 99) : 0;
                        const data = leagueData[l.id];
                        const members = data?.members || [];
                        const userPosition = data?.userPosition;
                        
                        return (
                          <div key={l.id} className="rounded-xl border bg-white overflow-hidden shadow-sm w-[320px]" style={{ borderRadius: '12px' }}>
                              <Link
                                to={`/league/${l.code}`}
                                className="block p-4 bg-white no-underline hover:text-inherit"
                              >
                                <div className="flex items-start gap-3">
                                  {/* League Avatar Badge */}
                                  <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center overflow-hidden">
                                    <img 
                                      src={getLeagueAvatarPath(l.avatar)} 
                                      alt={`${l.name} avatar`}
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
                                    <div className="text-base font-semibold text-slate-900 truncate">
                                      {l.name}
                                    </div>
                                    
                                    {/* Submission Status */}
                                    {leagueSubmissions[l.id] && (
                                      <div className="text-xs font-normal text-slate-600 mt-0.5 mb-4">
                                        {leagueSubmissions[l.id].allSubmitted ? (
                                          <span className="text-[#1C8376]">All Submitted</span>
                                        ) : (
                                          <span>{leagueSubmissions[l.id].submittedCount} submitted</span>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Member Info Row */}
                                    <div className="flex items-center gap-3">
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
                                  
                                  {/* View Button and Badge */}
                                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    {badge > 0 && (
                                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold">
                                        {badge}
                                      </span>
                                    )}
                                    <div className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-200 transition-colors hidden">
                                      View
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Games (first GW) */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Games
          </h2>
          {fixtures.length > 0 && !gwSubmitted && gwScore === null && (
            <div>
              <Link to="/new-predictions" className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors underline">Make your predictions</Link>
            </div>
          )}
        </div>
        <div className="text-slate-700 font-semibold text-lg mt-2 mb-0">
          <div className="flex justify-between items-center">
            <span>Game Week {gw}</span>
          </div>
          {nextGwComing ? (
            <div className="mt-1">
              <span className="font-semibold">GW{nextGwComing} coming soon</span>
            </div>
          ) : null}
        </div>
        {fixtures.length === 0 ? (
          <div className="p-4 text-slate-500">No fixtures yet.</div>
        ) : (
          <div>
            {(() => {
              // Group fixtures by day name
              const grouped: Record<string, Fixture[]> = {};
              fixtures.forEach((f) => {
                const day = f.kickoff_time
                  ? new Date(f.kickoff_time).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
                  : "Unknown";
                if (!grouped[day]) grouped[day] = [];
                grouped[day].push(f);
              });
              const days = Object.keys(grouped);
              let idx = 0;
              return days.map((day, dayIdx) => (
                <div key={day}>
                  <div className={`${dayIdx === 0 ? 'mt-3' : 'mt-6'} mb-2 text-slate-700 font-semibold text-lg`}>{day}</div>
                  <div className="rounded-2xl border bg-slate-50 overflow-hidden mb-4">
                    <ul>
                      {grouped[day].map((f) => {
                        const pick = picksMap[f.fixture_index];
                        const homeKey = f.home_code || f.home_name || f.home_team || "";
                        const awayKey = f.away_code || f.away_name || f.away_team || "";

                        const homeName = getMediumName(homeKey);
                        const awayName = getMediumName(awayKey);

                        const homeBadge = `/assets/badges/${homeKey.toUpperCase()}.png`;
                        const awayBadge = `/assets/badges/${awayKey.toUpperCase()}.png`;
                        const liClass = idx++ ? "border-t" : undefined;
                        return (
                          <li key={f.id} className={liClass}>
                            <div className="p-4 bg-white">
                              <div className="grid grid-cols-3 items-center">
                                <div className="flex items-center justify-center">
                                  <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{homeName}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                  <img src={homeBadge} alt={`${homeName} badge`} className="h-6 w-6" />
                                  <div className="text-[15px] sm:text-base font-semibold text-slate-600">
                                    {f.kickoff_time
                                      ? (() => {
                                          const d = new Date(f.kickoff_time);
                                          const hh = String(d.getUTCHours()).padStart(2, '0');
                                          const mm = String(d.getUTCMinutes()).padStart(2, '0');
                                          return `${hh}:${mm}`;
                                        })()
                                      : ""}
                                  </div>
                                  <img src={awayBadge} alt={`${awayName} badge`} className="h-6 w-6" />
                                </div>
                                <div className="flex items-center justify-center">
                                  <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{awayName}</span>
                                </div>
                              </div>
                              {/* Row: dots under H/D/A, always centered in each third */}
                              <div className="mt-3 grid grid-cols-3">
                                <div className="relative h-8">
                                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                    {pick === "H" ? (
                                      <Dot correct={resultsMap[f.fixture_index] ? resultsMap[f.fixture_index] === "H" : undefined} />
                                    ) : resultsMap[f.fixture_index] === "H" ? (
                                      <span className="inline-block h-5 w-5 rounded-full bg-gray-300 border-2 border-white shadow ring-1 ring-gray-200" />
                                    ) : (
                                      <span className="h-5" />
                                    )}
                                  </div>
                                </div>
                                <div className="relative h-8">
                                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                    {pick === "D" ? (
                                      <Dot correct={resultsMap[f.fixture_index] ? resultsMap[f.fixture_index] === "D" : undefined} />
                                    ) : resultsMap[f.fixture_index] === "D" ? (
                                      <span className="inline-block h-5 w-5 rounded-full bg-gray-300 border-2 border-white shadow ring-1 ring-gray-200" />
                                    ) : (
                                      <span className="h-5" />
                                    )}
                                  </div>
                                </div>
                                <div className="relative h-8">
                                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                    {pick === "A" ? (
                                      <Dot correct={resultsMap[f.fixture_index] ? resultsMap[f.fixture_index] === "A" : undefined} />
                                    ) : resultsMap[f.fixture_index] === "A" ? (
                                      <span className="inline-block h-5 w-5 rounded-full bg-gray-300 border-2 border-white shadow ring-1 ring-gray-200" />
                                    ) : (
                                      <span className="h-5" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
