import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { MiniLeagueCard } from "../components/MiniLeagueCard";
import type { LeagueRow, LeagueData } from "../components/MiniLeagueCard";
import { getDeterministicLeagueAvatar } from "../lib/leagueAvatars";
import { LEAGUE_START_OVERRIDES } from "../lib/leagueStart";
import { getCached, setCached, CACHE_TTL, invalidateUserCache } from "../lib/cache";

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

  // Load everything in parallel - stale-while-revalidate pattern
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setLeagueDataLoading(false);
      return;
    }
    
    let alive = true;
    const cacheKey = `tables:${user.id}`;
    
    // 1. Load from cache immediately (if available)
    try {
      const cached = getCached<{
        rows: LeagueRow[];
        currentGw: number | null;
        leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
        unreadByLeague: Record<string, number>;
        leagueData: Record<string, LeagueData>;
      }>(cacheKey);
      
      if (cached && cached.rows && Array.isArray(cached.rows) && cached.rows.length > 0) {
        // INSTANT RENDER from cache!
        console.log('[Tables] ✅ Loading from cache:', cached.rows.length, 'leagues');
        setRows(cached.rows);
        setCurrentGw(cached.currentGw);
        setLeagueSubmissions(cached.leagueSubmissions || {});
        setUnreadByLeague(cached.unreadByLeague || {});
        if (cached.leagueData) {
          setLeagueData(cached.leagueData);
        }
        setLoading(false);
        setLeagueDataLoading(false); // Hide spinner immediately when cache is available
      } else {
        console.log('[Tables] ⚠️ No valid cache found, will fetch fresh data');
      }
    } catch (error) {
      // If cache is corrupted, just continue with fresh fetch
      console.warn('[Tables] Error loading from cache, fetching fresh data:', error);
    }
    
    // 2. Fetch fresh data in background
    (async () => {
      try {
        // Step 1: Get league IDs and current GW in parallel
        const [membershipsResult, fixturesResult, metaResult] = await Promise.all([
          supabase.from("league_members").select("league_id").eq("user_id", user.id),
          supabase.from("fixtures").select("gw").order("gw", { ascending: false }).limit(1),
          supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle()
        ]);
        
        if (membershipsResult.error) throw membershipsResult.error;
        if (!alive) return;
        
        const leagueIds = (membershipsResult.data ?? []).map((r: any) => r.league_id);
        if (!leagueIds.length) {
          setRows([]);
          setCurrentGw(null);
          setLoading(false);
          setLeagueDataLoading(false);
          return;
        }

        const fixturesList = (fixturesResult.data as Array<{ gw: number }>) ?? [];
        const currentGw = fixturesList.length ? Math.max(...fixturesList.map((f) => f.gw)) : 1;
        const metaGw = (metaResult.data as any)?.current_gw ?? currentGw;
        setCurrentGw(currentGw);

        // Step 2: Fetch ALL data in parallel - leagues, members, reads, results, fixtures, submissions
        const [
          leaguesResult,
          memDataResult,
          readsResult,
          allResultsResult,
          allFixturesResult,
          allMembersWithUsersResult,
          leaguesMetaResult
        ] = await Promise.all([
          supabase.from("leagues").select("id,name,code,created_at,avatar").in("id", leagueIds).order("created_at", { ascending: true }),
          supabase.from("league_members").select("league_id,user_id").in("league_id", leagueIds).limit(10000),
          supabase.from("league_message_reads").select("league_id,last_read_at").eq("user_id", user.id),
          supabase.from("gw_results").select("gw,fixture_index,result"),
          supabase.from("fixtures").select("gw,kickoff_time").order("gw", { ascending: true }).order("kickoff_time", { ascending: true }),
          supabase.from("league_members").select("league_id,user_id, users(id, name)").in("league_id", leagueIds).limit(10000),
          supabase.from("leagues").select("id,name,created_at").in("id", leagueIds)
        ]);
        
        if (leaguesResult.error) throw leaguesResult.error;
        if (memDataResult.error) throw memDataResult.error;
        if (!alive) return;
        
        const leagues = (leaguesResult.data ?? []) as League[];
        
        // Assign avatars (non-blocking, don't wait)
        for (const league of leagues) {
          if (!league.avatar) {
            league.avatar = getDeterministicLeagueAvatar(league.id);
            void supabase.from("leagues").update({ avatar: league.avatar }).eq("id", league.id);
          }
        }

        // Process members
        const membersByLeague = new Map<string, string[]>();
        (memDataResult.data ?? []).forEach((r: any) => {
          const arr = membersByLeague.get(r.league_id) ?? [];
          arr.push(r.user_id);
          membersByLeague.set(r.league_id, arr);
        });

        const allMemberIds = Array.from(new Set(Array.from(membersByLeague.values()).flat()));
        const apiTestLeague = leagues.find(l => l.name === "API Test");
        const apiTestMemberIds = apiTestLeague ? (membersByLeague.get(apiTestLeague.id) ?? []) : [];
        const regularMemberIds = apiTestLeague 
          ? allMemberIds.filter(id => !apiTestMemberIds.includes(id))
          : allMemberIds;
        
        // Step 3: Fetch submissions and test API data in parallel
        const [submissionsResult, testMetaResult] = await Promise.all([
          regularMemberIds.length > 0
            ? supabase.from("gw_submissions").select("user_id").eq("gw", currentGw).in("user_id", regularMemberIds).limit(10000)
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
            supabase.from("test_api_submissions").select("user_id,submitted_at").eq("matchday", currentTestGw).in("user_id", apiTestMemberIds).not("submitted_at", "is", null),
            supabase.from("test_api_picks").select("user_id,fixture_index").eq("matchday", currentTestGw).in("user_id", apiTestMemberIds),
            supabase.from("test_api_fixtures").select("fixture_index").eq("test_gw", currentTestGw).order("fixture_index", { ascending: true })
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
        const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
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

        // Process unread counts
        const unreadCounts: Record<string, number> = {};
        try {
          const lastRead = new Map<string, string>();
          (readsResult.data ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));
          
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

        if (!alive) return;

        // Process results and fixtures for league data
        const resultList = (allResultsResult.data as ResultRowRaw[]) ?? [];
        const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
        for (const r of resultList) {
          const out = rowToOutcome(r);
          if (out) outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
        }

        const allFixtures = allFixturesResult.data ?? [];
        const fixturesByGw = new Map<number, string[]>();
        allFixtures.forEach((f: any) => {
          const arr = fixturesByGw.get(f.gw) ?? [];
          arr.push(f.kickoff_time);
          fixturesByGw.set(f.gw, arr);
        });

        const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
        
        // Process members with user names
        const membersByLeagueId = new Map<string, LeagueMember[]>();
        (allMembersWithUsersResult.data ?? []).forEach((m: any) => {
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

        // Calculate start_gw for all leagues
        const leagueStartGwMap = new Map<string, number>();
        for (const row of out) {
          const meta = leaguesMetaMap.get(row.id);
          const league = {
            id: row.id,
            name: meta?.name ?? row.name,
            created_at: (meta?.created_at ?? row.created_at) || null,
            start_gw: meta?.start_gw ?? row.start_gw
          };
          
          let leagueStartGw = metaGw;
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
            
            if (leagueStartGw === metaGw && gwsWithResults.length > 0) {
              leagueStartGw = Math.max(...gwsWithResults) + 1;
            }
          }
          leagueStartGwMap.set(row.id, leagueStartGw);
        }

        // Fetch picks in parallel for all leagues
        const allRelevantGws = new Set<number>();
        out.forEach(row => {
          const leagueStartGw = leagueStartGwMap.get(row.id) ?? metaGw;
          gwsWithResults.filter(g => g >= leagueStartGw).forEach(gw => allRelevantGws.add(gw));
        });
        
        const picksPromises = out.map(leagueRow => {
          const memberIds = membersByLeagueId.get(leagueRow.id) ?? [];
          if (memberIds.length === 0) return Promise.resolve({ data: [], error: null });
          
          const leagueStartGw = leagueStartGwMap.get(leagueRow.id) ?? metaGw;
          const relevantGws = Array.from(allRelevantGws).filter(gw => gw >= leagueStartGw);
          
          if (relevantGws.length === 0) return Promise.resolve({ data: [], error: null });
          
          return supabase
            .from("picks")
            .select("user_id,gw,fixture_index,pick")
            .in("user_id", memberIds.map(m => m.id))
            .in("gw", relevantGws)
            .limit(10000);
        });

        const allPicksResults = await Promise.all(picksPromises);
        if (!alive) return;

        const submittedUserIdsSet = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id));
        
        // Process league data
        const leagueDataMap: Record<string, LeagueData> = {};
        
        for (let i = 0; i < out.length; i++) {
          const leagueRow = out[i];
          const picksResult = allPicksResults[i];
          const memberIds = membersByLeagueId.get(leagueRow.id) ?? [];
          
          if (memberIds.length === 0) continue;
          
          const leagueStartGw = leagueStartGwMap.get(leagueRow.id) ?? metaGw;
          const relevantGws = Array.from(allRelevantGws).filter(gw => gw >= leagueStartGw);
          
          const picks = (picksResult.data ?? []) as PickRow[];
          const picksByUserGw = new Map<string, Map<number, Map<number, "H" | "D" | "A">>>();
          
          picks.forEach(p => {
            if (!picksByUserGw.has(p.user_id)) {
              picksByUserGw.set(p.user_id, new Map());
            }
            const userGwMap = picksByUserGw.get(p.user_id)!;
            if (!userGwMap.has(p.gw)) {
              userGwMap.set(p.gw, new Map());
            }
            userGwMap.get(p.gw)!.set(p.fixture_index, p.pick);
          });
          
          const userScores = new Map<string, number>();
          const userGwScores = new Map<string, Map<number, number>>();
          
          relevantGws.forEach(gw => {
            const gwFixtures = fixturesByGw.get(gw) ?? [];
            const fixtureCount = gwFixtures.length;
            if (fixtureCount === 0) return;
            
            memberIds.forEach(member => {
              const userPicks = picksByUserGw.get(member.id)?.get(gw);
              if (!userPicks) return;
              
              let gwScore = 0;
              for (let fi = 0; fi < fixtureCount; fi++) {
                const pick = userPicks.get(fi);
                const outcome = outcomeByGwIdx.get(`${gw}:${fi}`);
                if (pick && outcome && pick === outcome) {
                  gwScore++;
                }
              }
              
              if (!userGwScores.has(member.id)) {
                userGwScores.set(member.id, new Map());
              }
              userGwScores.get(member.id)!.set(gw, gwScore);
              
              const currentTotal = userScores.get(member.id) ?? 0;
              userScores.set(member.id, currentTotal + gwScore);
            });
          });
          
          const sortedMemberIds = [...memberIds].sort((a, b) => {
            const scoreA = userScores.get(a.id) ?? 0;
            const scoreB = userScores.get(b.id) ?? 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return a.name.localeCompare(b.name);
          });
          
          const userPosition = sortedMemberIds.findIndex(m => m.id === user.id) + 1;
          const prevPosition = userPosition > 1 ? userPosition - 1 : null;
          const positionChange: 'up' | 'down' | 'same' | null = prevPosition === null ? null : 
            userPosition < prevPosition ? 'up' : userPosition > prevPosition ? 'down' : 'same';
          
          const latestRelevantGw = relevantGws.length > 0 ? Math.max(...relevantGws) : metaGw;
          const latestGwWinners: string[] = [];
          if (latestRelevantGw && userGwScores.has(user.id)) {
            const latestGwScore = userGwScores.get(user.id)!.get(latestRelevantGw) ?? 0;
            sortedMemberIds.forEach(m => {
              const memberLatestScore = userGwScores.get(m.id)?.get(latestRelevantGw) ?? 0;
              if (memberLatestScore === latestGwScore && latestGwScore > 0) {
                latestGwWinners.push(m.id);
              }
            });
          }
          
          leagueDataMap[leagueRow.id] = {
            id: leagueRow.id,
            members: memberIds,
            userPosition: userPosition || null,
            positionChange,
            submittedMembers: leagueRow.id === apiTestLeague?.id ? testApiSubmittedUserIds : submittedUserIdsSet,
            sortedMemberIds: sortedMemberIds.map(m => m.id),
            latestGwWinners,
            latestRelevantGw
          };
        }

        if (alive) {
          setRows(out);
          setLeagueData(leagueDataMap);
          setLoading(false);
          setLeagueDataLoading(false);
          
          // Cache the processed data for next time
          try {
            setCached(cacheKey, {
              rows: out,
              currentGw,
              leagueSubmissions: submissionStatus,
              unreadByLeague: unreadCounts,
              leagueData: leagueDataMap, // Also cache leagueData for instant loading
            }, CACHE_TTL.TABLES);
            console.log('[Tables] ✅ Cached data for next time:', out.length, 'leagues');
          } catch (cacheError) {
            console.warn('[Tables] Failed to cache data:', cacheError);
          }
        }
      } catch (e: any) {
        if (alive) {
          setError(e?.message ?? "Failed to load leagues.");
          setLoading(false);
          setLeagueDataLoading(false);
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id]);


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
      // Invalidate cache after creating league
      if (user?.id) {
        invalidateUserCache(user.id);
      }
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
      // Invalidate cache after joining league
      if (user?.id) {
        invalidateUserCache(user.id);
      }
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

        {loading || leagueDataLoading ? (
          <div className="mt-6 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
          </div>
        ) : (
          <>
            <div className="mt-6">
              {rows.length === 0 ? (
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
          </>
        )}
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
