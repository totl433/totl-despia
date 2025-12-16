import React from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import GameweekBanner from "./ComingSoonBanner";

/**
 * Shows different banners based on game state:
 *  - "Make predictions" when fixtures exist but no results published
 *  - "Watch this space" when results published but next GW fixtures not ready
 */
export default function PredictionsBanner() {
  const { user } = useAuth();
  
  // NOTE: totl-staging.netlify.app IS Despia - banner should show there
  console.log('[PredictionsBanner] Component rendered, checking visibility...');
  
  const [visible, setVisible] = React.useState(false);
  const [currentGw, setCurrentGw] = React.useState<number | null>(null);
  const [bannerType, setBannerType] = React.useState<"predictions" | "watch-space" | null>(null);
  const [deadlineText, setDeadlineText] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    
    const refreshBanner = async () => {
      try {
        console.log('[PredictionsBanner] 🔍 Starting banner check...');
        
        // current GW
        const { data: meta, error: metaError } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        if (metaError) {
          console.error('[PredictionsBanner] ❌ Error fetching current_gw:', metaError);
          // Retry after a delay
          if (alive) {
            setTimeout(() => {
              if (alive) refreshBanner();
            }, 5000);
          }
          return;
        }
        
        const gw: number | null = (meta as any)?.current_gw ?? null;
        if (!alive) return;

        console.log('[PredictionsBanner] 📊 Current GW:', gw);
        setCurrentGw(gw);
        if (!gw) {
          console.log('[PredictionsBanner] ⚠️ No current_gw found');
          if (alive) setVisible(false);
          return;
        }

        // fixtures exist for current GW?
        const { count: fxCount, error: fxError } = await supabase
          .from("app_fixtures")
          .select("id", { count: "exact", head: true })
          .eq("gw", gw);
        
        if (fxError) {
          console.error('[PredictionsBanner] ❌ Error fetching fixtures:', fxError);
          // Retry after a delay
          if (alive) {
            setTimeout(() => {
              if (alive) refreshBanner();
            }, 5000);
          }
          return;
        }
        
        if (!alive) return;
        console.log('[PredictionsBanner] 📊 Current GW fixtures count:', fxCount || 0);

        // results already published for current GW?
        const { count: rsCount, error: rsError } = await supabase
          .from("app_gw_results")
          .select("gw", { count: "exact", head: true })
          .eq("gw", gw);
        
        if (rsError) {
          console.error('[PredictionsBanner] ❌ Error fetching results:', rsError);
          // Retry after a delay
          if (alive) {
            setTimeout(() => {
              if (alive) refreshBanner();
            }, 5000);
          }
          return;
        }
        
        if (!alive) return;
        const resultsPublished = (rsCount ?? 0) > 0;
        console.log('[PredictionsBanner] 📊 Results published for GW', gw, ':', resultsPublished, '(count:', rsCount || 0, ')');

        if (!fxCount) {
          // No fixtures for current GW - show "watch this space" for next GW
          setBannerType("watch-space");
          setVisible(true);
          setDeadlineText(null);
          return;
        }

        // Calculate deadline (1h 15mins before first kickoff)
        const { data: fixtures } = await supabase
          .from("app_fixtures")
          .select("kickoff_time")
          .eq("gw", gw)
          .order("kickoff_time", { ascending: true })
          .limit(1);
        
        if (fixtures && fixtures.length > 0 && fixtures[0].kickoff_time) {
          const firstKickoff = new Date(fixtures[0].kickoff_time);
          const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 1h 15mins = 75 minutes
          
          // Format deadline as readable date and time (GMT)
          const weekday = deadlineTime.toLocaleDateString(undefined, { weekday: 'short' });
          const month = deadlineTime.toLocaleDateString(undefined, { month: 'short' });
          const day = deadlineTime.toLocaleDateString(undefined, { day: 'numeric' });
          const hour = String(deadlineTime.getUTCHours()).padStart(2, '0');
          const minute = String(deadlineTime.getUTCMinutes()).padStart(2, '0');
          const deadlineFormatted = `${weekday}, ${month} ${day}, ${hour}:${minute}`;
          setDeadlineText(deadlineFormatted);
        } else {
          setDeadlineText(null);
        }

        if (resultsPublished) {
          // Results published for current GW - check if next GW fixtures exist
          // Only show "watch this space" banner if next GW fixtures don't exist yet
          const nextGw = gw + 1;
          console.log(`[PredictionsBanner] 🔍 Checking if GW ${nextGw} fixtures exist...`);
          
          const { count: nextGwFxCount, error: nextGwFxError } = await supabase
            .from("app_fixtures")
            .select("id", { count: "exact", head: true })
            .eq("gw", nextGw);
          
          if (!alive) return;
          
          // If there's an error checking next GW fixtures, assume they don't exist (show banner)
          // This ensures banner shows on Despia even if queries are slow or fail
          if (nextGwFxError) {
            console.error('[PredictionsBanner] ❌ Error checking next GW fixtures:', nextGwFxError);
            console.log(`[PredictionsBanner] ⚠️ Error checking GW ${nextGw} fixtures - assuming they don't exist, showing banner`);
            if (alive) {
              setBannerType("watch-space");
              setVisible(true);
            }
            return;
          }
          
          console.log(`[PredictionsBanner] 📊 Results published for GW ${gw}, checking GW ${nextGw} fixtures:`, nextGwFxCount || 0);
          
          // Show banner if next GW fixtures don't exist yet (or count is 0/undefined)
          // Use explicit check: if count is null/undefined/0, show banner
          const hasNextGwFixtures = nextGwFxCount !== null && nextGwFxCount !== undefined && nextGwFxCount > 0;
          
          if (!hasNextGwFixtures) {
            console.log(`[PredictionsBanner] ✅ Results published for GW ${gw}, GW ${nextGw} fixtures not ready (count: ${nextGwFxCount}) - showing coming soon banner`);
            if (alive) {
              setBannerType("watch-space");
              setVisible(true);
            }
          } else {
            // Next GW fixtures exist, don't show banner
            console.log(`[PredictionsBanner] Next GW ${nextGw} fixtures exist (${nextGwFxCount}), hiding banner`);
            if (alive) setVisible(false);
          }
          return;
        }

        // Fixtures exist, no results - check if user has submitted predictions
        // Check if user has submitted predictions for all fixtures
        if (!user?.id) {
          setVisible(false);
          return;
        }

        // Get all fixtures for current GW
        const { data: allFixtures } = await supabase
          .from("app_fixtures")
          .select("fixture_index")
          .eq("gw", gw);
        
        if (!allFixtures || allFixtures.length === 0) {
          setVisible(false);
          return;
        }

        // Check if user has submitted (not just picks - need to check submission)
        const { data: submission } = await supabase
          .from("app_gw_submissions")
          .select("submitted_at")
          .eq("user_id", user.id)
          .eq("gw", gw)
          .maybeSingle();
        
        if (!alive) return;

        const hasSubmitted = submission?.submitted_at !== null && submission?.submitted_at !== undefined;
        
        if (!hasSubmitted) {
          // User hasn't submitted predictions - show predictions banner
          console.log('[PredictionsBanner] User has not submitted, showing predictions banner');
          setBannerType("predictions");
          setVisible(true);
        } else {
          console.log('[PredictionsBanner] User has already submitted, hiding banner');
          setVisible(false);
        }
      } catch (error) {
        console.error('[PredictionsBanner] Error in refreshBanner:', error);
        if (alive) setVisible(false);
      }
    };

    // Initial check
    refreshBanner();
    
    // Periodic refresh to ensure banner shows on Despia even if initial check is slow
    // This is a fallback in case realtime subscriptions don't work or queries are slow
    // Check more frequently initially (every 10s for first 3 times), then every 30s
    let refreshCount = 0;
    const refreshInterval = setInterval(() => {
      if (alive) {
        refreshCount++;
        console.log(`[PredictionsBanner] 🔄 Periodic refresh check #${refreshCount}`);
        refreshBanner();
      }
    }, 10000); // Check every 10 seconds (more frequent to catch issues on Despia)
    
    // Subscribe to app_gw_results changes for real-time updates
    const channel = supabase
      .channel('predictions-banner-gw-results')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_gw_results',
        },
        (_payload) => {
          console.log('[PredictionsBanner] 🔔 app_gw_results change detected, refreshing banner');
          if (alive) {
            refreshBanner();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[PredictionsBanner] ✅ Subscribed to app_gw_results changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[PredictionsBanner] ❌ Subscription error for app_gw_results');
        }
      });
    
    // Subscribe to app_fixtures changes for real-time updates
    const fixturesChannel = supabase
      .channel('predictions-banner-fixtures')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_fixtures',
        },
        (_payload) => {
          console.log('[PredictionsBanner] 🔔 app_fixtures change detected, refreshing banner');
          if (alive) {
            refreshBanner();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[PredictionsBanner] ✅ Subscribed to app_fixtures changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[PredictionsBanner] ❌ Subscription error for app_fixtures');
        }
      });
    
    // Listen for submission events
    const handleSubmission = () => {
      refreshBanner();
    };
    
    // Listen for results published events
    const handleResultsPublished = () => {
      refreshBanner();
    };
    
    // Listen for fixtures published events
    const handleFixturesPublished = () => {
      refreshBanner();
    };
    
    // Refresh when component becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshBanner();
      }
    };
    
    window.addEventListener('predictionsSubmitted', handleSubmission);
    window.addEventListener('resultsPublished', handleResultsPublished);
    window.addEventListener('fixturesPublished', handleFixturesPublished);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      alive = false;
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
      supabase.removeChannel(fixturesChannel);
      window.removeEventListener('predictionsSubmitted', handleSubmission);
      window.removeEventListener('resultsPublished', handleResultsPublished);
      window.removeEventListener('fixturesPublished', handleFixturesPublished);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]); // Note: Effect runs even if user is null - "watch-space" banner doesn't need user

  if (!visible) return null;

  // UI - Different banners based on state
  if (bannerType === "predictions" && currentGw) {
    return (
      <GameweekBanner
        gameweek={currentGw}
        variant="live"
        deadlineText={deadlineText}
        linkTo="/predictions"
      />
    );
  }
  
  if (bannerType === "watch-space" && currentGw) {
    return (
      <GameweekBanner
        gameweek={(currentGw || 1) + 1}
        variant="coming-soon"
      />
    );
  }
  
  return null;
}