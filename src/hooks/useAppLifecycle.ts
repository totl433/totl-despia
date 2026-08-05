/**
 * Hook for app lifecycle events (foreground/background)
 * Used for prefetching data when app comes to foreground
 */

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCacheTimestamp, CACHE_TTL } from '../lib/cache';
import { supabase } from '../lib/supabase';
import { isLoadEverythingFirstEnabled } from '../lib/featureFlags';
import { ensureActiveSeasonCtx } from '../lib/activeSeasonCtx';
import { getSeasonTables, withSeasonId } from '../lib/seasonStack';

/**
 * Prefetch home page data (stack-aware so Pile B doesn't warm legacy GW points).
 */
async function prefetchHomeData(userId: string): Promise<void> {
  const cacheKey = `home:basic:${userId}`;
  const timestamp = getCacheTimestamp(cacheKey);
  const age = timestamp ? Date.now() - timestamp : Infinity;
  
  if (!timestamp || age > CACHE_TTL.HOME * 0.5) {
    try {
      const seasonCtx = await ensureActiveSeasonCtx(supabase as any, userId);
      const tables = getSeasonTables(seasonCtx);

      let resultsLatest = (supabase as any)
        .from(tables.results)
        .select('gw')
        .order('gw', { ascending: false })
        .limit(1);
      resultsLatest = withSeasonId(resultsLatest, seasonCtx);

      let pointsQ = (supabase as any)
        .from(tables.gwPoints)
        .select('user_id, gw, points')
        .order('gw', { ascending: true });
      if (seasonCtx.useSeasonStack && seasonCtx.seasonId) {
        pointsQ = pointsQ.eq('season_id', seasonCtx.seasonId);
      }

      let ocpQ = (supabase as any).from(tables.ocpOverall).select('user_id, name, ocp');
      if (seasonCtx.useSeasonStack && seasonCtx.seasonId) {
        ocpQ = ocpQ.eq('season_id', seasonCtx.seasonId);
      }

      Promise.all([
        supabase.from('league_members').select('leagues(id, name, code, avatar, created_at)').eq('user_id', userId),
        resultsLatest.maybeSingle(),
        pointsQ,
        ocpQ,
      ]).catch(() => {
        // Silently fail - this is just a prefetch
      });
    } catch {
      // Silently fail - this is just a prefetch
    }
  }
}

/**
 * Prefetch tables page data
 */
async function prefetchTablesData(userId: string): Promise<void> {
  const cacheKey = `tables:${userId}`;
  const timestamp = getCacheTimestamp(cacheKey);
  const age = timestamp ? Date.now() - timestamp : Infinity;
  
  if (!timestamp || age > CACHE_TTL.TABLES * 0.5) {
    try {
      const membershipsResult = await supabase
        .from('league_members')
        .select('league_id')
        .eq('user_id', userId);
      
      if (membershipsResult.error || !membershipsResult.data?.length) {
        return;
      }
      
      const leagueIds = membershipsResult.data.map((r: any) => r.league_id);
      const seasonCtx = await ensureActiveSeasonCtx(supabase as any, userId);
      const tables = getSeasonTables(seasonCtx);

      let resultsQ = (supabase as any)
        .from(tables.results)
        .select('gw,fixture_index,result');
      resultsQ = withSeasonId(resultsQ, seasonCtx);

      let fixturesQ = (supabase as any)
        .from(tables.fixtures)
        .select('gw,kickoff_time')
        .order('gw', { ascending: true })
        .order('kickoff_time', { ascending: true });
      fixturesQ = withSeasonId(fixturesQ, seasonCtx);
      
      Promise.all([
        supabase.from('leagues').select('id,name,code,created_at,avatar').in('id', leagueIds).order('created_at', { ascending: true }),
        supabase.from('league_members').select('league_id,user_id').in('league_id', leagueIds).limit(10000),
        supabase.from('league_message_reads').select('league_id,last_read_at').eq('user_id', userId),
        resultsQ,
        fixturesQ,
      ]).catch(() => {
        // Silently fail
      });
    } catch {
      // Silently fail
    }
  }
}

/**
 * Hook to handle app lifecycle events and prefetch data
 */
export function useAppLifecycle(): void {
  const { user } = useAuth();
  
  useEffect(() => {
    if (isLoadEverythingFirstEnabled()) return;
    if (!user?.id) return;
    
    prefetchHomeData(user.id);
    prefetchTablesData(user.id);
    
    const handleVisibilityChange = () => {
      if (!document.hidden && user.id) {
        prefetchHomeData(user.id);
        prefetchTablesData(user.id);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
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
