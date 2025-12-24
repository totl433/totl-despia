import { useEffect, useState } from 'react';
import { getGameweekState, type GameweekState } from '../lib/gameweekState';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * Hook to get the current state of a gameweek (GW_OPEN, LIVE, or RESULTS_PRE_GW)
 * Subscribes to real-time updates from app_gw_results and live_scores
 */
export function useGameweekState(gw: number | null | undefined) {
  const [state, setState] = useState<GameweekState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gw === null || gw === undefined) {
      setState(null);
      setLoading(false);
      return;
    }

    let alive = true;
    let resultsChannel: RealtimeChannel | null = null;
    let liveScoresChannel: RealtimeChannel | null = null;

    const checkState = async () => {
      if (!alive) return;
      setLoading(true);
      setError(null);
      try {
        const gameweekState = await getGameweekState(gw);
        if (alive) {
          setState(gameweekState);
        }
      } catch (err: any) {
        console.error(`[useGameweekState] Error checking GW ${gw} state:`, err);
        if (alive) {
          setError(err.message || 'Failed to check gameweek state');
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    checkState();

    // Subscribe to app_gw_results changes
    resultsChannel = supabase
      .channel(`gameweek-state-results-${gw}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_gw_results', filter: `gw=eq.${gw}` },
        () => {
          console.log(`[useGameweekState] 🔔 app_gw_results change for GW ${gw}, re-checking state`);
          checkState();
        }
      )
      .subscribe();

    // Subscribe to live_scores changes
    liveScoresChannel = supabase
      .channel(`gameweek-state-live-scores-${gw}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_scores', filter: `gw=eq.${gw}` },
        () => {
          console.log(`[useGameweekState] 🔔 live_scores change for GW ${gw}, re-checking state`);
          checkState();
        }
      )
      .subscribe();

    // Also subscribe to app_fixtures changes (kickoff times might change)
    const fixturesChannel = supabase
      .channel(`gameweek-state-fixtures-${gw}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_fixtures', filter: `gw=eq.${gw}` },
        () => {
          console.log(`[useGameweekState] 🔔 app_fixtures change for GW ${gw}, re-checking state`);
          checkState();
        }
      )
      .subscribe();

    return () => {
      alive = false;
      if (resultsChannel) supabase.removeChannel(resultsChannel);
      if (liveScoresChannel) supabase.removeChannel(liveScoresChannel);
      if (fixturesChannel) supabase.removeChannel(fixturesChannel);
    };
  }, [gw]);

  return { state, loading, error };
}

