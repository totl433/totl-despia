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
  
  // Hide banner on staging - it links to wrong predictions page
  // Check hostname early and return null immediately
  // NOTE: Removed localhost check so banner shows in development
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('staging') || 
        hostname.includes('totl-staging')) {
      return null;
    }
  }
  
  const [visible, setVisible] = React.useState(false);
  const [currentGw, setCurrentGw] = React.useState<number | null>(null);
  const [bannerType, setBannerType] = React.useState<"predictions" | "watch-space" | null>(null);
  const [deadlineText, setDeadlineText] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    const refreshBanner = async () => {
      try {
        // current GW
        const { data: meta } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        const gw: number | null = (meta as any)?.current_gw ?? null;
        if (!alive) return;

        setCurrentGw(gw);
        if (!gw) return setVisible(false);

        // fixtures exist for current GW?
        const { count: fxCount } = await supabase
          .from("app_fixtures")
          .select("id", { count: "exact", head: true })
          .eq("gw", gw);
        if (!alive) return;

        // results already published for current GW?
        const { count: rsCount } = await supabase
          .from("app_gw_results")
          .select("gw", { count: "exact", head: true })
          .eq("gw", gw);
        if (!alive) return;
        const resultsPublished = (rsCount ?? 0) > 0;

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
          const { count: nextGwFxCount } = await supabase
            .from("app_fixtures")
            .select("id", { count: "exact", head: true })
            .eq("gw", nextGw);
          if (!alive) return;
          
          // Only show GW16 banner if GW16 fixtures don't exist yet
          if (!nextGwFxCount || nextGwFxCount === 0) {
            setBannerType("watch-space");
            setVisible(true);
          } else {
            // Next GW fixtures exist, don't show banner
            setVisible(false);
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
          setBannerType("predictions");
          setVisible(true);
        } else {
          setVisible(false);
        }
      } catch {
        setVisible(false);
      }
    };

    refreshBanner();
    
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
      window.removeEventListener('predictionsSubmitted', handleSubmission);
      window.removeEventListener('resultsPublished', handleResultsPublished);
      window.removeEventListener('fixturesPublished', handleFixturesPublished);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

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