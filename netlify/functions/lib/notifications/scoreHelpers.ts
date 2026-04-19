/**
 * Score Notification Helpers
 * 
 * Helper functions for building score-related notifications.
 * Used by sendScoreNotificationsWebhookV2.
 */

import { dispatchNotification } from './dispatch';
import { formatDeepLink } from './catalog';
import type { BatchDispatchResult } from './types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return supabaseClient;
}

/**
 * Get base URL for building absolute deep link URLs
 */
function getBaseUrl(): string {
  // Try environment variables first
  if (process.env.URL) {
    return process.env.URL.trim();
  }
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.trim();
  }
  if (process.env.DEPLOY_PRIME_URL) {
    return process.env.DEPLOY_PRIME_URL.trim();
  }
  // Default fallback (shouldn't happen in production)
  const defaultUrl = 'https://playtotl.com';
  console.warn(`[scoreHelpers] Base URL using default fallback: ${defaultUrl}`);
  return defaultUrl;
}

/**
 * Normalize a scorer name for event_id
 */
export function normalizeScorer(scorer: string): string {
  return scorer
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30);
}

/**
 * Normalize a goal type for event IDs and diffing.
 */
function normalizeGoalType(goalType: unknown): string {
  const normalized = String(goalType || 'regular')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_');
  return normalized || 'regular';
}

/**
 * Build a stable fingerprint for a goal.
 *
 * This intentionally uses team and scorer identifiers when available so that:
 * - multiple goals in the same minute remain distinct
 * - scorer name normalization/formatting changes are less likely to create duplicates
 */
export function buildGoalFingerprint(goal: {
  minute?: number | null;
  scorer?: string | null;
  scorerId?: number | null;
  team?: string | null;
  teamId?: number | null;
  isOwnGoal?: boolean;
  isPenalty?: boolean;
  type?: string | null;
}): string {
  const minute = goal.minute ?? 0;
  const teamPart = goal.teamId !== undefined && goal.teamId !== null
    ? `teamid_${goal.teamId}`
    : `team_${normalizeScorer(goal.team || 'unknown')}`;
  const scorerPart = goal.scorerId !== undefined && goal.scorerId !== null
    ? `scorerid_${goal.scorerId}`
    : `scorer_${normalizeScorer(goal.scorer || 'unknown')}`;
  const flagsPart = [
    goal.isOwnGoal ? 'og' : 'reg',
    goal.isPenalty ? 'pen' : 'open',
    normalizeGoalType(goal.type),
  ].join('_');

  return `${minute}:${teamPart}:${scorerPart}:${flagsPart}`;
}

/**
 * Return the items in `sourceGoals` that are not present in `comparisonGoals`,
 * comparing goals as a multiset of goal fingerprints.
 */
export function diffGoalsByFingerprint(sourceGoals: any[], comparisonGoals: any[]): any[] {
  const comparisonCounts = new Map<string, number>();

  for (const goal of comparisonGoals) {
    const key = buildGoalFingerprint(goal || {});
    comparisonCounts.set(key, (comparisonCounts.get(key) || 0) + 1);
  }

  const changedGoals: any[] = [];
  for (const goal of sourceGoals) {
    const key = buildGoalFingerprint(goal || {});
    const remaining = comparisonCounts.get(key) || 0;

    if (remaining > 0) {
      comparisonCounts.set(key, remaining - 1);
      continue;
    }

    changedGoals.push(goal);
  }

  return changedGoals;
}

/**
 * Build a goal notification event_id.
 */
export function buildGoalEventId(
  apiMatchId: number,
  goal: {
    minute?: number | null;
    scorer?: string | null;
    scorerId?: number | null;
    team?: string | null;
    teamId?: number | null;
    isOwnGoal?: boolean;
    isPenalty?: boolean;
    type?: string | null;
  }
): string {
  return `goal:${apiMatchId}:${buildGoalFingerprint(goal)}`;
}

/**
 * Build a kickoff notification event_id
 */
export function buildKickoffEventId(apiMatchId: number, half: 1 | 2): string {
  return `kickoff:${apiMatchId}:${half}`;
}

/**
 * Check if a kickoff notification was already sent for a match
 * Returns the highest half number that was sent, or 0 if none
 */
