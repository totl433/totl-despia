import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getMediumName } from "../lib/teamNames";
import WhatsAppBanner from "../components/WhatsAppBanner";

// Types
type League = { id: string; name: string; code: string };
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
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, boolean>>({});
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
  const leagueIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      // User's leagues
      const { data: lm } = await supabase
        .from("league_members")
        .select("leagues(id,name,code)")
        .eq("user_id", user?.id);

      const ls: League[] = (lm as any[])?.map((r) => r.leagues).filter(Boolean) ?? [];

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
        if (alive) setUnreadByLeague(out);
      } catch (e) {
        // best-effort; ignore errors
      }

      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setLoading(false);

      // Check submission status for each league
      const submissionStatus: Record<string, boolean> = {};
      for (const league of ls) {
        try {
          // Get all members of this league
          const { data: members } = await supabase
            .from("league_members")
            .select("user_id")
            .eq("league_id", league.id);
          
          if (members && members.length > 0) {
            const memberIds = members.map(m => m.user_id);
            
            // Check if all members have submitted for current GW
            const { data: submissions } = await supabase
              .from("gw_submissions")
              .select("user_id")
              .eq("gw", currentGw)
              .in("user_id", memberIds);
            
            const submittedCount = submissions?.length || 0;
            submissionStatus[league.id] = submittedCount === memberIds.length;
          } else {
            submissionStatus[league.id] = false;
          }
        } catch (error) {
          console.warn(`Error checking submissions for league ${league.id}:`, error);
          submissionStatus[league.id] = false;
        }
      }
      setLeagueSubmissions(submissionStatus);
      
      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

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
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
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
                <span>👥</span>
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
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
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
          {loading ? (
            <div className="p-4 text-slate-500">Loading…</div>
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
            <div className="overflow-x-auto -mr-4 scrollbar-hide snap-x snap-mandatory">
              <div className="flex gap-3 pb-2 pr-4" style={{ width: 'max-content' }}>
                {Array.from({ length: Math.ceil(leagues.length / 4) }).map((_, pageIdx) => {
                  const startIdx = pageIdx * 4;
                  const pageLeagues = leagues.slice(startIdx, startIdx + 4);
                  return (
                    <div key={pageIdx} className="snap-start" style={{ width: 'calc(100vw - 6rem)' }}>
                      <div className="flex flex-col gap-3">
                        {pageLeagues.map((l) => {
                          const unread = unreadByLeague?.[l.id] ?? 0;
                          const badge = unread > 0 ? Math.min(unread, 99) : 0;
                          return (
                            <div key={l.id} className="rounded-xl border bg-slate-50 overflow-hidden">
                              <Link
                                to={`/league/${l.code}`}
                                className="block p-3 bg-white hover:bg-emerald-50 transition-colors no-underline"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-base font-semibold text-slate-900 truncate">
                                      {l.name}
                                    </div>
                                    {leagueSubmissions[l.id] && (
                                      <div className="text-xs text-[#1C8376] font-bold mt-0.5">
                                        All Submitted
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {badge > 0 && (
                                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold">
                                        {badge}
                                      </span>
                                    )}
                                    <div className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-200 transition-colors">
                                      View
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Games (first GW) */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
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

    </div>
  );
}
