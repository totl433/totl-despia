/**
 * Canonical league data fetching.
 * This is the ONLY place where Supabase queries for user leagues are defined.
 * 
 * All pages (Home, Tables, etc.) should use this via the useLeagues hook.
 * The initialDataLoader also uses this to pre-warm the cache.
 * 
 * CACHE QUALITY LOGGING:
 * This module logs cache hits/misses with freshness metrics to help debug
 * data consistency issues. Key log events:
 * - api/leagues_cache_hit: Data served from cache (includes ageMs, freshnessPercent)
 * - api/leagues_cache_miss: No cache or expired
 * - api/leagues_fetch_start: Network request started
 * - api/leagues_fetch_success: Network request completed (includes source)
 */

import { supabase } from '../lib/supabase';
import { getCachedWithMeta, setCached, CACHE_TTL } from '../lib/cache';
import { log } from '../lib/logEvent';
import type { League, LeagueWithUnread } from '../types/league';
import { sortLeaguesAttachingUnread } from '../lib/sortLeagues';

// Cache key generator for leagues
const getLeaguesCacheKey = (userId: string) => `leagues:${userId}`;
const getUnreadCacheKey = (userId: string) => `leagues:unread:${userId}`;

// Data source types for logging
type DataSource = 'cache' | 'network' | 'prewarm';

/**
 * Fetch user's leagues from Supabase.
 * This is the single query definition - no other file should query league_members for league data.
 */
export async function fetchUserLeaguesFromDb(userId: string): Promise<League[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('leagues(id, name, code, avatar, created_at, start_gw)')
    .eq('user_id', userId);

  if (error) {
    log.error('api/fetch_leagues_error', { error: error.message });
    throw error;
  }

  const leagues = (data ?? [])
    .map((r: any) => r.leagues)
    .filter((l: any): l is League => l !== null && l.name !== 'API Test');

  return leagues;
}

/**
 * Fetch unread message counts for leagues.
 * Returns a map of leagueId -> unreadCount
 */
