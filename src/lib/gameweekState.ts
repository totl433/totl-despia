import { supabase } from "./supabase";
import { getCached } from "./cache";

export type GameweekState = 'GW_OPEN' | 'GW_PREDICTED' | 'DEADLINE_PASSED' | 'LIVE' | 'RESULTS_PRE_GW';

const DEADLINE_BUFFER_MINUTES = 75;

/**
 * Determines the global state of a gameweek (not user-specific):
 * - GW_OPEN: New GW published, players can make predictions (before deadline)
 * - DEADLINE_PASSED: Deadline has passed but first kickoff hasn't happened yet
 * - LIVE: First kickoff happened AND last game hasn't finished (FT)
 * - RESULTS_PRE_GW: GW has finished (last game has reached FT AND no active games)
 */
// Cache for fixture kickoff times to prevent duplicate DB queries
const fixtureKickoffCache = new Map<number, Array<{ fixture_index: number; kickoff_time: string }>>();
// Promise cache to prevent concurrent duplicate requests for the same GW
const fixtureFetchPromises = new Map<number, Promise<Array<{ fixture_index: number; kickoff_time: string }>>>();
// Promise cache for live_scores queries to prevent concurrent duplicate requests
const liveScoresFetchPromises = new Map<string, Promise<Array<{ fixture_index: number; status: string }>>>();

export async function getGameweekState(gw: number): Promise<GameweekState> {
  // Check in-memory cache first (prevents duplicate requests during same render cycle)
  if (fixtureKickoffCache.has(gw)) {
    const fixtures = fixtureKickoffCache.get(gw)!;
    if (fixtures && fixtures.length > 0) {
      return calculateGameweekState(fixtures, gw);
    }
  }
  
  // Try to get fixtures from localStorage cache (pre-loaded during initial data load)
  let fixtures: Array<{ fixture_index: number; kickoff_time: string }> | null = null;
  
  // Check all localStorage keys to find any user's fixtures cache for this GW
  // Cache format: home:fixtures:${userId}:${gw}
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`home:fixtures:`) && key.endsWith(`:${gw}`)) {
          const cached = getCached<{ fixtures: Array<{ fixture_index: number; kickoff_time: string }> }>(key);
          if (cached?.fixtures?.length) {
            fixtures = cached.fixtures.map(f => ({ fixture_index: f.fixture_index, kickoff_time: f.kickoff_time }));
            // Cache in memory for this render cycle
            fixtureKickoffCache.set(gw, fixtures);
            break;
          }
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }
  
  // If not in cache, fetch from DB (only once per GW, even if multiple concurrent calls)
  if (!fixtures) {
    // Check if there's already a fetch in progress for this GW
    let fetchPromise = fixtureFetchPromises.get(gw);
    
    if (!fetchPromise) {
      // Create new fetch promise
      fetchPromise = (async () => {
        const { data, error: fixturesError } = await supabase
          .from("app_fixtures")
          .select("fixture_index, kickoff_time")
          .eq("gw", gw)
          .order("kickoff_time", { ascending: true });
        
        if (fixturesError || !data || data.length === 0) {
          fixtureFetchPromises.delete(gw);
          return [];
        }
        
        fixtureKickoffCache.set(gw, data);
        fixtureFetchPromises.delete(gw);
        return data;
      })();
      
      fixtureFetchPromises.set(gw, fetchPromise);
    }
    
    fixtures = await fetchPromise;
    
    if (!fixtures || fixtures.length === 0) {
      return 'GW_OPEN';
    }
  }
  
  return calculateGameweekState(fixtures, gw);
}

async function calculateGameweekState(fixtures: Array<{ fixture_index: number; kickoff_time: string }>, gw: number): Promise<GameweekState> {
  if (!fixtures || fixtures.length === 0) {
    return 'GW_OPEN';
  }
  
  const now = new Date();
  const firstKickoff = fixtures[0]?.kickoff_time ? new Date(fixtures[0].kickoff_time) : null;
  
  if (!firstKickoff) {
    return 'GW_OPEN';
  }
  
  // Calculate deadline (75 minutes before first kickoff)
  const deadlineTime = new Date(firstKickoff.getTime() - (DEADLINE_BUFFER_MINUTES * 60 * 1000));
  
  // Check if deadline has passed
  const deadlinePassed = now >= deadlineTime;
  
  // Check if first game has kicked off
  const firstGameStarted = now >= firstKickoff;
  
  if (!firstGameStarted) {
    // Before first kickoff - check if deadline has passed
    if (deadlinePassed) {
      return 'DEADLINE_PASSED';
    } else {
      return 'GW_OPEN';
    }
  }
  
  // Check if GW has finished: last game has reached FT AND no active games
  const isFinished = await isGameweekFinished(gw);
  
  if (isFinished) {
    return 'RESULTS_PRE_GW';
  } else {
    return 'LIVE';
  }
}

