import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed, shouldSendNotification, loadUserNotificationPreferences } from './utils/notificationHelpers';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function sendOneSignalNotification(
  playerIds: string[],
  title: string,
  message: string,
  data: Record<string, any> = {}
): Promise<{ success: boolean; sentTo: number; error?: string }> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('[sendScoreNotificationsWebhook] OneSignal credentials not configured');
    return { success: false, sentTo: 0, error: 'OneSignal not configured' };
  }

  if (!playerIds || playerIds.length === 0) {
    return { success: false, sentTo: 0, error: 'No player IDs provided' };
  }

  // Filter to only subscribed players (technical check only - preferences checked at call site)
  const subscribedPlayerIds: string[] = [];
  for (const playerId of playerIds) {
    const { subscribed } = await isSubscribed(playerId, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);
    if (subscribed) {
      subscribedPlayerIds.push(playerId);
    }
  }

  if (subscribedPlayerIds.length === 0) {
    console.log('[sendScoreNotificationsWebhook] No subscribed players found');
    return { success: true, sentTo: 0 };
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: subscribedPlayerIds,
    headings: { en: title },
    contents: { en: message },
    data,
  };

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sendScoreNotificationsWebhook] OneSignal API error:', errorText);
      return { success: false, sentTo: 0, error: errorText };
    }

    const result = await response.json();
    console.log(`[sendScoreNotificationsWebhook] Sent notification to ${subscribedPlayerIds.length} players:`, result);
    return { success: true, sentTo: subscribedPlayerIds.length };
  } catch (error: any) {
    console.error('[sendScoreNotificationsWebhook] Error sending notification:', error);
    return { success: false, sentTo: 0, error: error?.message };
  }
}

function formatMinuteDisplay(status: string | null, minute: number | null): string {
  if (!status || status === 'FINISHED' || status === 'FT') {
    return 'FT';
  }
  if (status === 'IN_PLAY' && minute !== null && minute !== undefined) {
    return `${minute}'`;
  }
  if (status === 'PAUSED' && minute !== null && minute !== undefined) {
    return `HT ${minute}'`;
  }
  return '';
}

// Helper: Fetch picks for a fixture (handles app_picks, test_api_picks, or picks)
async function fetchFixturePicks(
  fixtureGw: number,
  fixtureIndex: number,
  isAppFixture: boolean,
  isTestFixture: boolean,
  testGwForPicks: number | null,
  includePick: boolean = true
): Promise<any[]> {
  const selectFields = includePick ? 'user_id, pick' : 'user_id';
  
  if (isAppFixture) {
    const { data } = await supabase
      .from('app_picks')
      .select(selectFields)
      .eq('gw', fixtureGw)
      .eq('fixture_index', fixtureIndex);
    return data || [];
  } else if (isTestFixture && testGwForPicks) {
    const { data } = await supabase
      .from('test_api_picks')
      .select(selectFields)
      .eq('matchday', testGwForPicks)
      .eq('fixture_index', fixtureIndex);
    return data || [];
  } else {
    const { data } = await supabase
      .from('picks')
      .select(selectFields)
      .eq('gw', fixtureGw)
      .eq('fixture_index', fixtureIndex);
    return data || [];
  }
}

// Helper: Get subscriptions and build playerIdsByUser map
async function getSubscriptionsAndPlayerIds(userIds: string[]): Promise<Map<string, string[]>> {
  const playerIdsByUser = new Map<string, string[]>();
  
  if (userIds.length === 0) return playerIdsByUser;
  
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('user_id, player_id')
    .in('user_id', userIds)
    .eq('is_active', true);
  
  (subscriptions || []).forEach((sub: any) => {
    if (!sub.player_id) return;
    if (!playerIdsByUser.has(sub.user_id)) {
      playerIdsByUser.set(sub.user_id, []);
    }
    playerIdsByUser.get(sub.user_id)!.push(sub.player_id);
  });
  
  return playerIdsByUser;
}

// Helper: Calculate score from goals array (source of truth)
function calculateScoreFromGoals(
  goals: any[],
  homeTeamName: string,
  awayTeamName: string
): { homeScore: number; awayScore: number } {
  const normalizedHome = homeTeamName.toLowerCase().trim();
  const normalizedAway = awayTeamName.toLowerCase().trim();
  
  let homeScore = 0;
  let awayScore = 0;
  
  for (const goal of goals) {
    if (!goal || typeof goal !== 'object') continue;
    const goalTeam = (goal.team || '').toLowerCase().trim();
    
    const isHomeGoal = goalTeam === normalizedHome ||
                      goalTeam.includes(normalizedHome) ||
                      normalizedHome.includes(goalTeam);
    
    if (isHomeGoal) {
      homeScore++;
    } else {
      awayScore++;
    }
  }
  
  return { homeScore, awayScore };
}

// Helper: Determine which team scored from goal object
function determineScoringTeam(
  goal: any,
  homeTeamName: string,
  awayTeamName: string
): { isHomeTeam: boolean; teamName: string } {
  const scoringTeam = (goal.team || '').toLowerCase().trim();
  const normalizedHome = homeTeamName.toLowerCase().trim();
  const normalizedAway = awayTeamName.toLowerCase().trim();
  
  const isHomeTeam = scoringTeam === normalizedHome ||
                     scoringTeam.includes(normalizedHome) ||
                     normalizedHome.includes(scoringTeam);
  
  return {
    isHomeTeam,
    teamName: isHomeTeam ? homeTeamName : awayTeamName,
  };
}

