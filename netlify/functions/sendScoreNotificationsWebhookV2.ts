/**
 * Score Notifications Webhook (V2 - using unified dispatcher)
 * 
 * Migrated from sendScoreNotificationsWebhook.ts to use the new notification system.
 * 
 * Major Changes:
 * - Uses dispatchNotification() instead of direct OneSignal API calls
 * - Idempotency via notification_send_log (replaces notification_state for dedup)
 * - Deterministic event_ids for each notification type
 * - collapse_id/thread_id/android_group set automatically
 * - Per-user sends (not per-pick loops) - prevents multi-device duplicates
 * - Clean separation of concerns via scoreHelpers
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  sendGoalNotification,
  sendGoalDisallowedNotification,
  sendKickoffNotification,
  sendHalftimeNotification,
  sendFinalWhistleNotification,
  sendGameweekCompleteNotification,
  hasGoalNotificationForMinute,
  getExistingKickoffHalf,
} from './lib/notifications/scoreHelpers';
import {
  isKickoffTooOldForLiveNotifications,
  isLiveMatchStatus,
  isTerminalMatchStatus,
} from './lib/liveMatchGuards';
import {
  fetchDualStackFixturePicks,
  fetchGwPickerUserIds,
  fetchWebhookFixtureInfo,
  finalizeFixtureResultsDualStack,
  type WebhookFixtureInfo,
} from './lib/seasonStackPoll';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface LiveScoreRecord {
  api_match_id: number;
  home_score: number;
  away_score: number;
  status: string;
  minute: number | null;
  goals: any[];
  red_cards: any[];
  home_team?: string;
  away_team?: string;
  home_team_id?: number;
  away_team_id?: number;
}

/**
 * Fetch user IDs who have picks for a fixture (legacy + season stack).
 */
async function fetchUserIdsWithPicks(
  fixture: WebhookFixtureInfo,
  includePick: boolean = false
): Promise<{ userId: string; pick?: string }[]> {
  return fetchDualStackFixturePicks(supabase, fixture, includePick);
}

/**
 * Determine which team scored from goal object
 * Uses teamId if available (more reliable), otherwise falls back to name matching
 */
function determineScoringTeam(
  goal: any,
  homeTeam: string,
  awayTeam: string,
  homeTeamId?: number,
  awayTeamId?: number
): { isHomeTeam: boolean; teamName: string } {
  // First try to match by teamId if available (most reliable)
  if (goal.teamId !== undefined && goal.teamId !== null) {
    if (homeTeamId !== undefined && goal.teamId === homeTeamId) {
      return { isHomeTeam: true, teamName: homeTeam };
    }
    if (awayTeamId !== undefined && goal.teamId === awayTeamId) {
      return { isHomeTeam: false, teamName: awayTeam };
    }
  }

  // Fall back to name matching (handle abbreviations and variations)
  const scoringTeam = (goal.team || '').toLowerCase().trim();
  const normalizedHome = homeTeam.toLowerCase().trim();
  const normalizedAway = awayTeam.toLowerCase().trim();

  // Check exact match first
  if (scoringTeam === normalizedHome || scoringTeam === normalizedAway) {
    const isHomeTeam = scoringTeam === normalizedHome;
    return { isHomeTeam, teamName: isHomeTeam ? homeTeam : awayTeam };
  }

  // Check if scoring team is contained in home/away team name or vice versa
  // This handles cases like "Forest" matching "Nottingham" (Nottingham Forest)
  const homeMatch = 
    scoringTeam.includes(normalizedHome) ||
    normalizedHome.includes(scoringTeam);
  const awayMatch = 
    scoringTeam.includes(normalizedAway) ||
    normalizedAway.includes(scoringTeam);

  // If both match, prefer the longer/more specific match
  if (homeMatch && awayMatch) {
    const homeScore = scoringTeam.length + normalizedHome.length;
    const awayScore = scoringTeam.length + normalizedAway.length;
    const isHomeTeam = homeScore >= awayScore;
    return { isHomeTeam, teamName: isHomeTeam ? homeTeam : awayTeam };
  }

  // If only one matches, use that
  if (homeMatch) {
    return { isHomeTeam: true, teamName: homeTeam };
  }
  if (awayMatch) {
    return { isHomeTeam: false, teamName: awayTeam };
  }

  // Default fallback: assume away team (less common, safer default)
  // This should rarely happen if data is correct
  console.warn(`[determineScoringTeam] Could not match goal team "${goal.team}" to "${homeTeam}" or "${awayTeam}"`);
  return { isHomeTeam: false, teamName: awayTeam };
}

