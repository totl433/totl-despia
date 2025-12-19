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
  // NOTE: start_gw column doesn't exist in production - don't include it
  const { data, error } = await supabase
    .from('league_members')
    .select('leagues(id, name, code, avatar, created_at)')
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
 * 
 * OPTIMIZED: Uses only 2 queries instead of N+1
 * 1. Fetch last_read_at for all leagues
 * 2. Fetch ALL messages for these leagues (with created_at, league_id, user_id)
 * 3. Count unread client-side
 */
export async function fetchUnreadCountsFromDb(
  userId: string,
  leagueIds: string[]
): Promise<Record<string, number>> {
  if (leagueIds.length === 0) return {};

  try {
    // Query 1: Fetch last read times for user (all leagues at once)
    const { data: readsData, error: readsError } = await supabase
      .from('league_message_reads')
      .select('league_id, last_read_at')
      .eq('user_id', userId)
      .in('league_id', leagueIds);

    if (readsError) {
      log.warn('api/fetch_unread_reads_error', { error: readsError.message });
      return {};
    }

    const lastRead = new Map<string, string>();
    (readsData ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

    // Find the earliest last_read_at to minimize message fetch
    const defaultTime = '1970-01-01T00:00:00Z';
    let earliestTime = defaultTime;
    leagueIds.forEach(id => {
      const time = lastRead.get(id) ?? defaultTime;
      if (time < earliestTime || earliestTime === defaultTime) {
        earliestTime = time;
      }
    });

    // Query 2: Fetch all messages since earliest last_read (single query for all leagues)
    const { data: messagesData, error: messagesError } = await supabase
      .from('league_messages')
      .select('league_id, created_at, user_id')
      .in('league_id', leagueIds)
      .gte('created_at', earliestTime)
      .neq('user_id', userId) // Exclude own messages
      .limit(10000); // Safety limit

    if (messagesError) {
      log.warn('api/fetch_unread_messages_error', { error: messagesError.message });
      return {};
    }

    // Count unread messages client-side
    const unreadMap: Record<string, number> = {};
    leagueIds.forEach(id => { unreadMap[id] = 0; });

    (messagesData ?? []).forEach((msg: any) => {
      const leagueLastRead = lastRead.get(msg.league_id) ?? defaultTime;
      if (msg.created_at >= leagueLastRead) {
        unreadMap[msg.league_id] = (unreadMap[msg.league_id] ?? 0) + 1;
      }
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

