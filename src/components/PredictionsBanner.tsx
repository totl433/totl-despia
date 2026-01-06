import React from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useGameweekState } from "../hooks/useGameweekState";
import { useCurrentGameweek } from "../hooks/useCurrentGameweek";
import { getCached } from "../lib/cache";
import GameweekBanner from "./ComingSoonBanner";

/**
 * Shows different banners based on game state:
 * - GW_OPEN: "Make your predictions"
 * - GW_PREDICTED: Nothing
 * - LIVE: Nothing
 * - RESULTS_PRE_GW: Either "GW Coming soon" OR "GW ready" banner (if new GW published)
 */
export default function PredictionsBanner() {
  const { user } = useAuth();
  
  // Use centralized hook for current gameweek (single source of truth)
  const { currentGw } = useCurrentGameweek();
  
  const [viewingGw, setViewingGw] = React.useState<number | null>(() => {
    if (user?.id) {
      const cached = getCached<{ current_viewing_gw: number | null }>(`user_notification_prefs:${user.id}`);
      if (cached?.current_viewing_gw !== undefined) {
        return cached.current_viewing_gw;
      }
    }
    return null;
  });
  
  const [visible, setVisible] = React.useState(false);
  const [bannerType, setBannerType] = React.useState<"predictions" | "watch-space" | "gw-ready" | null>(null);
  const [deadlineText, setDeadlineText] = React.useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [newGwNumber, setNewGwNumber] = React.useState<number | null>(null);
  
  // Get game state for the GW the user is viewing (user-specific)
  // Use currentGw as fallback if viewingGw is not set yet
  // Only call useGameweekState if we have a valid GW number
  const effectiveViewingGw = viewingGw ?? currentGw;
  const { state: viewingGwState } = useGameweekState(
    effectiveViewingGw && typeof effectiveViewingGw === 'number' ? effectiveViewingGw : null,
    user?.id
  );
  
  // Calculate effective viewing GW (default to currentGw - 1 if not set, matching refreshBanner logic)
  const effectiveViewingGwCalculated = React.useMemo(() => {
    if (user?.id && viewingGw === null && currentGw !== null) {
      // User hasn't set current_viewing_gw, default to previous GW (currentGw - 1)
      return currentGw > 1 ? currentGw - 1 : currentGw;
    }
    return viewingGw ?? currentGw;
  }, [user?.id, viewingGw, currentGw]);
  
  // Get cached game state immediately (pre-loaded during initial data load)
  const cachedViewingGwState = React.useMemo(() => {
    const gw = effectiveViewingGwCalculated;
    if (!gw || typeof gw !== 'number') return null;
    return getCached<import('../lib/gameweekState').GameweekState>(`gameState:${gw}`);
  }, [effectiveViewingGwCalculated]);
  
  // Use cached state if available, otherwise fall back to hook state
  const effectiveViewingGwState = cachedViewingGwState ?? viewingGwState;
  
  // Define refreshBanner using useCallback so it can be used in multiple effects
  const refreshBanner = React.useCallback(async () => {
    try {
      if (!user?.id) {
        // For non-logged-in users, only show "watch-space" if applicable
        if (!currentGw) {
          setVisible(false);
          return;
        }
        
        // Check if GW has finished and next GW fixtures don't exist
        if (!currentGw) {
          setVisible(false);
          return;
        }
        
        const { count: rsCount } = await supabase
          .from("app_gw_results")
          .select("gw", { count: "exact", head: true })
          .eq("gw", currentGw);
        
        if ((rsCount ?? 0) > 0) {
          const { count: nextGwFxCount } = await supabase
            .from("app_fixtures")
            .select("id", { count: "exact", head: true })
            .eq("gw", currentGw + 1);
          
          if (!nextGwFxCount || nextGwFxCount === 0) {
            setBannerType("watch-space");
            setVisible(true);
          } else {
            setVisible(false);
          }
        } else {
          setVisible(false);
        }
        return;
      }
      
      // Use currentGw from hook (already fetched from app_meta)
      if (!currentGw) {
        setVisible(false);
        return;
      }
      
      const gw = currentGw;
      
      // Get user's current_viewing_gw (check cache first, then fetch)
      const cached = getCached<{ current_viewing_gw: number | null }>(`user_notification_prefs:${user.id}`);
      let userViewingGw: number | null = cached?.current_viewing_gw ?? null;
      
      // If not in cache, fetch from DB
      if (userViewingGw === null) {
        const { data: prefs } = await supabase
          .from("user_notification_preferences")
          .select("current_viewing_gw")
          .eq("user_id", user.id)
          .maybeSingle();
        userViewingGw = prefs?.current_viewing_gw ?? null;
      }
      
      // If user hasn't set current_viewing_gw, default to previous GW (currentGw - 1)
      // This ensures users stay on the previous GW's results when a new GW is published
      // and see the "GW ready" banner to transition
      const effectiveViewingGw = userViewingGw ?? (gw > 1 ? gw - 1 : gw);
      setViewingGw(effectiveViewingGw);
      
    } catch (error) {
      console.error('[PredictionsBanner] Error in refreshBanner:', error);
      setVisible(false);
    }
  }, [user?.id, currentGw]);
  
  // Determine banner based on game state of the viewing GW
  // Use cached data immediately, then refresh in background
  React.useEffect(() => {
    // Don't run if we don't have currentGw yet
    if (!currentGw) {
      return;
    }
    
    // Calculate effective viewing GW (use calculated one if available, otherwise compute it)
    const effectiveGw = effectiveViewingGwCalculated ?? (user?.id && currentGw ? (currentGw > 1 ? currentGw - 1 : currentGw) : currentGw);
    
    // If state is still loading and we don't have cached state, wait
    if (effectiveViewingGwState === null && !cachedViewingGwState) {
      return;
    }
    
    // Use cached state if available, otherwise use hook state
    const state = effectiveViewingGwState;
    if (!state) return;
    
    let alive = true;
    
    (async () => {
      // Check if new GW is published but user hasn't transitioned
      const userViewingGw = effectiveViewingGwCalculated ?? currentGw;
      if (userViewingGw < currentGw) {
        // New GW published - show "GW ready" banner
        if (alive) {
          setNewGwNumber(currentGw);
          setBannerType("gw-ready");
          setVisible(true);
        }
        return;
      }
      
      // User is viewing current or previous GW - determine banner based on viewing GW's state
      if (state === 'GW_OPEN') {
        // Check if user has submitted (check cache first - submissions are pre-loaded)
        let hasSubmitted = false;
        if (!user?.id) {
          if (alive) setVisible(false);
          return;
        }
        try {
          // Check cache for submissions (pre-loaded during initial data load)
          const cachedSubmissions = getCached<Array<{ user_id: string; gw: number }>>(`home:submissions:${effectiveGw}`);
          if (cachedSubmissions) {
            hasSubmitted = cachedSubmissions.some(s => s.user_id === user.id);
          } else {
            // Not in cache, fetch from DB
            const { data: submission } = await supabase
              .from("app_gw_submissions")
              .select("submitted_at")
              .eq("user_id", user.id)
              .eq("gw", effectiveGw)
              .maybeSingle();
            hasSubmitted = submission?.submitted_at !== null && submission?.submitted_at !== undefined;
          }
        } catch (e) {
          // Cache read failed, fetch from DB
          const { data: submission } = await supabase
            .from("app_gw_submissions")
            .select("submitted_at")
            .eq("user_id", user.id)
            .eq("gw", effectiveGw)
            .maybeSingle();
          hasSubmitted = submission?.submitted_at !== null && submission?.submitted_at !== undefined;
        }
        
        if (!hasSubmitted) {
          // Calculate deadline (check cache first - fixtures are pre-loaded)
          let deadlineFormatted: string | null = null;
          try {
            const cachedFixtures = getCached<Array<{ gw: number; kickoff_time: string }>>(`home:fixtures:${effectiveGw}`);
            if (cachedFixtures && cachedFixtures.length > 0) {
              const firstFixture = cachedFixtures.sort((a, b) => 
                new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
              )[0];
              if (firstFixture.kickoff_time) {
                const firstKickoff = new Date(firstFixture.kickoff_time);
                const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
                const weekday = deadlineTime.toLocaleDateString(undefined, { weekday: 'short' });
                const month = deadlineTime.toLocaleDateString(undefined, { month: 'short' });
                const day = deadlineTime.toLocaleDateString(undefined, { day: 'numeric' });
                const hour = String(deadlineTime.getUTCHours()).padStart(2, '0');
                const minute = String(deadlineTime.getUTCMinutes()).padStart(2, '0');
                deadlineFormatted = `${weekday}, ${month} ${day}, ${hour}:${minute}`;
              }
            }
          } catch (e) {
            // Cache read failed, fetch from DB
          }
          
          if (!deadlineFormatted) {
            // Not in cache, fetch from DB
            const { data: fixtures } = await supabase
              .from("app_fixtures")
              .select("kickoff_time")
              .eq("gw", effectiveGw)
              .order("kickoff_time", { ascending: true })
              .limit(1);
            
            if (fixtures && fixtures.length > 0 && fixtures[0].kickoff_time) {
              const firstKickoff = new Date(fixtures[0].kickoff_time);
              const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
              const weekday = deadlineTime.toLocaleDateString(undefined, { weekday: 'short' });
              const month = deadlineTime.toLocaleDateString(undefined, { month: 'short' });
              const day = deadlineTime.toLocaleDateString(undefined, { day: 'numeric' });
              const hour = String(deadlineTime.getUTCHours()).padStart(2, '0');
              const minute = String(deadlineTime.getUTCMinutes()).padStart(2, '0');
              deadlineFormatted = `${weekday}, ${month} ${day}, ${hour}:${minute}`;
            }
          }
          
          if (deadlineFormatted) {
            setDeadlineText(deadlineFormatted);
          }
          
          if (alive) {
            setBannerType("predictions");
            setVisible(true);
          }
        } else {
          if (alive) setVisible(false);
        }
      } else if (state === 'GW_PREDICTED' || state === 'LIVE') {
        // Hide banner in these states
        if (alive) setVisible(false);
      } else if (state === 'RESULTS_PRE_GW') {
        // Check if next GW is published in app_meta (not just if fixtures exist)
        // Fixtures can exist (mirrored from web) even if GW isn't published on app yet
        const nextGw = effectiveGw + 1;
        
        if (nextGw <= currentGw) {
          // Next GW is published in app_meta - check if user has transitioned
          const userViewingGwForTransition = effectiveViewingGwCalculated ?? currentGw;
          if (userViewingGwForTransition < nextGw) {
            // User hasn't transitioned - show "GW ready" banner
            if (alive) {
              setNewGwNumber(nextGw);
              setBannerType("gw-ready");
              setVisible(true);
            }
          } else {
            // User has transitioned - hide banner
            if (alive) setVisible(false);
          }
        } else {
          // Next GW not published yet in app_meta - show "coming soon"
          if (alive) {
            setBannerType("watch-space");
            setVisible(true);
          }
        }
      }
    })();
    
    return () => { alive = false; };
  }, [currentGw, viewingGw, effectiveViewingGwCalculated, effectiveViewingGwState, cachedViewingGwState, user?.id]);
  
  // Set up subscriptions and initial check
  React.useEffect(() => {
    let alive = true;
    
    // Initial check
    refreshBanner();
    
    // Subscribe to changes (only if user is logged in)
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    if (user?.id) {
      channel = supabase
        .channel('predictions-banner-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_meta',
          },
          () => {
            if (alive) refreshBanner();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_fixtures',
          },
          () => {
            if (alive) refreshBanner();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_gw_results',
          },
          () => {
            if (alive) refreshBanner();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_notification_preferences',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (alive) refreshBanner();
          }
        )
        .subscribe();
    }
    
    return () => {
      alive = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, refreshBanner]);
  
  const handleGwTransition = async () => {
    console.log('[PredictionsBanner] handleGwTransition called', { userId: user?.id, newGwNumber, isTransitioning });
    
    if (!user?.id) {
      console.error('[PredictionsBanner] No user ID');
      return;
    }
    
    if (!newGwNumber) {
      console.error('[PredictionsBanner] No newGwNumber');
      return;
    }
    
    if (isTransitioning) {
      console.log('[PredictionsBanner] Already transitioning, ignoring click');
      return;
    }
    
    setIsTransitioning(true);
    console.log('[PredictionsBanner] Starting transition to GW', newGwNumber);
    
    try {
      // Update current_viewing_gw in database
      console.log('[PredictionsBanner] Updating current_viewing_gw to', newGwNumber);
      
      // Try UPDATE first (user should already have a row)
      let { data, error } = await supabase
        .from("user_notification_preferences")
        .update({
          current_viewing_gw: newGwNumber,
        })
        .eq("user_id", user.id)
        .select();
      
      // If no row exists, create one with UPSERT
      if (!error && (!data || data.length === 0)) {
        console.log('[PredictionsBanner] No existing row found, creating new one');
        const upsertResult = await supabase
          .from("user_notification_preferences")
          .upsert({
            user_id: user.id,
            current_viewing_gw: newGwNumber,
            preferences: {},
          }, {
            onConflict: 'user_id',
          })
          .select();
        data = upsertResult.data;
        error = upsertResult.error;
      }
      
      if (error) {
        console.error('[PredictionsBanner] Error updating current_viewing_gw:', error);
        console.error('[PredictionsBanner] Error details:', JSON.stringify(error, null, 2));
        console.error('[PredictionsBanner] Error message:', error.message);
        console.error('[PredictionsBanner] Error code:', error.code);
        console.error('[PredictionsBanner] Error hint:', error.hint);
        setIsTransitioning(false);
        return;
      }
      
      console.log('[PredictionsBanner] Successfully updated current_viewing_gw:', data);
      
      // Trigger shimmer animation on page
      console.log('[PredictionsBanner] Dispatching gwTransition event');
      window.dispatchEvent(new CustomEvent('gwTransition', { detail: { newGw: newGwNumber } }));
      
      // Wait for animation to complete, then refresh
      console.log('[PredictionsBanner] Scheduling page reload in 1200ms');
      setTimeout(() => {
        console.log('[PredictionsBanner] Reloading page...');
        window.location.reload();
      }, 1200);
      
    } catch (error) {
      console.error('[PredictionsBanner] Error in handleGwTransition:', error);
      setIsTransitioning(false);
    }
  };
  
  if (!visible) return null;
  
  // GW Ready banner (new GW published, user needs to transition)
  if (bannerType === "gw-ready" && newGwNumber) {
    return (
      <div className="w-full px-4 lg:px-6 py-3 relative gameweek-banner z-40 bg-gradient-to-br from-[#1C8376]/10 to-blue-50/50" data-banner-height>
        <div className="mx-auto max-w-6xl lg:max-w-[1024px] flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Circular icon with lightning bolt */}
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1C8376] flex items-center justify-center text-white">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="font-bold text-slate-900 text-base">
                Ready to move on?
              </div>
            </div>
          </div>
          
          {/* Let's Go button */}
          <button
            onClick={handleGwTransition}
            disabled={isTransitioning}
            className="flex-shrink-0 px-4 py-2 bg-[#1C8376] text-white rounded-[20px] font-medium disabled:opacity-50 flex items-center gap-1"
          >
            {isTransitioning ? "Transitioning..." : `Gameweek ${newGwNumber}`}
            {!isTransitioning && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  }
  
  // Predictions banner (GW_OPEN, user hasn't submitted)
  if (bannerType === "predictions" && effectiveViewingGwCalculated) {
    return (
      <GameweekBanner
        gameweek={effectiveViewingGwCalculated}
        variant="live"
        deadlineText={deadlineText}
        linkTo="/predictions"
      />
    );
  }
  
  // Coming soon banner (RESULTS_PRE_GW, next GW not published)
  if (bannerType === "watch-space" && effectiveViewingGwCalculated) {
    return (
      <GameweekBanner
        gameweek={effectiveViewingGwCalculated + 1}
        variant="coming-soon"
      />
    );
  }
  
  return null;
}
