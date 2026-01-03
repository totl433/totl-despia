import { supabase } from "./supabase";

export type GameweekState = 'GW_OPEN' | 'GW_PREDICTED' | 'DEADLINE_PASSED' | 'LIVE' | 'RESULTS_PRE_GW';

const DEADLINE_BUFFER_MINUTES = 75;

/**
 * Determines the global state of a gameweek (not user-specific):
 * - GW_OPEN: New GW published, players can make predictions (before deadline)
 * - DEADLINE_PASSED: Deadline has passed but first kickoff hasn't happened yet
 * - LIVE: First kickoff happened AND last game hasn't finished (FT)
 * - RESULTS_PRE_GW: GW has finished (last game has reached FT AND no active games)
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
  // Get all fixtures for this GW, ordered by kickoff time
  const { data: fixtures, error: fixturesError } = await supabase
    .from("app_fixtures")
    .select("fixture_index, kickoff_time")
    .eq("gw", gw)
    .order("kickoff_time", { ascending: true });
  
  if (fixturesError || !fixtures || fixtures.length === 0) {
    return false;
  }
  
  // Get the last fixture by kickoff time
  const lastFixture = fixtures[fixtures.length - 1];
  if (!lastFixture) {
    return false;
  }
  
  // Check if the last game has finished (status === 'FINISHED' in live_scores)
  // This is the key check: GW is only finished when the LAST game has reached FT
  const { data: lastGameLiveScore } = await supabase
    .from("live_scores")
    .select("status")
    .eq("gw", gw)
    .eq("fixture_index", lastFixture.fixture_index)
    .maybeSingle();
  
  const lastGameFinished = lastGameLiveScore?.status === 'FINISHED';
  
  // If last game hasn't finished, GW is still LIVE
  if (!lastGameFinished) {
    return false;
  }
  
  // Safety check: ensure no active games in live_scores (IN_PLAY or PAUSED)
  const { data: activeGames } = await supabase
    .from("live_scores")
    .select("status")
    .eq("gw", gw)
    .in("status", ["IN_PLAY", "PAUSED"]);
  
  const hasActiveGames = activeGames && activeGames.length > 0;
  
  // GW is finished if last game has finished AND no active games
  return !hasActiveGames;
}

