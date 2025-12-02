/**
 * Hook for app lifecycle events (foreground/background)
 * Used for prefetching data when app comes to foreground
 */

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCacheTimestamp, CACHE_TTL } from '../lib/cache';
import { supabase } from '../lib/supabase';
import { isLoadEverythingFirstEnabled } from '../lib/featureFlags';

/**
 * Prefetch home page data
 * Note: This just triggers a background fetch - the actual caching is done by Home.tsx
 * We don't cache here to avoid structure mismatches
 */
async function prefetchHomeData(userId: string): Promise<void> {
  const cacheKey = `home:basic:${userId}`;
  const timestamp = getCacheTimestamp(cacheKey);
  const age = timestamp ? Date.now() - timestamp : Infinity;
  
  // Only prefetch if cache is stale or missing
  // Refresh at 50% of TTL to keep data fresh
  if (!timestamp || age > CACHE_TTL.HOME * 0.5) {
    try {
      // Just trigger the fetch - Home.tsx will handle caching
      // This is a fire-and-forget prefetch to warm up the network
      Promise.all([
        supabase.from("league_members").select("leagues(id, name, code, avatar, created_at)").eq("user_id", userId),
        supabase.from("gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle(),
        supabase.from("v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
        supabase.from("v_ocp_overall").select("user_id, name, ocp")
      ]).catch(() => {
        // Silently fail - this is just a prefetch
      });
    } catch (error) {
      // Silently fail - this is just a prefetch
    }
  }
}

/**
 * Prefetch tables page data
 * Note: This just triggers a background fetch - the actual caching is done by Tables.tsx
 * We don't cache here to avoid structure mismatches
 */
async function prefetchTablesData(userId: string): Promise<void> {
  const cacheKey = `tables:${userId}`;
  const timestamp = getCacheTimestamp(cacheKey);
  const age = timestamp ? Date.now() - timestamp : Infinity;
  
  // Only prefetch if cache is stale or missing
  if (!timestamp || age > CACHE_TTL.TABLES * 0.5) {
    try {
      // Just trigger the fetch - Tables.tsx will handle caching
      // This is a fire-and-forget prefetch to warm up the network
      const membershipsResult = await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", userId);
      
      if (membershipsResult.error || !membershipsResult.data?.length) {
        return;
      }
      
      const leagueIds = membershipsResult.data.map((r: any) => r.league_id);
      
      // Fire-and-forget prefetch
      Promise.all([
        supabase.from("leagues").select("id,name,code,created_at,avatar").in("id", leagueIds).order("created_at", { ascending: true }),
        supabase.from("league_members").select("league_id,user_id").in("league_id", leagueIds).limit(10000),
        supabase.from("league_message_reads").select("league_id,last_read_at").eq("user_id", userId),
        supabase.from("gw_results").select("gw,fixture_index,result"),
        supabase.from("fixtures").select("gw,kickoff_time").order("gw", { ascending: true }).order("kickoff_time", { ascending: true }),
      ]).catch(() => {
        // Silently fail - this is just a prefetch
      });
    } catch (error) {
      // Silently fail - this is just a prefetch
    }
  }
}

/**
 * Hook to handle app lifecycle events and prefetch data
 */
export function useAppLifecycle(): void {
  const { user } = useAuth();
  
  useEffect(() => {
    // Skip prefetching if "load everything first" mode is enabled
    // (data is already loaded upfront in that mode)
    if (isLoadEverythingFirstEnabled()) return;
    
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