export async function getExistingKickoffHalf(
  apiMatchId: number,
  userIds: string[]
): Promise<number> {
  const supabase = getSupabase();
  // Query notification_send_log for any kickoff notification for this match
  // Event ID format: kickoff:{apiMatchId}:{half}
  const eventIdPrefix = `kickoff:${apiMatchId}:`;
  
  const { data: existing } = await supabase
    .from('notification_send_log')
    .select('event_id')
    .eq('notification_key', 'kickoff')
    .in('user_id', userIds)
    .like('event_id', `${eventIdPrefix}%`)
    .in('result', ['accepted', 'pending'])
    .limit(100);
  
  let maxHalf = 0;
  (existing || []).forEach((entry: any) => {
    if (entry.event_id && entry.event_id.startsWith(eventIdPrefix)) {
      const halfStr = entry.event_id.replace(eventIdPrefix, '');
      const half = parseInt(halfStr, 10);
      if (!isNaN(half) && half > maxHalf) {
        maxHalf = half;
      }
    }
  });
  
  return maxHalf;
}

/**
 * Build a half-time notification event_id
 */
export function buildHalftimeEventId(apiMatchId: number): string {
  return `halftime:${apiMatchId}`;
}

/**
 * Build a final whistle notification event_id
 */
export function buildFinalWhistleEventId(apiMatchId: number): string {
  return `ft:${apiMatchId}`;
}

/**
 * Build a gameweek complete notification event_id
 */
export function buildGameweekCompleteEventId(gw: number): string {
  return `gw_complete:${gw}`;
}

/**
 * Build a goal disallowed notification event_id
 */
export function buildGoalDisallowedEventId(apiMatchId: number, minute: number): string {
  return `goal_disallowed:${apiMatchId}:${minute}`;
}

/**
 * Send a goal notification (personalized with pick indicator)
 */
export async function sendGoalNotification(
  userIds: string[],
  params: {
    apiMatchId: number;
    fixtureIndex: number;
    gw: number;
    scorer: string;
    scorerId?: number | null;
    minute: number;
    teamName: string;
    teamId?: number | null;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    isHomeTeam: boolean;
    isOwnGoal?: boolean;
    isPenalty?: boolean;
    type?: string | null;
    userPicks?: Map<string, string>; // userId -> pick (H/D/A) - optional for backward compatibility
  }
): Promise<BatchDispatchResult | { results: BatchDispatchResult[]; summary: { accepted: number; failed: number } }> {
  const {
    apiMatchId, fixtureIndex, gw, scorer, scorerId, minute,
    teamName, homeTeam, awayTeam, homeScore, awayScore,
    isHomeTeam, isOwnGoal, isPenalty, type, teamId, userPicks,
  } = params;

  const eventId = buildGoalEventId(apiMatchId, {
    minute,
    scorer,
    scorerId,
    team: teamName,
    teamId,
    isOwnGoal,
    isPenalty,
    type,
  });
  
  const scoreDisplay = isHomeTeam
    ? `${homeTeam} [${homeScore}] - ${awayScore} ${awayTeam}`
    : `${homeTeam} ${homeScore} - [${awayScore}] ${awayTeam}`;

  // Build deep link URL from catalog
  const baseUrl = getBaseUrl();
  const deepLinkUrl = formatDeepLink('goal-scored', { api_match_id: apiMatchId }, baseUrl);

  let baseTitle: string;
  let baseBody: string;

  if (isOwnGoal) {
    baseTitle = `Own Goal`;
    baseBody = `${minute}' Own goal by ${scorer}\n${scoreDisplay}`;
  } else {
    baseTitle = `Goal ${teamName}!`;
    baseBody = `${minute}' ${scorer}\n${scoreDisplay}`;
  }

  // If userPicks provided, send personalized notifications with pick indicator
  if (userPicks && userPicks.size > 0) {
    // Determine current result state
    let currentResult: 'H' | 'D' | 'A';
    if (homeScore > awayScore) currentResult = 'H';
    else if (awayScore > homeScore) currentResult = 'A';
    else currentResult = 'D';

    // Group users by whether their pick matches the current result
    const onTrackUsers: string[] = [];
    const offTrackUsers: string[] = [];
    const usersWithoutPicks: string[] = [];

    for (const userId of userIds) {
      const pick = userPicks.get(userId);
      if (!pick) {
        usersWithoutPicks.push(userId);
      } else if (pick === currentResult) {
        onTrackUsers.push(userId);
      } else {
        offTrackUsers.push(userId);
      }
    }

    const results: BatchDispatchResult[] = [];
    let totalAccepted = 0;
    let totalFailed = 0;

    // Send to users whose pick is on track (✅)
    if (onTrackUsers.length > 0) {
      const onTrackResult = await dispatchNotification({
        notification_key: 'goal-scored',
        event_id: `${eventId}:ontrack`,
        user_ids: onTrackUsers,
        title: baseTitle,
        body: `${baseBody} ✅`,
        data: {
          type: 'goal',
          api_match_id: apiMatchId,
          fixture_index: fixtureIndex,
          gw,
        },
        url: deepLinkUrl || undefined,
        grouping_params: { api_match_id: apiMatchId },
      });
      results.push(onTrackResult);
      totalAccepted += onTrackResult.results.accepted;
      totalFailed += onTrackResult.results.failed;
    }

    // Send to users whose pick is off track (❌)
    if (offTrackUsers.length > 0) {
      const offTrackResult = await dispatchNotification({
        notification_key: 'goal-scored',
        event_id: `${eventId}:offtrack`,
        user_ids: offTrackUsers,
        title: baseTitle,
        body: `${baseBody} ❌`,
        data: {
          type: 'goal',
          api_match_id: apiMatchId,
          fixture_index: fixtureIndex,
          gw,
        },
        url: deepLinkUrl || undefined,
        grouping_params: { api_match_id: apiMatchId },
      });
      results.push(offTrackResult);
      totalAccepted += offTrackResult.results.accepted;
      totalFailed += offTrackResult.results.failed;
    }

    // Send to users without picks (no indicator)
    if (usersWithoutPicks.length > 0) {
      const noPickResult = await dispatchNotification({
        notification_key: 'goal-scored',
        event_id: `${eventId}:nopick`,
        user_ids: usersWithoutPicks,
        title: baseTitle,
        body: baseBody,
        data: {
          type: 'goal',
          api_match_id: apiMatchId,
          fixture_index: fixtureIndex,
          gw,
        },
        url: deepLinkUrl || undefined,
        grouping_params: { api_match_id: apiMatchId },
      });
      results.push(noPickResult);
      totalAccepted += noPickResult.results.accepted;
      totalFailed += noPickResult.results.failed;
    }

    return {
      results,
      summary: { accepted: totalAccepted, failed: totalFailed },
    };
  }

  // Fallback: send batch notification (no picks available)
  return dispatchNotification({
    notification_key: 'goal-scored',
    event_id: eventId,
    user_ids: userIds,
    title: baseTitle,
    body: baseBody,
    data: {
      type: 'goal',
      api_match_id: apiMatchId,
      fixture_index: fixtureIndex,
      gw,
    },
    url: deepLinkUrl || undefined,
    grouping_params: { api_match_id: apiMatchId },
  });
}