export async function fetchUnreadCountsFromDb(
  userId: string,
  leagueIds: string[]
): Promise<Record<string, number>> {
  if (leagueIds.length === 0) return {};

  try {
    // Fetch last read times for user
    const { data: readsData, error: readsError } = await supabase
      .from('league_message_reads')
      .select('league_id, last_read_at')
      .eq('user_id', userId);

    if (readsError) {
      log.warn('api/fetch_unread_reads_error', { error: readsError.message });
      return {};
    }

    const lastRead = new Map<string, string>();
    (readsData ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

    // Fetch unread counts for each league in parallel
    const countPromises = leagueIds.map(async (leagueId) => {
      const since = lastRead.get(leagueId) ?? '1970-01-01T00:00:00Z';
      const { count, error } = await supabase
        .from('league_messages')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', leagueId)
        .gte('created_at', since)
        .neq('user_id', userId); // Exclude own messages

      if (error) {
        log.warn('api/fetch_unread_count_error', { leagueId: leagueId.slice(0, 8), error: error.message });
        return { leagueId, count: 0 };
      }

      return { leagueId, count: typeof count === 'number' ? count : 0 };
    });

    const results = await Promise.all(countPromises);
    const unreadMap: Record<string, number> = {};
    results.forEach(({ leagueId, count }) => {
      unreadMap[leagueId] = count;
    });

    return unreadMap;
  } catch (error: any) {
    log.error('api/fetch_unread_error', { error: error?.message });
    return {};
  }
}

/**
 * Options for fetching leagues
 */
export interface FetchLeaguesOptions {
  /** Skip cache and fetch from network */
  forceRefresh?: boolean;
  /** Include unread counts (requires additional query) */
  includeUnread?: boolean;
}

/**
 * Result of fetching leagues
 */
export interface FetchLeaguesResult {
  leagues: League[];
  unreadByLeague: Record<string, number>;
  fromCache: boolean;
  /** Data source for logging purposes */
  source: DataSource;
  /** Cache age in milliseconds (null if from network) */
  cacheAgeMs: number | null;
}

/**
 * Fetch user's leagues with caching.
 * This is the main entry point for getting league data.
 * 
 * Features:
 * - Reads from cache first (stale-while-revalidate)
 * - Fetches from network in background
 * - Updates cache with fresh data
 * - Optionally includes unread counts
 * - Logs cache quality metrics for debugging
 */
export async function fetchUserLeagues(
  userId: string,
  options: FetchLeaguesOptions = {}
): Promise<FetchLeaguesResult> {
  const { forceRefresh = false, includeUnread = true } = options;
  const cacheKey = getLeaguesCacheKey(userId);
  const unreadCacheKey = getUnreadCacheKey(userId);

  // Try cache first (unless force refresh)
  if (!forceRefresh) {
    const { data: cachedLeagues, meta: leaguesMeta } = getCachedWithMeta<League[]>(cacheKey);
    const { data: cachedUnread, meta: unreadMeta } = getCachedWithMeta<Record<string, number>>(unreadCacheKey);
    
    if (cachedLeagues && cachedLeagues.length > 0) {
      // Log cache hit with quality metrics
      log.info('api/leagues_cache_hit', { 
        cacheHit: true,
        cacheAgeMs: leaguesMeta?.ageMs ?? null,
        freshnessPercent: leaguesMeta?.freshnessPercent ?? 0,
        source: 'cache' as DataSource,
        count: cachedLeagues.length,
        unreadCacheAgeMs: unreadMeta?.ageMs ?? null,
      });
      
      return {
        leagues: cachedLeagues,
        unreadByLeague: cachedUnread ?? {},
        fromCache: true,
        source: 'cache',
        cacheAgeMs: leaguesMeta?.ageMs ?? null,
      };
    } else {
      // Log cache miss
      log.info('api/leagues_cache_miss', { 
        cacheHit: false,
        reason: cachedLeagues ? 'empty' : 'not_found',
        source: 'network' as DataSource,
      });
    }
  }

  // Fetch from network
  log.info('api/leagues_fetch_start', { 
    userId: userId.slice(0, 8),
    forceRefresh,
    source: forceRefresh ? 'prewarm' : 'network' as DataSource,
  });
  
  const startTime = Date.now();
  const leagues = await fetchUserLeaguesFromDb(userId);
  const fetchDurationMs = Date.now() - startTime;
  
  // Cache leagues
  setCached(cacheKey, leagues, CACHE_TTL.LEAGUES);
  
  // Fetch unread counts if requested
  let unreadByLeague: Record<string, number> = {};
  if (includeUnread && leagues.length > 0) {
    const leagueIds = leagues.map(l => l.id);
    unreadByLeague = await fetchUnreadCountsFromDb(userId, leagueIds);
    setCached(unreadCacheKey, unreadByLeague, CACHE_TTL.LEAGUES);
  }
  
  const source: DataSource = forceRefresh ? 'prewarm' : 'network';
  
  // Log successful network fetch
  log.info('api/leagues_fetch_success', { 
    cacheHit: false,
    source,
    count: leagues.length,
    fetchDurationMs,
    totalUnread: Object.values(unreadByLeague).reduce((a, b) => a + b, 0),
  });

  return {
    leagues,
    unreadByLeague,
    fromCache: false,
    source,
    cacheAgeMs: null,
  };
}

/**
 * Fetch leagues and return them sorted by unread count.
 * Convenience function that combines fetch + sort.
 */
export async function fetchUserLeaguesSorted(
  userId: string,
  options: FetchLeaguesOptions = {}
): Promise<{ leagues: LeagueWithUnread[]; fromCache: boolean }> {
  const { leagues, unreadByLeague, fromCache } = await fetchUserLeagues(userId, options);
  const sortedLeagues = sortLeaguesAttachingUnread(leagues, unreadByLeague);
  
  return { leagues: sortedLeagues, fromCache };
}

/**
 * Invalidate cached league data for a user.
 * Call this after actions that modify leagues (join, leave, create).
 */
export function invalidateLeagueCache(userId: string): void {
  const cacheKey = getLeaguesCacheKey(userId);
  const unreadCacheKey = getUnreadCacheKey(userId);
  
  // Remove from cache (using removeCached from cache.ts)
  try {
    localStorage.removeItem(`despia:cache:${cacheKey}`);
    localStorage.removeItem(`despia:cache:${unreadCacheKey}`);
    log.debug('api/leagues_cache_invalidated', { userId: userId.slice(0, 8) });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Pre-warm the leagues cache.
 * Used by initialDataLoader to populate cache before app renders.
 * Returns league IDs for use in subsequent queries (e.g., Tables pre-loading).
 */
export async function prewarmLeaguesCache(userId: string): Promise<{ leagueIds: string[] }> {
  const result = await fetchUserLeagues(userId, { forceRefresh: true, includeUnread: true });
  log.debug('api/leagues_cache_prewarmed', { userId: userId.slice(0, 8), count: result.leagues.length });
  return { leagueIds: result.leagues.map(l => l.id) };
}

