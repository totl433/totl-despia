import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import ScrollLogo from "../components/ScrollLogo";
import Section from "../components/Section";
import { LeaderboardCard } from "../components/LeaderboardCard";
import { StreakCard } from "../components/StreakCard";
import { MiniLeagueCard } from "../components/MiniLeagueCard";
import type { LeagueRow, LeagueData } from "../components/MiniLeagueCard";
import { LEAGUE_START_OVERRIDES } from "../lib/leagueStart";
import { FixtureCard, type Fixture as FixtureCardFixture, type LiveScore as FixtureCardLiveScore } from "../components/FixtureCard";
import { useLiveScores } from "../hooks/useLiveScores";
import LiveGamesToggle from "../components/LiveGamesToggle";

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
  kickoff_time?: string | null;
  api_match_id?: number | null;
  test_gw?: number | null;
};

function rowToOutcome(r: { result?: "H" | "D" | "A" | null }): "H" | "D" | "A" | null {
  return r.result === "H" || r.result === "D" || r.result === "A" ? r.result : null;
}

export default function TempHome() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>({});
  const [gw, setGw] = useState<number>(1);
  const [latestGw, setLatestGw] = useState<number | null>(null);
  const [gwPoints, setGwPoints] = useState<Array<{user_id: string, gw: number, points: number}>>([]);
  const [loading, setLoading] = useState(true);
  const [leagueDataLoading, setLeagueDataLoading] = useState(true);
  const [leaderboardDataLoading, setLeaderboardDataLoading] = useState(true);
  
  // Leaderboard rankings
  const [lastGwRank, setLastGwRank] = useState<{ rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null>(null);
  const [fiveGwRank, setFiveGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);
  const [tenGwRank, setTenGwRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);
  const [seasonRank, setSeasonRank] = useState<{ rank: number; total: number; isTied: boolean } | null>(null);
  
  // Additional data for form calculations
  const [allGwPoints, setAllGwPoints] = useState<Array<{user_id: string, gw: number, points: number}>>([]);
  const [overall, setOverall] = useState<Array<{user_id: string, name: string | null, ocp: number | null}>>([]);
  
  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});
  const [leagueData, setLeagueData] = useState<Record<string, LeagueDataInternal>>({});
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixturesLoading, setFixturesLoading] = useState(true);
  const [isInApiTestLeague, setIsInApiTestLeague] = useState(false);
  const [userPicks, setUserPicks] = useState<Record<number, "H" | "D" | "A">>({});
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  
  // Get api_match_ids from fixtures for real-time subscription
  const apiMatchIds = useMemo(() => {
    if (!fixtures || fixtures.length === 0) return [];
    return fixtures
      .map(f => f.api_match_id)
      .filter((id): id is number => id !== null && id !== undefined);
  }, [fixtures]);

  // Subscribe to real-time live scores updates
  const { liveScores: liveScoresMap } = useLiveScores(
    undefined, // Don't filter by GW - listen to all gameweeks
    apiMatchIds.length > 0 ? apiMatchIds : undefined
  );

  // Convert Map to Record format for backward compatibility
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
    }> = {};
    if (!fixtures || fixtures.length === 0) return result;
    
    fixtures.forEach(fixture => {
      const apiMatchId = fixture.api_match_id;
      if (apiMatchId) {
        const liveScore = liveScoresMap.get(apiMatchId);
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
      }
    });
    
    return result;
  }, [liveScoresMap, fixtures]);

  // Fetch basic data (leagues, current GW, leaderboard data)
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setLeaderboardDataLoading(false);
      setLeagueDataLoading(false);
      return;
    }
    
    let alive = true;
    
    (async () => {
      try {
        // 1. Fetch leagues via league_members
        const { data: membersData, error: membersError } = await supabase
          .from("league_members")
          .select("leagues(id, name, code, avatar, created_at)")
          .eq("user_id", user.id);
        
        if (!alive) return;
        
        if (membersError) {
          console.error('[TempHome] Error fetching leagues:', membersError);
          setLeagues([]);
        } else {
          const leaguesData = (membersData ?? [])
            .map((m: any) => m.leagues)
            .filter((l: any) => l !== null) as League[];
          setLeagues(leaguesData);
          
          // Check if user is in API Test league
          const apiTestLeague = leaguesData.find(l => l.name === "API Test");
          setIsInApiTestLeague(!!apiTestLeague);
        }
        
        // 2. Fetch current GW from meta table
        const { data: metaData, error: metaError } = await supabase
          .from("meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        if (!alive) return;
        
        let currentGw = 1;
        if (!metaError && metaData?.current_gw) {
          currentGw = metaData.current_gw;
        }
        setGw(currentGw);
        setLatestGw(currentGw);
        
        // 3. Fetch ALL GW points (for form calculations and streak)
        const { data: allGwPointsData, error: allGwPointsError } = await supabase
          .from("v_gw_points")
          .select("user_id, gw, points")
          .order("gw", { ascending: true });
        
        if (!alive) return;
        
        if (allGwPointsError) {
          console.error('[TempHome] Error fetching all GW points:', allGwPointsError);
          setAllGwPoints([]);
          setGwPoints([]);
        } else {
          const allPoints = (allGwPointsData as Array<{user_id: string, gw: number, points: number}>) ?? [];
          setAllGwPoints(allPoints);
          setGwPoints(allPoints.filter(gp => gp.user_id === user.id));
        }
        
        // 4. Fetch overall/season rankings
        const { data: overallData, error: overallError } = await supabase
          .from("v_ocp_overall")
          .select("user_id, name, ocp");
        
        if (!alive) return;
        
        if (overallError) {
          console.error('[TempHome] Error fetching overall rankings:', overallError);
          setOverall([]);
        } else {
          setOverall((overallData as Array<{user_id: string, name: string | null, ocp: number | null}>) ?? []);
        }
        
        // 5. Calculate Last GW leaderboard ranking
        const lastGwData = (allGwPointsData ?? []).filter((gp: any) => gp.gw === currentGw);
        if (lastGwData.length > 0) {
          const sorted = [...lastGwData].sort((a: any, b: any) => (b.points - a.points) || 0);
          
          let currentRank = 1;
          const ranked = sorted.map((player: any, index: number) => {
            if (index > 0 && sorted[index - 1].points !== player.points) {
              currentRank = index + 1;
            }
            return { ...player, rank: currentRank };
          });
          
          const userEntry = ranked.find((r: any) => r.user_id === user.id);
          if (userEntry) {
            const rankCount = ranked.filter((r: any) => r.rank === userEntry.rank).length;
            const { data: fixturesData } = await supabase
              .from("fixtures")
              .select("id", { count: "exact", head: true })
              .eq("gw", currentGw);
            const totalFixtures = typeof fixturesData === "number" ? fixturesData : 10;
            
            setLastGwRank({
              rank: userEntry.rank,
              total: ranked.length,
              score: userEntry.points,
              gw: currentGw,
              totalFixtures,
              isTied: rankCount > 1
            });
          }
        }
        
        setLoading(false);
        setLeaderboardDataLoading(false);
      } catch (error) {
        console.error('[TempHome] Error fetching data:', error);
        if (alive) {
          setLoading(false);
          setLeaderboardDataLoading(false);
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id]);
  
  // Calculate form rankings and season rank
  useEffect(() => {
    if (!user?.id || !latestGw || allGwPoints.length === 0) return;
    
    let alive = true;
    
    (async () => {
      try {
        // 5-WEEK FORM
        if (latestGw >= 5) {
          const fiveGwStart = latestGw - 4;
          const fiveGwPoints = allGwPoints.filter(gp => gp.gw >= fiveGwStart && gp.gw <= latestGw);
          const fiveGwUserData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
          
          overall.forEach(o => {
            fiveGwUserData.set(o.user_id, {
              user_id: o.user_id,
              name: o.name ?? "User",
              formPoints: 0,
              weeksPlayed: new Set()
            });
          });
          
          fiveGwPoints.forEach(gp => {
            const user = fiveGwUserData.get(gp.user_id);
            if (user) {
              user.formPoints += gp.points ?? 0;
              user.weeksPlayed.add(gp.gw);
            } else {
              fiveGwUserData.set(gp.user_id, {
                user_id: gp.user_id,
                name: "User",
                formPoints: gp.points ?? 0,
                weeksPlayed: new Set([gp.gw])
              });
            }
          });
          
          const sorted = Array.from(fiveGwUserData.values())
            .filter(user => {
              for (let gw = fiveGwStart; gw <= latestGw; gw++) {
                if (!user.weeksPlayed.has(gw)) return false;
              }
              return true;
            })
            .sort((a, b) => (b.formPoints - a.formPoints) || a.name.localeCompare(b.name));
          
          let currentRank = 1;
          const ranked = sorted.map((player, index) => {
            if (index > 0 && sorted[index - 1].formPoints !== player.formPoints) {
              currentRank = index + 1;
            }
            return { ...player, rank: currentRank };
          });
          
          if (ranked.length > 0 && alive) {
            const userEntry = ranked.find(u => u.user_id === user.id);
            if (userEntry) {
              const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
              setFiveGwRank({
                rank: userEntry.rank,
                total: ranked.length,
                isTied: rankCount > 1
              });
            }
          }
        }
        
        // 10-WEEK FORM
        if (latestGw >= 10) {
          const tenGwStart = latestGw - 9;
          const tenGwPoints = allGwPoints.filter(gp => gp.gw >= tenGwStart && gp.gw <= latestGw);
          const tenGwUserData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
          
          overall.forEach(o => {
            tenGwUserData.set(o.user_id, {
              user_id: o.user_id,
              name: o.name ?? "User",
              formPoints: 0,
              weeksPlayed: new Set()
            });
          });
          
          tenGwPoints.forEach(gp => {
            const user = tenGwUserData.get(gp.user_id);
            if (user) {
              user.formPoints += gp.points ?? 0;
              user.weeksPlayed.add(gp.gw);
            } else {
              tenGwUserData.set(gp.user_id, {
                user_id: gp.user_id,
                name: "User",
                formPoints: gp.points ?? 0,
                weeksPlayed: new Set([gp.gw])
              });
            }
          });
          
          const sorted = Array.from(tenGwUserData.values())
            .filter(user => {
              for (let gw = tenGwStart; gw <= latestGw; gw++) {
                if (!user.weeksPlayed.has(gw)) return false;
              }
              return true;
            })
            .sort((a, b) => (b.formPoints - a.formPoints) || a.name.localeCompare(b.name));
          
          let currentRank = 1;
          const ranked = sorted.map((player, index) => {
            if (index > 0 && sorted[index - 1].formPoints !== player.formPoints) {
              currentRank = index + 1;
            }
            return { ...player, rank: currentRank };
          });
          
          if (ranked.length > 0 && alive) {
            const userEntry = ranked.find(u => u.user_id === user.id);
            if (userEntry) {
              const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
              setTenGwRank({
                rank: userEntry.rank,
                total: ranked.length,
                isTied: rankCount > 1
              });
            }
          }
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
          }
        }
      } catch (e) {
        console.error('[TempHome] Error calculating form rankings:', e);
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, latestGw, allGwPoints, overall]);

  // Fetch league data with chip logic
  useEffect(() => {
    if (!user?.id) {
      setLeagueDataLoading(false);
      return;
    }
    
    if (leagues.length === 0) {
      setLeagueDataLoading(false);
      return;
    }
    
    if (gw === null) return;
    
    let alive = true;
    
    (async () => {
      try {
        setLeagueData({});
        setLeagueDataLoading(true);
        
        const leagueIds = leagues.map(l => l.id);
        
        // Fetch members for all leagues
        const { data: membersData } = await supabase
          .from("league_members")
          .select("league_id, user_id, users!inner(id, name)")
          .in("league_id", leagueIds);
        
        if (!alive) return;
        
        const membersByLeague: Record<string, LeagueMember[]> = {};
        (membersData ?? []).forEach((m: any) => {
          if (!membersByLeague[m.league_id]) {
            membersByLeague[m.league_id] = [];
          }
          membersByLeague[m.league_id].push({
            id: m.users.id,
            name: m.users.name
          });
        });
        
        const allMemberIds = Array.from(new Set(Object.values(membersByLeague).flat().map(m => m.id)));
        
        // Fetch unread counts
        const { data: readsData } = await supabase
          .from("league_message_reads")
          .select("league_id, last_read_at")
          .eq("user_id", user.id)
          .in("league_id", leagueIds);
        
        const lastReadMap = new Map<string, string>();
        (readsData ?? []).forEach((r: any) => {
          lastReadMap.set(r.league_id, r.last_read_at);
        });
        
        const picksPromises = leagues.map(async (league) => {
          const memberIds = (membersByLeague[league.id] ?? []).map(m => m.id);
          if (memberIds.length === 0) return { leagueId: league.id, picks: [] };
          
          const { data: picksData } = await supabase
            .from("picks")
            .select("user_id, gw, fixture_index, pick")
            .in("user_id", memberIds);
          
          return { leagueId: league.id, picks: (picksData ?? []) as PickRow[] };
        });
        
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
        
        const [unreadCountResults, { data: submissionsData }, { data: allResults }, { data: fixturesData }, picksResults] = await Promise.all([
          Promise.all(unreadCountPromises),
          supabase.from("gw_submissions").select("user_id").eq("gw", gw).in("user_id", allMemberIds.length > 0 ? allMemberIds : ['']),
          supabase.from("gw_results").select("gw, fixture_index, result"),
          supabase.from("fixtures").select("gw, kickoff_time").in("gw", Array.from({ length: 20 }, (_, i) => i + 1)),
          Promise.all(picksPromises)
        ]);
        
        if (!alive) return;
        
        const submittedUserIds = new Set((submissionsData ?? []).map((s: any) => s.user_id));
        
        const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
        (allResults ?? []).forEach((r: any) => {
          const out = rowToOutcome(r);
          if (out) {
            outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
          }
        });
        
        if (!alive) return;
        
        const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
        const relevantFixtures = (fixturesData ?? []).filter((f: any) => 
          gwsWithResults.length > 0 ? gwsWithResults.includes(f.gw) : f.gw === 1
        );
        
        const unreadCounts: Record<string, number> = {};
        unreadCountResults.forEach(({ leagueId, count }) => {
          unreadCounts[leagueId] = count;
        });
        setUnreadByLeague(unreadCounts);
        
        const picksByLeague = new Map<string, PickRow[]>();
        picksResults.forEach(({ leagueId, picks }) => {
          picksByLeague.set(leagueId, picks);
        });
        
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
            for (const gw of gwsWithResults) {
              const deadline = gwDeadlines.get(gw);
              if (deadline && leagueCreatedAt <= deadline) {
                leagueStartGws.set(league.id, gw);
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
            const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
            leagueDataMap[league.id] = {
              id: league.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition: null,
              positionChange: null,
              submittedMembers: Array.from(memberIds.filter(id => submittedUserIds.has(id))),
              sortedMemberIds: alphabeticalIds,
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
            const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
            const alphabeticalIds = sortedMembers.map(m => m.id);
            const submittedMembers = memberIds.filter(id => submittedUserIds.has(id));
            leagueDataMap[league.id] = {
              id: league.id,
              members: sortedMembers,
              userPosition: null,
              positionChange: null,
              submittedMembers: Array.from(submittedMembers),
              sortedMemberIds: alphabeticalIds,
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
            const gw = parseInt(gwStr, 10);
            const idx = parseInt(idxStr, 10);
            if (relevantGwsSet.has(gw)) {
              outcomeByGwAndIdx.get(gw)?.set(idx, out);
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
                if (row) {
                  row.unicorns += 1;
                }
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
          
          const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
          const submittedMembers = memberIds.filter(id => submittedUserIds.has(id));
          
          leagueDataMap[league.id] = {
            id: league.id,
            members: sortedMembers,
            userPosition,
            positionChange: null,
            submittedMembers: Array.from(submittedMembers),
            sortedMemberIds,
            latestGwWinners: Array.from(latestGwWinners),
            latestRelevantGw
          };
        });
        
        setLeagueSubmissions(submissionStatus);
        setLeagueData(leagueDataMap);
        setLeagueDataLoading(false);
      } catch (error) {
        console.error('[TempHome] Error fetching league data:', error);
        setLeagueDataLoading(false);
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, leagues, gw]);

  // Fetch fixtures and picks for API Test league
  useEffect(() => {
    if (!user?.id || !isInApiTestLeague) {
      setFixtures([]);
      setFixturesLoading(false);
      setUserPicks({});
      return;
    }
    
    let alive = true;
    
    (async () => {
      try {
        const [fixturesResult, picksResult] = await Promise.all([
          supabase
            .from("test_api_fixtures")
            .select("id, test_gw, fixture_index, api_match_id, home_code, away_code, home_team, away_team, home_name, away_name, kickoff_time")
            .eq("test_gw", 2)
            .order("fixture_index", { ascending: true }),
          supabase
            .from("picks")
            .select("fixture_index, pick")
            .eq("gw", 2)
            .eq("user_id", user.id)
        ]);
        
        if (!alive) return;
        
        if (fixturesResult.error) {
          console.error('[TempHome] Error fetching fixtures:', fixturesResult.error);
          setFixtures([]);
        } else {
          const fixturesData = fixturesResult.data ?? [];
          setFixtures(fixturesData.map((f: any) => ({ ...f, gw: f.test_gw })) as Fixture[]);
        }
        
        if (picksResult.error) {
          console.error('[TempHome] Error fetching picks:', picksResult.error);
          setUserPicks({});
        } else {
          const picksMap: Record<number, "H" | "D" | "A"> = {};
          (picksResult.data ?? []).forEach((p: { fixture_index: number; pick: "H" | "D" | "A" }) => {
            picksMap[p.fixture_index] = p.pick;
          });
          setUserPicks(picksMap);
        }

        setFixturesLoading(false);
      } catch (error) {
        console.error('[TempHome] Error fetching fixtures/picks:', error);
        if (alive) {
          setFixtures([]);
          setFixturesLoading(false);
          setUserPicks({});
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, isInApiTestLeague]);

  // Calculate score component
  const scoreComponent = useMemo(() => {
    if (!isInApiTestLeague || fixtures.length === 0) return null;
    
    const hasSubmittedPicks = Object.keys(userPicks).length > 0;
    let score = 0;
    let liveCount = 0;
    let finishedCount = 0;
    let allFinished = true;
    let hasAnyActive = false;
    
    fixtures.forEach(f => {
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
          const isCorrect = 
            (pick === 'H' && liveScore.homeScore > liveScore.awayScore) ||
            (pick === 'A' && liveScore.awayScore > liveScore.homeScore) ||
            (pick === 'D' && liveScore.homeScore === liveScore.awayScore);
          if (isCorrect) score++;
        }
      } else {
        allFinished = false;
      }
    });
    
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

  // Check if there are any live games
  const hasLiveGames = useMemo(() => {
    return fixtures.some(f => {
      const liveScore = liveScores[f.fixture_index];
      return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
    });
  }, [fixtures, liveScores]);

  // Calculate streak data
  const userStreakData = useMemo(() => {
    if (!user?.id || !latestGw) return null;
    
    const userGwPoints = gwPoints
      .filter(gp => gp.user_id === user.id)
      .sort((a, b) => b.gw - a.gw);
    
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

  // Sort leagues by unread
  const sortedLeagues = useMemo(() => {
    return [...leagues].sort((a, b) => {
      const unreadA = unreadByLeague?.[a.id] ?? 0;
      const unreadB = unreadByLeague?.[b.id] ?? 0;
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadA === 0 && unreadB > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [leagues, unreadByLeague]);

  const isDataReady = !loading && !leaderboardDataLoading && !leagueDataLoading;

  return (
    <div className="max-w-6xl mx-auto px-2 pt-2 pb-4 min-h-screen relative">
      <ScrollLogo />
      
      {!isDataReady ? (
        <div className="p-4 text-slate-500">Loading...</div>
      ) : (
        <>
          {/* LEADERBOARDS - COMPONENT HP */}
          <Section title="LEADERBOARDS - COMPONENT HP">
            <div 
              className="overflow-x-auto scrollbar-hide" 
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none', 
                WebkitOverflowScrolling: 'touch', 
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x pan-y pinch-zoom',
                marginLeft: '-1.5rem',
                marginRight: '-1.5rem',
                paddingLeft: '1rem',
                paddingRight: '1rem',
                width: 'calc(100% + 3rem)'
              }}
            >
              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
                <LeaderboardCard
                  title="Last GW"
                  linkTo="/global?tab=lastgw"
                  rank={lastGwRank?.rank ?? null}
                  total={lastGwRank?.total ?? null}
                  score={lastGwRank?.score}
                  gw={lastGwRank?.gw}
                  totalFixtures={lastGwRank?.totalFixtures}
                  variant="lastGw"
                />

                <LeaderboardCard
                  title="5-WEEK FORM"
                  badgeSrc="/assets/5-week-form-badge.png"
                  badgeAlt="5-Week Form Badge"
                  linkTo="/global?tab=form5"
                  rank={fiveGwRank?.rank ?? null}
                  total={fiveGwRank?.total ?? null}
                />

                <LeaderboardCard
                  title="10-WEEK FORM"
                  badgeSrc="/assets/10-week-form-badge.png"
                  badgeAlt="10-Week Form Badge"
                  linkTo="/global?tab=form10"
                  rank={tenGwRank?.rank ?? null}
                  total={tenGwRank?.total ?? null}
                />

                <LeaderboardCard
                  title="SEASON RANK"
                  badgeSrc="/assets/season-rank-badge.png"
                  badgeAlt="Season Rank Badge"
                  linkTo="/global?tab=overall"
                  rank={seasonRank?.rank ?? null}
                  total={seasonRank?.total ?? null}
                />

                {userStreakData && (
                  <StreakCard
                    streak={userStreakData.streak}
                    last10GwScores={userStreakData.last10GwScores}
                    latestGw={latestGw ?? 1}
                  />
                )}
              </div>
            </div>
          </Section>

          {/* Mini Leagues section */}
          <section className="mt-6">
            <div className="flex items-center justify-between mb-2 pt-5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-medium text-slate-500 uppercase tracking-wide">
                  Mini Leagues
                </h2>
                <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center">
                  <span className="text-[10px] text-slate-500 font-bold">i</span>
                </div>
              </div>
            </div>
            <div>
              {!leagueDataLoading && leagues.length === 0 ? (
                <div className="p-6 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-slate-600 mb-3">You don't have any mini leagues yet.</div>
                  <Link 
                    to="/create-league" 
                    className="inline-block px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg hover:bg-[#1C8376]/80 transition-colors no-underline"
                  >
                    Create one now!
                  </Link>
                </div>
              ) : sortedLeagues.length > 0 ? (
                <div 
                  className="overflow-x-auto scrollbar-hide" 
                  style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none', 
                    WebkitOverflowScrolling: 'touch', 
                    overscrollBehaviorX: 'contain',
                    overscrollBehaviorY: 'auto',
                    touchAction: 'pan-x pan-y pinch-zoom',
                    marginLeft: '-1.5rem',
                    marginRight: '-1.5rem',
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    width: 'calc(100% + 3rem)'
                  }}
                >
                  <style>{`
                    .scrollbar-hide::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
                    {(() => {
                      return Array.from({ length: Math.ceil(sortedLeagues.length / 3) }).map((_, batchIdx) => {
                        const startIdx = batchIdx * 3;
                        const batchLeagues = sortedLeagues.slice(startIdx, startIdx + 3);
                        
                        return (
                          <div key={batchIdx} className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm w-[320px]">
                            {batchLeagues.map((l, index) => {
                              const unread = unreadByLeague?.[l.id] ?? 0;
                              const data = leagueData[l.id];
                              const cardData: LeagueData | undefined = data ? {
                                id: data.id,
                                members: data.members,
                                userPosition: data.userPosition,
                                positionChange: data.positionChange,
                                submittedMembers: data.submittedMembers,
                                sortedMemberIds: data.sortedMemberIds,
                                latestGwWinners: data.latestGwWinners,
                                latestRelevantGw: data.latestRelevantGw
                              } : undefined;
                              
                              return (
                                <div key={l.id} className={index < batchLeagues.length - 1 ? 'relative' : ''}>
                                  {index < batchLeagues.length - 1 && (
                                    <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-30 pointer-events-none" />
                                  )}
                                  <div className="[&>div]:border-0 [&>div]:shadow-none [&>div]:rounded-none [&>div]:bg-transparent relative z-20 [&>div>a]:!p-4">
                                    <MiniLeagueCard
                                      row={l as LeagueRow}
                                      data={cardData}
                                      unread={unread}
                                      submissions={leagueSubmissions[l.id]}
                                      leagueDataLoading={leagueDataLoading}
                                      currentGw={gw}
                                      showRanking={false}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-slate-600">Loading leagues...</div>
                </div>
              )}
            </div>
          </section>

          {/* Games section */}
      <Section 
        title="Games"
        subtitle="Test Game Week 2"
        className="mt-6"
        headerRight={
          <div className="flex items-center gap-3">
            {hasLiveGames && (
              <LiveGamesToggle value={showLiveOnly} onChange={setShowLiveOnly} />
            )}
            {scoreComponent}
          </div>
        }
      >
        {fixturesLoading ? (
          <div className="p-4 text-slate-500">Loading fixtures...</div>
        ) : fixtures.length === 0 ? (
          <div className="p-4 text-slate-500">No fixtures yet.</div>
        ) : (
          <div className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm">
            {(() => {
              // Filter to live games only if toggle is on
              let fixturesToShow = fixtures;
              if (showLiveOnly) {
                fixturesToShow = fixtures.filter(f => {
                  const liveScore = liveScores[f.fixture_index];
                  return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
                });
              }
              
              return fixturesToShow.map((f, index) => {
                // Convert fixture to FixtureCard format
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
              
              // Convert live score to FixtureCard format
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
              
              return (
                <div key={f.id} className={index < fixturesToShow.length - 1 ? 'relative' : ''}>
                  {index < fixturesToShow.length - 1 && (
                    <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-10" />
                  )}
                  <FixtureCard
                    fixture={fixtureCardFixture}
                    pick={userPicks[f.fixture_index]}
                    liveScore={fixtureCardLiveScore}
                    isTestApi={isInApiTestLeague}
                    showPickButtons={true}
                  />
                </div>
              );
              });
            })()}
          </div>
        )}
      </Section>

          {/* Bottom padding to prevent content from being hidden under bottom nav */}
          <div className="h-20"></div>
        </>
      )}
    </div>
  );
}
