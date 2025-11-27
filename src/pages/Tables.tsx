import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { MiniLeagueCard } from "../components/MiniLeagueCard";
import type { LeagueRow, LeagueData } from "../components/MiniLeagueCard";
import { getDeterministicLeagueAvatar } from "../lib/leagueAvatars";
import { LEAGUE_START_OVERRIDES } from "../lib/leagueStart";

// Types
type League = { 
  id: string; 
  name: string; 
  code: string; 
  avatar?: string | null; 
  created_at?: string | null; 
  start_gw?: number | null;
};

type LeagueMember = { id: string; name: string };
type ResultRowRaw = {
  gw: number;
  fixture_index: number;
  result?: "H" | "D" | "A" | null;
};
type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  return null;
}

export default function TablesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [leagueDataLoading, setLeagueDataLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [error, setError] = useState("");
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>({});
  const [leagueData, setLeagueData] = useState<Record<string, LeagueData>>({});
  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});
  const [currentGw, setCurrentGw] = useState<number | null>(null);

  // Load leagues, submissions, unread counts - optimized
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    let alive = true;
    
    (async () => {
      try {
        // Parallel fetch: memberships, current GW, and leagues in one batch
        const [membershipsResult, fixturesResult] = await Promise.all([
          supabase.from("league_members").select("league_id").eq("user_id", user.id),
          supabase.from("fixtures").select("gw").order("gw", { ascending: false }).limit(1)
        ]);
        
        if (membershipsResult.error) throw membershipsResult.error;
        if (!alive) return;
        
        const leagueIds = (membershipsResult.data ?? []).map((r: any) => r.league_id);
        if (!leagueIds.length) {
          setRows([]);
          setCurrentGw(null);
          setLoading(false);
          return;
        }

        const fixturesList = (fixturesResult.data as Array<{ gw: number }>) ?? [];
        const currentGw = fixturesList.length ? Math.max(...fixturesList.map((f) => f.gw)) : 1;
        setCurrentGw(currentGw);

        // Fetch leagues
        const { data: leaguesData, error: lErr } = await supabase
          .from("leagues")
          .select("id,name,code,created_at,avatar")
          .in("id", leagueIds)
          .order("created_at", { ascending: true });
        
        if (lErr) throw lErr;
        if (!alive) return;
        
        const leagues = (leaguesData ?? []) as League[];
        
        // Assign avatars (non-blocking)
        for (const league of leagues) {
          if (!league.avatar) {
            league.avatar = getDeterministicLeagueAvatar(league.id);
            void supabase.from("leagues").update({ avatar: league.avatar }).eq("id", league.id);
          }
        }

        // Parallel fetch: members and reads
        const [memDataResult, readsResult] = await Promise.all([
          supabase.from("league_members").select("league_id,user_id").in("league_id", leagues.map((l) => l.id)),
          supabase.from("league_message_reads").select("league_id,last_read_at").eq("user_id", user.id)
        ]);
        
        if (memDataResult.error) throw memDataResult.error;
        if (!alive) return;
        
        const membersByLeague = new Map<string, string[]>();
        (memDataResult.data ?? []).forEach((r: any) => {
          const arr = membersByLeague.get(r.league_id) ?? [];
          arr.push(r.user_id);
          membersByLeague.set(r.league_id, arr);
        });

        const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
        const allMemberIds = Array.from(new Set(Array.from(membersByLeague.values()).flat()));
        
        const apiTestLeague = leagues.find(l => l.name === "API Test");
        const apiTestMemberIds = apiTestLeague ? (membersByLeague.get(apiTestLeague.id) ?? []) : [];
        const regularMemberIds = apiTestLeague 
          ? allMemberIds.filter(id => !apiTestMemberIds.includes(id))
          : allMemberIds;
        
        // Parallel fetch: submissions and test API data
        const [submissionsResult, testMetaResult] = await Promise.all([
          regularMemberIds.length > 0
            ? supabase.from("gw_submissions").select("user_id").eq("gw", currentGw).in("user_id", regularMemberIds)
            : Promise.resolve({ data: [], error: null }),
          apiTestLeague && apiTestMemberIds.length > 0
            ? supabase.from("test_api_meta").select("current_test_gw").eq("id", 1).maybeSingle()
            : Promise.resolve({ data: null, error: null })
        ]);
        
        const submittedUserIds = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id));
        let testApiSubmittedUserIds = new Set<string>();
        
        if (apiTestLeague && apiTestMemberIds.length > 0 && testMetaResult.data) {
          const currentTestGw = (testMetaResult.data as any)?.current_test_gw ?? 1;
          
          const [testSubsResult, testPicksResult, testFixturesResult] = await Promise.all([
            supabase
              .from("test_api_submissions")
              .select("user_id,submitted_at")
              .eq("matchday", currentTestGw)
              .in("user_id", apiTestMemberIds)
              .not("submitted_at", "is", null),
            supabase
              .from("test_api_picks")
              .select("user_id,fixture_index")
              .eq("matchday", currentTestGw)
              .in("user_id", apiTestMemberIds),
            supabase
              .from("test_api_fixtures")
              .select("fixture_index")
              .eq("test_gw", currentTestGw)
              .order("fixture_index", { ascending: true })
          ]);
          
          if (testFixturesResult.data && testPicksResult.data && testSubsResult.data) {
            const currentFixtureIndicesSet = new Set(testFixturesResult.data.map((f: any) => f.fixture_index));
            const requiredFixtureCount = currentFixtureIndicesSet.size;
            
            testSubsResult.data.forEach((sub: any) => {
              const userPicks = (testPicksResult.data ?? []).filter((p: any) => p.user_id === sub.user_id);
              const picksForCurrentFixtures = userPicks.filter((p: any) => currentFixtureIndicesSet.has(p.fixture_index));
              const hasAllRequiredPicks = picksForCurrentFixtures.length === requiredFixtureCount && requiredFixtureCount > 0;
              const uniqueFixtureIndices = new Set(picksForCurrentFixtures.map((p: any) => p.fixture_index));
              const hasExactMatch = uniqueFixtureIndices.size === requiredFixtureCount;
              
              if (hasAllRequiredPicks && hasExactMatch) {
                testApiSubmittedUserIds.add(sub.user_id);
              }
            });
          }
        }
        
        // Calculate submission status
        for (const league of leagues) {
          const memberIds = membersByLeague.get(league.id) ?? [];
          const totalCount = memberIds.length;
          const submittedCount = league.id === apiTestLeague?.id
            ? memberIds.filter(id => testApiSubmittedUserIds.has(id)).length
            : memberIds.filter(id => submittedUserIds.has(id)).length;
          
          submissionStatus[league.id] = {
            allSubmitted: submittedCount === totalCount && totalCount > 0,
            submittedCount,
            totalCount
          };
        }
        setLeagueSubmissions(submissionStatus);

        // Fetch unread counts
        const unreadCounts: Record<string, number> = {};
        try {
          const lastRead = new Map<string, string>();
          (readsResult.data ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));
          
          const leagueIds = leagues.map(l => l.id);
          if (leagueIds.length > 0) {
            const sinceMap = new Map<string, string>();
            leagueIds.forEach(id => {
              sinceMap.set(id, lastRead.get(id) ?? "1970-01-01T00:00:00Z");
            });
            
            const earliestSince = Math.min(...Array.from(sinceMap.values()).map(s => new Date(s).getTime()));
            const earliestSinceStr = new Date(earliestSince).toISOString();
            
            const { data: allMessages } = await supabase
              .from("league_messages")
              .select("id,league_id,created_at")
              .in("league_id", leagueIds)
              .gte("created_at", earliestSinceStr);
            
            leagueIds.forEach(leagueId => {
              const since = sinceMap.get(leagueId)!;
              const unread = (allMessages ?? []).filter((m: any) => 
                m.league_id === leagueId && new Date(m.created_at) > new Date(since)
              ).length;
              unreadCounts[leagueId] = unread;
            });
          }
        } catch (e) {
          // Silent fail
        }
        setUnreadByLeague(unreadCounts);

        // Build rows
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

        // Sort rows: unread messages first
        out.sort((a, b) => {
          const unreadA = unreadCounts[a.id] ?? 0;
          const unreadB = unreadCounts[b.id] ?? 0;
          if (unreadA > 0 && unreadB === 0) return -1;
          if (unreadA === 0 && unreadB > 0) return 1;
          return 0;
        });

        if (alive) {
          setRows(out);
          setLoading(false);
        }
      } catch (e: any) {
        if (alive) {
          setError(e?.message ?? "Failed to load leagues.");
          setLoading(false);
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id]);

  // Fetch league data - optimized
  useEffect(() => {
    if (!rows.length || !user?.id || !currentGw) {
      setLeagueDataLoading(false);
      return;
    }
    
    setLeagueDataLoading(true);
    let alive = true;
    
    (async () => {
      try {
        const [metaResult, allResultsResult] = await Promise.all([
          supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle(),
          supabase.from("gw_results").select("gw,fixture_index,result")
        ]);
        
        const currentGw = (metaResult.data as any)?.current_gw ?? 1;
        if (!alive) return;
        
        const { data: allResults } = allResultsResult;
        const resultList = (allResults as ResultRowRaw[]) ?? [];
        const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
        for (const r of resultList) {
          const out = rowToOutcome(r);
          if (out) outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
        }

        const leagueDataMap: Record<string, LeagueData> = {};
        const allLeagueIds = rows.map(r => r.id);
        const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
        
        // Parallel fetch: members, leagues metadata, and fixtures
        const [allMembersResult, leaguesMetaResult, allFixturesResult] = await Promise.all([
          supabase
            .from("league_members")
            .select("league_id,user_id, users(id, name)")
            .in("league_id", allLeagueIds)
            .limit(10000),
          supabase.from("leagues").select("id,name,created_at").in("id", allLeagueIds),
          gwsWithResults.length > 0
            ? supabase
                .from("fixtures")
                .select("gw,kickoff_time")
                .in("gw", gwsWithResults)
                .order("gw", { ascending: true })
                .order("kickoff_time", { ascending: true })
            : Promise.resolve({ data: [], error: null })
        ]);
        
        const membersByLeagueId = new Map<string, LeagueMember[]>();
        (allMembersResult.data ?? []).forEach((m: any) => {
          if (!m.users?.name) return;
          const arr = membersByLeagueId.get(m.league_id) ?? [];
          arr.push({ id: m.user_id, name: m.users.name });
          membersByLeagueId.set(m.league_id, arr);
        });
        
        const leaguesMetaData = leaguesMetaResult.data ?? [];
        const leaguesMetaMap = new Map<string, any>();
        leaguesMetaData.forEach((l: any) => {
          leaguesMetaMap.set(l.id, l);
        });
        
        const allFixtures = allFixturesResult.data ?? [];
        const fixturesByGw = new Map<number, string[]>();
        allFixtures.forEach((f: any) => {
          const arr = fixturesByGw.get(f.gw) ?? [];
          arr.push(f.kickoff_time);
          fixturesByGw.set(f.gw, arr);
        });
        
        // Calculate start_gw for all leagues
        const leagueStartGwMap = new Map<string, number>();
        for (const row of rows) {
          const meta = leaguesMetaMap.get(row.id);
          const league = {
            id: row.id,
            name: meta?.name ?? row.name,
            created_at: (meta?.created_at ?? row.created_at) || null,
            start_gw: meta?.start_gw ?? row.start_gw
          };
          
          let leagueStartGw = currentGw;
          const override = league.name ? LEAGUE_START_OVERRIDES[league.name] : undefined;
          if (typeof override === "number") {
            leagueStartGw = override;
          } else if (league.start_gw !== null && league.start_gw !== undefined) {
            leagueStartGw = league.start_gw;
          } else if (league.created_at && gwsWithResults.length > 0) {
            const leagueCreatedAt = new Date(league.created_at);
            const DEADLINE_BUFFER_MINUTES = 75;
            
            for (const gw of gwsWithResults) {
              const gwFixtures = fixturesByGw.get(gw);
              if (gwFixtures && gwFixtures.length > 0) {
                const firstKickoff = new Date(gwFixtures[0]);
                const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
                if (leagueCreatedAt <= deadlineTime) {
                  leagueStartGw = gw;
                  break;
                }
              }
            }
            
            if (leagueStartGw === currentGw && gwsWithResults.length > 0) {
              leagueStartGw = Math.max(...gwsWithResults) + 1;
            }
          }
          leagueStartGwMap.set(row.id, leagueStartGw);
        }
        
        // Fetch submissions and picks in parallel
        const allMemberIdsArray = Array.from(new Set(Array.from(membersByLeagueId.values()).flat().map(m => m.id)));
        const allRelevantGws = new Set<number>();
        rows.forEach(row => {
          const leagueStartGw = leagueStartGwMap.get(row.id) ?? currentGw;
          gwsWithResults.filter(g => g >= leagueStartGw).forEach(gw => allRelevantGws.add(gw));
        });
        
        const allSubmissionsResult = allMemberIdsArray.length > 0
          ? await supabase
              .from("gw_submissions")
              .select("user_id")
              .eq("gw", currentGw)
              .in("user_id", allMemberIdsArray)
              .limit(10000)
          : { data: [], error: null };
        
        const submittedUserIdsSet = new Set((allSubmissionsResult.data ?? []).map((s: any) => s.user_id));
        
        // Fetch picks per league (parallel)
        const picksPromises = rows.map(async (row) => {
          const members = membersByLeagueId.get(row.id) ?? [];
          const memberIds = members.map(m => m.id);
          if (memberIds.length === 0 || allRelevantGws.size === 0) {
            return { leagueId: row.id, picks: [] };
          }
          
          const { data: picksData } = await supabase
            .from("picks")
            .select("user_id,gw,fixture_index,pick")
            .in("user_id", memberIds)
            .in("gw", Array.from(allRelevantGws));
          
          return { leagueId: row.id, picks: (picksData ?? []) as PickRow[] };
        });
        
        const picksResults = await Promise.all(picksPromises);
        const picksByLeague = new Map<string, PickRow[]>();
        picksResults.forEach(({ leagueId, picks }) => {
          picksByLeague.set(leagueId, picks);
        });
        
        // Process leagues
        for (const row of rows) {
          try {
            const members = (membersByLeagueId.get(row.id) ?? []).filter((m: LeagueMember) => m.name !== "Unknown");
            
            // Special handling for API Test league
            const leagueMeta = leaguesMetaMap.get(row.id);
            if (row.name === 'API Test' || leagueMeta?.name === 'API Test') {
              const alphabeticalIds = members.sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id);
              
              const submittedMembers = new Set<string>();
              const { data: testMeta } = await supabase
                .from("test_api_meta")
                .select("current_test_gw")
                .eq("id", 1)
                .maybeSingle();
              
              const currentTestGw = (testMeta as any)?.current_test_gw ?? 1;
              const memberIds = members.map(m => m.id);
              
              if (memberIds.length > 0) {
                const [testSubsResult, testPicksResult, testFixturesResult] = await Promise.all([
                  supabase
                    .from("test_api_submissions")
                    .select("user_id,submitted_at")
                    .eq("matchday", currentTestGw)
                    .in("user_id", memberIds)
                    .not("submitted_at", "is", null),
                  supabase
                    .from("test_api_picks")
                    .select("user_id,fixture_index")
                    .eq("matchday", currentTestGw)
                    .in("user_id", memberIds),
                  supabase
                    .from("test_api_fixtures")
                    .select("fixture_index")
                    .eq("test_gw", currentTestGw)
                    .order("fixture_index", { ascending: true })
                ]);
                
                if (testFixturesResult.data && testPicksResult.data && testSubsResult.data) {
                  const currentFixtureIndicesSet = new Set(testFixturesResult.data.map((f: any) => f.fixture_index));
                  const requiredFixtureCount = currentFixtureIndicesSet.size;
                  
                  testSubsResult.data.forEach((sub: any) => {
                    const userPicks = (testPicksResult.data ?? []).filter((p: any) => p.user_id === sub.user_id);
                    const picksForCurrentFixtures = userPicks.filter((p: any) => currentFixtureIndicesSet.has(p.fixture_index));
                    const hasAllRequiredPicks = picksForCurrentFixtures.length === requiredFixtureCount && requiredFixtureCount > 0;
                    const uniqueFixtureIndices = new Set(picksForCurrentFixtures.map((p: any) => p.fixture_index));
                    const hasExactMatch = uniqueFixtureIndices.size === requiredFixtureCount;
                    
                    if (hasAllRequiredPicks && hasExactMatch) {
                      submittedMembers.add(sub.user_id);
                    }
                  });
                }
              }
              
              leagueDataMap[row.id] = {
                id: row.id,
                members: members.sort((a, b) => a.name.localeCompare(b.name)),
                userPosition: alphabeticalIds.indexOf(user.id) + 1 || null,
                positionChange: null,
                sortedMemberIds: alphabeticalIds,
                latestGwWinners: new Set(),
                latestRelevantGw: null,
                submittedMembers
              };
              continue;
            }

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
            
            const leagueStartGw = leagueStartGwMap.get(row.id) ?? currentGw;
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

            const picksAll = (picksByLeague.get(row.id) ?? []).filter((p: PickRow) => 
              relevantGws.includes(p.gw)
            );
            
            // Calculate ML table
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
            
            const submittedMembers = new Set<string>();
            const memberIds = members.map(m => m.id);
            memberIds.forEach((userId: string) => {
              if (submittedUserIdsSet.has(userId)) {
                submittedMembers.add(userId);
              }
            });
            
            // Ensure all members are included
            const allMemberIds = members.map(m => m.id);
            const missingFromSorted = allMemberIds.filter(id => !sortedMemberIds.includes(id));
            if (missingFromSorted.length > 0) {
              const missingMembers = members.filter(m => missingFromSorted.includes(m.id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(m => m.id);
              sortedMemberIds.push(...missingMembers);
            }
            
            leagueDataMap[row.id] = {
              id: row.id,
              members: members.sort((a, b) => a.name.localeCompare(b.name)),
              userPosition,
              positionChange: null,
              submittedMembers,
              sortedMemberIds,
              latestGwWinners,
              latestRelevantGw
            };
          } catch (e: any) {
            leagueDataMap[row.id] = {
              id: row.id,
              members: [],
              userPosition: null,
              positionChange: null,
              sortedMemberIds: [],
              latestGwWinners: new Set(),
              latestRelevantGw: null
            };
          }
        }
        
        if (alive) {
          setLeagueData(leagueDataMap);
          setLeagueDataLoading(false);
        }
      } catch (error) {
        if (alive) {
          setLeagueDataLoading(false);
        }
      }
    })();
    
    return () => { alive = false; };
  }, [rows, user?.id, currentGw]);

  const createLeague = useCallback(async () => {
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

      const avatar = getDeterministicLeagueAvatar(data!.id);
      await supabase.from("leagues").update({ avatar }).eq("id", data!.id);
      await supabase.from("league_members").insert({
        league_id: data!.id,
        user_id: user.id,
      });

      setLeagueName("");
      setRows([]);
      setLoading(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create league.");
    } finally {
      setCreating(false);
    }
  }, [leagueName, user?.id]);

  const joinLeague = useCallback(async () => {
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
      setRows([]);
      setLoading(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league.");
    }
  }, [joinCode, user?.id]);

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
          Create or join a private league and battle it out with your friends. - COMPONENTS VERSION
        </p>

        {error && (
          <div className="mt-4 rounded border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6">
          {loading || leagueDataLoading ? (
            <LeagueListSkeleton />
          ) : rows.length === 0 ? (
            <div className="px-4 py-4 text-sm">No leagues yet.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <MiniLeagueCard
                  key={r.id}
                  row={r}
                  data={leagueData[r.id]}
                  unread={unreadByLeague?.[r.id] ?? 0}
                  submissions={leagueSubmissions[r.id]}
                  leagueDataLoading={false}
                  currentGw={currentGw}
                />
              ))}
            </div>
          )}
        </div>

        <div id="create-join-section" className="mt-10 mb-3 text-xl font-extrabold text-slate-900">Create or Join</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CreateLeagueForm
            leagueName={leagueName}
            setLeagueName={setLeagueName}
            creating={creating}
            onCreate={createLeague}
          />
          <JoinLeagueForm
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            onJoin={joinLeague}
          />
        </div>
      </div>
    </div>
  );
}

