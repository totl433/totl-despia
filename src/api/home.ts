// Optimized API functions for Home page
import { supabase } from "../lib/supabase";
import { query, batchQuery, getCacheKey } from "./client";

export type League = {
  id: string;
  name: string;
  code: string;
  created_at?: string | null;
  avatar?: string | null;
  start_gw?: number | null;
};

export type LeagueMember = {
  id: string;
  name: string;
};

export type Fixture = {
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

export type PickRow = {
  user_id: string;
  gw: number;
  fixture_index: number;
  pick: "H" | "D" | "A";
};

export type ResultRow = {
  gw: number;
  fixture_index: number;
  result?: "H" | "D" | "A" | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

export type SubmissionRow = {
  user_id: string;
  gw: number;
  submitted_at?: string | null;
};

// Fetch user's leagues (cached, 2 min TTL)
export async function fetchUserLeagues(userId: string): Promise<League[]> {
  const cacheKey = getCacheKey('user_leagues', userId);
  
  try {
    const result = await query(
      async () => {
        const { data, error } = await supabase
          .from("league_members")
          .select("leagues(id,name,code,created_at,start_gw)")
          .eq("user_id", userId);
        
        if (error) {
          console.error('[fetchUserLeagues] Supabase error:', error);
          return { data: null, error };
        }
        
        const leagues = (data ?? [])
          .map((r: any) => r.leagues)
          .filter(Boolean) as League[];
        
        return { data: leagues, error: null };
      },
      { cacheKey, cacheTTL: 2 * 60 * 1000 }
    );
    
    return result.data ?? [];
  } catch (error) {
    console.error('[fetchUserLeagues] Unexpected error:', error);
    return [];
  }
}

// Fetch current gameweek from meta (cached, 5 min TTL)
export async function fetchCurrentGw(): Promise<number> {
  const cacheKey = getCacheKey('current_gw');
  
  try {
    const result = await query(
      async () => {
        const { data, error } = await supabase
          .from("meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        if (error) {
          console.error('[fetchCurrentGw] Supabase error:', error);
          return { data: null, error };
        }
        return { data: (data as any)?.current_gw ?? 1, error: null };
      },
      { cacheKey, cacheTTL: 5 * 60 * 1000 }
    );
    
    return result.data ?? 1;
  } catch (error) {
    console.error('[fetchCurrentGw] Unexpected error:', error);
    return 1;
  }
}

// Fetch fixtures for a specific GW (cached, 2 min TTL)
export async function fetchFixturesForGw(gw: number): Promise<Fixture[]> {
  const cacheKey = getCacheKey('fixtures_gw', gw);
  
  const result = await query(
    async () => {
      const { data, error } = await supabase
        .from("fixtures")
        .select("id,gw,fixture_index,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time")
        .eq("gw", gw)
        .order("fixture_index", { ascending: true });
      
      if (error) return { data: null, error };
      return { data: (data as Fixture[]) ?? [], error: null };
    },
    { cacheKey, cacheTTL: 2 * 60 * 1000 }
  );
  
  return result.data ?? [];
}

// Fetch user's picks for a specific GW (cached, 1 min TTL)
export async function fetchUserPicks(userId: string, gw: number): Promise<PickRow[]> {
  const cacheKey = getCacheKey('user_picks', userId, gw);
  
  const result = await query(
    async () => {
      const { data, error } = await supabase
        .from("picks")
        .select("user_id,gw,fixture_index,pick")
        .eq("user_id", userId)
        .eq("gw", gw);
      
      if (error) return { data: null, error };
      return { data: (data as PickRow[]) ?? [], error: null };
    },
    { cacheKey, cacheTTL: 60 * 1000 }
  );
  
  return result.data ?? [];
}

// Fetch results for a specific GW (cached, 1 min TTL)
export async function fetchResultsForGw(gw: number): Promise<ResultRow[]> {
  const cacheKey = getCacheKey('results_gw', gw);
  
  const result = await query(
    async () => {
      const { data, error } = await supabase
        .from("gw_results")
        .select("gw,fixture_index,result,home_goals,away_goals")
        .eq("gw", gw);
      
      if (error) return { data: null, error };
      return { data: (data as ResultRow[]) ?? [], error: null };
    },
    { cacheKey, cacheTTL: 60 * 1000 }
  );
  
  return result.data ?? [];
}

// Check if user has submitted for a GW
export async function checkUserSubmission(userId: string, gw: number): Promise<boolean> {
  const cacheKey = getCacheKey('user_submission', userId, gw);
  
  const result = await query(
    async () => {
      const { data, error } = await supabase
        .from("gw_submissions")
        .select("submitted_at")
        .eq("user_id", userId)
        .eq("gw", gw)
        .maybeSingle();
      
      if (error) return { data: null, error };
      return { data: !!data?.submitted_at, error: null };
    },
    { cacheKey, cacheTTL: 60 * 1000 }
  );
  
  return result.data ?? false;
}

// Fetch latest GW with results
export async function fetchLatestGwWithResults(): Promise<number | null> {
  const cacheKey = getCacheKey('latest_gw_results');
  
  const result = await query(
    async () => {
      const { data, error } = await supabase
        .from("gw_results")
        .select("gw")
        .order("gw", { ascending: false })
        .limit(1);
      
      if (error) return { data: null, error };
      const gw = Array.isArray(data) && data.length ? (data[0] as any).gw : null;
      return { data: gw, error: null };
    },
    { cacheKey, cacheTTL: 2 * 60 * 1000 }
  );
  
  return result.data;
}

// Fetch results and picks for a specific GW (parallel)
export async function fetchGwResultsAndPicks(
  gw: number,
  userId: string
): Promise<{ results: ResultRow[]; picks: PickRow[] }> {
  const [resultsResult, picksResult] = await batchQuery([
    async () => {
      const { data, error } = await supabase
        .from("gw_results")
        .select("fixture_index,result")
        .eq("gw", gw);
      return { data: (data as ResultRow[]) ?? [], error };
    },
    async () => {
      const { data, error } = await supabase
        .from("picks")
        .select("fixture_index,pick")
        .eq("gw", gw)
        .eq("user_id", userId);
      return { data: (data as PickRow[]) ?? [], error };
    },
  ], {
    cacheKey: getCacheKey('gw_results_picks', gw, userId),
    cacheTTL: 60 * 1000,
  });
  
  return {
    results: (resultsResult.data as ResultRow[]) ?? [],
    picks: (picksResult.data as PickRow[]) ?? [],
  };
}

// Fetch league members for multiple leagues (batched)
export async function fetchLeagueMembersBatch(leagueIds: string[]): Promise<Record<string, LeagueMember[]>> {
  if (leagueIds.length === 0) return {};
  
  const cacheKey = getCacheKey('league_members_batch', leagueIds.sort().join(','));
  
  const result = await query(
    async () => {
      const { data, error } = await supabase
        .from("league_members")
        .select("league_id,user_id,users(id,name)")
        .in("league_id", leagueIds);
      
      if (error) return { data: null, error };
      
      const membersByLeague: Record<string, LeagueMember[]> = {};
      leagueIds.forEach(id => membersByLeague[id] = []);
      
      (data ?? []).forEach((row: any) => {
        const leagueId = row.league_id;
        if (!membersByLeague[leagueId]) membersByLeague[leagueId] = [];
        membersByLeague[leagueId].push({
          id: row.user_id,
          name: row.users?.name || "Unknown",
        });
      });
      
      return { data: membersByLeague, error: null };
    },
    { cacheKey, cacheTTL: 2 * 60 * 1000 }
  );
  
  return result.data ?? {};
}

// Fetch submission status for multiple leagues (batched)
export async function fetchLeagueSubmissionsBatch(
  leagueIds: string[],
  gw: number
): Promise<Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>> {
  if (leagueIds.length === 0) return {};
  
  const cacheKey = getCacheKey('league_submissions_batch', leagueIds.sort().join(','), gw);
  
  const result = await query(
    async () => {
      // Fetch all members for these leagues
      const { data: membersData, error: membersError } = await supabase
        .from("league_members")
        .select("league_id,user_id")
        .in("league_id", leagueIds);
      
      if (membersError) return { data: null, error: membersError };
      
      // Group by league
      const membersByLeague: Record<string, string[]> = {};
      leagueIds.forEach(id => membersByLeague[id] = []);
      (membersData ?? []).forEach((row: any) => {
        if (!membersByLeague[row.league_id]) membersByLeague[row.league_id] = [];
        membersByLeague[row.league_id].push(row.user_id);
      });
      
      // Get all member IDs
      const allMemberIds = Array.from(new Set(Object.values(membersByLeague).flat()));
      
      // Fetch submissions for this GW
      const { data: submissionsData, error: submissionsError } = await supabase
        .from("gw_submissions")
        .select("user_id")
        .eq("gw", gw)
        .in("user_id", allMemberIds);
      
      if (submissionsError) return { data: null, error: submissionsError };
      
      const submittedUserIds = new Set((submissionsData ?? []).map((s: any) => s.user_id));
      
      // Build result
      const status: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
      Object.entries(membersByLeague).forEach(([leagueId, memberIds]) => {
        const totalCount = memberIds.length;
        const submittedCount = memberIds.filter(id => submittedUserIds.has(id)).length;
        status[leagueId] = {
          allSubmitted: submittedCount === totalCount && totalCount > 0,
          submittedCount,
          totalCount,
        };
      });
      
      return { data: status, error: null };
    },
    { cacheKey, cacheTTL: 60 * 1000 }
  );
  
  return result.data ?? {};
}

// Fetch unread message counts for leagues (batched)
export async function fetchUnreadCounts(
  userId: string,
  leagueIds: string[]
): Promise<Record<string, number>> {
  if (leagueIds.length === 0) return {};
  
  const cacheKey = getCacheKey('unread_counts', userId, leagueIds.sort().join(','));
  
  const result = await query(
    async () => {
      // Fetch last read times
      const { data: readsData, error: readsError } = await supabase
        .from("league_message_reads")
        .select("league_id,last_read_at")
        .eq("user_id", userId);
      
      if (readsError) {
        console.warn("league_message_reads query failed:", readsError);
        return { data: {}, error: null }; // Return empty object on error
      }
      
      const lastRead = new Map<string, string>();
      (readsData ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));
      
      // Fetch unread counts for each league in parallel
      const countPromises = leagueIds.map(async (leagueId) => {
        const since = lastRead.get(leagueId) ?? "1970-01-01T00:00:00Z";
        const { data, count, error } = await supabase
          .from("league_messages")
          .select("id", { count: "exact" })
          .eq("league_id", leagueId)
          .gte("created_at", since);
        
        if (error) {
          console.warn(`unread count query error for ${leagueId}:`, error);
          return [leagueId, 0] as [string, number];
        }
        
        return [leagueId, typeof count === "number" ? count : (data?.length ?? 0)] as [string, number];
      });
      
      const counts = await Promise.all(countPromises);
      const result: Record<string, number> = {};
      counts.forEach(([leagueId, count]) => {
        result[leagueId] = count;
      });
      
      return { data: result, error: null };
    },
    { cacheKey, cacheTTL: 60 * 1000 }
  );
  
  return result.data ?? {};
}

// Fetch all results (for leaderboard calculations) - cached longer
export async function fetchAllResults(): Promise<ResultRow[]> {
  const cacheKey = getCacheKey('all_results');
  
  const result = await query(
    async () => {
      const { data, error } = await supabase
        .from("gw_results")
        .select("gw,fixture_index,result,home_goals,away_goals");
      
      if (error) return { data: null, error };
      return { data: (data as ResultRow[]) ?? [], error: null };
    },
    { cacheKey, cacheTTL: 5 * 60 * 1000 } // Cache for 5 minutes
  );
  
  return result.data ?? [];
}

// Fetch picks for multiple users and GWs (for leaderboard calculations)
export async function fetchPicksBatch(
  userIds: string[],
  gws: number[]
): Promise<PickRow[]> {
  if (userIds.length === 0 || gws.length === 0) return [];
  
  const cacheKey = getCacheKey('picks_batch', userIds.length, gws.length, gws[0], gws[gws.length - 1]);
  
  const result = await query(
    async () => {
      const { data, error } = await supabase
        .from("picks")
        .select("user_id,gw,fixture_index,pick")
        .in("user_id", userIds)
        .in("gw", gws);
      
      if (error) return { data: null, error };
      return { data: (data as PickRow[]) ?? [], error: null };
    },
    { cacheKey, cacheTTL: 2 * 60 * 1000 }
  );
  
  return result.data ?? [];
}

