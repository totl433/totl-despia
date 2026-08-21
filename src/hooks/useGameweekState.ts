import { useEffect, useState } from 'react';
import { getUserGameweekState, getGameweekState, type GameweekState } from '../lib/gameweekState';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getCached } from '../lib/cache';
import { getActiveSeasonCtx } from '../lib/activeSeasonCtx';
import { getSeasonTables } from '../lib/seasonStack';

/**
 * Hook to get the state of a gameweek (GW_OPEN, GW_PREDICTED, DEADLINE_PASSED, LIVE, or RESULTS_PRE_GW)
 * If userId is provided, returns user-specific state (includes GW_PREDICTED and DEADLINE_PASSED)
 * If userId is not provided, returns global state (GW_OPEN, DEADLINE_PASSED, LIVE, or RESULTS_PRE_GW)
 * Subscribes to real-time updates from results / fixtures / submissions (season-aware tables)
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

    const checkState = async (isInitialCheck: boolean = false) => {
      if (!alive) return;
      
      // If we already have state from cache, skip DB query on initial check
      const hasCachedState = state !== null;
      if (isInitialCheck && hasCachedState) {
        // We have cached state, refresh in background but don't block
        setLoading(false);
        // Still refresh in background to get latest state
      } else {
        // No cached state or not initial check - show loading
        setLoading(true);
      }
      
      setError(null);
      try {
        // Use user-specific state if userId is provided, otherwise use global state
        const gameweekState = userId 
          ? await getUserGameweekState(gw, userId)
          : await getGameweekState(gw);
        if (alive) {
          setState(gameweekState);
          setLoading(false);
        }
      } catch (err: any) {
        console.error(`[useGameweekState] Error checking GW ${gw} state:`, err);
        if (alive) {
          setError(err.message || 'Failed to check gameweek state');
          setLoading(false);
        }
      }
    };

    // Only check if we don't have cached state, or refresh in background if we do
    if (state === null) {
      checkState(true); // Initial check - blocking if no cache
    } else {
      // We have cached state - refresh in background without blocking
      checkState(true);
    }

    const seasonCtx = getActiveSeasonCtx();
    const tables = getSeasonTables(seasonCtx ?? { useSeasonStack: false });

    // Subscribe to results changes (legacy app_gw_results or app_season_results)
    resultsChannel = supabase
      .channel(`gameweek-state-results-${tables.results}-${gw}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tables.results, filter: `gw=eq.${gw}` },
        () => {
          console.log(`[useGameweekState] 🔔 ${tables.results} change for GW ${gw}, re-checking state`);
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

    // Also subscribe to fixtures changes (kickoff times might change)
    const fixturesChannel = supabase
      .channel(`gameweek-state-fixtures-${tables.fixtures}-${gw}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tables.fixtures, filter: `gw=eq.${gw}` },
        () => {
          console.log(`[useGameweekState] 🔔 ${tables.fixtures} change for GW ${gw}, re-checking state`);
          checkState();
        }
      )
      .subscribe();

    // Subscribe to submissions changes (user submission status)
    if (userId) {
      submissionsChannel = supabase
        .channel(`gameweek-state-submissions-${tables.submissions}-${gw}-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tables.submissions, filter: `gw=eq.${gw}` },
          () => {
            console.log(`[useGameweekState] 🔔 ${tables.submissions} change for GW ${gw}, re-checking state`);
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