function CreateLeagueForm({
  leagueName,
  setLeagueName,
  creating,
  onCreate,
}: {
  leagueName: string;
  setLeagueName: (name: string) => void;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="border rounded-2xl p-4 bg-white">
      <div className="text-sm font-medium mb-2">Create a league</div>
      <input
        className="border rounded px-3 py-2 w-full bg-white"
        placeholder="League name"
        value={leagueName}
        onChange={(e) => setLeagueName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !creating && leagueName.trim()) {
            onCreate();
          }
        }}
      />
      <button
        className="mt-3 px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
        onClick={onCreate}
        disabled={creating || !leagueName.trim()}
      >
        {creating ? "Creating…" : "Create"}
      </button>
    </div>
  );
}

function JoinLeagueForm({
  joinCode,
  setJoinCode,
  onJoin,
}: {
  joinCode: string;
  setJoinCode: (code: string) => void;
  onJoin: () => void;
}) {
  return (
    <div className="border rounded-2xl p-4 bg-white">
      <div className="text-sm font-medium mb-2">Join with code</div>
      <input
        className="border rounded px-3 py-2 w-full uppercase tracking-widest bg-white"
        placeholder="ABCDE"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && joinCode.trim()) {
            onJoin();
          }
        }}
      />
      <button
        className="mt-3 px-3 py-2 rounded border"
        onClick={onJoin}
      >
        Join
      </button>
    </div>
  );
}

function LeagueListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border bg-white overflow-hidden shadow-sm w-full animate-pulse"
        >
          <div className="p-6 bg-white relative">
            <div className="flex items-start gap-3 relative">
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-slate-200" />
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="h-5 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-slate-200 rounded" />
                  <div className="h-4 w-6 bg-slate-200 rounded" />
                  <div className="h-4 w-4 bg-slate-200 rounded" />
                  <div className="h-4 w-8 bg-slate-200 rounded" />
                </div>
              </div>
              <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                <div className="h-6 w-6 rounded-full bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}
