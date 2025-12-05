import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { MiniLeagueCard } from "../components/MiniLeagueCard";
import type { LeagueRow, LeagueData } from "../components/MiniLeagueCard";
import { getDeterministicLeagueAvatar } from "../lib/leagueAvatars";
import { LEAGUE_START_OVERRIDES } from "../lib/leagueStart";
import { getCached, setCached, CACHE_TTL, invalidateUserCache } from "../lib/cache";
import { useLeagues } from "../hooks/useLeagues";

/**
 * Tables.tsx - Mini Leagues Page
 * 
 * IMPORTANT: This page uses the useLeagues hook for leagues and unread counts (single source of truth).
 * It still fetches member data separately via Supabase for member counts and league data calculations.
 * 
 * Data flow:
 * - Leagues: useLeagues hook (sorted by unread count, API Test filtered out)
 * - Unread counts: useLeagues hook
 * - Member counts: Fetched separately from league_members
 * - League data (positions, winners): Calculated from picks data
 */

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
  
  // LEAGUES: Use centralized useLeagues hook (single source of truth)
  // This provides leagues already sorted by unread count, filtered (no API Test)
  const { 
    leagues, 
    unreadByLeague, 
    loading: leaguesLoading,
    invalidateAndRefresh: refreshLeagues
  } = useLeagues({ pageName: 'tables' });
  
  // Load additional Tables-specific data from cache (member counts, league data, submissions)
  const loadInitialStateFromCache = () => {
    let userId: string | undefined = user?.id;
    if (!userId && typeof window !== 'undefined') {
      try {
        const userStr = localStorage.getItem('totl:user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          userId = userObj.id;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (typeof window === 'undefined' || !userId) {
      return {
        memberCounts: {} as Record<string, number>,
        leagueDataLoading: true,
        currentGw: null,
        leagueSubmissions: {} as Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>,
        leagueData: {} as Record<string, LeagueData>,
      };
    }
    
    try {
      const cacheKey = `tables:${userId}`;
      const cached = getCached<{
        rows: LeagueRow[];
        currentGw: number | null;
        leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
        leagueData: Record<string, LeagueData>;
        memberCounts?: Record<string, number>;
      }>(cacheKey);
      
      if (cached) {
        // Extract member counts from cached rows
        const memberCounts: Record<string, number> = cached.memberCounts || {};
        if (cached.rows && Array.isArray(cached.rows)) {
          cached.rows.forEach(row => {
            if (row.memberCount !== undefined) {
              memberCounts[row.id] = row.memberCount;
            }
          });
        }
        
        // Convert arrays back to Sets for submittedMembers and latestGwWinners
        const restoredLeagueData: Record<string, LeagueData> = {};
        if (cached.leagueData) {
          for (const [leagueId, data] of Object.entries(cached.leagueData)) {
            restoredLeagueData[leagueId] = {
              ...data,
              submittedMembers: data.submittedMembers ? (Array.isArray(data.submittedMembers) ? new Set(data.submittedMembers) : new Set()) : undefined,
              latestGwWinners: data.latestGwWinners ? (Array.isArray(data.latestGwWinners) ? new Set(data.latestGwWinners) : new Set()) : undefined,
            };
          }
        }
        
        return {
          memberCounts,
          leagueDataLoading: false,
          currentGw: cached.currentGw,
          leagueSubmissions: cached.leagueSubmissions || {},
          leagueData: restoredLeagueData,
        };
      }
    } catch (error) {
      // Error loading from cache (non-critical)
    }
    
    return {
      memberCounts: {} as Record<string, number>,
      leagueDataLoading: true,
      currentGw: null,
      leagueSubmissions: {} as Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>,
      leagueData: {} as Record<string, LeagueData>,
    };
  };
  
  const initialState = loadInitialStateFromCache();
  
  // Member counts are fetched separately since useLeagues doesn't provide them
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>(initialState.memberCounts);
  const [leagueDataLoading, setLeagueDataLoading] = useState(initialState.leagueDataLoading);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [error, setError] = useState("");
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>>(initialState.leagueSubmissions);
  const [leagueData, setLeagueData] = useState<Record<string, LeagueData>>(initialState.leagueData);
  const [currentGw, setCurrentGw] = useState<number | null>(initialState.currentGw);
  
  // Build rows from leagues (from hook) + member counts (fetched separately)
  // Leagues from useLeagues are already sorted by unread count
  const rows: LeagueRow[] = useMemo(() => {
    return leagues.map(league => ({
      id: league.id,
      name: league.name,
      code: league.code,
      avatar: league.avatar ?? getDeterministicLeagueAvatar(league.id),
      created_at: league.created_at,
      start_gw: league.start_gw,
      memberCount: memberCounts[league.id] ?? 0,
    }));
  }, [leagues, memberCounts]);
  
  // Combined loading state
  const loading = leaguesLoading;

  // Fetch member data and other Tables-specific data
  // NOTE: Leagues and unread counts come from useLeagues hook
  // This effect only fetches member counts, submissions, league data calculations
  useEffect(() => {
    if (!user?.id) {
      setLeagueDataLoading(false);
      return;
    }
    
    // Wait for leagues to load from hook
    if (leaguesLoading) return;
    
    // Get league IDs from hook (already filtered and sorted)
    const leagueIds = leagues.map(l => l.id);
    if (!leagueIds.length) {
      setLeagueDataLoading(false);
      return;
    }
    
    let alive = true;
    const cacheKey = `tables:${user.id}`;
    
    // Fetch member data and other Tables-specific data in background
    (async () => {
      try {
        // Step 1: Get current GW
        const [fixturesResult, metaResult] = await Promise.all([
          supabase.from("app_fixtures").select("gw").order("gw", { ascending: false }).limit(1),
          supabase.from("app_meta").select("current_gw").eq("id", 1).maybeSingle()
        ]);
        
        if (!alive) return;

        const fixturesList = (fixturesResult.data as Array<{ gw: number }>) ?? [];
        const fetchedCurrentGw = fixturesList.length ? Math.max(...fixturesList.map((f) => f.gw)) : 1;
        const metaGw = (metaResult.data as any)?.current_gw ?? fetchedCurrentGw;
        setCurrentGw(fetchedCurrentGw);

        // Step 2: Fetch member data, results, fixtures, submissions
        // NOTE: We don't fetch leagues here - they come from useLeagues hook
        const [
          memDataResult,
          allResultsResult,
          allFixturesResult,
          allMembersWithUsersResult,
          leaguesMetaResult
        ] = await Promise.all([
          supabase.from("league_members").select("league_id,user_id").in("league_id", leagueIds).limit(10000),
          supabase.from("app_gw_results").select("gw,fixture_index,result"),
          supabase.from("app_fixtures").select("gw,kickoff_time").order("gw", { ascending: true }).order("kickoff_time", { ascending: true }),
          supabase.from("league_members").select("league_id,user_id, users(id, name)").in("league_id", leagueIds).limit(10000),
          supabase.from("leagues").select("id,name,created_at,start_gw").in("id", leagueIds)
        ]);
        
        if (memDataResult.error) throw memDataResult.error;
        if (!alive) return;

        // Process members and build member counts
        const membersByLeague = new Map<string, string[]>();
        (memDataResult.data ?? []).forEach((r: any) => {
          const arr = membersByLeague.get(r.league_id) ?? [];
          arr.push(r.user_id);
          membersByLeague.set(r.league_id, arr);
        });
        
        // Update member counts
        const newMemberCounts: Record<string, number> = {};
        leagueIds.forEach(leagueId => {
          newMemberCounts[leagueId] = (membersByLeague.get(leagueId) ?? []).length;
        });
        setMemberCounts(newMemberCounts);

        // Optimize: use Set for faster lookups
        const allMemberIds = Array.from(new Set(Array.from(membersByLeague.values()).flat()));
        
        // Step 3: Fetch submissions
        const [submissionsResult] = await Promise.all([
          allMemberIds.length > 0
            ? supabase.from("app_gw_submissions").select("user_id").eq("gw", fetchedCurrentGw).in("user_id", allMemberIds).limit(10000)
            : Promise.resolve({ data: [], error: null }),
        ]);
        
        const submittedUserIds = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id));
        
        // Calculate submission status for each league
        const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
        for (const league of leagues) {
          const memberIds = membersByLeague.get(league.id) ?? [];
          const totalCount = memberIds.length;
          const submittedCount = memberIds.reduce((count, id) => count + (submittedUserIds.has(id) ? 1 : 0), 0);
          
          submissionStatus[league.id] = {
            allSubmitted: submittedCount === totalCount && totalCount > 0,
            submittedCount,
            totalCount
          };
        }
        setLeagueSubmissions(submissionStatus);

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
        for (const league of leagues) {
          const meta = leaguesMetaMap.get(league.id);
          const leagueWithMeta = {
            id: league.id,
            name: meta?.name ?? league.name,
            created_at: (meta?.created_at ?? league.created_at) || null,
            start_gw: meta?.start_gw ?? league.start_gw
          };
          
          let leagueStartGw = metaGw;
          const override = leagueWithMeta.name ? LEAGUE_START_OVERRIDES[leagueWithMeta.name] : undefined;
          if (typeof override === "number") {
            leagueStartGw = override;
          } else if (leagueWithMeta.start_gw !== null && leagueWithMeta.start_gw !== undefined) {
            leagueStartGw = leagueWithMeta.start_gw;
          } else if (leagueWithMeta.created_at && gwsWithResults.length > 0) {
            const leagueCreatedAt = new Date(leagueWithMeta.created_at);
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
          leagueStartGwMap.set(league.id, leagueStartGw);
        }

        // Fetch picks in parallel for all leagues
        const allRelevantGws = new Set<number>();
        leagues.forEach(league => {
          const leagueStartGw = leagueStartGwMap.get(league.id) ?? metaGw;
          gwsWithResults.filter(g => g >= leagueStartGw).forEach(gw => allRelevantGws.add(gw));
        });
        
        const picksPromises = leagues.map(league => {
          const memberIds = membersByLeagueId.get(league.id) ?? [];
          if (memberIds.length === 0) return Promise.resolve({ data: [], error: null });
          
          const leagueStartGw = leagueStartGwMap.get(league.id) ?? metaGw;
          const relevantGws = Array.from(allRelevantGws).filter(gw => gw >= leagueStartGw);
          
          if (relevantGws.length === 0) return Promise.resolve({ data: [], error: null });
          
          return supabase
            .from("app_picks")
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
        
        for (let i = 0; i < leagues.length; i++) {
          const league = leagues[i];
          const picksResult = allPicksResults[i];
          const memberIds = membersByLeagueId.get(league.id) ?? [];
          
          if (memberIds.length === 0) continue;
          
          const leagueStartGw = leagueStartGwMap.get(league.id) ?? metaGw;
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
          
          leagueDataMap[league.id] = {
            id: league.id,
            members: memberIds,
            userPosition: userPosition || null,
            positionChange,
            submittedMembers: submittedUserIdsSet,
            sortedMemberIds: sortedMemberIds.map(m => m.id),
            latestGwWinners,
            latestRelevantGw
          };
        }

        if (alive) {
          setLeagueData(leagueDataMap);
          setLeagueDataLoading(false);
          
          // Cache the processed data for next time
          // Note: We don't cache leagues/unreadByLeague here - they're managed by useLeagues
          try {
            // Convert Sets to Arrays for JSON serialization
            const cacheableLeagueData: Record<string, any> = {};
            for (const [leagueId, data] of Object.entries(leagueDataMap)) {
              cacheableLeagueData[leagueId] = {
                ...data,
                submittedMembers: data.submittedMembers ? (data.submittedMembers instanceof Set ? Array.from(data.submittedMembers) : data.submittedMembers) : undefined,
                latestGwWinners: data.latestGwWinners ? (data.latestGwWinners instanceof Set ? Array.from(data.latestGwWinners) : data.latestGwWinners) : undefined,
              };
            }
            
            setCached(cacheKey, {
              rows: rows, // Save current rows for member counts
              currentGw: fetchedCurrentGw,
              leagueSubmissions: submissionStatus,
              leagueData: cacheableLeagueData,
              memberCounts: newMemberCounts,
            }, CACHE_TTL.TABLES);
          } catch (cacheError) {
            // Failed to cache data (non-critical)
          }
        }
      } catch (e: any) {
        if (alive) {
          setError(e?.message ?? "Failed to load league data.");
          setLeagueDataLoading(false);
        }
      }
    })();
    
    return () => { alive = false; };
  }, [user?.id, leagues, leaguesLoading]);


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
      // Invalidate cache and refresh leagues
      if (user?.id) {
        invalidateUserCache(user.id);
        refreshLeagues();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to create league.");
    } finally {
      setCreating(false);
    }
  }, [leagueName, user?.id, refreshLeagues]);

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
      // Invalidate cache and refresh leagues
      if (user?.id) {
        invalidateUserCache(user.id);
        refreshLeagues();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league.");
    }
  }, [joinCode, user?.id, refreshLeagues]);

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
