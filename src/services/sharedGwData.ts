/**
 * Shared GW Data Service
 * 
 * Centralized data fetching for fixtures and results per gameweek.
 * Implements request deduplication and error retry logic to prevent
 * duplicate queries and handle transient failures.
 */

import { supabase } from '../lib/supabase';
import { getCached, setCached, CACHE_TTL } from '../lib/cache';

export type Fixture = {
  id: number;
  gw: number;
  fixture_index: number;
  home_name: string;
  away_name: string;
  home_team: string | null;
  away_team: string | null;
  home_code: string | null;
  away_code: string | null;
  kickoff_time: string;
  api_match_id: number | null;
};

export type ResultRow = {
  gw: number;
  fixture_index: number;
  result: "H" | "D" | "A" | null;
};

interface SharedGwData {
  fixtures: Fixture[];
  results: ResultRow[];
}

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<SharedGwData>>();

// Cache keys
const getFixturesCacheKey = (gw: number) => `shared:fixtures:${gw}`;
const getResultsCacheKey = (gw: number) => `shared:results:${gw}`;

/**
 * Retry wrapper with exponential backoff
 */
async function fetchWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn();
      return result;
    } catch (error: any) {
      lastError = error;
      
      
      // Don't retry on certain errors
      if (error?.code === 'PGRST116' || error?.message?.includes('not found')) {
        throw error; // Not found errors shouldn't be retried
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Failed after retries');
}

/**
 * Fetch fixtures for a gameweek with retry logic
 */
async function fetchFixtures(gw: number): Promise<Fixture[]> {
  return fetchWithRetry(async () => {
    const { data, error } = await supabase
      .from('app_fixtures')
      .select('id, gw, fixture_index, home_name, away_name, home_team, away_team, home_code, away_code, kickoff_time, api_match_id')
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });
    
    if (error) throw error;
    return (data ?? []) as Fixture[];
  }, 3, 1000);
}

/**
 * Fetch results for a gameweek with retry logic
 */
async function fetchResults(gw: number): Promise<ResultRow[]> {
  return fetchWithRetry(async () => {
    const { data, error } = await supabase
      .from('app_gw_results')
      .select('gw, fixture_index, result')
      .eq('gw', gw);
    
    if (error) throw error;
    return (data ?? []) as ResultRow[];
  }, 3, 1000);
}

/**
 * Get shared GW data (fixtures + results) with deduplication and caching
 * 
 * This function ensures that:
 * - Multiple calls for the same GW reuse the same promise (deduplication)
 * - Data is cached to avoid unnecessary queries
 * - Errors are retried automatically
 * 
 * @param gw - Gameweek number
 * @returns Promise resolving to fixtures and results
 */
export async function getSharedGwData(gw: number): Promise<SharedGwData> {
  if (!gw || gw < 1) {
    return { fixtures: [], results: [] };
  }
  
  const requestKey = `gw:${gw}`;
  
  // Check if request is already in flight
  const inFlight = inFlightRequests.get(requestKey);
  if (inFlight) {
    return inFlight;
  }
  
  // Check cache first
  const fixturesCacheKey = getFixturesCacheKey(gw);
  const resultsCacheKey = getResultsCacheKey(gw);
  
  const cachedFixtures = getCached<Fixture[]>(fixturesCacheKey);
  const cachedResults = getCached<ResultRow[]>(resultsCacheKey);
  
  if (cachedFixtures && cachedResults) {
    // Return cached data immediately
    return { fixtures: cachedFixtures, results: cachedResults };
  }
  
  // Create new request promise
  const requestPromise = (async (): Promise<SharedGwData> => {
    try {
      // Fetch both in parallel
      const [fixtures, results] = await Promise.all([
        cachedFixtures ? Promise.resolve(cachedFixtures) : fetchFixtures(gw),
        cachedResults ? Promise.resolve(cachedResults) : fetchResults(gw),
      ]);
      
      // Cache the results
      if (!cachedFixtures && fixtures.length > 0) {
        setCached(fixturesCacheKey, fixtures, CACHE_TTL.FIXTURES);
      }
      if (!cachedResults && results.length > 0) {
        setCached(resultsCacheKey, results, CACHE_TTL.HOME);
      }
      
      return { fixtures, results };
    } catch (error: any) {
      throw error;
    } finally {
      // Remove from in-flight map when done
      inFlightRequests.delete(requestKey);
    }
  })();
  
  // Store in-flight request
  inFlightRequests.set(requestKey, requestPromise);
  
  return requestPromise;
}

/**
 * Clear cached data for a specific gameweek
 */
export function clearSharedGwDataCache(gw: number): void {
  const fixturesCacheKey = getFixturesCacheKey(gw);
  const resultsCacheKey = getResultsCacheKey(gw);
  
  // Remove from cache
  try {
    localStorage.removeItem(`despia:cache:${fixturesCacheKey}`);
    localStorage.removeItem(`despia:cache:${resultsCacheKey}`);
  } catch {
    // Ignore cache errors
  }
  
  // Remove from in-flight map if exists
  inFlightRequests.delete(`gw:${gw}`);
}
