import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached, CACHE_TTL } from '../lib/cache';
import { useCurrentGameweek } from './useCurrentGameweek';
import { useAuth } from '../context/AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * ROCK-SOLID hook to determine which GW to display to the user.
 * 
 * This is the SINGLE SOURCE OF TRUTH for display GW across the app.
 * 
 * Logic:
 * 1. Current GW comes from app_meta.current_gw (via useCurrentGameweek hook)
 * 2. User viewing GW comes from user_notification_preferences.current_viewing_gw
 * 3. Display GW = user viewing GW if set and < current GW, otherwise current GW
 * 
 * Features:
 * - Always fetches from DB (validates cache)
 * - Subscribes to real-time updates for both current GW and user viewing GW
 * - Returns cached value immediately for instant UI
 * - Handles "move on" logic automatically
 * 
 * Usage:
 *   const { displayGw, currentGw, userViewingGw, hasMovedOn } = useDisplayGameweek();
 * 
 * Returns:
 * - displayGw: The GW to actually display (user viewing GW or current GW)
 * - currentGw: The current published GW from app_meta
 * - userViewingGw: The GW the user is viewing (null if they've moved on to current GW)
 * - hasMovedOn: true if userViewingGw === currentGw or userViewingGw === null
 */
export function useDisplayGameweek() {
  const { user } = useAuth();
  const { currentGw, loading: currentGwLoading } = useCurrentGameweek();
  
  const [userViewingGw, setUserViewingGw] = useState<number | null>(() => {
    if (!user?.id) return null;
    // Try to load from cache first (pre-loaded during initial data load)
    const cached = getCached<{ current_viewing_gw: number | null }>(`user_notification_prefs:${user.id}`);
    return cached?.current_viewing_gw ?? null;
  });
  
  const [loading, setLoading] = useState(() => {
    if (!user?.id) return false;
    const cached = getCached<{ current_viewing_gw: number | null }>(`user_notification_prefs:${user.id}`);
    return cached === null;
  });
  
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track previous value for comparison without causing re-renders
  const userViewingGwRef = useRef<number | null>(userViewingGw);
  userViewingGwRef.current = userViewingGw;

  useEffect(() => {
    if (!user?.id) {
      setUserViewingGw(null);
      setLoading(false);
      return;
    }

    let alive = true;
    let channel: RealtimeChannel | null = null;

    const fetchUserViewingGw = async () => {
      if (!alive) return;
      
      // If we already have cached value, refresh in background but don't block
      const hasCached = userViewingGwRef.current !== null;
      if (!hasCached) {
        setLoading(true);
      }
      
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from('user_notification_preferences')
          .select('current_viewing_gw')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!alive) return;
        
        if (fetchError) {
          console.error('[useDisplayGameweek] Error fetching current_viewing_gw:', fetchError);
          setError(fetchError.message);
          setLoading(false);
          return;
        }
        
        const newUserViewingGw = data?.current_viewing_gw ?? null;
        
        // Update state if different (using ref for comparison to avoid stale closure)
        const prevViewingGw = userViewingGwRef.current;
        if (prevViewingGw !== newUserViewingGw) {
          setUserViewingGw(newUserViewingGw);
          
          // Update cache
          setCached(`user_notification_prefs:${user.id}`, { current_viewing_gw: newUserViewingGw }, CACHE_TTL.HOME);
          
          // Log if user has moved on
          if (currentGw && newUserViewingGw !== null && newUserViewingGw >= currentGw) {
            console.log(`[useDisplayGameweek] User has moved on to GW ${currentGw} (viewingGw: ${newUserViewingGw})`);
          }
        } else {
          // Always update cache even if value hasn't changed (refresh timestamp)
          setCached(`user_notification_prefs:${user.id}`, { current_viewing_gw: newUserViewingGw }, CACHE_TTL.HOME);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('[useDisplayGameweek] Unexpected error:', err);
        if (alive) {
          setError(err.message || 'Failed to fetch user viewing gameweek');
          setLoading(false);
        }
      }
    };

    // Initial fetch - only if we don't have cached value
    if (userViewingGwRef.current === null) {
      // No cached value - fetch immediately (blocking)
      fetchUserViewingGw();
    } else {
      // We have cached value - refresh in background (non-blocking)
      fetchUserViewingGw();
    }

    // Subscribe to user_notification_preferences changes for real-time updates
    channel = supabase
      .channel(`user-viewing-gw-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notification_preferences',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newUserViewingGw = (payload.new as any)?.current_viewing_gw ?? null;
          const prevViewingGw = userViewingGwRef.current;
          if (newUserViewingGw !== prevViewingGw) {
            console.log(`[useDisplayGameweek] 🔔 Real-time update: user viewing GW changed to ${newUserViewingGw}`);
            setUserViewingGw(newUserViewingGw);
            setCached(`user_notification_prefs:${user.id}`, { current_viewing_gw: newUserViewingGw }, CACHE_TTL.HOME);
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
  }, [user?.id]); // Only depend on user.id, not userViewingGw (to avoid loops)

  // Calculate display GW: user viewing GW if set and < current GW, otherwise current GW
  const displayGw = (() => {
    if (!currentGw) return null;
    if (userViewingGw === null) {
      // User hasn't set viewing GW - default to current GW (they've moved on)
      return currentGw;
    }
    // User has set viewing GW - use it if it's less than current GW, otherwise use current GW
    return userViewingGw < currentGw ? userViewingGw : currentGw;
  })();

  // Determine if user has "moved on" to current GW
  // User has moved on if:
  // - userViewingGw is null (never set, defaults to current GW)
  // - userViewingGw === currentGw (explicitly set to current GW)
  // - userViewingGw > currentGw (shouldn't happen, but treat as moved on)
  const hasMovedOn = currentGw !== null && (
    userViewingGw === null || 
    userViewingGw >= currentGw
  );

  return {
    displayGw,
    currentGw,
    userViewingGw,
    hasMovedOn,
    loading: loading || currentGwLoading,
    error: error || null,
  };
}