/**
 * Send a goal disallowed notification
 */
export async function sendGoalDisallowedNotification(
  userIds: string[],
  params: {
    apiMatchId: number;
    fixtureIndex: number;
    gw: number;
    scorer: string;
    minute: number;
    teamName: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }
): Promise<BatchDispatchResult> {
  const {
    apiMatchId, fixtureIndex, gw, scorer, minute,
    teamName, homeTeam, awayTeam, homeScore, awayScore,
  } = params;

  const eventId = buildGoalDisallowedEventId(apiMatchId, minute);
  const scoreDisplay = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;

  // Build deep link URL from catalog
  const baseUrl = getBaseUrl();
  const deepLinkUrl = formatDeepLink('goal-disallowed', { api_match_id: apiMatchId }, baseUrl);

  return dispatchNotification({
    notification_key: 'goal-disallowed',
    event_id: eventId,
    user_ids: userIds,
    title: `Goal Disallowed`,
    body: `${minute}' ${scorer}'s goal for ${teamName} was disallowed\n${scoreDisplay}`,
    data: {
      type: 'goal_disallowed',
      api_match_id: apiMatchId,
      fixture_index: fixtureIndex,
      gw,
    },
    url: deepLinkUrl || undefined,
    grouping_params: { api_match_id: apiMatchId },
  });
}

/**
 * Send a kickoff notification
 */
export async function sendKickoffNotification(
  userIds: string[],
  params: {
    apiMatchId: number;
    fixtureIndex: number;
    gw: number;
    homeTeam: string;
    awayTeam: string;
    isSecondHalf: boolean;
  }
): Promise<BatchDispatchResult> {
  const { apiMatchId, fixtureIndex, gw, homeTeam, awayTeam, isSecondHalf } = params;

  const half = isSecondHalf ? 2 : 1;
  const eventId = buildKickoffEventId(apiMatchId, half);

  // Build deep link URL from catalog
  const baseUrl = getBaseUrl();
  const deepLinkUrl = formatDeepLink('kickoff', { api_match_id: apiMatchId }, baseUrl);

  return dispatchNotification({
    notification_key: 'kickoff',
    event_id: eventId,
    user_ids: userIds,
    title: `${homeTeam} vs ${awayTeam}`,
    body: isSecondHalf ? 'Second half underway' : 'Kickoff!',
    data: {
      type: 'kickoff',
      api_match_id: apiMatchId,
      fixture_index: fixtureIndex,
      gw,
    },
    url: deepLinkUrl || undefined,
    grouping_params: { api_match_id: apiMatchId, half },
  });
}

