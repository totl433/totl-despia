/**
 * Hook for app lifecycle events (foreground/background)
 * Used for prefetching data when app comes to foreground
 */

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCached, setCached, getCacheTimestamp, CACHE_TTL } from '../lib/cache';
import { supabase } from '../lib/supabase';

/**
 * Prefetch home page data
 */
async function prefetchHomeData(userId: string): Promise<void> {
  const cacheKey = `home:${userId}`;
  const cached = getCached(cacheKey);
  const timestamp = getCacheTimestamp(cacheKey);
  const age = timestamp ? Date.now() - timestamp : Infinity;
  
  // Only prefetch if cache is stale or missing
  // Refresh at 50% of TTL to keep data fresh
  if (!cached || age > CACHE_TTL.HOME * 0.5) {
    try {
      // Fetch critical data in parallel
      const [membersResult, latestGwResult, metaResult, allGwPointsResult, overallResult] = await Promise.all([
        supabase.from("league_members").select("leagues(id, name, code, avatar, created_at)").eq("user_id", userId),
        supabase.from("gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle(),
        supabase.from("v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
        supabase.from("v_ocp_overall").select("user_id, name, ocp")
      ]);
      
      // Cache the raw results (will be processed by Home component)
      const data = {
        members: membersResult.data,
        latestGw: latestGwResult.data,
        meta: metaResult.data,
        gwPoints: allGwPointsResult.data,
        overall: overallResult.data,
      };
      
      setCached(cacheKey, data, CACHE_TTL.HOME);
    } catch (error) {
      console.warn('[Prefetch] Failed to prefetch home data:', error);
    }
  }
}

/**
 * Prefetch tables page data
 */
async function prefetchTablesData(userId: string): Promise<void> {
  const cacheKey = `tables:${userId}`;
  const cached = getCached(cacheKey);
  const timestamp = getCacheTimestamp(cacheKey);
  const age = timestamp ? Date.now() - timestamp : Infinity;
  
  // Only prefetch if cache is stale or missing
  if (!cached || age > CACHE_TTL.TABLES * 0.5) {
    try {
      // Fetch league memberships first
      const membershipsResult = await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", userId);
      
      if (membershipsResult.error || !membershipsResult.data?.length) {
        return;
      }
      
      const leagueIds = membershipsResult.data.map((r: any) => r.league_id);
      
      // Fetch all league data in parallel
      const [
        leaguesResult,
        memDataResult,
        readsResult,
        allResultsResult,
        allFixturesResult,
      ] = await Promise.all([
        supabase.from("leagues").select("id,name,code,created_at,avatar").in("id", leagueIds).order("created_at", { ascending: true }),
        supabase.from("league_members").select("league_id,user_id").in("league_id", leagueIds).limit(10000),
        supabase.from("league_message_reads").select("league_id,last_read_at").eq("user_id", userId),
        supabase.from("gw_results").select("gw,fixture_index,result"),
        supabase.from("fixtures").select("gw,kickoff_time").order("gw", { ascending: true }).order("kickoff_time", { ascending: true }),
      ]);
      
      // Cache the raw results
      const data = {
        leagues: leaguesResult.data,
        members: memDataResult.data,
        reads: readsResult.data,
        results: allResultsResult.data,
        fixtures: allFixturesResult.data,
        leagueIds,
      };
      
      setCached(cacheKey, data, CACHE_TTL.TABLES);
    } catch (error) {
      console.warn('[Prefetch] Failed to prefetch tables data:', error);
    }
  }
}

/**
 * Hook to handle app lifecycle events and prefetch data
 */
export function useAppLifecycle(): void {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user?.id) return;
    
    // Prefetch on mount (app startup)
    prefetchHomeData(user.id);
    prefetchTablesData(user.id);
    
    // Handle visibility change (app comes to foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden && user.id) {
        // App came to foreground - prefetch critical data
        prefetchHomeData(user.id);
        prefetchTablesData(user.id);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle focus (when window regains focus)
    const handleFocus = () => {
      if (user.id) {
        prefetchHomeData(user.id);
        prefetchTablesData(user.id);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id]);
}

