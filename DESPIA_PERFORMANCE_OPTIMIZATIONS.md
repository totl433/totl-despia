# Despia Performance Optimizations

## Current State Analysis

### What's Already Fast
- ✅ Parallel queries (Promise.all) for data fetching
- ✅ Optimized React rendering (useMemo, useCallback)
- ✅ Lazy loading of routes
- ✅ Minimal re-renders

### What's Missing (Despia-Specific Opportunities)
- ❌ **No data caching** - Every page load fetches fresh data from Supabase
- ❌ **No prefetching** - Data only loads when page is visited
- ❌ **No stale-while-revalidate** - Users wait for network requests
- ❌ **No background refresh** - Data only updates when user navigates

## Despia-Specific Optimizations

Since users **only ever see the Despia version** (native app), we can implement aggressive optimizations that wouldn't work well in a web browser:

### 1. Aggressive Data Caching with TTL

**Strategy**: Cache all Supabase query results in localStorage/indexedDB with timestamps and TTL (Time To Live).

**Benefits**:
- Instant page loads from cache
- Background refresh keeps data fresh
- Works offline (shows cached data)

**Implementation**:
```typescript
// src/lib/cache.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

const CACHE_TTL = {
  LEAGUES: 5 * 60 * 1000,        // 5 minutes
  FIXTURES: 2 * 60 * 1000,      // 2 minutes (more dynamic)
  LEADERBOARD: 1 * 60 * 1000,    // 1 minute
  SUBMISSIONS: 30 * 1000,       // 30 seconds
  LIVE_SCORES: 10 * 1000,       // 10 seconds (very dynamic)
};

export function getCached<T>(key: string): T | null {
  try {
    const entry = localStorage.getItem(`cache:${key}`);
    if (!entry) return null;
    
    const { data, timestamp, ttl }: CacheEntry<T> = JSON.parse(entry);
    const age = Date.now() - timestamp;
    
    if (age > ttl) {
      localStorage.removeItem(`cache:${key}`);
      return null; // Expired
    }
    
    return data;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T, ttl: number): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch (e) {
    // Storage full - clear old entries
    clearOldCache();
  }
}
```

### 2. Stale-While-Revalidate Pattern

**Strategy**: Show cached data immediately, then refresh in background.

**Benefits**:
- Perceived load time: **0ms** (instant from cache)
- Data stays fresh (background refresh)
- Best of both worlds

**Implementation Pattern**:
```typescript
// In Home.tsx, Tables.tsx, etc.
useEffect(() => {
  if (!user?.id) return;
  
  // 1. Load from cache immediately (if available)
  const cacheKey = `home:${user.id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    setLeagues(cached.leagues);
    setGwPoints(cached.gwPoints);
    // ... set all state from cache
    setLoading(false); // Show page immediately!
  }
  
  // 2. Fetch fresh data in background
  (async () => {
    const fresh = await fetchAllData();
    setLeagues(fresh.leagues);
    setGwPoints(fresh.gwPoints);
    // ... update state with fresh data
    setCached(cacheKey, fresh, CACHE_TTL.LEAGUES);
  })();
}, [user?.id]);
```

### 3. App Lifecycle Prefetching

**Strategy**: Prefetch data when app comes to foreground (using `document.visibilitychange`).

**Benefits**:
- Data ready before user navigates
- Feels instant when switching tabs

**Implementation**:
```typescript
// src/hooks/useAppLifecycle.ts
export function useAppLifecycle() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user?.id) return;
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // App came to foreground - prefetch critical data
        prefetchHomeData(user.id);
        prefetchTablesData(user.id);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also prefetch on mount (app startup)
    prefetchHomeData(user.id);
    prefetchTablesData(user.id);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);
}

async function prefetchHomeData(userId: string) {
  const cacheKey = `home:${userId}`;
  const cached = getCached(cacheKey);
  const age = cached ? (Date.now() - getCacheTimestamp(cacheKey)) : Infinity;
  
  // Only prefetch if cache is stale or missing
  if (!cached || age > CACHE_TTL.LEAGUES * 0.5) { // Refresh at 50% of TTL
    // Fetch in background, don't block UI
    fetchHomeData(userId).then(data => {
      setCached(cacheKey, data, CACHE_TTL.LEAGUES);
    });
  }
}
```

### 4. Route-Based Prefetching

**Strategy**: Prefetch data for likely next pages when user is on current page.

**Benefits**:
- Next page loads instantly
- Predictable navigation patterns

**Implementation**:
```typescript
// When on Home page, prefetch Tables data
// When on Tables page, prefetch Home data
useEffect(() => {
  if (location.pathname === '/') {
    // User is on Home - prefetch Tables in background
    prefetchTablesData(user?.id);
  } else if (location.pathname === '/tables') {
    // User is on Tables - prefetch Home in background
    prefetchHomeData(user?.id);
  }
}, [location.pathname, user?.id]);
```

### 5. Native Storage Optimization

**Strategy**: Since Despia is native, we could potentially use native storage APIs if available.

**Note**: Despia doesn't expose native storage APIs directly, but native apps have better localStorage performance than web browsers.

**Optimization**: Use IndexedDB for larger datasets (leagues, fixtures) instead of localStorage.

```typescript
// For large datasets, use IndexedDB
// For small datasets, use localStorage
const useIndexedDB = (size: number) => size > 100 * 1024; // > 100KB
```

### 6. Query Result Deduplication

**Strategy**: If multiple components request the same data, only fetch once.

**Benefits**:
- Fewer network requests
- Faster overall load

**Implementation**:
```typescript
// src/lib/queryCache.ts
const pendingQueries = new Map<string, Promise<any>>();

