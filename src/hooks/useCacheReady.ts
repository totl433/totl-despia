import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCached } from '../lib/cache';

/**
 * Hook to determine if cache is ready for a user
 * Returns true when preload is complete OR cache exists
 * 
 * This helps coordinate between preload system and component initialization,
 * preventing race conditions where components read cache before it's populated.
 */
function hasHomeBasicCache(userId: string): boolean {
  if (getCached(`home:basic:${userId}`) !== null) return true;
  const seasonCtx = getCached<{ useSeasonStack?: boolean; seasonId?: string | null }>(
    `season:ctx:${userId}`
  );
  if (seasonCtx?.useSeasonStack) {
    const key = `home:basic:v2:${seasonCtx.seasonId ?? 'stack'}:${userId}`;
    return getCached(key) !== null;
  }
  // Also accept any v2 basic cache for this user
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          k.includes(`home:basic:v2:`) &&
          k.endsWith(`:${userId}`)
        ) {
          // localStorage keys are despia:cache:…
          const logical = k.replace(/^despia:cache:/, '');
          if (getCached(logical) !== null) return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

export function useCacheReady() {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(() => {
    if (!user?.id) return false;
    
    // Check if preload completed
    const preloadComplete = typeof window !== 'undefined' && 
      sessionStorage.getItem('preload:complete') === 'true';
    
    return preloadComplete || hasHomeBasicCache(user.id);
  });
  
  useEffect(() => {
    if (!user?.id) {
      setIsReady(false);
      return;
    }
    
    // Check preload status
    const checkReady = () => {
      const preloadComplete = typeof window !== 'undefined' && 
        sessionStorage.getItem('preload:complete') === 'true';
      setIsReady(preloadComplete || hasHomeBasicCache(user.id));
    };
    
    // Check immediately
    checkReady();
    
    // Listen for preload completion event
    const handlePreloadComplete = () => {
      checkReady();
    };
    window.addEventListener('preloadComplete', handlePreloadComplete);
    
    // Also poll periodically (in case event doesn't fire or cache is populated elsewhere)
    // Use short interval initially, then back off
    let pollCount = 0;
    const maxPolls = 50; // Stop polling after 5 seconds (50 * 100ms)
    const interval = setInterval(() => {
      pollCount++;
      checkReady();
      
      // Stop polling if ready or max polls reached
      const nowReady = typeof window !== 'undefined' && 
        (sessionStorage.getItem('preload:complete') === 'true' || 
         hasHomeBasicCache(user.id));
      
      if (nowReady || pollCount >= maxPolls) {
        clearInterval(interval);
      }
    }, 100);
    
    return () => {
      window.removeEventListener('preloadComplete', handlePreloadComplete);
      clearInterval(interval);
    };
  }, [user?.id]); // Only depend on user.id, not isReady (to avoid loops)
  
  return isReady;
}

