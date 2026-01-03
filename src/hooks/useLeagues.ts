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
import { fetchUserLeagues, fetchUnreadCountsFromDb, invalidateLeagueCache } from '../api/leagues';
import { sortLeaguesWithUnreadMap } from '../lib/sortLeagues';
import { getCached, setCached, CACHE_TTL } from '../lib/cache';
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
  const [leagues, setLeagues] = useState<League[]>(() => {
    if (!userId) return [];
    const cached = getCached<League[]>(getLeaguesCacheKey(userId));
    return cached ?? [];
  });
  
  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>(() => {
    if (!userId) return {};
    const cached = getCached<Record<string, number>>(getUnreadCacheKey(userId));
    return cached ?? {};
  });
  
  const [loading, setLoading] = useState(() => {
    if (!userId) return false;
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
  const refreshUnreadCounts = useCallback(async () => {
    if (!userId || leagues.length === 0) return;
    
    try {
      const leagueIds = leagues.map(l => l.id);
      const freshUnread = await fetchUnreadCountsFromDb(userId, leagueIds);
      
      if (!mountedRef.current) return;
      
      setUnreadByLeague(freshUnread);
      
      // Re-sort with fresh unread counts
      const sorted = sortLeaguesWithUnreadMap(leagues, freshUnread);
      setLeagues(sorted);
      
      // Update cache
      setCached(getUnreadCacheKey(userId), freshUnread, CACHE_TTL.LEAGUES);
      
    } catch (err) {
      // Silently fail - unread refresh is non-critical
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
      return;
    }
    
    if (!userId) {
      setLoading(false);
      return;
    }
    
    // If we have cached data, show it immediately
    if (leagues.length > 0) {
      setLoading(false);
      // Still refresh in background
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchLeagues(false);
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
  }, [userId, skipInitialFetch, fetchLeagues, leagues.length]);

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
      const { userId: eventUserId } = event.detail || {};
      // Only refresh if the event is for this user
      if (eventUserId === userId) {
        refreshUnreadCounts();
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
  };
}