/**
 * Send a half-time notification (personalized with pick indicator)
 */
export async function sendHalftimeNotification(
  userIds: string[],
  params: {
    apiMatchId: number;
    fixtureIndex: number;
    gw: number;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    userPicks?: Map<string, string>; // userId -> pick (H/D/A) - optional for backward compatibility
  }
): Promise<BatchDispatchResult | { results: BatchDispatchResult[]; summary: { accepted: number; failed: number } }> {
  const { apiMatchId, fixtureIndex, gw, homeTeam, awayTeam, homeScore, awayScore, userPicks } = params;

  const eventId = buildHalftimeEventId(apiMatchId);
  const baseBody = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;

  // Build deep link URL from catalog
  const baseUrl = getBaseUrl();
  const deepLinkUrl = formatDeepLink('half-time', { api_match_id: apiMatchId }, baseUrl);

  // If userPicks provided, send personalized notifications with pick indicator
  if (userPicks && userPicks.size > 0) {
    // Determine current result state at half-time
    let currentResult: 'H' | 'D' | 'A';
    if (homeScore > awayScore) currentResult = 'H';
    else if (awayScore > homeScore) currentResult = 'A';
    else currentResult = 'D';

    // Group users by whether their pick matches the current result
    const onTrackUsers: string[] = [];
    const offTrackUsers: string[] = [];
    const usersWithoutPicks: string[] = [];

    for (const userId of userIds) {
      const pick = userPicks.get(userId);
      if (!pick) {
        usersWithoutPicks.push(userId);
      } else if (pick === currentResult) {
        onTrackUsers.push(userId);
      } else {
        offTrackUsers.push(userId);
      }
    }

    const results: BatchDispatchResult[] = [];
    let totalAccepted = 0;
    let totalFailed = 0;

    // Send to users whose pick is on track (✅)
    if (onTrackUsers.length > 0) {
      const onTrackResult = await dispatchNotification({
        notification_key: 'half-time',
        event_id: `${eventId}:ontrack`,
        user_ids: onTrackUsers,
        title: `Half-Time`,
        body: `${baseBody} ✅`,
        data: {
          type: 'half_time',
          api_match_id: apiMatchId,
          fixture_index: fixtureIndex,
          gw,
        },
        url: deepLinkUrl || undefined,
        grouping_params: { api_match_id: apiMatchId },
        skip_preference_check: true, // Half-time has no preference
      });
      results.push(onTrackResult);
      totalAccepted += onTrackResult.results.accepted;
      totalFailed += onTrackResult.results.failed;
    }

    // Send to users whose pick is off track (❌)
    if (offTrackUsers.length > 0) {
      const offTrackResult = await dispatchNotification({
        notification_key: 'half-time',
        event_id: `${eventId}:offtrack`,
        user_ids: offTrackUsers,
        title: `Half-Time`,
        body: `${baseBody} ❌`,
        data: {
          type: 'half_time',
          api_match_id: apiMatchId,
          fixture_index: fixtureIndex,
          gw,
        },
        url: deepLinkUrl || undefined,
        grouping_params: { api_match_id: apiMatchId },
        skip_preference_check: true, // Half-time has no preference
      });
      results.push(offTrackResult);
      totalAccepted += offTrackResult.results.accepted;
      totalFailed += offTrackResult.results.failed;
    }

    // Send to users without picks (no indicator)
    if (usersWithoutPicks.length > 0) {
      const noPickResult = await dispatchNotification({
        notification_key: 'half-time',
        event_id: `${eventId}:nopick`,
        user_ids: usersWithoutPicks,
        title: `Half-Time`,
        body: baseBody,
        data: {
          type: 'half_time',
          api_match_id: apiMatchId,
          fixture_index: fixtureIndex,
          gw,
        },
        url: deepLinkUrl || undefined,
        grouping_params: { api_match_id: apiMatchId },
        skip_preference_check: true, // Half-time has no preference
      });
      results.push(noPickResult);
      totalAccepted += noPickResult.results.accepted;
      totalFailed += noPickResult.results.failed;
    }

    return {
      results,
      summary: { accepted: totalAccepted, failed: totalFailed },
    };
  }

  // Fallback: send batch notification (no picks available)
  return dispatchNotification({
    notification_key: 'half-time',
    event_id: eventId,
    user_ids: userIds,
    title: `Half-Time`,
    body: baseBody,
    data: {
      type: 'half_time',
      api_match_id: apiMatchId,
      fixture_index: fixtureIndex,
      gw,
    },
    url: deepLinkUrl || undefined,
    grouping_params: { api_match_id: apiMatchId },
    skip_preference_check: true, // Half-time has no preference
  });
}

