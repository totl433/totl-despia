import { supabase } from "./supabase";

export type GameweekState = 'GW_OPEN' | 'GW_PREDICTED' | 'LIVE' | 'RESULTS_PRE_GW';

/**
 * Determines the global state of a gameweek (not user-specific):
 * - GW_OPEN: New GW published, players can make predictions (before first kickoff)
 * - LIVE: First kickoff happened AND last game hasn't finished
 * - RESULTS_PRE_GW: GW has finished (all fixtures have results in app_gw_results AND no active games)
 */
export async function getGameweekState(gw: number): Promise<GameweekState> {
  // Get all fixtures for this GW
  const { data: fixtures, error: fixturesError } = await supabase
    .from("app_fixtures")
    .select("fixture_index, kickoff_time")
    .eq("gw", gw)
    .order("kickoff_time", { ascending: true });
  
  if (fixturesError || !fixtures || fixtures.length === 0) {
    // No fixtures = GW_OPEN (or doesn't exist)
    return 'GW_OPEN';
  }
  
  const now = new Date();
  const firstKickoff = fixtures[0]?.kickoff_time ? new Date(fixtures[0].kickoff_time) : null;
  
  // Check if first game has kicked off
  const firstGameStarted = firstKickoff ? now >= firstKickoff : false;
  
  if (!firstGameStarted) {
    return 'GW_OPEN';
  }
  
  // Check if GW has finished: all fixtures have results in app_gw_results AND no active games
  const isFinished = await isGameweekFinished(gw);
  
  if (isFinished) {
    return 'RESULTS_PRE_GW';
  } else {
    return 'LIVE';
  }
}

/**
 * Determines the user-specific state of a gameweek:
 * - GW_OPEN: New GW published, user hasn't submitted predictions yet (before first kickoff)
 * - GW_PREDICTED: User has submitted predictions but first kickoff hasn't happened yet
 * - LIVE: First kickoff happened AND last game hasn't finished
 * - RESULTS_PRE_GW: GW has finished (all fixtures have results in app_gw_results AND no active games)
 */
export async function getUserGameweekState(gw: number, userId: string | null | undefined): Promise<GameweekState> {
  // Get all fixtures for this GW
  const { data: fixtures, error: fixturesError } = await supabase
    .from("app_fixtures")
    .select("fixture_index, kickoff_time")
    .eq("gw", gw)
    .order("kickoff_time", { ascending: true });
  
  if (fixturesError || !fixtures || fixtures.length === 0) {
    // No fixtures = GW_OPEN (or doesn't exist)
    return 'GW_OPEN';
  }
  
  const now = new Date();
  const firstKickoff = fixtures[0]?.kickoff_time ? new Date(fixtures[0].kickoff_time) : null;
  
  // Check if first game has kicked off
  const firstGameStarted = firstKickoff ? now >= firstKickoff : false;
  
  if (!firstGameStarted) {
    // Before first kickoff - check if user has submitted
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
  
  // Check if GW has finished: all fixtures have results in app_gw_results AND no active games
  const isFinished = await isGameweekFinished(gw);
  
  if (isFinished) {
    return 'RESULTS_PRE_GW';
  } else {
    return 'LIVE';
  }
}

/**
 * Check if a gameweek has finished (moved to RESULTS_PRE_GW state)
 * GW is finished when: all fixtures have entries in app_gw_results AND no active games in live_scores
 */
export async function isGameweekFinished(gw: number): Promise<boolean> {
  // Get all fixtures for this GW
  const { data: fixtures, error: fixturesError } = await supabase
    .from("app_fixtures")
    .select("fixture_index")
    .eq("gw", gw);
  
  if (fixturesError || !fixtures || fixtures.length === 0) {
    return false;
  }
  
  const fixtureCount = fixtures.length;
  
  // Check if all fixtures have results in app_gw_results
  const { data: results, error: resultsError } = await supabase
    .from("app_gw_results")
    .select("fixture_index")
    .eq("gw", gw);
  
  if (resultsError) {
    return false;
  }
  
  const resultsCount = results?.length || 0;
  const allFixturesHaveResults = resultsCount === fixtureCount;
  
  if (!allFixturesHaveResults) {
    return false;
  }
  
  // Safety check: ensure no active games in live_scores
  const { data: activeGames } = await supabase
    .from("live_scores")
    .select("status")
    .eq("gw", gw)
    .in("status", ["IN_PLAY", "PAUSED"]);
  
  const hasActiveGames = activeGames && activeGames.length > 0;
  
  // GW is finished if all fixtures have results AND no active games
  return !hasActiveGames;
}

