import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isGameweekFinished } from '../lib/gameweekState';

/**
 * Hook to check if a gameweek has finished (moved to RESULTS_PRE_GW state)
 * Subscribes to app_gw_results and live_scores changes for real-time updates
 */
export function useGameweekFinished(gw: number | null): boolean {
  const [finished, setFinished] = useState<boolean>(false);

  useEffect(() => {
    if (!gw) {
      setFinished(false);
      return;
    }

    let alive = true;

    // Initial check
    (async () => {
      const isFinished = await isGameweekFinished(gw);
      if (alive) {
        setFinished(isFinished);
      }
    })();

    // Subscribe to app_gw_results changes
    const resultsChannel = supabase
      .channel(`gw_results_${gw}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_gw_results',
          filter: `gw=eq.${gw}`,
        },
        async () => {
          // Recheck when results change
          const isFinished = await isGameweekFinished(gw);
          if (alive) {
            setFinished(isFinished);
          }
        }
      )
      .subscribe();

    // Subscribe to live_scores changes (for active games check)
    const liveScoresChannel = supabase
      .channel(`live_scores_${gw}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_scores',
          filter: `gw=eq.${gw}`,
        },
        async () => {
          // Recheck when live scores change (active games might finish)
          const isFinished = await isGameweekFinished(gw);
          if (alive) {
            setFinished(isFinished);
          }
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(resultsChannel);
      supabase.removeChannel(liveScoresChannel);
    };
  }, [gw]);

  return finished;
}