/**
 * Determines the user-specific state of a gameweek:
 * - GW_OPEN: New GW published, user hasn't submitted predictions yet (before deadline)
 * - GW_PREDICTED: User has submitted predictions but deadline hasn't passed yet
 * - DEADLINE_PASSED: Deadline has passed but first kickoff hasn't happened yet
 * - LIVE: First kickoff happened AND last game hasn't finished (FT)
 * - RESULTS_PRE_GW: GW has finished (last game has reached FT AND no active games)
 */
export async function getUserGameweekState(gw: number, userId: string | null | undefined): Promise<GameweekState> {
  // Check in-memory cache first
  if (fixtureKickoffCache.has(gw)) {
    const fixtures = fixtureKickoffCache.get(gw)!;
    if (fixtures && fixtures.length > 0) {
      return calculateUserGameweekState(fixtures, gw, userId);
    }
  }
  
  // Try to get fixtures from localStorage cache (pre-loaded during initial data load)
  let fixtures: Array<{ fixture_index: number; kickoff_time: string }> | null = null;
  
  // Check user-specific cache first
  if (userId) {
    const userCacheKey = `home:fixtures:${userId}:${gw}`;
    const cached = getCached<{ fixtures: Array<{ fixture_index: number; kickoff_time: string }> }>(userCacheKey);
    if (cached?.fixtures?.length) {
      fixtures = cached.fixtures.map(f => ({ fixture_index: f.fixture_index, kickoff_time: f.kickoff_time }));
      fixtureKickoffCache.set(gw, fixtures);
    }
  }
  
  // If not in user cache, check any user's cache for this GW
  if (!fixtures && typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`home:fixtures:`) && key.endsWith(`:${gw}`)) {
          const cached = getCached<{ fixtures: Array<{ fixture_index: number; kickoff_time: string }> }>(key);
          if (cached?.fixtures?.length) {
            fixtures = cached.fixtures.map(f => ({ fixture_index: f.fixture_index, kickoff_time: f.kickoff_time }));
            fixtureKickoffCache.set(gw, fixtures);
            break;
          }
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }
  
  // If not in cache, fetch from DB (only once per GW, even if multiple concurrent calls)
  if (!fixtures) {
    // Check if there's already a fetch in progress for this GW
    let fetchPromise = fixtureFetchPromises.get(gw);
    
    if (!fetchPromise) {
      // Create new fetch promise
      fetchPromise = (async () => {
        const { data, error: fixturesError } = await supabase
          .from("app_fixtures")
          .select("fixture_index, kickoff_time")
          .eq("gw", gw)
          .order("kickoff_time", { ascending: true });
        
        if (fixturesError || !data || data.length === 0) {
          fixtureFetchPromises.delete(gw);
          return [];
        }
        
        fixtureKickoffCache.set(gw, data);
        fixtureFetchPromises.delete(gw);
        return data;
      })();
      
      fixtureFetchPromises.set(gw, fetchPromise);
    }
    
    fixtures = await fetchPromise;
    
    if (!fixtures || fixtures.length === 0) {
      return 'GW_OPEN';
    }
  }
  
  return calculateUserGameweekState(fixtures, gw, userId);
}

async function calculateUserGameweekState(fixtures: Array<{ fixture_index: number; kickoff_time: string }>, gw: number, userId: string | null | undefined): Promise<GameweekState> {
  if (!fixtures || fixtures.length === 0) {
    return 'GW_OPEN';
  }
  
  const now = new Date();
  const firstKickoff = fixtures[0]?.kickoff_time ? new Date(fixtures[0].kickoff_time) : null;
  
  if (!firstKickoff) {
    return 'GW_OPEN';
  }
  
  // Calculate deadline (75 minutes before first kickoff)
  const deadlineTime = new Date(firstKickoff.getTime() - (DEADLINE_BUFFER_MINUTES * 60 * 1000));
  
  // Check if deadline has passed
  const deadlinePassed = now >= deadlineTime;
  
  // Check if first game has kicked off
  const firstGameStarted = now >= firstKickoff;
  
  if (!firstGameStarted) {
    // Before first kickoff - check if deadline has passed
    if (deadlinePassed) {
      return 'DEADLINE_PASSED';
    } else {
      // Before deadline - check if user has submitted
      if (userId) {
        const { data: submission } = await supabase
          .from("app_gw_submissions")
          .select("submitted_at")
          .eq("user_id", userId)
          .eq("gw", gw)
          .maybeSingle();
        
        const hasSubmitted = submission?.submitted_at !== null && submission?.submitted_at !== undefined;
        
        if (hasSubmitted) {
          return 'GW_PREDICTED';
        }
      }
      return 'GW_OPEN';
    }
  }
  
  // Check if GW has finished: last game has reached FT AND no active games
  const isFinished = await isGameweekFinished(gw);
  
  if (isFinished) {
    return 'RESULTS_PRE_GW';
  } else {
    return 'LIVE';
  }
}

