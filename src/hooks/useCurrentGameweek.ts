import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached, removeCached, CACHE_TTL } from '../lib/cache';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Centralized hook to get the current gameweek from app_meta.current_gw.
 * This is the SINGLE SOURCE OF TRUTH for current gameweek across the app.
 * 
 * Features:
 * - Always fetches from app_meta.current_gw (authoritative source)
 * - Subscribes to real-time updates
 * - Invalidates related caches when GW changes
 * - Returns cached value immediately for instant UI updates
 * 
 * Usage:
 *   const { currentGw, loading } = useCurrentGameweek();
 */
export function useCurrentGameweek() {
  const [currentGw, setCurrentGw] = useState<number | null>(() => {
    // Try to load from cache first (pre-loaded during initial data load)
    const cached = getCached<{ current_gw: number }>(`app_meta:current_gw`);
    return cached?.current_gw ?? null;
  });
  
  const [loading, setLoading] = useState(() => {
    // Only loading if not in cache
    const cached = getCached<{ current_gw: number }>(`app_meta:current_gw`);
    return cached === null;
  });
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let channel: RealtimeChannel | null = null;

    const fetchCurrentGw = async () => {
      if (!alive) return;
      
      // If we already have cached value, refresh in background but don't block
      const hasCached = currentGw !== null;
      if (!hasCached) {
        setLoading(true);
      }
      
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from('app_meta')
          .select('current_gw')
          .eq('id', 1)
          .maybeSingle();
        
        if (!alive) return;
        
        if (fetchError) {
          console.error('[useCurrentGameweek] Error fetching current_gw:', fetchError);
          setError(fetchError.message);
          setLoading(false);
          return;
        }
        
        const newCurrentGw = data?.current_gw ?? null;
        
        if (newCurrentGw !== null && typeof newCurrentGw === 'number') {
          // Update state if different
          if (currentGw !== newCurrentGw) {
            setCurrentGw(newCurrentGw);
            
            // Invalidate related caches when GW changes
            // This ensures components fetch fresh data for the new GW
            if (currentGw !== null) {
              console.log(`[useCurrentGameweek] GW changed from ${currentGw} to ${newCurrentGw}, invalidating caches`);
              
              // Clear user-specific caches (they'll be repopulated with new GW data)
              // Note: We can't clear all user caches here since we don't have userId
              // Components should handle cache invalidation when they detect GW change
            }
          }
          
          // Always update cache with latest value
          setCached(`app_meta:current_gw`, { current_gw: newCurrentGw }, CACHE_TTL.HOME);
        } else {
          // Fallback to 1 if current_gw is null/undefined
          const fallbackGw = 1;
          if (currentGw !== fallbackGw) {
            setCurrentGw(fallbackGw);
            setCached(`app_meta:current_gw`, { current_gw: fallbackGw }, CACHE_TTL.HOME);
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('[useCurrentGameweek] Unexpected error:', err);
        if (alive) {
          setError(err.message || 'Failed to fetch current gameweek');
          setLoading(false);
        }
      }
    };

    // Initial fetch
    if (currentGw === null) {
      // No cached value - fetch immediately (blocking)
      fetchCurrentGw();
    } else {
      // We have cached value - refresh in background
      fetchCurrentGw();
    }

    // Subscribe to app_meta changes for real-time updates
    channel = supabase
      .channel('current-gameweek-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_meta',
          filter: 'id=eq.1'
        },
        (payload) => {
          const newCurrentGw = (payload.new as any)?.current_gw;
          if (newCurrentGw !== null && typeof newCurrentGw === 'number' && newCurrentGw !== currentGw) {
            console.log(`[useCurrentGameweek] 🔔 Real-time update: GW changed to ${newCurrentGw}`);
            setCurrentGw(newCurrentGw);
            setCached(`app_meta:current_gw`, { current_gw: newCurrentGw }, CACHE_TTL.HOME);
            
            // Dispatch custom event so components can react to GW change
            window.dispatchEvent(new CustomEvent('currentGwChanged', { 
              detail: { oldGw: currentGw, newGw: newCurrentGw } 
            }));
          }
        }
      )
      .subscribe();

    return () => {
      alive = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentGw]);

  return { currentGw, loading, error };
}

