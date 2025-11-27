/**
 * Cache utilities for Despia native app optimization
 * Implements TTL-based caching with localStorage for instant page loads
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

// Cache TTLs - how long data stays fresh
export const CACHE_TTL = {
  LEAGUES: 5 * 60 * 1000,        // 5 minutes
  FIXTURES: 2 * 60 * 1000,       // 2 minutes (more dynamic)
  LEADERBOARD: 1 * 60 * 1000,    // 1 minute
  SUBMISSIONS: 30 * 1000,        // 30 seconds
  LIVE_SCORES: 10 * 1000,        // 10 seconds (very dynamic)
  TABLES: 5 * 60 * 1000,         // 5 minutes
  HOME: 5 * 60 * 1000,           // 5 minutes
  GLOBAL: 1 * 60 * 1000,         // 1 minute
} as const;

const CACHE_PREFIX = 'despia:cache:';
// Note: MAX_CACHE_SIZE reserved for future use if we need to implement size-based cache eviction
// const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB max cache

/**
 * Get cached data if it exists and hasn't expired
 */
export function getCached<T>(key: string): T | null {
  try {
    const entryStr = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!entryStr) return null;
    
    const entry: CacheEntry<T> = JSON.parse(entryStr);
    const age = Date.now() - entry.timestamp;
    
    if (age > entry.ttl) {
      // Expired - remove it
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    
    return entry.data;
  } catch (e) {
    // Invalid cache entry - remove it
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch {}
    return null;
  }
}

/**
 * Cache data with TTL
 */
export function setCached<T>(key: string, data: T, ttl: number): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (e) {
    // Storage might be full - try to clear old entries
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      clearOldCache();
      // Retry once
      try {
        localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({
          data,
          timestamp: Date.now(),
          ttl,
        }));
      } catch {
        // Still failing - give up
      }
    }
  }
}

/**
 * Remove a specific cache entry
 */
export function removeCached(key: string): void {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {}
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    
    const now = Date.now();
    for (const key of keys) {
      try {
        const entryStr = localStorage.getItem(key);
        if (!entryStr) continue;
        
        const entry: CacheEntry<any> = JSON.parse(entryStr);
        if (now - entry.timestamp > entry.ttl) {
          localStorage.removeItem(key);
        }
      } catch {
        // Invalid entry - remove it
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

/**
 * Clear old cache entries when storage is full
 * Removes oldest entries first
 */
function clearOldCache(): void {
  try {
    const entries: Array<{ key: string; timestamp: number }> = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        try {
          const entryStr = localStorage.getItem(key);
          if (!entryStr) continue;
          
          const entry: CacheEntry<any> = JSON.parse(entryStr);
          entries.push({
            key,
            timestamp: entry.timestamp,
          });
        } catch {
          // Invalid entry - remove it
          localStorage.removeItem(key!);
        }
      }
    }
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key);
    }
  } catch {}
}

/**
 * Clear all cache entries matching a pattern
 * Useful for invalidating related caches
 */
export function clearCachePattern(pattern: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX) && key.includes(pattern)) {
        keys.push(key);
      }
    }
    
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {}
}

/**
 * Get cache timestamp for a key (to check age)
 */
export function getCacheTimestamp(key: string): number | null {
  try {
    const entryStr = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!entryStr) return null;
    
    const entry: CacheEntry<any> = JSON.parse(entryStr);
    return entry.timestamp;
  } catch {
    return null;
  }
}

/**
 * Check if cache entry exists and is fresh
 */
export function isCacheFresh(key: string, maxAge?: number): boolean {
  const timestamp = getCacheTimestamp(key);
  if (!timestamp) return false;
  
  const age = Date.now() - timestamp;
  if (maxAge !== undefined) {
    return age < maxAge;
  }
  
  // Check TTL
  try {
    const entryStr = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!entryStr) return false;
    
    const entry: CacheEntry<any> = JSON.parse(entryStr);
    return age < entry.ttl;
  } catch {
    return false;
  }
}

/**
 * Invalidate cache for a specific user after actions that change data
 */
export function invalidateUserCache(userId: string): void {
  clearCachePattern(`:${userId}`);
  clearCachePattern(`home:${userId}`);
  clearCachePattern(`tables:${userId}`);
}

/**
 * Invalidate all cache (use sparingly)
 */
export function invalidateAllCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch {}
}

// Clean up expired cache on module load
if (typeof window !== 'undefined') {
  clearExpiredCache();
}