// Helper: Send notifications to users with picks
async function sendNotificationsToUsers(
  picks: any[],
  playerIdsByUser: Map<string, string[]>,
  prefsMap: Map<string, Record<string, boolean>>,
  title: string,
  message: string,
  data: Record<string, any>,
  requestId: string,
  preferenceKey?: string // Optional preference key to check (e.g., 'score-updates')
): Promise<number> {
  let totalSent = 0;
  
  for (const pick of picks) {
    const playerIds = playerIdsByUser.get(pick.user_id) || [];
    if (playerIds.length === 0) continue;

    // Check user preferences if preference key provided
    if (preferenceKey) {
      const userPrefs = prefsMap.get(pick.user_id);
      if (userPrefs && userPrefs[preferenceKey] === false) {
        continue;
      }
    }

    const result = await sendOneSignalNotification(playerIds, title, message, data);

    if (result.success) {
      totalSent += result.sentTo;
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] Sent notification to user ${pick.user_id} (${result.sentTo} devices)`);
    }
  }
  
  return totalSent;
}

/**
 * Webhook handler for instant notifications when live_scores is updated
 * This is called by Supabase database webhook when a row in live_scores is updated
 */
export const handler: Handler = async (event, context) => {
  // CORS headers for webhook
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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse webhook payload from Supabase
    const webhookPayload = JSON.parse(event.body || '{}');
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[sendScoreNotificationsWebhook] [${requestId}] Webhook received:`, {
      type: webhookPayload.type,
      table: webhookPayload.table,
      api_match_id: webhookPayload.record?.api_match_id || webhookPayload.new?.api_match_id,
      hasOldRecord: !!webhookPayload.old_record || !!webhookPayload.old,
      timestamp: new Date().toISOString(),
    });

    // Supabase webhook format can vary:
    // Format 1: { type: 'UPDATE', table: 'live_scores', record: {...}, old_record: {...} }
    // Format 2: Direct record update: { api_match_id: ..., home_score: ..., ... }
    // Format 3: pg_net format: { new: {...}, old: {...} }
    let record: any = null;
    let old_record: any = null;
    let table: string | null = null;

    if (webhookPayload.record && webhookPayload.table) {
      // Format 1: Standard Supabase webhook
      record = webhookPayload.record;
      old_record = webhookPayload.old_record;
      table = webhookPayload.table;
    } else if (webhookPayload.new) {
      // Format 3: pg_net format
      record = webhookPayload.new;
      old_record = webhookPayload.old;
      table = 'live_scores'; // Assume live_scores if not specified
    } else if (webhookPayload.api_match_id) {
      // Format 2: Direct record
      record = webhookPayload;
      old_record = {}; // No old record available
      table = 'live_scores';
    }

    if (table !== 'live_scores' || !record) {
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] Ignoring webhook - not a live_scores update`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Ignored - not a live_scores update' }),
      };
    }
    
    const apiMatchId = record.api_match_id;
    console.log(`[sendScoreNotificationsWebhook] [${requestId}] Processing match ${apiMatchId}`);

    const homeScore = record.home_score ?? 0;
    const awayScore = record.away_score ?? 0;
    const status = record.status;
    const minute = record.minute;
    const goals = record.goals || [];
    const redCards = record.red_cards || [];

    // If old_record is missing, try to fetch previous state from database
    let oldHomeScore = old_record?.home_score ?? 0;
    let oldAwayScore = old_record?.away_score ?? 0;
    let oldStatus = old_record?.status;
    let oldGoals = old_record?.goals || [];
    
    // Note: We don't need complex oldStatus detection for kickoff anymore
    // Kickoff is simply: status is IN_PLAY with 0-0 score, and we haven't notified yet
    // The oldStatus is only used for goal detection (score changes), not kickoff

    // Check if goals array changed (compare JSON strings to detect any changes)
    const goalsChanged = JSON.stringify(goals || []) !== JSON.stringify(oldGoals || []);

    // Check if this is a score change (for goal notifications)
    const isScoreChange = homeScore !== oldHomeScore || awayScore !== oldAwayScore;
    const isStatusChange = status !== oldStatus;
    // Half-time is detected when status changes from IN_PLAY to PAUSED
    // This happens regardless of minute (could be 45', 45+1', 45+4', etc. due to injury time)
    // We rely on the API to set PAUSED status, not minute-based detection
    const isHalfTime = oldStatus === 'IN_PLAY' && status === 'PAUSED';
    const isFinished = status === 'FINISHED' || status === 'FT';

    console.log(`[sendScoreNotificationsWebhook] [${requestId}] Change detection:`, {
      scoreChange: isScoreChange,
      goalsChanged,
      homeScore: `${oldHomeScore} -> ${homeScore}`,
      awayScore: `${oldAwayScore} -> ${awayScore}`,
      status: `${oldStatus || 'null'} -> ${status}`,
      isHalfTime,
      isFinished,
      currentGoalsCount: Array.isArray(goals) ? goals.length : 0,
      oldGoalsCount: Array.isArray(oldGoals) ? oldGoals.length : 0,
      hasOldRecord: !!old_record,
    });

    // Get fixture info - check regular fixtures, test_api_fixtures, and app_fixtures
    const [regularFixture, testFixture, appFixture] = await Promise.all([
      supabase
        .from('fixtures')
        .select('fixture_index, gw, home_team, away_team')
        .eq('api_match_id', apiMatchId)
        .maybeSingle(),
      supabase
        .from('test_api_fixtures')
        .select('fixture_index, test_gw, home_team, away_team')
        .eq('api_match_id', apiMatchId)
        .maybeSingle(),
      supabase
        .from('app_fixtures')
        .select('fixture_index, gw, home_team, away_team')
        .eq('api_match_id', apiMatchId)
        .maybeSingle(),
    ]);

    const fixture = regularFixture.data || testFixture.data || appFixture.data;
    
    if (!fixture) {
      console.log(`[sendScoreNotificationsWebhook] No fixture found for api_match_id ${apiMatchId}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'No fixture found' }),
      };
    }
    
    // Get current GW
    const { data: gwMeta } = await supabase
      .from('gw_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();
    const currentGw = gwMeta?.current_gw || 1;

    // Normalize fixture data (test fixtures use test_gw, regular use gw)
    const fixtureGw = (fixture as any).gw || (fixture as any).test_gw || currentGw;
    const fixtureTestGw = (fixture as any).test_gw; // Get actual test_gw from fixture (should be 1 for GW T1)
    
    const normalizedFixture = {
      fixture_index: fixture.fixture_index,
      gw: fixtureGw,
      test_gw: fixtureTestGw, // Include test_gw in normalized fixture
      home_team: fixture.home_team || record.home_team,
      away_team: fixture.away_team || record.away_team,
    };

    // Determine if this is a test fixture or app fixture
    const isTestFixture = !!testFixture.data;
    const isAppFixture = !!appFixture.data;
    
    // Use fixture's actual test_gw (prioritize test_gw = 1) for querying picks
    const testGwForPicks = fixtureTestGw || (isTestFixture ? 1 : null);

    // Get notification state - fetch fresh from database
    const { data: state } = await supabase
      .from('notification_state')
      .select('*')
      .eq('api_match_id', apiMatchId)
      .maybeSingle();

    // EARLY CHECK: If goals exist and we've already notified for them recently, skip immediately
    // This prevents race conditions where two webhook calls read the same state
    if (Array.isArray(goals) && goals.length > 0 && state?.last_notified_goals && Array.isArray(state.last_notified_goals)) {
      const normalizeGoalKey = (g: any): string => {
        if (!g || typeof g !== 'object') return '';
        const scorer = (g.scorer || '').toString().trim().toLowerCase();
        const minute = g.minute !== null && g.minute !== undefined ? String(g.minute) : '';
        const teamId = g.teamId !== null && g.teamId !== undefined ? String(g.teamId) : '';
        return `${scorer}|${minute}|${teamId}`;
      };
      
      const currentGoalsHash = JSON.stringify(goals.map(normalizeGoalKey).sort());
      const previousGoalsHash = JSON.stringify(state.last_notified_goals.map(normalizeGoalKey).sort());
      
      if (currentGoalsHash === previousGoalsHash && state.last_notified_at) {
        const lastNotifiedTime = new Date(state.last_notified_at).getTime();
        const now = Date.now();
        const oneMinute = 60 * 1000;
        // If we notified for these exact goals in the last minute, skip immediately
        if (now - lastNotifiedTime < oneMinute) {
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 EARLY SKIP - already notified for these goals within last minute`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Already notified (early check)' }),
          };
        }
      }
    }

    console.log(`[sendScoreNotificationsWebhook] [${requestId}] Processing match ${apiMatchId}:`, {
      scoreChange: isScoreChange,
      goalsChanged,
      homeScore: `${oldHomeScore} -> ${homeScore}`,
      awayScore: `${oldAwayScore} -> ${awayScore}`,
      goalsCount: Array.isArray(goals) ? goals.length : 0,
      previousGoalsCount: state?.last_notified_goals ? (Array.isArray(state.last_notified_goals) ? state.last_notified_goals.length : 0) : 0,
      oldGoalsCount: Array.isArray(oldGoals) ? oldGoals.length : 0,
      hasGoals: Array.isArray(goals) && goals.length > 0,
    });

    // FIRST: Check if score went DOWN (VAR disallowed goal) - handle this BEFORE processing new goals
    // This prevents sending "goal scored" when VAR disallows
    const scoreWentDown = homeScore < (oldHomeScore || 0) || awayScore < (oldAwayScore || 0);
    if (scoreWentDown) {
      // Score went DOWN - this is a goal disallowed by VAR
      // Determine which team had goal disallowed
      const homeScoreDecreased = homeScore < (oldHomeScore || 0);
      const awayScoreDecreased = awayScore < (oldAwayScore || 0);
      const isHomeTeamDisallowed = homeScoreDecreased && !awayScoreDecreased;
      const isAwayTeamDisallowed = awayScoreDecreased && !homeScoreDecreased;
      
      // Try to find the disallowed goal - check if it's still in goals array or was removed
      let disallowedScorer = 'Unknown';
      let disallowedMinute = '';
      
      // First, check if goal is still in current goals array (API might not remove it immediately)
      if (Array.isArray(goals) && goals.length > 0) {
        // Find goal that matches the team whose score decreased
        const disallowedGoal = goals.find((g: any) => {
          if (!g || typeof g !== 'object') return false;
          // Try to match by teamId or team name
          const goalTeamId = g.teamId;
          const scoringTeam = (g.team || '').toLowerCase().trim();
          const homeTeam = (normalizedFixture.home_team || '').toLowerCase().trim();
          const awayTeam = (normalizedFixture.away_team || '').toLowerCase().trim();
          
          if (isHomeTeamDisallowed) {
            return scoringTeam === homeTeam || scoringTeam.includes(homeTeam) || homeTeam.includes(scoringTeam);
          } else if (isAwayTeamDisallowed) {
            return scoringTeam === awayTeam || scoringTeam.includes(awayTeam) || awayTeam.includes(scoringTeam);
          }
          return false;
        });
        
        if (disallowedGoal) {
          disallowedScorer = disallowedGoal.scorer || 'Unknown';
          disallowedMinute = disallowedGoal.minute !== null && disallowedGoal.minute !== undefined ? `${disallowedGoal.minute}'` : '';
        }
      }
      
      // If not found in current goals, check old goals array
      if (disallowedScorer === 'Unknown' && Array.isArray(oldGoals) && oldGoals.length > 0) {
        // Find the goal that was removed - compare old goals to current goals
        const currentGoalKeys = new Set((goals || []).map((g: any) => {
          if (!g || typeof g !== 'object') return '';
          return `${(g.scorer || '').toString().trim().toLowerCase()}|${g.minute !== null && g.minute !== undefined ? String(g.minute) : ''}|${g.teamId !== null && g.teamId !== undefined ? String(g.teamId) : ''}`;
        }));
        
        const removedGoal = oldGoals.find((g: any) => {
          if (!g || typeof g !== 'object') return false;
          const key = `${(g.scorer || '').toString().trim().toLowerCase()}|${g.minute !== null && g.minute !== undefined ? String(g.minute) : ''}|${g.teamId !== null && g.teamId !== undefined ? String(g.teamId) : ''}`;
          return !currentGoalKeys.has(key);
        });
        
        if (removedGoal) {
          disallowedScorer = removedGoal.scorer || 'Unknown';
          disallowedMinute = removedGoal.minute !== null && removedGoal.minute !== undefined ? `${removedGoal.minute}'` : '';
        } else if (oldGoals.length > 0) {
          // Fallback: use the most recent goal from old goals
          const sortedOldGoals = [...oldGoals].sort((a: any, b: any) => (b.minute ?? 0) - (a.minute ?? 0));
          const latestOldGoal = sortedOldGoals[0];
          disallowedScorer = latestOldGoal.scorer || 'Unknown';
          disallowedMinute = latestOldGoal.minute !== null && latestOldGoal.minute !== undefined ? `${latestOldGoal.minute}'` : '';
        }
      }
      
      // Get users who have picks for this fixture
      const picks = await fetchFixturePicks(
        fixtureGw,
        normalizedFixture.fixture_index,
        isAppFixture,
        isTestFixture,
        testGwForPicks
      );

      if (picks.length > 0) {
        const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
        const playerIdsByUser = await getSubscriptionsAndPlayerIds(userIds);

        // Send goal disallowed notification
        const teamName = isHomeTeamDisallowed ? normalizedFixture.home_team : normalizedFixture.away_team;
        const scoreDisplay = `${normalizedFixture.home_team} ${homeScore}-${awayScore} ${normalizedFixture.away_team}`;
        const title = `🚫 Goal Disallowed`;
        const message = `${disallowedMinute} ${disallowedScorer}'s goal for ${teamName} was disallowed by VAR\n${scoreDisplay}`;

        const totalSent = await sendNotificationsToUsers(
          picks,
          playerIdsByUser,
          new Map(), // No preference check for goal disallowed
          title,
          message,
          {
            type: 'goal_disallowed',
            api_match_id: apiMatchId,
            fixture_index: normalizedFixture.fixture_index,
            gw: fixtureGw,
          },
          requestId
        );

        // Update state
        await supabase
          .from('notification_state')
          .upsert({
            api_match_id: apiMatchId,
            last_notified_home_score: homeScore,
            last_notified_away_score: awayScore,
            last_notified_status: status,
            last_notified_at: new Date().toISOString(),
            last_notified_goals: goals || [],
            last_notified_red_cards: redCards || null,
          } as any, {
            onConflict: 'api_match_id',
          });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: 'Goal disallowed notification sent',
            sentTo: totalSent,
          }),
        };
      }
    }

    // Process goals - ALWAYS check for new goals if goals exist, regardless of score change or status
    // This handles cases where webhook fires after goal is already in database
    // We compare against state.last_notified_goals (what we've already notified), not old_record.goals
    // NOTE: Skip if score went down (handled above)
    // IMPORTANT: Process goals BEFORE half-time check, even if status is PAUSED, to catch goals scored at half-time
    if (Array.isArray(goals) && goals.length > 0 && !scoreWentDown) {
      // Always check for new goals compared to what we've notified about
      const normalizeGoalKey = (g: any): string => {
        if (!g || typeof g !== 'object') return '';
        const scorer = (g.scorer || '').toString().trim().toLowerCase();
        const minute = g.minute !== null && g.minute !== undefined ? String(g.minute) : '';
        const teamId = g.teamId !== null && g.teamId !== undefined ? String(g.teamId) : '';
        return `${scorer}|${minute}|${teamId}`;
      };

      const currentGoalsHash = JSON.stringify(goals.map(normalizeGoalKey).sort());
      
      // Compare against old_record FIRST to catch goals that were just added
      // Then check state to see if we've already notified
      // This ensures we detect new goals even if state was updated by a concurrent webhook
      let previousGoals = oldGoals || [];
      
      // If old_record has fewer goals than current, definitely use old_record (new goal was added)
      // Otherwise, check state to see if we've already notified for these goals
      if (Array.isArray(oldGoals) && oldGoals.length >= goals.length && state?.last_notified_goals && Array.isArray(state.last_notified_goals)) {
        // old_record has same or more goals, so check state to see if we've notified
        previousGoals = state.last_notified_goals;
      }
      
      // Fallback: if no old_record and no state, use empty array
      if (!previousGoals || !Array.isArray(previousGoals) || previousGoals.length === 0) {
        previousGoals = [];
      }
      const previousGoalsArray = Array.isArray(previousGoals) ? previousGoals : [];
      const previousGoalsHash = JSON.stringify(previousGoalsArray.map(normalizeGoalKey).sort());
      
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] Goal hash comparison:`, {
        currentHash: currentGoalsHash.substring(0, 100),
        previousHash: previousGoalsHash.substring(0, 100),
        hashMatch: currentGoalsHash === previousGoalsHash,
        currentGoalsCount: goals.length,
        previousGoalsCount: previousGoalsArray.length,
      });

      // Skip if we've already notified for these exact goals (within last 2 minutes)
      if (previousGoalsHash === currentGoalsHash && state?.last_notified_at) {
        const lastNotifiedTime = new Date(state.last_notified_at).getTime();
        const now = Date.now();
        const twoMinutes = 2 * 60 * 1000;
        if (now - lastNotifiedTime < twoMinutes) {
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 SKIPPING - already notified for these goals`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Already notified' }),
          };
        }
      }

      // Find new goals
      const previousGoalKeys = new Set(previousGoalsArray.map(normalizeGoalKey));
      const newGoals = goals.filter((g: any) => {
        if (!g || typeof g !== 'object') return false;
        const key = normalizeGoalKey(g);
        const isNew = !previousGoalKeys.has(key);
        if (isNew) {
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] ✅ NEW GOAL DETECTED:`, {
            scorer: g.scorer,
            minute: g.minute,
            teamId: g.teamId,
            key,
          });
        }
        return isNew;
      });

      console.log(`[sendScoreNotificationsWebhook] [${requestId}] Goal comparison:`, {
        currentGoals: goals.map((g: any) => `${g.scorer} ${g.minute}'`),
        previousGoals: previousGoalsArray.map((g: any) => `${g.scorer} ${g.minute}'`),
        newGoalsCount: newGoals.length,
      });

      // Check if this is a goal reallocation (same score, same number of goals, just scorer changed)
      // This happens when a goal is reattributed (e.g., changed to own goal) - we should update the app
      // but NOT send a notification as it's confusing
      let isGoalReallocation = false;
      if (!isScoreChange && newGoals.length > 0 && goals.length === previousGoalsArray.length && goals.length > 0) {
        // Create a hash based on minute + teamId (ignoring scorer) to detect reallocation
        const normalizeGoalByMinuteAndTeam = (g: any): string => {
          if (!g || typeof g !== 'object') return '';
          const minute = g.minute !== null && g.minute !== undefined ? String(g.minute) : '';
          const teamId = g.teamId !== null && g.teamId !== undefined ? String(g.teamId) : '';
          return `${minute}|${teamId}`;
        };
        
        const currentGoalsByMinuteTeam = new Set(goals.map(normalizeGoalByMinuteAndTeam));
        const previousGoalsByMinuteTeam = new Set(previousGoalsArray.map(normalizeGoalByMinuteAndTeam));
        
        // If the minute+team combinations match, this is a reallocation
        const minuteTeamMatch = currentGoalsByMinuteTeam.size === previousGoalsByMinuteTeam.size &&
                                 [...currentGoalsByMinuteTeam].every(key => previousGoalsByMinuteTeam.has(key));
        
        if (minuteTeamMatch) {
          isGoalReallocation = true;
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔄 GOAL REALLOCATION DETECTED - skipping notification (score unchanged, scorer updated)`);
          // Update state with new goal data (so app shows correct scorer) but don't send notification
          await supabase
            .from('notification_state')
            .upsert({
              api_match_id: apiMatchId,
              last_notified_home_score: homeScore,
              last_notified_away_score: awayScore,
              last_notified_status: status,
              last_notified_at: new Date().toISOString(),
              last_notified_goals: goals,
              last_notified_red_cards: redCards || null,
            } as any, {
              onConflict: 'api_match_id',
            });
          // Don't return here - continue to check for FT/GW finished
        }
      }

      if (newGoals.length === 0) {
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 SKIPPING - no new goals detected`, {
          currentGoalsCount: goals.length,
          previousGoalsCount: previousGoalsArray.length,
          currentGoals: goals.map((g: any) => `${g.scorer} ${g.minute}'`),
          previousGoals: previousGoalsArray.map((g: any) => `${g.scorer} ${g.minute}'`),
        });
        // Update state but don't send goal notification
        // Continue to check for FT/GW finished below
        await supabase
          .from('notification_state')
          .upsert({
            api_match_id: apiMatchId,
            last_notified_home_score: homeScore,
            last_notified_away_score: awayScore,
            last_notified_status: status,
            last_notified_at: new Date().toISOString(),
            last_notified_goals: goals,
            last_notified_red_cards: redCards || null,
          } as any, {
            onConflict: 'api_match_id',
          });
        // Don't return here - continue to check for FT/GW finished
      } else if (isGoalReallocation) {
        // Goal reallocation already handled above (state updated, notification skipped)
        // Continue to check for FT/GW finished below
      } else {
        // CRITICAL: Use atomic "claim" operation to prevent duplicate notifications
        // Try to update state ONLY if it hasn't been updated in the last 10 seconds for these exact goals
        // This ensures only ONE webhook call can "claim" the notification
        const currentGoalsHash = JSON.stringify(goals.map(normalizeGoalKey).sort());
        const now = new Date().toISOString();
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
        
        // First, try to update state atomically - only if goals hash doesn't match OR last_notified_at is old
        // This is a "claim" operation: only one call can successfully update if state is stale
        const { data: updatedState, error: stateError } = await supabase
          .from('notification_state')
          .upsert({
            api_match_id: apiMatchId,
            last_notified_home_score: homeScore,
            last_notified_away_score: awayScore,
            last_notified_status: status,
            last_notified_at: now,
            last_notified_goals: goals,
            last_notified_red_cards: redCards || null,
          } as any, {
            onConflict: 'api_match_id',
          })
          .select()
          .single();

        // After update, check if another process already claimed this notification
        // Re-fetch state to see what actually got stored
        const { data: finalState } = await supabase
          .from('notification_state')
          .select('*')
          .eq('api_match_id', apiMatchId)
          .maybeSingle();

        if (finalState && Array.isArray(finalState.last_notified_goals)) {
          const storedGoalsHash = JSON.stringify(finalState.last_notified_goals.map(normalizeGoalKey).sort());
          const storedTime = new Date(finalState.last_notified_at).getTime();
          const currentTime = Date.now();
          
          // If stored goals match AND were updated very recently (within 2 seconds), another process claimed it
          if (storedGoalsHash === currentGoalsHash && (currentTime - storedTime) < 2000) {
            // Check if we're the one who updated it (compare timestamps)
            const ourUpdateTime = new Date(now).getTime();
            const timeDiff = Math.abs(storedTime - ourUpdateTime);
            
            // If the stored time is significantly different from ours, another process updated it
            if (timeDiff > 1000) {
              console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 SKIPPING - another process claimed this notification (time diff: ${timeDiff}ms)`);
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Already claimed by another process' }),
              };
            }
          }
        }

        if (stateError) {
          console.error(`[sendScoreNotificationsWebhook] [${requestId}] Error updating state:`, stateError);
        } else {
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] ✅ Successfully claimed notification for match ${apiMatchId}`);
        }

      // Get users who have picks for this fixture
      const picks = await fetchFixturePicks(
        fixtureGw,
        normalizedFixture.fixture_index,
        isAppFixture,
        isTestFixture,
        testGwForPicks
      );

      if (picks.length === 0) {
        console.log(`[sendScoreNotificationsWebhook] No picks found for fixture ${normalizedFixture.fixture_index}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'No picks found' }),
        };
      }

      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      const prefsMap = await loadUserNotificationPreferences(userIds);
      const playerIdsByUser = await getSubscriptionsAndPlayerIds(userIds);

      // Get newest goal details
      const newestGoal = newGoals.sort((a: any, b: any) => (b.minute ?? 0) - (a.minute ?? 0))[0];
      const scorer = newestGoal.scorer || 'Unknown';
      const goalMinute = newestGoal.minute !== null && newestGoal.minute !== undefined ? `${newestGoal.minute}'` : '';
      const isOwnGoal = newestGoal.isOwnGoal === true;
      
      // Determine which team scored from goal object (most reliable)
      const { isHomeTeam, teamName } = determineScoringTeam(
        newestGoal,
        normalizedFixture.home_team,
        normalizedFixture.away_team
      );
      
      // Check if goal was disallowed (score went down)
      const isGoalDisallowed = homeScore < (oldHomeScore || 0) || awayScore < (oldAwayScore || 0);
      
      // Calculate score from goals array (source of truth)
      const { homeScore: actualHomeScore, awayScore: actualAwayScore } = calculateScoreFromGoals(
        goals,
        normalizedFixture.home_team,
        normalizedFixture.away_team
      );
      
      // Format score display
      const scoreDisplay = isHomeTeam
        ? `${normalizedFixture.home_team} [${actualHomeScore}] - ${actualAwayScore} ${normalizedFixture.away_team}`
        : `${normalizedFixture.home_team} ${actualHomeScore} - [${actualAwayScore}] ${normalizedFixture.away_team}`;

      // Format notification message
      let title: string;
      let message: string;
      if (isGoalDisallowed) {
        title = `🚫 Goal Disallowed`;
        message = `${goalMinute} ${scorer}'s goal for ${teamName} was disallowed by VAR\n${scoreDisplay}`;
      } else if (isOwnGoal) {
        title = `Own Goal`;
        message = `${goalMinute} Own goal by ${scorer}\n${scoreDisplay}`;
      } else {
        title = `${teamName} scores!`;
        message = `${goalMinute} ${scorer}\n${scoreDisplay}`;
      }

      const totalSent = await sendNotificationsToUsers(
        picks,
        playerIdsByUser,
        prefsMap,
        title,
        message,
        {
          type: isGoalDisallowed ? 'goal_disallowed' : 'goal',
          api_match_id: apiMatchId,
          fixture_index: normalizedFixture.fixture_index,
          gw: fixtureGw,
        },
        requestId,
        'score-updates' // Check user preferences
      );

      console.log(`[sendScoreNotificationsWebhook] [${requestId}] ✅ Goal notification sent (${totalSent} users), continuing to check for half-time/final whistle`);

      // Don't return here - continue to check for half-time/final whistle
      // This ensures goals scored at half-time still trigger goal notifications
      // and then half-time notification is also sent
    }
    }

    // Handle score changes without goals (for manual updates)
    // BUT: Skip if score went DOWN (this is handled above as goal disallowed)
    if (isScoreChange && (!Array.isArray(goals) || goals.length === 0) && !scoreWentDown) {
      // Score changed but no goals data - send simple score update notification
      // Note: We skip if score went down to avoid sending "NOT SCORED" when VAR disallows
      const picks = await fetchFixturePicks(
        fixtureGw,
        normalizedFixture.fixture_index,
        isAppFixture,
        isTestFixture,
        testGwForPicks
      );

      if (picks.length === 0) {
        console.log(`[sendScoreNotificationsWebhook] No picks found for fixture ${normalizedFixture.fixture_index}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'No picks found' }),
        };
      }

      // Check if we've already notified for this exact score recently
      if (state?.last_notified_at) {
        const lastNotifiedTime = new Date(state.last_notified_at).getTime();
        const now = Date.now();
        const twoMinutes = 2 * 60 * 1000;
        if (now - lastNotifiedTime < twoMinutes && 
            state.last_notified_home_score === homeScore && 
            state.last_notified_away_score === awayScore) {
          console.log(`[sendScoreNotificationsWebhook] 🚫 SKIPPING - already notified for this score`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Already notified' }),
          };
        }
      }

      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      const playerIdsByUser = await getSubscriptionsAndPlayerIds(userIds);

      // Send notification to each user
      const title = `⚽ GOAL! ${normalizedFixture.home_team} ${homeScore}-${awayScore} ${normalizedFixture.away_team}`;
      const message = `Score updated`;

      const totalSent = await sendNotificationsToUsers(
        picks,
        playerIdsByUser,
        new Map(), // No preference check for score updates without goals
        title,
        message,
        {
          type: 'goal',
          api_match_id: apiMatchId,
          fixture_index: normalizedFixture.fixture_index,
          gw: fixtureGw,
        },
        requestId
      );

      // Update state
      await supabase
        .from('notification_state')
        .upsert({
          api_match_id: apiMatchId,
          last_notified_home_score: homeScore,
          last_notified_away_score: awayScore,
          last_notified_status: status,
          last_notified_at: new Date().toISOString(),
          last_notified_goals: goals || [],
          last_notified_red_cards: redCards || null,
        } as any, {
          onConflict: 'api_match_id',
        });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Score update notification sent',
          sentTo: totalSent,
        }),
      };
    }

    // Handle kickoff - detect both first half and second half kickoff
    // First half: status is IN_PLAY with 0-0 score, and we haven't notified kickoff yet
    // Second half: oldStatus was PAUSED/HALF_TIME and status is now IN_PLAY (regardless of score)
    const isFirstHalfKickoff = status === 'IN_PLAY' && homeScore === 0 && awayScore === 0;
    const isSecondHalfKickoff = (oldStatus === 'PAUSED' || oldStatus === 'HALF_TIME') && status === 'IN_PLAY';
    const isKickoff = isFirstHalfKickoff || isSecondHalfKickoff;
    
    if (isKickoff) {
      // For first half kickoff, check if we've already sent notification
      if (isFirstHalfKickoff) {
        const hasNotifiedKickoff = state?.last_notified_status === 'IN_PLAY' && 
                                   state?.last_notified_home_score === 0 && 
                                   state?.last_notified_away_score === 0;
        
        if (hasNotifiedKickoff) {
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 SKIPPING - already sent first half kickoff notification for match ${apiMatchId}`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Already notified for kickoff' }),
          };
        }
      }
      
      // For second half kickoff, check if we've already sent second half notification
      // We detect this by checking if state was already updated to IN_PLAY after being PAUSED
      if (isSecondHalfKickoff) {
        // If state shows IN_PLAY and we're transitioning from PAUSED, check if we already notified
        // The state update happens before notification, so if state is IN_PLAY and was updated recently,
        // another webhook already handled this
        if (state?.last_notified_status === 'IN_PLAY' && oldStatus === 'PAUSED') {
          // Check if state was updated very recently (within 10 seconds) - another webhook claimed it
          if (state.last_notified_at) {
            const lastNotifiedTime = new Date(state.last_notified_at).getTime();
            const now = Date.now();
            if (now - lastNotifiedTime < 10000) {
              console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 SKIPPING - already sent second half kickoff notification for match ${apiMatchId} (recent update)`);
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Already notified for second half kickoff' }),
              };
            }
          }
        }
      }

      const kickoffType = isSecondHalfKickoff ? 'SECOND_HALF' : 'FIRST_HALF';
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 ${kickoffType} KICKOFF DETECTED: status=${status}, score=${homeScore}-${awayScore}, oldStatus=${oldStatus}`);

      // Mark as notified BEFORE sending to prevent duplicates
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('notification_state')
        .upsert({
          api_match_id: apiMatchId,
          last_notified_home_score: homeScore,
          last_notified_away_score: awayScore,
          last_notified_status: 'IN_PLAY',
          last_notified_at: now,
          last_notified_goals: goals || [],
          last_notified_red_cards: redCards || null,
        } as any, {
          onConflict: 'api_match_id',
        });

      if (updateError) {
        console.error(`[sendScoreNotificationsWebhook] [${requestId}] Error updating state:`, updateError);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Failed to update state, skipping notification' }),
        };
      }

      // Get users who have picks
      const picks = await fetchFixturePicks(
        fixtureGw,
        normalizedFixture.fixture_index,
        isAppFixture,
        isTestFixture,
        testGwForPicks,
        false // Don't need pick field for kickoff
      );

      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 ${kickoffType} KICKOFF: Found ${userIds.length} unique users with picks`);
      
      if (userIds.length === 0) {
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 ${kickoffType} KICKOFF: No users with picks found for fixture ${normalizedFixture.fixture_index}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'No picks found for kickoff' }),
        };
      }

      const prefsMap = await loadUserNotificationPreferences(userIds);
      const playerIdsByUser = await getSubscriptionsAndPlayerIds(userIds);

      const title = `⚽ ${normalizedFixture.home_team} vs ${normalizedFixture.away_team}`;
      const message = isSecondHalfKickoff ? `Second half underway` : `Kickoff!`;

      const totalSent = await sendNotificationsToUsers(
        picks,
        playerIdsByUser,
        prefsMap,
        title,
        message,
        {
          type: 'kickoff',
          api_match_id: apiMatchId,
          fixture_index: normalizedFixture.fixture_index,
          gw: fixtureGw,
        },
        requestId,
        'score-updates' // Check user preferences
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: `${kickoffType} kickoff notification sent`,
          sentTo: totalSent,
        }),
      };
    }

    // Handle half-time
    if (isHalfTime) {
      // Check if we've already sent a half-time notification for this match
      const hasNotifiedHalfTime = state?.last_notified_status === 'PAUSED';
      
      if (hasNotifiedHalfTime) {
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 SKIPPING - already sent half-time notification for match ${apiMatchId}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Already notified for half-time' }),
        };
      }

      // Update state IMMEDIATELY before sending notifications
      await supabase
        .from('notification_state')
        .upsert({
          api_match_id: apiMatchId,
          last_notified_home_score: homeScore,
          last_notified_away_score: awayScore,
          last_notified_status: 'PAUSED',
          last_notified_at: new Date().toISOString(),
          last_notified_goals: goals || [],
          last_notified_red_cards: redCards || null,
        } as any, {
          onConflict: 'api_match_id',
        });
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] ✅ State updated IMMEDIATELY for half-time match ${apiMatchId}`);

      // Get users who have picks
      const picks = await fetchFixturePicks(
        fixtureGw,
        normalizedFixture.fixture_index,
        isAppFixture,
        isTestFixture,
        testGwForPicks,
        false // Don't need pick field for half-time
      );

      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      const playerIdsByUser = await getSubscriptionsAndPlayerIds(userIds);

      const htMinute = minute !== null && minute !== undefined ? `${minute}'` : '';
      const title = `⏸️ Half-Time`;
      const message = `${normalizedFixture.home_team} ${homeScore}-${awayScore} ${normalizedFixture.away_team}${htMinute ? ` ${htMinute}` : ''}`;

      const totalSent = await sendNotificationsToUsers(
        picks,
        playerIdsByUser,
        new Map(), // No preference check for half-time
        title,
        message,
        {
          type: 'half_time',
          api_match_id: apiMatchId,
          fixture_index: normalizedFixture.fixture_index,
          gw: fixtureGw,
        },
        requestId
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Half-time notification sent',
          sentTo: totalSent,
        }),
      };
    }

    // Handle game finished (check this even if there were no new goals)
    // IMPORTANT: Check if game is finished regardless of oldStatus
    // The webhook might fire multiple times when a game finishes, so we need to check
    // if we've already notified for this finished game
    if (isFinished) {
      // Check if we've already notified for this finished game
      const hasNotifiedFinished = state?.last_notified_status === 'FINISHED' || state?.last_notified_status === 'FT';
      
      // Only send notification if game JUST finished (transition from non-finished to finished)
      // OR if we haven't notified for this finished game yet
      if (oldStatus !== 'FINISHED' && oldStatus !== 'FT' && !hasNotifiedFinished) {
        console.log(`[sendScoreNotificationsWebhook] 🏁 Game finished detected for match ${apiMatchId}`);
      // Get users who have picks
      const picks = await fetchFixturePicks(
        fixtureGw,
        normalizedFixture.fixture_index,
        isAppFixture,
        isTestFixture,
        testGwForPicks,
        true // Need pick field for final whistle
      );

      // Calculate result
      let result = 'D';
      if (homeScore > awayScore) result = 'H';
      if (awayScore > homeScore) result = 'A';

      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      const prefsMap = await loadUserNotificationPreferences(userIds);
      const playerIdsByUser = await getSubscriptionsAndPlayerIds(userIds);

      // Calculate percentage of users who got it correct
      const totalPicks = picks.length;
      const correctPicks = picks.filter((p: any) => p.pick === result).length;
      const correctPercentage = totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0;

      // Send final whistle notification (personalized per user)
      let totalSent = 0;
      const title = `FT: ${normalizedFixture.home_team} ${homeScore}-${awayScore} ${normalizedFixture.away_team}`;
      const percentageText = correctPercentage <= 20
        ? `Only ${correctPercentage}% of players got this fixture correct`
        : `${correctPercentage}% of players got this fixture correct`;

      for (const pick of picks) {
        const playerIds = playerIdsByUser.get(pick.user_id) || [];
        if (playerIds.length === 0) continue;

        const userPrefs = prefsMap.get(pick.user_id);
        if (userPrefs && userPrefs['final-whistle'] === false) {
          continue;
        }

        const isCorrect = pick.pick === result;
        const message = isCorrect 
          ? `✅ Got it right! ${percentageText}` 
          : `❌ Wrong pick ${percentageText}`;

        const result2 = await sendOneSignalNotification(
          playerIds,
          title,
          message,
          {
            type: 'game_finished',
            api_match_id: apiMatchId,
            fixture_index: normalizedFixture.fixture_index,
            gw: fixtureGw,
          }
        );

        if (result2.success) {
          totalSent += result2.sentTo;
        }
      }

      // Update state to mark that we've notified for this finished game
      await supabase
        .from('notification_state')
        .upsert({
          api_match_id: apiMatchId,
          last_notified_status: status, // Mark as FINISHED or FT
          last_notified_home_score: homeScore,
          last_notified_away_score: awayScore,
          last_notified_at: new Date().toISOString(),
          last_notified_goals: goals || [],
        } as any, {
          onConflict: 'api_match_id',
        });

      console.log(`[sendScoreNotificationsWebhook] [${requestId}] ✅ Sent full-time notification for match ${apiMatchId} (${totalSent} users)`);

      // Check if all games in this GW are finished (end of gameweek)
      // IMPORTANT: Check this even if we've already notified for this specific game
      // because the gameweek might have just finished
      // We need to check ALL fixtures for the GW, not just ones in live_scores
      let allFinished = false;
      
      // Get ALL fixtures for this GW
      const { data: allFixtures } = await supabase
        .from('app_fixtures')
        .select('api_match_id, fixture_index')
        .eq('gw', fixtureGw);
      
      if (allFixtures && allFixtures.length > 0) {
        // Filter to only fixtures with api_match_id (these are the ones we track)
        const fixturesWithApiId = allFixtures.filter((f: any) => f.api_match_id);
        
        if (fixturesWithApiId.length > 0) {
          // Get live_scores for all fixtures with api_match_id
          const apiMatchIds = fixturesWithApiId.map((f: any) => f.api_match_id);
          const { data: allLiveScores } = await supabase
            .from('live_scores')
            .select('api_match_id, status')
            .in('api_match_id', apiMatchIds);
          
          // Check that ALL fixtures with api_match_id have finished live_scores
          const finishedScores = (allLiveScores || []).filter((score: any) => 
            score.status === 'FINISHED' || score.status === 'FT'
          );
          
          // All fixtures with api_match_id must have finished live_scores
          allFinished = finishedScores.length === fixturesWithApiId.length;
          
          if (allFinished) {
            console.log(`[sendScoreNotificationsWebhook] ✅ All ${fixturesWithApiId.length} fixtures with API IDs are finished for GW ${fixtureGw}`);
          } else {
            console.log(`[sendScoreNotificationsWebhook] ⏳ Not all fixtures finished: ${finishedScores.length}/${fixturesWithApiId.length} finished for GW ${fixtureGw}`);
          }
        } else {
          // No fixtures with api_match_id, can't determine if GW is finished
          console.log(`[sendScoreNotificationsWebhook] ⚠️ No fixtures with api_match_id for GW ${fixtureGw}, skipping end-of-GW check`);
        }
      } else {
        // No fixtures found for this GW
        console.log(`[sendScoreNotificationsWebhook] ⚠️ No fixtures found for GW ${fixtureGw}, skipping end-of-GW check`);
      }
      
      if (allFinished) {
        console.log(`[sendScoreNotificationsWebhook] 🎉 All games finished for GW ${fixtureGw} - writing results to app_gw_results`);
        
        // Check if results already exist for this GW
        const { data: existingResults } = await supabase
          .from('app_gw_results')
          .select('gw')
          .eq('gw', fixtureGw)
          .limit(1);
        
        if (!existingResults || existingResults.length === 0) {
          // Write results to app_gw_results based on live_scores
          console.log(`[sendScoreNotificationsWebhook] Writing results for GW ${fixtureGw} to app_gw_results...`);
          
          // Get all fixtures for this GW with their fixture_index
          const { data: gwFixtures } = await supabase
            .from('app_fixtures')
            .select('fixture_index, api_match_id')
            .eq('gw', fixtureGw)
            .order('fixture_index', { ascending: true });
          
          if (gwFixtures && gwFixtures.length > 0) {
            // Get all live_scores for fixtures with api_match_id
            const apiMatchIds = gwFixtures
              .map((f: any) => f.api_match_id)
              .filter((id: any) => id != null);
            
            const { data: allLiveScores } = await supabase
              .from('live_scores')
              .select('api_match_id, home_score, away_score, status')
              .in('api_match_id', apiMatchIds);
            
            // Create a map of api_match_id -> result (H/D/A)
            const liveScoresMap = new Map<number, 'H' | 'D' | 'A'>();
            (allLiveScores || []).forEach((score: any) => {
              if (score.status === 'FINISHED' || score.status === 'FT') {
                const homeScore = score.home_score ?? 0;
                const awayScore = score.away_score ?? 0;
                let result: 'H' | 'D' | 'A';
                if (homeScore > awayScore) {
                  result = 'H';
                } else if (awayScore > homeScore) {
                  result = 'A';
                } else {
                  result = 'D';
                }
                liveScoresMap.set(score.api_match_id, result);
              }
            });
            
            // Build results array for app_gw_results
            const resultsToInsert: Array<{ gw: number; fixture_index: number; result: 'H' | 'D' | 'A' }> = [];
            
            gwFixtures.forEach((fixture: any) => {
              if (fixture.api_match_id && liveScoresMap.has(fixture.api_match_id)) {
                resultsToInsert.push({
                  gw: fixtureGw,
                  fixture_index: fixture.fixture_index,
                  result: liveScoresMap.get(fixture.api_match_id)!,
                });
              }
            });
            
            if (resultsToInsert.length > 0) {
              const { error: insertError } = await supabase
                .from('app_gw_results')
                .upsert(resultsToInsert, { onConflict: 'gw,fixture_index' });
              
              if (insertError) {
                console.error(`[sendScoreNotificationsWebhook] Error writing results to app_gw_results:`, insertError);
              } else {
                console.log(`[sendScoreNotificationsWebhook] ✅ Successfully wrote ${resultsToInsert.length} results to app_gw_results for GW ${fixtureGw}`);
              }
            } else {
              console.warn(`[sendScoreNotificationsWebhook] ⚠️ No results to write for GW ${fixtureGw} (no finished games found)`);
            }
          } else {
            console.warn(`[sendScoreNotificationsWebhook] ⚠️ No fixtures found for GW ${fixtureGw}`);
          }
        } else {
          console.log(`[sendScoreNotificationsWebhook] Results already exist for GW ${fixtureGw}, skipping write`);
        }
        
        console.log(`[sendScoreNotificationsWebhook] 🎉 All games finished for GW ${fixtureGw} - sending end of GW notification`);
        
        // Get all users who have picks for this GW
        let allPicks: any[] = [];
        if (isAppFixture) {
          const { data: appPicks } = await supabase
            .from('app_picks')
            .select('user_id')
            .eq('gw', fixtureGw);
          allPicks = appPicks || [];
        } else if (isTestFixture && testGwForPicks) {
          const { data: testPicks } = await supabase
            .from('test_api_picks')
            .select('user_id')
            .eq('matchday', testGwForPicks);
          allPicks = testPicks || [];
        } else {
          const { data: regularPicks } = await supabase
            .from('picks')
            .select('user_id')
            .eq('gw', fixtureGw);
          allPicks = regularPicks || [];
        }
        
        const allUserIds = Array.from(new Set(allPicks.map((p: any) => p.user_id)));
        
        // Load user notification preferences for GW results using shared utility
        const gwPrefsMap = await loadUserNotificationPreferences(allUserIds);

        const { data: allSubscriptions } = await supabase
          .from('push_subscriptions')
          .select('user_id, player_id')
          .in('user_id', allUserIds)
          .eq('is_active', true);
        
        const allPlayerIdsByUser = new Map<string, string[]>();
        (allSubscriptions || []).forEach((sub: any) => {
          if (!sub.player_id) return;
          if (!allPlayerIdsByUser.has(sub.user_id)) {
            allPlayerIdsByUser.set(sub.user_id, []);
          }
          allPlayerIdsByUser.get(sub.user_id)!.push(sub.player_id);
        });
        
        // Check if we've already notified for end of GW
        // Check if any match in this GW has status 'GW_FINISHED' (our marker)
        const { data: gwFinishedCheck } = await supabase
          .from('notification_state')
          .select('last_notified_status')
          .eq('last_notified_status', 'GW_FINISHED')
          .limit(1);
        
        // Also check if we notified recently (within last hour) to avoid duplicates
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentNotifications } = await supabase
          .from('notification_state')
          .select('last_notified_at, last_notified_status')
          .gte('last_notified_at', oneHourAgo)
          .eq('last_notified_status', 'GW_FINISHED')
          .limit(1);
        
        if (!recentNotifications || recentNotifications.length === 0) {
          // Send end of GW notification to all users
          let gwTotalSent = 0;
          for (const userId of allUserIds) {
            const playerIds = allPlayerIdsByUser.get(userId) || [];
            if (playerIds.length === 0) continue;
            
            // Check if notification should be sent (OneSignal subscription + user preferences)
            const userPrefs = gwPrefsMap.get(userId);
            if (userPrefs && userPrefs['gw-results'] === false) {
              continue; // Skip if user disabled gw-results notifications
            }
            
            const gwTitle = `🎉 Gameweek ${fixtureGw} Complete!`;
            const gwMessage = `All games finished. Check your results!`;
            
            const gwResult = await sendOneSignalNotification(
              playerIds,
              gwTitle,
              gwMessage,
              {
                type: 'gameweek_finished',
                gw: fixtureGw,
              }
            );
            
            if (gwResult.success) {
              gwTotalSent += gwResult.sentTo;
            }
          }
          
          // Mark GW as notified by updating the current match's state with special status
          // This marks that we've sent the end-of-GW notification
          await supabase
            .from('notification_state')
            .upsert({
              api_match_id: apiMatchId,
              last_notified_at: new Date().toISOString(),
              last_notified_home_score: homeScore,
              last_notified_away_score: awayScore,
              last_notified_status: 'GW_FINISHED',
            } as any, {
              onConflict: 'api_match_id',
            });
          
          console.log(`[sendScoreNotificationsWebhook] Sent end of GW ${fixtureGw} notification to ${gwTotalSent} users`);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Game finished notification sent',
          sentTo: totalSent,
        }),
      };
    }

    // No notification needed
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'No notification needed' }),
    };
  } catch (error: any) {
    console.error('[sendScoreNotificationsWebhook] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error?.message,
      }),
    };
  }
};

