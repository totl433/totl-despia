/**
 * useSharedGwData Hook
 * 
 * React hook for accessing shared gameweek data (fixtures + results).
 * Automatically handles loading states, errors, and request deduplication.
 */

import { useState, useEffect, useMemo } from 'react';
import { getSharedGwData, type Fixture, type ResultRow } from '../services/sharedGwData';
import { getCached } from '../lib/cache';

interface UseSharedGwDataResult {
  fixtures: Fixture[];
  results: ResultRow[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to get shared fixtures and results for a gameweek
 * 
 * Automatically deduplicates requests and handles caching.
 * Multiple components can use this hook for the same GW without
 * causing duplicate queries.
 * 
 * @param gw - Gameweek number (null/undefined to skip fetching)
 * @returns Object with fixtures, results, loading, and error states
 */
// Cache key helpers (matching sharedGwData.ts)
const getFixturesCacheKey = (gw: number) => `shared:fixtures:${gw}`;
const getResultsCacheKey = (gw: number) => `shared:results:${gw}`;

export function useSharedGwData(gw: number | null | undefined): UseSharedGwDataResult {
  // CRITICAL FIX: Use useMemo to read cache synchronously on every render
  // This ensures components always see cached data immediately, even before state updates
  const cachedData = useMemo(() => {
    if (!gw || gw < 1) {
      return { fixtures: null, results: null };
    }
    
    const cachedFixtures = getCached<Fixture[]>(getFixturesCacheKey(gw));
    const cachedResults = getCached<ResultRow[]>(getResultsCacheKey(gw));
    
    // Allow partial cache - if fixtures exist, use them even if results are empty
    // This prevents empty tables when results haven't loaded yet
    if (cachedFixtures && cachedFixtures.length > 0) {
      return { fixtures: cachedFixtures, results: cachedResults || [] };
    }
    
    return { fixtures: null, results: null };
  }, [gw]);
  
  const [fixtures, setFixtures] = useState<Fixture[]>(cachedData.fixtures ?? []);
  const [results, setResults] = useState<ResultRow[]>(cachedData.results ?? []);
  const [loading, setLoading] = useState(!cachedData.fixtures);
  const [error, setError] = useState<string | null>(null);
  
  // CRITICAL: Use cached data if available, otherwise use state
  // This ensures components see cached data immediately on every render
  const effectiveFixtures = cachedData.fixtures ?? fixtures;
  const effectiveResults = cachedData.results ?? results;
  
  useEffect(() => {
    // Skip if no GW provided
    if (!gw || gw < 1) {
      setFixtures([]);
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    // CRITICAL FIX: Check cache synchronously in effect when gw changes
    // This handles the case where gw changes from null to a value
    const cachedFixtures = getCached<Fixture[]>(getFixturesCacheKey(gw));
    const cachedResults = getCached<ResultRow[]>(getResultsCacheKey(gw));
    const hasCachedData = cachedFixtures && cachedResults && cachedFixtures.length > 0 && cachedResults.length > 0;
    
    // If cache exists, set state immediately (synchronously) before async call
    if (hasCachedData) {
      setFixtures(cachedFixtures);
      setResults(cachedResults);
      setLoading(false);
      setError(null);
    } else {
      // No cache - set loading state
      setLoading(true);
      setError(null);
    }
    
    let alive = true;
    
    (async () => {
      try {
        const data = await getSharedGwData(gw);
        
        if (!alive) return;
        
        // Update state (even if cached data is being used, this ensures we have latest)
        setFixtures(data.fixtures);
        setResults(data.results);
        setLoading(false);
      } catch (err: any) {
        if (!alive) return;
        
        // Provide user-friendly error messages
        let errorMessage = 'Failed to load data';
        if (err?.message?.includes('502') || err?.message?.includes('Bad Gateway')) {
          errorMessage = 'Supabase is temporarily unavailable. Please try again in a moment.';
        } else if (err?.message?.includes('CORS') || err?.code === 'ERR_NETWORK') {
          errorMessage = 'Network error. Please check your connection.';
        } else if (err?.message) {
          errorMessage = err.message;
        }
        
        console.error('[useSharedGwData] Error fetching data:', err);
        setError(errorMessage);
        setLoading(false);
      }
    })();
    
    return () => {
      alive = false;
    };
  }, [gw]);
  
  // Return effective values (cached if available, otherwise state)
  return { fixtures: effectiveFixtures, results: effectiveResults, loading, error };
}