/**
 * Parse webhook payload (handles multiple Supabase formats)
 */
function parseWebhookPayload(body: string): { record: LiveScoreRecord | null; oldRecord: any | null } {
  const payload = JSON.parse(body || '{}');
  
  let record: any = null;
  let oldRecord: any = null;

  if (payload.record && payload.table) {
    record = payload.record;
    oldRecord = payload.old_record;
  } else if (payload.new) {
    record = payload.new;
    oldRecord = payload.old;
  } else if (payload.api_match_id) {
    record = payload;
    oldRecord = {};
  }

  return { record, oldRecord };
}

export const handler: Handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const requestId = Math.random().toString(36).substring(7);
    const { record, oldRecord } = parseWebhookPayload(event.body || '{}');

    if (!record || !record.api_match_id) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Invalid payload' }) };
    }

    const apiMatchId = record.api_match_id;
    const homeScore = record.home_score ?? 0;
    const awayScore = record.away_score ?? 0;
    const status = record.status;
    const minute = record.minute;
    const goals = record.goals || [];

    const oldHomeScore = oldRecord?.home_score ?? 0;
    const oldAwayScore = oldRecord?.away_score ?? 0;
    const oldStatus = oldRecord?.status;
    const oldGoals = oldRecord?.goals || [];

    console.log(`[scoreWebhookV2] [${requestId}] Processing match ${apiMatchId}: status=${status}, score=${homeScore}-${awayScore}`);

    // Fetch fixture info (legacy + Pile B season fixtures)
    const fixture = await fetchWebhookFixtureInfo(supabase, apiMatchId);
    if (!fixture) {
      console.log(`[scoreWebhookV2] [${requestId}] No fixture found for api_match_id ${apiMatchId}`);
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No fixture found' }) };
    }

    const { fixture_index, gw, home_team, away_team, kickoff_time } = fixture;
    console.log(`[scoreWebhookV2] [${requestId}] Fixture stacks:`, {
      gw,
      fixture_index,
      isApp: fixture.isAppFixture,
      isSeason: fixture.isSeasonFixture,
      seasonId: fixture.seasonId,
    });

    // Use team names from live_scores record if available (more accurate, matches goal data)
    // Fall back to fixture team names if not available
    const liveHomeTeam = record.home_team || home_team;
    const liveAwayTeam = record.away_team || away_team;
    const homeTeamId = record.home_team_id;
    const awayTeamId = record.away_team_id;

    // Detect changes
    const scoreWentDown = homeScore < oldHomeScore || awayScore < oldAwayScore;
    const isHalfTime = oldStatus === 'IN_PLAY' && status === 'PAUSED';
    const isFinished = isTerminalMatchStatus(status);
    const wasFinished = isTerminalMatchStatus(oldStatus);
    const isLiveNow = isLiveMatchStatus(status);
    const wasLive = isLiveMatchStatus(oldStatus);
    const kickoffTooOld = isKickoffTooOldForLiveNotifications(kickoff_time);

    // Guard: finished→finished re-upserts (historical API re-poll) must never notify.
    if (isFinished && wasFinished) {
      console.log(
        `[scoreWebhookV2] [${requestId}] Skipping stale finished→finished update for match ${apiMatchId}`
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Skipped stale finished match update' }),
      };
    }

    // Guard: never send live pushes for matches whose kickoff was >24h ago,
    // unless we are still in a genuine live transition (shouldn't happen off-season).
    if (kickoffTooOld && !isLiveNow && !wasLive) {
      console.log(
        `[scoreWebhookV2] [${requestId}] Skipping notifications for stale kickoff match ${apiMatchId} kickoff=${kickoff_time}`
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Skipped stale kickoff match notifications' }),
      };
    }
    
    // Kickoff detection: Simplified using idempotency (doesn't rely on oldStatus)
    // If status is IN_PLAY, attempt to send kickoff notification
    // Idempotency will prevent duplicates (event_id includes half number)
    const isInPlay = status === 'IN_PLAY';
    const shouldCheckKickoff = isInPlay && !kickoffTooOld;

    let totalSent = 0;

    // 1. Handle goal disallowed (score went down)
    if (scoreWentDown) {
      const picksData = await fetchUserIdsWithPicks(fixture);
      const userIds = [...new Set(picksData.map(p => p.userId))];

      if (userIds.length > 0) {
        // Find which goal was disallowed by comparing oldGoals vs new goals
        // A goal was disallowed if it exists in oldGoals but not in new goals
        const normalizeGoalKey = (g: any): string => {
          if (!g || typeof g !== 'object') return '';
          const scorer = (g.scorer || '').toString().trim().toLowerCase();
          const goalMinute = g.minute !== null && g.minute !== undefined ? String(g.minute) : '';
          return `${scorer}|${goalMinute}`;
        };

        const newGoalKeys = new Set(goals.map(normalizeGoalKey));
        const disallowedGoals = oldGoals.filter((g: any) => !newGoalKeys.has(normalizeGoalKey(g)));

        if (disallowedGoals.length > 0) {
          // Use the most recent disallowed goal (highest minute)
          const disallowedGoal = disallowedGoals.sort((a: any, b: any) => (b.minute ?? 0) - (a.minute ?? 0))[0];
          const scorer = disallowedGoal.scorer || 'Unknown';
          const goalMinute = disallowedGoal.minute ?? 0;
          const { isHomeTeam, teamName } = determineScoringTeam(disallowedGoal, liveHomeTeam, liveAwayTeam, homeTeamId, awayTeamId);

          const result = await sendGoalDisallowedNotification(userIds, {
            apiMatchId, fixtureIndex: fixture_index, gw,
            scorer, minute: goalMinute, teamName,
            homeTeam: liveHomeTeam, awayTeam: liveAwayTeam,  // Use team names from live_scores
            homeScore, awayScore,
          });
          totalSent += result.results.accepted;
          console.log(`[scoreWebhookV2] [${requestId}] Goal disallowed ${goalMinute}' (${scorer}): ${result.results.accepted} sent`);
        } else {
          // Fallback if we can't identify the goal (shouldn't happen, but be safe)
          const result = await sendGoalDisallowedNotification(userIds, {
            apiMatchId, fixtureIndex: fixture_index, gw,
            scorer: 'Unknown', minute: minute || 0,
            teamName: homeScore < oldHomeScore ? home_team : away_team,
            homeTeam: home_team, awayTeam: away_team,
            homeScore, awayScore,
          });
          totalSent += result.results.accepted;
          console.log(`[scoreWebhookV2] [${requestId}] Goal disallowed (fallback): ${result.results.accepted} sent`);
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Goal disallowed notification sent', sentTo: totalSent }) };
    }

    // 2. Handle new goals (never for stale historical re-polls)
    if (Array.isArray(goals) && goals.length > 0 && !scoreWentDown && !kickoffTooOld) {
      // Find new goals by comparing to old goals
      const normalizeGoalKey = (g: any): string => {
        if (!g || typeof g !== 'object') return '';
        const scorer = (g.scorer || '').toString().trim().toLowerCase();
        const minute = g.minute !== null && g.minute !== undefined ? String(g.minute) : '';
        return `${scorer}|${minute}`;
      };

      const oldGoalKeys = new Set(oldGoals.map(normalizeGoalKey));
      const newGoals = goals.filter((g: any) => !oldGoalKeys.has(normalizeGoalKey(g)));

      if (newGoals.length > 0) {
        const picksData = await fetchUserIdsWithPicks(fixture, true); // Include picks
        const userIds = [...new Set(picksData.map(p => p.userId))];
        
        // Build user picks map
        const userPicksMap = new Map<string, string>();
        for (const p of picksData) {
          if (p.pick) userPicksMap.set(p.userId, p.pick);
        }

        if (userIds.length > 0) {
          // Send notification for each new goal
          // Sort by minute (oldest first) to maintain chronological order
          const sortedNewGoals = newGoals.sort((a: any, b: any) => (a.minute ?? 0) - (b.minute ?? 0));
          
          // Calculate score from goals array (database score can be stale)
          // Note: For own goals, pollLiveScores already flipped the team before storing,
          // so determineScoringTeam returns the benefiting team (the team that scored)
          let calculatedHomeScore = 0;
          let calculatedAwayScore = 0;
          
          for (const goal of goals) {
            const { isHomeTeam } = determineScoringTeam(goal, liveHomeTeam, liveAwayTeam, homeTeamId, awayTeamId);
            // Note: For own goals, pollLiveScores already flipped the team before storing,
            // so determineScoringTeam returns the benefiting team (the team that scored)
            // Count the goal for the team returned by determineScoringTeam
            if (isHomeTeam) {
              calculatedHomeScore++;
            } else {
              calculatedAwayScore++;
            }
          }
          
          // Use calculated score (more reliable than database score which can be stale)
          const homeScore = calculatedHomeScore;
          const awayScore = calculatedAwayScore;
          
          for (const goal of sortedNewGoals) {
            const scorer = goal.scorer || 'Unknown';
            const goalMinute = goal.minute ?? 0;
            const isOwnGoal = goal.isOwnGoal === true;
            // Note: For own goals, pollLiveScores already flipped the team before storing,
            // so determineScoringTeam returns the benefiting team (the team that scored)
            const { isHomeTeam, teamName } = determineScoringTeam(goal, liveHomeTeam, liveAwayTeam, homeTeamId, awayTeamId);
            
            // Check if we've already sent a notification for this match/minute (scorer-only change suppression)
            const usersWithExisting = await hasGoalNotificationForMinute(apiMatchId, goalMinute, userIds);
            const usersToNotify = userIds.filter(uid => !usersWithExisting.has(uid));
            
            if (usersToNotify.length > 0) {
              const result = await sendGoalNotification(usersToNotify, {
                apiMatchId, fixtureIndex: fixture_index, gw,
                scorer, minute: goalMinute, teamName,
                homeTeam: liveHomeTeam, awayTeam: liveAwayTeam,  // Use team names from live_scores
                homeScore,  // Use calculated score
                awayScore,  // Use calculated score
                isHomeTeam,
                isOwnGoal,
                userPicks: userPicksMap, // Pass user picks map
              });
              
              // Handle both single result and batch result format
              if ('summary' in result) {
                totalSent += result.summary.accepted;
                console.log(`[scoreWebhookV2] [${requestId}] Goal ${goalMinute}' (${scorer}): ${result.summary.accepted} sent (${usersWithExisting.size} suppressed - scorer-only change)`);
              } else {
                totalSent += result.results.accepted;
                console.log(`[scoreWebhookV2] [${requestId}] Goal ${goalMinute}' (${scorer}): ${result.results.accepted} sent (${usersWithExisting.size} suppressed - scorer-only change)`);
              }
            } else {
              console.log(`[scoreWebhookV2] [${requestId}] Goal ${goalMinute}' (${scorer}): All ${userIds.length} users already notified (scorer-only change)`);
            }
          }
        }
      }
    }

    // 3. Handle kickoff (simplified - uses idempotency, doesn't rely on oldStatus)
    if (shouldCheckKickoff) {
      const picksData = await fetchUserIdsWithPicks(fixture);
      const userIds = [...new Set(picksData.map(p => p.userId))];

      if (userIds.length > 0) {
        // Determine which half: check if we've already sent kickoff notifications
        // If oldStatus available, use it for reliability. Otherwise check database.
        let isSecondHalf = false;
        
        if (oldStatus) {
          // Use oldStatus if available (most reliable)
          const wasPaused = oldStatus === 'PAUSED' || oldStatus === 'HALF_TIME';
          isSecondHalf = wasPaused;
        } else {
          // oldStatus missing - check database for existing kickoff notifications
          const existingHalf = await getExistingKickoffHalf(apiMatchId, userIds);
          isSecondHalf = existingHalf >= 1; // If we've sent half 1, this must be half 2
        }
        
        const result = await sendKickoffNotification(userIds, {
          apiMatchId, fixtureIndex: fixture_index, gw,
          homeTeam: home_team, awayTeam: away_team,
          isSecondHalf,
        });
        totalSent += result.results.accepted;
        console.log(`[scoreWebhookV2] [${requestId}] Kickoff (half ${isSecondHalf ? 2 : 1}): ${result.results.accepted} sent`);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Kickoff notification sent', sentTo: totalSent }) };
    }

    // 4. Handle half-time
    if (isHalfTime) {
      const picksData = await fetchUserIdsWithPicks(fixture, true); // Include picks
      const userIds = [...new Set(picksData.map(p => p.userId))];
      
      // Build user picks map
      const userPicksMap = new Map<string, string>();
      for (const p of picksData) {
        if (p.pick) userPicksMap.set(p.userId, p.pick);
      }

      if (userIds.length > 0) {
        const result = await sendHalftimeNotification(userIds, {
          apiMatchId, fixtureIndex: fixture_index, gw,
          homeTeam: home_team, awayTeam: away_team,
          homeScore, awayScore,
          userPicks: userPicksMap, // Pass user picks map
        });
        
        // Handle both single result and batch result format
        if ('summary' in result) {
          totalSent += result.summary.accepted;
          console.log(`[scoreWebhookV2] [${requestId}] Half-time: ${result.summary.accepted} sent`);
        } else {
          totalSent += result.results.accepted;
          console.log(`[scoreWebhookV2] [${requestId}] Half-time: ${result.results.accepted} sent`);
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Half-time notification sent', sentTo: totalSent }) };
    }

    // 5. Handle game finished
    if (isFinished && oldStatus !== 'FINISHED' && oldStatus !== 'FT') {
      const picksData = await fetchUserIdsWithPicks(fixture, true);
      const userIds = [...new Set(picksData.map(p => p.userId))];

      if (userIds.length > 0) {
        // Calculate correct percentage
        let matchResult: string;
        if (homeScore > awayScore) matchResult = 'H';
        else if (awayScore > homeScore) matchResult = 'A';
        else matchResult = 'D';

        const correctCount = picksData.filter(p => p.pick === matchResult).length;
        const correctPercentage = picksData.length > 0 ? Math.round((correctCount / picksData.length) * 100) : 0;

        // Build user picks map
        const userPicks = new Map<string, string>();
        for (const p of picksData) {
          if (p.pick) userPicks.set(p.userId, p.pick);
        }

        const { summary } = await sendFinalWhistleNotification(userIds, {
          apiMatchId, fixtureIndex: fixture_index, gw,
          homeTeam: home_team, awayTeam: away_team,
          homeScore, awayScore, userPicks, correctPercentage,
        });
        totalSent += summary.accepted;
        console.log(`[scoreWebhookV2] [${requestId}] Final whistle: ${summary.accepted} sent`);
      }

      // Write results to legacy and/or season tables; check all-GW finished per stack
      const { allFinishedLegacy, allFinishedSeason } = await finalizeFixtureResultsDualStack(
        supabase,
        fixture,
        {
          api_match_id: apiMatchId,
          home_score: homeScore,
          away_score: awayScore,
          status,
        }
      );

      const completeGwTasks: Promise<void>[] = [];

      if (allFinishedLegacy) {
        completeGwTasks.push(
          (async () => {
            const legacyGw =
              fixture.sources.find((s) => s.stack === 'legacy')?.gw ?? gw;
            console.log(
              `[scoreWebhookV2] [${requestId}] All legacy games finished for GW ${legacyGw}`
            );
            const gwUserIds = await fetchGwPickerUserIds(supabase, 'legacy', legacyGw);
            if (gwUserIds.length > 0) {
              const result = await sendGameweekCompleteNotification(gwUserIds, legacyGw);
              console.log(
                `[scoreWebhookV2] [${requestId}] Gameweek complete (legacy): ${result.results.accepted} sent`
              );
            }
            try {
              const baseUrl =
                process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://playtotl.com';
              const volleyRes = await fetch(
                `${baseUrl}/.netlify/functions/sendVolleyGwCongratulations`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gameweek: legacyGw }),
                }
              );
              const volleyData = await volleyRes.json().catch(() => ({}));
              if (volleyRes.ok && volleyData.ok) {
                console.log(
                  `[scoreWebhookV2] [${requestId}] Volley congratulations sent to ${volleyData.totalLeagues || 0} leagues`
                );
              } else {
                console.warn(
                  `[scoreWebhookV2] [${requestId}] Volley congratulations failed:`,
                  volleyData
                );
              }
            } catch (volleyError) {
              console.error(
                `[scoreWebhookV2] [${requestId}] Error sending Volley congratulations:`,
                volleyError
              );
            }
          })()
        );
      }

      if (allFinishedSeason) {
        completeGwTasks.push(
          (async () => {
            const seasonSrc = fixture.sources.find(
              (s) => s.stack === 'season' && s.seasonId
            );
            const seasonGw = seasonSrc?.gw ?? gw;
            const seasonId = seasonSrc?.seasonId ?? fixture.seasonId;
            console.log(
              `[scoreWebhookV2] [${requestId}] All season games finished for GW ${seasonGw} season=${seasonId}`
            );
            const gwUserIds = await fetchGwPickerUserIds(
              supabase,
              'season',
              seasonGw,
              seasonId
            );
            if (gwUserIds.length > 0) {
              // Same notice type; event_id is season-scoped when seasonId present
              const result = await sendGameweekCompleteNotification(gwUserIds, seasonGw, seasonId);
              console.log(
                `[scoreWebhookV2] [${requestId}] Gameweek complete (season): ${result.results.accepted} sent`
              );
            }
            // Volley for season-stack leagues: same congratulate path with gameweek number
            try {
              const baseUrl =
                process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://playtotl.com';
              const volleyRes = await fetch(
                `${baseUrl}/.netlify/functions/sendVolleyGwCongratulations`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gameweek: seasonGw, seasonId }),
                }
              );
              const volleyData = await volleyRes.json().catch(() => ({}));
              if (volleyRes.ok && (volleyData as any).ok) {
                console.log(
                  `[scoreWebhookV2] [${requestId}] Season Volley congratulations OK`
                );
              }
            } catch (e) {
              console.error(
                `[scoreWebhookV2] [${requestId}] Season Volley error:`,
                e
              );
            }
          })()
        );
      }

      await Promise.all(completeGwTasks);

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Final whistle notification sent', sentTo: totalSent }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ message: 'No notification needed', sentTo: totalSent }) };

  } catch (error: any) {
    console.error('[scoreWebhookV2] Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error?.message }) };
  }
};