export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Check cache first
  const cached = getCached<T>(key);
  if (cached) return cached;
  
  // Check if query is already pending
  if (pendingQueries.has(key)) {
    return pendingQueries.get(key)!;
  }
  
  // Start new query
  const promise = queryFn().then(data => {
    setCached(key, data, ttl);
    pendingQueries.delete(key);
    return data;
  });
  
  pendingQueries.set(key, promise);
  return promise;
}
```

## Implementation Priority

### Phase 1: Quick Wins (High Impact, Low Effort)
1. ✅ **Add caching layer** - Wrap Supabase queries with cache
2. ✅ **Stale-while-revalidate** - Show cache, refresh background
3. ✅ **App lifecycle prefetching** - Prefetch on foreground

**Expected Impact**: Pages load **instantly** from cache (0ms perceived load), then update with fresh data.

### Phase 2: Advanced Optimizations
4. Route-based prefetching
5. Query deduplication
6. IndexedDB for large datasets

**Expected Impact**: Even faster navigation, better offline support.

## Cache Invalidation Strategy

### When to Invalidate
- **User actions**: After submitting picks, joining league, etc.
- **Time-based**: TTL expiration
- **Manual refresh**: Pull-to-refresh gesture

### Smart Invalidation
```typescript
// After user submits picks, invalidate related caches
function invalidateAfterSubmission(userId: string, gw: number) {
  localStorage.removeItem(`cache:home:${userId}`);
  localStorage.removeItem(`cache:tables:${userId}`);
  localStorage.removeItem(`cache:league:*:${userId}`);
  // Keep fixtures cache (doesn't change)
}
```

## Metrics to Track

- **Time to First Render**: Should be < 50ms (from cache)
- **Time to Interactive**: Should be < 100ms (from cache)
- **Cache Hit Rate**: Should be > 80%
- **Background Refresh Time**: Should be < 2s

## Despia-Specific Advantages

1. **Native App Performance**: Native apps have better localStorage/IndexedDB performance than web browsers
2. **Predictable Environment**: All users have the same environment (native app)
3. **Better Network Handling**: Native networking might be more efficient
4. **Background Capabilities**: Could potentially prefetch in background (if Despia supports it)

## Code Example: Optimized Home Page

```typescript
// src/pages/Home.tsx (optimized version)
export default function HomePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  // ... other state

  useEffect(() => {
    if (!user?.id) return;
    
    const cacheKey = `home:${user.id}`;
    
    // 1. Load from cache immediately
    const cached = getCached<HomeData>(cacheKey);
    if (cached) {
      setLeagues(cached.leagues);
      setGwPoints(cached.gwPoints);
      // ... set all state
      setLoading(false); // INSTANT RENDER!
    }
    
    // 2. Fetch fresh data in background
    (async () => {
      const [membersResult, latestGwResult, ...] = await Promise.all([
        // ... all queries
      ]);
      
      const fresh: HomeData = {
        leagues: processLeagues(membersResult.data),
        gwPoints: processGwPoints(allGwPointsResult.data),
        // ... process all data
      };
      
      // Update state with fresh data
      setLeagues(fresh.leagues);
      setGwPoints(fresh.gwPoints);
      // ... update all state
      
      // Cache for next time
      setCached(cacheKey, fresh, CACHE_TTL.LEAGUES);
    })();
  }, [user?.id]);

  // Rest of component...
}
```

## Expected Results

### Before Optimization
- Home page: ~500-1000ms load time
- Tables page: ~800-1500ms load time
- Every navigation: Full network fetch

### After Optimization
- Home page: **< 50ms** perceived load (from cache)
- Tables page: **< 50ms** perceived load (from cache)
- Background refresh: Updates data without blocking UI
- Offline support: App works with cached data

## Next Steps

1. Create `src/lib/cache.ts` with caching utilities
2. Create `src/hooks/useAppLifecycle.ts` for prefetching
3. Update `Home.tsx` to use stale-while-revalidate
4. Update `Tables.tsx` to use stale-while-revalidate
5. Add cache invalidation on user actions
6. Test and measure improvements

---

*This optimization strategy leverages the fact that users only see the Despia native app, allowing us to be more aggressive with caching than we could be in a web browser environment.*

