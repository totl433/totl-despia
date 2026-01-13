/**
 * Shared hook for fetching and managing league data.
 * This is the ONLY way pages should access league data.
 * 
 * Features:
 * - Stale-while-revalidate pattern
 * - Automatic refresh on mount
 * - Manual refresh capability
 * - Sorted by unread count (canonical sort)
 * - Cache quality logging for debugging
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUserLeagues, fetchUnreadCountsFromDb, invalidateLeagueCache, forceClearUnreadCache } from '../api/leagues';
import { sortLeaguesWithUnreadMap } from '../lib/sortLeagues';
import { getCached, setCached, getCachedWithMeta, CACHE_TTL } from '../lib/cache';
import { pageLog, log } from '../lib/logEvent';
import type { League } from '../types/league';

// Cache keys
const getLeaguesCacheKey = (userId: string) => `leagues:${userId}`;
const getUnreadCacheKey = (userId: string) => `leagues:unread:${userId}`;

export interface UseLeaguesResult {
  /** Sorted leagues (by unread count desc, then name asc) */
  leagues: League[];
  /** Map of leagueId -> unread message count */
  unreadByLeague: Record<string, number>;
  /** Whether initial load is in progress */
  loading: boolean;
  /** Whether a background refresh is in progress */
  refreshing: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  /** Invalidate cache and refresh */
  invalidateAndRefresh: () => Promise<void>;
  /** Force refresh unread counts only (lighter operation) */
  refreshUnreadCounts: (forceRefresh?: boolean) => Promise<void>;
}

export interface UseLeaguesOptions {
  /** Page name for logging (e.g., 'home', 'tables') */
  pageName?: string;
  /** Skip initial fetch (useful if data is pre-loaded) */
  skipInitialFetch?: boolean;
}

/**
 * Hook to fetch and manage league data.
 * Uses stale-while-revalidate pattern for optimal UX.
 */