/**
 * Send a final whistle notification (personalized per user)
 */
export async function sendFinalWhistleNotification(
  userIds: string[],
  params: {
    apiMatchId: number;
    fixtureIndex: number;
    gw: number;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    userPicks: Map<string, string>; // userId -> pick (H/D/A)
    correctPercentage: number;
  }
): Promise<{ results: BatchDispatchResult[]; summary: { accepted: number; failed: number } }> {
  const {
    apiMatchId, fixtureIndex, gw, homeTeam, awayTeam,
    homeScore, awayScore, userPicks, correctPercentage,
  } = params;

  const eventId = buildFinalWhistleEventId(apiMatchId);
  const title = `FT: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;

  // Build deep link URL from catalog
  const baseUrl = getBaseUrl();
  const deepLinkUrl = formatDeepLink('final-whistle', { api_match_id: apiMatchId }, baseUrl);

  // Determine match result
  let result: string;
  if (homeScore > awayScore) result = 'H';
  else if (awayScore > homeScore) result = 'A';
  else result = 'D';

  const percentageText = correctPercentage <= 20
    ? `Only ${correctPercentage}% of players got this fixture correct`
    : `${correctPercentage}% of players got this fixture correct`;

  // Group users by whether they got it right
  const correctUsers: string[] = [];
  const wrongUsers: string[] = [];

  for (const userId of userIds) {
    const pick = userPicks.get(userId);
    if (pick === result) {
      correctUsers.push(userId);
    } else {
      wrongUsers.push(userId);
    }
  }

  const results: BatchDispatchResult[] = [];
  let totalAccepted = 0;
  let totalFailed = 0;

  // Send to correct users
  if (correctUsers.length > 0) {
    const correctResult = await dispatchNotification({
      notification_key: 'final-whistle',
      event_id: `${eventId}:correct`,
      user_ids: correctUsers,
      title,
      body: `✅ Got it right! ${percentageText}`,
      data: {
        type: 'game_finished',
        api_match_id: apiMatchId,
        fixture_index: fixtureIndex,
        gw,
      },
      url: deepLinkUrl || undefined,
      grouping_params: { api_match_id: apiMatchId },
    });
    results.push(correctResult);
    totalAccepted += correctResult.results.accepted;
    totalFailed += correctResult.results.failed;
  }

  // Send to wrong users
  if (wrongUsers.length > 0) {
    const wrongResult = await dispatchNotification({
      notification_key: 'final-whistle',
      event_id: `${eventId}:wrong`,
      user_ids: wrongUsers,
      title,
      body: `❌ Wrong pick ${percentageText}`,
      data: {
        type: 'game_finished',
        api_match_id: apiMatchId,
        fixture_index: fixtureIndex,
        gw,
      },
      url: deepLinkUrl || undefined,
      grouping_params: { api_match_id: apiMatchId },
    });
    results.push(wrongResult);
    totalAccepted += wrongResult.results.accepted;
    totalFailed += wrongResult.results.failed;
  }

  return {
    results,
    summary: { accepted: totalAccepted, failed: totalFailed },
  };
}

/**
 * Send a gameweek complete notification
 */
export async function sendGameweekCompleteNotification(
  userIds: string[],
  gw: number
): Promise<BatchDispatchResult> {
  const eventId = buildGameweekCompleteEventId(gw);

  // Build deep link URL from catalog
  const baseUrl = getBaseUrl();
  const deepLinkUrl = formatDeepLink('gameweek-complete', { gw }, baseUrl);

  return dispatchNotification({
    notification_key: 'gameweek-complete',
    event_id: eventId,
    user_ids: userIds,
    title: `Gameweek ${gw} Complete!`,
    body: `All games finished. Check your results!`,
    data: {
      type: 'gameweek_finished',
      gw,
    },
    url: deepLinkUrl || undefined,
    grouping_params: { gw },
    badge_count: 1,
  });
}