/**
 * Check if a gameweek has finished (moved to RESULTS_PRE_GW state)
 * GW is finished when: last game (by kickoff time) has reached FT AND no active games in live_scores
 * 
 * Key principle: A GW is LIVE between first kickoff and last FT.
 * A game is LIVE between kickoff and FT (status IN_PLAY or PAUSED).
 */
export async function isGameweekFinished(gw: number): Promise<boolean> {
  // Check in-memory cache first
  let fixtures: Array<{ fixture_index: number; kickoff_time: string }> | null = null;
  
  if (fixtureKickoffCache.has(gw)) {
    fixtures = fixtureKickoffCache.get(gw)!;
  }
  
  // Try to get fixtures from localStorage cache
  if (!fixtures && typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`home:fixtures:`) && key.endsWith(`:${gw}`)) {
          const cached = getCached<{ fixtures: Array<{ fixture_index: number; kickoff_time: string }> }>(key);
          if (cached?.fixtures?.length) {
            fixtures = cached.fixtures.map(f => ({ fixture_index: f.fixture_index, kickoff_time: f.kickoff_time }));
            fixtureKickoffCache.set(gw, fixtures);
            break;
          }
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }
  
  // If not in cache, fetch from DB (only once per GW, even if multiple concurrent calls)
  if (!fixtures) {
    // Check if there's already a fetch in progress for this GW
    let fetchPromise = fixtureFetchPromises.get(gw);
    
    if (!fetchPromise) {
      // Create new fetch promise
      fetchPromise = (async () => {
        const { data, error: fixturesError } = await supabase
          .from("app_fixtures")
          .select("fixture_index, kickoff_time")
          .eq("gw", gw)
          .order("kickoff_time", { ascending: true });
        
        if (fixturesError || !data || data.length === 0) {
          fixtureFetchPromises.delete(gw);
          return [];
        }
        
        fixtureKickoffCache.set(gw, data);
        fixtureFetchPromises.delete(gw);
        return data;
      })();
      
      fixtureFetchPromises.set(gw, fetchPromise);
    }
    
    fixtures = await fetchPromise;
    
    if (!fixtures || fixtures.length === 0) {
      return false;
    }
  }
  
  if (!fixtures || fixtures.length === 0) {
    return false;
  }
  
  // Get the last fixture by kickoff time
  const lastFixture = fixtures[fixtures.length - 1];
  if (!lastFixture) {
    return false;
  }
  
  // Try to get live_scores from cache first (pre-loaded during initial data load)
  let liveScores: Array<{ fixture_index: number; status: string }> | null = null;
  
  // Check cache for any user's live scores cache (live scores are the same for all users)
  // Try to find any user-specific cache for this GW
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('despia:cache:home:fixtures:') && key.includes(`:${gw}`)) {
          const cached = getCached<{ liveScores?: Array<{ fixture_index: number; status: string }> }>(key.replace('despia:cache:', ''));
          if (cached?.liveScores?.length) {
            liveScores = cached.liveScores.map(ls => ({ fixture_index: ls.fixture_index, status: ls.status }));
            break;
          }
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }
  
  // If not in cache, fetch from DB (only once per GW, even if multiple concurrent calls)
  if (!liveScores) {
    const cacheKey = `live_scores:${gw}`;
    let fetchPromise = liveScoresFetchPromises.get(cacheKey);
    
    if (!fetchPromise) {
      // Create new fetch promise
      fetchPromise = (async () => {
        const { data, error } = await supabase
          .from("live_scores")
          .select("fixture_index, status")
          .eq("gw", gw);
        
        if (error || !data) {
          liveScoresFetchPromises.delete(cacheKey);
          return [];
        }
        
        liveScoresFetchPromises.delete(cacheKey);
        return data;
      })();
      
      liveScoresFetchPromises.set(cacheKey, fetchPromise);
    }
    
    liveScores = await fetchPromise;
  }
  
  if (!liveScores || liveScores.length === 0) {
    // No live scores = GW hasn't started yet, so not finished
    return false;
  }
  
  // Check if the last game has finished (status === 'FINISHED' in live_scores)
  const lastGameLiveScore = liveScores.find(ls => ls.fixture_index === lastFixture.fixture_index);
  const lastGameFinished = lastGameLiveScore?.status === 'FINISHED';
  
  // If last game hasn't finished, GW is still LIVE
  if (!lastGameFinished) {
    return false;
  }
  
  // Safety check: ensure no active games in live_scores (IN_PLAY or PAUSED)
  const hasActiveGames = liveScores.some(ls => ls.status === 'IN_PLAY' || ls.status === 'PAUSED');
  
  // GW is finished if last game has finished AND no active games
  return !hasActiveGames;
}

