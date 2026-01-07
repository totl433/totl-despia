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
export function useCacheReady() {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(() => {
    if (!user?.id) return false;
    
    // Check if preload completed
    const preloadComplete = typeof window !== 'undefined' && 
      sessionStorage.getItem('preload:complete') === 'true';
    
    // Check if cache exists (even if preload didn't run)
    const hasCache = getCached(`home:basic:${user.id}`) !== null;
    
    return preloadComplete || hasCache;
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
      const hasCache = getCached(`home:basic:${user.id}`) !== null;
      setIsReady(preloadComplete || hasCache);
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
      const wasReady = isReady;
      checkReady();
      
      // Stop polling if ready or max polls reached
      // Check current state, not stale closure value
      const nowReady = typeof window !== 'undefined' && 
        (sessionStorage.getItem('preload:complete') === 'true' || 
         getCached(`home:basic:${user.id}`) !== null);
      
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