export function useLeagues(options: UseLeaguesOptions = {}): UseLeaguesResult {
  const { pageName = 'unknown', skipInitialFetch = false } = options;
  const { user } = useAuth();
  const userId = user?.id;
  
  // Load initial state from cache synchronously
  // CRITICAL: Sort leagues when loading from cache to ensure consistent order
  const [leagues, setLeagues] = useState<League[]>(() => {
    if (!userId) return [];
    const cached = getCached<League[]>(getLeaguesCacheKey(userId));
    if (!cached) return [];
    // Sort using cached unread counts
    const cachedUnread = getCached<Record<string, number>>(getUnreadCacheKey(userId));
    return sortLeaguesWithUnreadMap(cached, cachedUnread ?? {});
  });
  
  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>(() => {
    if (!userId) return {};
    const unreadCacheKey = getUnreadCacheKey(userId);
    const { data: cached, meta: cacheMeta } = getCachedWithMeta<Record<string, number>>(unreadCacheKey);
    
    // If cache is very stale (older than 5 minutes), don't use it - return empty object
    // This forces a fresh fetch and prevents showing stale badge counts
    const VERY_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    if (cached && cacheMeta && cacheMeta.ageMs > VERY_STALE_THRESHOLD_MS) {
      log.debug('api/unread_cache_too_stale_on_init', {
        cacheAgeMs: cacheMeta.ageMs,
        freshnessPercent: cacheMeta.freshnessPercent,
        action: 'clearing_stale_cache',
      });
      // Clear the stale cache
      try {
        localStorage.removeItem(`despia:cache:${unreadCacheKey}`);
      } catch (e) {
        // Ignore errors
      }
      return {}; // Return empty to force fresh fetch
    }
    
    return cached ?? {};
  });
  
  const [loading, setLoading] = useState(() => {
    if (!userId) return false;
    if (skipInitialFetch) return false; // If skipping initial fetch, assume cache exists
    const cached = getCached<League[]>(getLeaguesCacheKey(userId));
    return !cached || cached.length === 0;
  });
  
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've done initial fetch
  const hasFetchedRef = useRef(false);
  const mountedRef = useRef(true);

  // Fetch leagues from API
  const fetchLeagues = useCallback(async (isRefresh: boolean = false) => {
    if (!userId) return;
    
    if (isRefresh) {
      setRefreshing(true);
    }
    
    try {
      const startTime = Date.now();
      const result = await fetchUserLeagues(userId, { forceRefresh: isRefresh });
      const fetchDurationMs = Date.now() - startTime;
      
      if (!mountedRef.current) return;
      
      const filteredLeagues = result.leagues.filter(l => l.name !== 'API Test');
      
      // Sort leagues
      const sorted = sortLeaguesWithUnreadMap(filteredLeagues, result.unreadByLeague);
      
      setLeagues(sorted);
      setUnreadByLeague(result.unreadByLeague);
      setError(null);
      
      // Log for debugging with cache quality metrics
      if (result.fromCache) {
        pageLog.leaguesInitial(pageName, sorted.length, sorted.map(l => l.id), {
          source: result.source,
          cacheAgeMs: result.cacheAgeMs,
        });
      } else {
        pageLog.leaguesRefresh(pageName, sorted.length, sorted.map(l => l.id), {
          source: result.source,
          fetchDurationMs,
        });
      }
      
      // Update cache
      setCached(getLeaguesCacheKey(userId), sorted, CACHE_TTL.LEAGUES);
      setCached(getUnreadCacheKey(userId), result.unreadByLeague, CACHE_TTL.LEAGUES);
      
    } catch (err: any) {
      if (!mountedRef.current) return;
      log.error(`${pageName}/leagues_error`, { error: err?.message });
      setError(err?.message ?? 'Failed to fetch leagues');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId, pageName]);

  // Refresh unread counts only (lighter operation)
  // CRITICAL: Always fetches fresh data from DB, ignoring cache
  const refreshUnreadCounts = useCallback(async (forceRefresh: boolean = false) => {
    if (!userId || leagues.length === 0) return;
    
    try {
      const leagueIds = leagues.map(l => l.id);
      const unreadCacheKey = getUnreadCacheKey(userId);
      
      // Get cached values before refresh for debug comparison
      const { data: cachedUnread, meta: cacheMeta } = getCachedWithMeta<Record<string, number>>(unreadCacheKey);
      
      // Check if cache is stale (older than 1 minute) - force refresh if so
      // Also force refresh if cache is older than 5 minutes (likely stale for badge counts)
      const STALE_THRESHOLD_MS = 60 * 1000; // 1 minute
      const VERY_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
      const isStale = cacheMeta && cacheMeta.ageMs > STALE_THRESHOLD_MS;
      const isVeryStale = cacheMeta && cacheMeta.ageMs > VERY_STALE_THRESHOLD_MS;
      const shouldForceRefresh = forceRefresh || isStale;
      
      // If cache is very stale, force clear it before fetching
      // This ensures we don't use stale data even temporarily
      if (isVeryStale) {
        log.debug('api/unread_cache_very_stale_clearing', {
          cacheAgeMs: cacheMeta.ageMs,
          freshnessPercent: cacheMeta.freshnessPercent,
          action: 'force_clearing_before_refresh',
        });
        forceClearUnreadCache(userId);
      }
      
      if (shouldForceRefresh && cacheMeta) {
        log.debug('api/unread_cache_stale_force_refresh', {
          cacheAgeMs: cacheMeta.ageMs,
          freshnessPercent: cacheMeta.freshnessPercent,
          isVeryStale,
          forceRefresh,
        });
      }
      
      // If cache is very stale, always refresh (even if forceRefresh is false)
      // This ensures badges are updated even if user hasn't explicitly requested refresh
      if (isVeryStale && !forceRefresh) {
        log.debug('api/unread_cache_very_stale_auto_refresh', {
          cacheAgeMs: cacheMeta.ageMs,
          freshnessPercent: cacheMeta.freshnessPercent,
        });
      }
      
      // Always fetch fresh from DB (ignore cache)
      const freshUnread = await fetchUnreadCountsFromDb(userId, leagueIds);
      
      if (!mountedRef.current) return;
      
      // Always log refresh (for debugging badge issues)
      const hasChanges = cachedUnread ? leagueIds.some(id => {
        const cached = cachedUnread[id] ?? 0;
        const fresh = freshUnread[id] ?? 0;
        return cached !== fresh;
      }) : true; // If no cache, consider it a change
      
      if (hasChanges) {
        log.debug('api/unread_counts_refreshed', {
          cached: cachedUnread ?? {},
          fresh: freshUnread,
          cacheAgeMs: cacheMeta?.ageMs ?? null,
          cacheFreshness: cacheMeta?.freshnessPercent ?? null,
          forceRefresh,
        });
      } else {
        // Log even when no changes (for debugging)
        log.debug('api/unread_counts_refreshed_no_changes', {
          cached: cachedUnread,
          fresh: freshUnread,
          cacheAgeMs: cacheMeta?.ageMs ?? null,
          forceRefresh,
        });
      }
      
      // Always update state with fresh data, even if it matches cache
      // This ensures UI is updated even if cache was stale
      setUnreadByLeague(freshUnread);
      
      // Re-sort with fresh unread counts
      const sorted = sortLeaguesWithUnreadMap(leagues, freshUnread);
      setLeagues(sorted);
      
      // Update cache with fresh data
      setCached(unreadCacheKey, freshUnread, CACHE_TTL.LEAGUES);
      
    } catch (err) {
      // Log error but don't throw - unread refresh is non-critical
      log.warn('api/unread_refresh_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }, [userId, leagues]);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchLeagues(true);
  }, [fetchLeagues]);

  // Invalidate and refresh
  const invalidateAndRefresh = useCallback(async () => {
    if (userId) {
      invalidateLeagueCache(userId);
    }
    await fetchLeagues(true);
  }, [userId, fetchLeagues]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    
    if (skipInitialFetch) {
      setLoading(false);
      // Even if skipping initial fetch, refresh unread counts IMMEDIATELY
      // This ensures badges are up-to-date even when using cached league data
      // Force refresh to ensure we get fresh data even if cache exists
      if (leagues.length > 0 && !hasFetchedRef.current) {
        hasFetchedRef.current = true;
        // Refresh unread counts IMMEDIATELY (no delay) with force refresh
        // This is critical to fix stuck badges - don't wait for background refresh
        refreshUnreadCounts(true).catch(() => {
          // Silently fail - non-critical
        });
      }
      return;
    }
    
    if (!userId) {
      setLoading(false);
      return;
    }
    
    // If we have cached data, show it immediately
    if (leagues.length > 0) {
      setLoading(false);
      // Still refresh in background (both leagues and unread counts)
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchLeagues(false);
        // Also refresh unread counts IMMEDIATELY (no delay) to ensure they're fresh
        // Force refresh to ensure we get fresh data even if cache exists
        // This is critical to fix stuck badges - refresh immediately, not in background
        refreshUnreadCounts(true).catch(() => {
          // Silently fail - non-critical
        });
      }
    } else {
      // No cache, must fetch
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchLeagues(false);
      }
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [userId, skipInitialFetch, fetchLeagues, leagues.length, refreshUnreadCounts]);

  // Refresh unread counts when window gains focus
  useEffect(() => {
    if (!userId) return;
    
    const handleFocus = () => {
      refreshUnreadCounts();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userId, refreshUnreadCounts]);

  // Refresh unread counts when messages are marked as read (from League page)
  useEffect(() => {
    if (!userId) return;
    
    const handleMessagesRead = (event: CustomEvent) => {
      const { userId: eventUserId, leagueId } = event.detail || {};
      // Only refresh if the event is for this user
      if (eventUserId === userId) {
        log.debug('api/leagues_unread_refresh_triggered', {
          leagueId,
          userId: userId.slice(0, 8),
        });
        // Immediately refresh unread counts (cache was already invalidated by useMarkMessagesRead)
        // Force refresh to ensure we get fresh data after cache invalidation
        refreshUnreadCounts(true).catch((err) => {
          log.warn('api/leagues_unread_refresh_failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    };
    
    window.addEventListener('leagueMessagesRead', handleMessagesRead as EventListener);
    return () => window.removeEventListener('leagueMessagesRead', handleMessagesRead as EventListener);
  }, [userId, refreshUnreadCounts]);

  return {
    leagues,
    unreadByLeague,
    loading,
    refreshing,
    error,
    refresh,
    invalidateAndRefresh,
    refreshUnreadCounts,
  };
}

