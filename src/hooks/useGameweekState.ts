import { useEffect, useState } from 'react';
import { getUserGameweekState, getGameweekState, type GameweekState } from '../lib/gameweekState';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getCached } from '../lib/cache';

/**
 * Hook to get the state of a gameweek (GW_OPEN, GW_PREDICTED, DEADLINE_PASSED, LIVE, or RESULTS_PRE_GW)
 * If userId is provided, returns user-specific state (includes GW_PREDICTED and DEADLINE_PASSED)
 * If userId is not provided, returns global state (GW_OPEN, DEADLINE_PASSED, LIVE, or RESULTS_PRE_GW)
 * Subscribes to real-time updates from app_gw_results, live_scores, and app_gw_submissions
 */
export function useGameweekState(gw: number | null | undefined, userId?: string | null | undefined) {
  // Try to load from cache first (pre-loaded during initial data load)
  const [state, setState] = useState<GameweekState | null>(() => {
    if (gw === null || gw === undefined) return null;
    const cached = getCached<GameweekState>(`gameState:${gw}`);
    return cached ?? null;
  });
  const [loading, setLoading] = useState(() => {
    if (gw === null || gw === undefined) return false;
    const cached = getCached<GameweekState>(`gameState:${gw}`);
    return cached === null; // Only loading if not in cache
  });
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
    let submissionsChannel: RealtimeChannel | null = null;

    const checkState = async () => {
      if (!alive) return;
      setLoading(true);
      setError(null);
      try {
        // Use user-specific state if userId is provided, otherwise use global state
        const gameweekState = userId 
          ? await getUserGameweekState(gw, userId)
          : await getGameweekState(gw);
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

    // Subscribe to app_gw_submissions changes (user submission status)
    if (userId) {
      submissionsChannel = supabase
        .channel(`gameweek-state-submissions-${gw}-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_gw_submissions', filter: `gw=eq.${gw}` },
          () => {
            console.log(`[useGameweekState] 🔔 app_gw_submissions change for GW ${gw}, re-checking state`);
            checkState();
          }
        )
        .subscribe();
    }

    return () => {
      alive = false;
      if (resultsChannel) supabase.removeChannel(resultsChannel);
      if (liveScoresChannel) supabase.removeChannel(liveScoresChannel);
      if (fixturesChannel) supabase.removeChannel(fixturesChannel);
      if (submissionsChannel) supabase.removeChannel(submissionsChannel);
    };
  }, [gw, userId]);

  return { state, loading, error };
}

