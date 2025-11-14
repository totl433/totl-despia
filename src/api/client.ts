// Centralized API client with caching, retry logic, and offline support
// import { supabase } from "../lib/supabase"; // Not currently used
import { storage } from "../lib/nativeStorage";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  expiresAt: number;
};

type QueryOptions = {
  cacheKey?: string;
  cacheTTL?: number; // Time to live in milliseconds
  retries?: number;
  retryDelay?: number; // Delay between retries in milliseconds
  forceRefresh?: boolean;
};

const DEFAULT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

// Cache storage key prefix
const CACHE_PREFIX = 'api_cache_';

// Check if we're online
function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // Assume online if we can't determine
}

// Get cached data
async function getCached<T>(cacheKey: string): Promise<T | null> {
  try {
    const cached = await storage.getJSON<CacheEntry<T>>(cacheKey);
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.expiresAt) {
      // Cache expired, remove it
      await storage.removeItem(cacheKey);
      return null;
    }
    
    return cached.data;
  } catch (error) {
    // If cache lookup fails, just return null (don't block the query)
    console.warn('[API Client] Cache lookup failed for', cacheKey, error);
    return null;
  }
}

// Set cached data
async function setCached<T>(cacheKey: string, data: T, ttl: number): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    await storage.setJSON(cacheKey, entry);
  } catch (error) {
    // If caching fails, just log it but don't throw (caching is optional)
    console.warn('[API Client] Failed to cache data for', cacheKey, error);
  }
}

// Retry wrapper for Supabase queries
async function withRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  retries: number = DEFAULT_RETRIES,
  delay: number = DEFAULT_RETRY_DELAY
): Promise<{ data: T | null; error: any }> {
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await queryFn();
      if (!result.error) {
        return result;
      }
      lastError = result.error;
      
      // Don't retry on certain errors (e.g., authentication errors)
      if (result.error?.code === 'PGRST116' || result.error?.status === 401) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    
    // Wait before retrying (except on last attempt)
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
  
  return { data: null, error: lastError };
}

// Main query function with caching and retry logic
export async function query<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: QueryOptions = {}
): Promise<{ data: T | null; error: any; fromCache: boolean }> {
  const {
    cacheKey,
    cacheTTL = DEFAULT_CACHE_TTL,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    forceRefresh = false,
  } = options;

  // Try cache first (unless force refresh)
  // If cache lookup fails, just continue to query (don't block)
  if (cacheKey && !forceRefresh) {
    try {
      const cached = await getCached<T>(cacheKey);
      if (cached !== null) {
        return { data: cached, error: null, fromCache: true };
      }
    } catch (cacheError) {
      // Cache lookup failed, but continue to execute query
      console.warn('[API Client] Cache check failed, proceeding with query:', cacheError);
    }
  }

  // If offline and no cache, return error
  if (!isOnline() && !cacheKey) {
    return { data: null, error: { message: 'Offline and no cache available' }, fromCache: false };
  }

  // Execute query with retry logic
  const result = await withRetry(queryFn, retries, retryDelay);

  // Cache successful results (don't block if caching fails)
  if (cacheKey && result.data !== null && !result.error) {
    try {
      await setCached(cacheKey, result.data, cacheTTL);
    } catch (cacheError) {
      // Caching failed, but that's okay - we still have the data
      console.warn('[API Client] Failed to cache result, but query succeeded:', cacheError);
    }
  }

  return { ...result, fromCache: false };
}

// Batch multiple queries in parallel
export async function batchQuery<T>(
  queries: Array<() => Promise<{ data: T | null; error: any }>>,
  options: QueryOptions = {}
): Promise<Array<{ data: T | null; error: any; fromCache: boolean }>> {
  return Promise.all(queries.map(q => query(q, options)));
}

// Clear cache for a specific key or all cache
export async function clearCache(cacheKey?: string): Promise<void> {
  if (cacheKey) {
    await storage.removeItem(`${CACHE_PREFIX}${cacheKey}`);
  } else {
    // Clear all cache entries (this is a simple implementation)
    // In production, you might want to iterate through all keys
    try {
      // For now, we'll just clear known cache keys
      // A more robust solution would require listing all keys
      console.warn('Clearing all cache not fully implemented - clear specific keys instead');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}

// Helper to generate cache keys
export function getCacheKey(prefix: string, ...parts: (string | number | null | undefined)[]): string {
  const key = parts.filter(p => p !== null && p !== undefined).join('_');
  return `${CACHE_PREFIX}${prefix}_${key}`;
}

