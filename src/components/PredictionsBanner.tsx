import React from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/**
 * Shows different banners based on game state:
 *  - "Make predictions" when fixtures exist but no results published
 *  - "Watch this space" when results published but next GW fixtures not ready
 */
export default function PredictionsBanner() {
  const { user } = useAuth();
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
          .from("meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        const gw: number | null = (meta as any)?.current_gw ?? null;
        if (!alive) return;

        setCurrentGw(gw);
        if (!gw) return setVisible(false);

        // fixtures exist for current GW?
        const { count: fxCount } = await supabase
          .from("fixtures")
          .select("id", { count: "exact", head: true })
          .eq("gw", gw);
        if (!alive) return;

        // results already published for current GW?
        const { count: rsCount } = await supabase
          .from("gw_results")
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
          .from("fixtures")
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
          // Results published - show "watch this space" for next GW
          setBannerType("watch-space");
          setVisible(true);
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
          .from("fixtures")
          .select("fixture_index")
          .eq("gw", gw);
        
        if (!allFixtures || allFixtures.length === 0) {
          setVisible(false);
          return;
        }

        // Check if user has picks for all fixtures
        const { data: picks } = await supabase
          .from("picks")
          .select("fixture_index")
          .eq("user_id", user.id)
          .eq("gw", gw);
        
        if (!alive) return;

        const hasAllPicks = picks && picks.length === allFixtures.length;
        
        if (!hasAllPicks) {
          // User hasn't submitted all predictions - show predictions banner
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
  return (
    <>
      {bannerType === "predictions" ? (
        <div className="mx-auto max-w-6xl px-4">
        <Link
          to="/new-predictions"
          className="block mt-4 rounded-lg bg-blue-600 px-4 py-3 hover:bg-blue-700 transition-colors"
        >
          <div className="text-center">
            <div className="font-semibold text-white">GW{currentGw} is Live - Make your predictions</div>
            <div className="text-white/90">
              {deadlineText ? (
                <>
                  <span>Deadline: </span>
                  <span className="font-extrabold">{deadlineText}</span>
                </>
              ) : (
                "Don't miss the deadline!"
              )}
            </div>
          </div>
        </Link>
        </div>
      ) : (
        <div className="w-full px-4 py-3 relative" style={{ backgroundColor: '#e1eae9' }}>
          <div className="mx-auto max-w-6xl relative">
            {/* Circular icon with exclamation mark - top left */}
            <div className="absolute top-3 left-0 w-6 h-6 rounded-full bg-[#1C8376] flex items-center justify-center text-white text-[10px] font-normal">!</div>
            
            {/* Text content */}
            <div className="pl-10">
              <div className="font-bold text-slate-900 text-base">
                GW{(currentGw || 1) + 1} Coming Soon!
              </div>
              <div className="text-sm text-slate-600 mt-0.5">
                Fixtures will be published soon.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}