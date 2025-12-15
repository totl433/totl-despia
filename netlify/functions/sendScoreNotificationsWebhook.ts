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
    
    // If old_record is empty/missing, query database for previous state from live_scores
    // This handles cases where webhook doesn't provide old_record (e.g., INSERT operations)
    if (!old_record || Object.keys(old_record).length === 0 || !oldStatus) {
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] No old_record or oldStatus missing, querying live_scores for previous state`);
      
      // Try to get previous state from live_scores table (before the current update)
      // We need to check if there's a record that was just updated
      // Since we're in a webhook, the record might already be updated, so we check notification_state
      // which stores the last notified state
      const [previousLiveScore, previousNotificationState] = await Promise.all([
        // Check notification_state first (most reliable for what we've already processed)
        supabase
          .from('notification_state')
          .select('last_notified_status, last_notified_home_score, last_notified_away_score')
          .eq('api_match_id', apiMatchId)
          .maybeSingle(),
        // Also check if there's a way to get the old live_scores value
        // Note: This might not work if the update already happened, but worth trying
        supabase
          .from('live_scores')
          .select('status, home_score, away_score')
          .eq('api_match_id', apiMatchId)
          .maybeSingle(),
      ]);
      
      // Determine oldStatus with priority: notification_state > live_scores > undefined
      // For kickoff detection, we need to know if status changed from non-IN_PLAY to IN_PLAY
      
      // First, check notification_state (what we last notified about)
      if (previousNotificationState.data && previousNotificationState.data.last_notified_status) {
        const notifiedStatus = previousNotificationState.data.last_notified_status;
        // Only use notification_state if it's different from current status
        // This ensures we detect status changes even if notification_state exists
        if (notifiedStatus !== status) {
          oldStatus = notifiedStatus;
          oldHomeScore = previousNotificationState.data.last_notified_home_score ?? oldHomeScore;
          oldAwayScore = previousNotificationState.data.last_notified_away_score ?? oldAwayScore;
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] Found previous state in notification_state: status=${oldStatus}, score=${oldHomeScore}-${oldAwayScore}`);
        } else {
          // notification_state matches current status, so check live_scores for actual previous state
          // This handles cases where status changed but notification_state wasn't updated yet
          if (previousLiveScore.data && previousLiveScore.data.status !== status) {
            oldStatus = previousLiveScore.data.status;
            oldHomeScore = previousLiveScore.data.home_score ?? oldHomeScore;
            oldAwayScore = previousLiveScore.data.away_score ?? oldAwayScore;
            console.log(`[sendScoreNotificationsWebhook] [${requestId}] notification_state matches current status, using live_scores: status=${oldStatus}, score=${oldHomeScore}-${oldAwayScore}`);
          } else {
            // Both match current status, so this might be a duplicate update
            // For kickoff: if current is IN_PLAY with 0-0, and we don't have a different oldStatus,
            // we should still check if this is a kickoff (oldStatus will be undefined/null)
            console.log(`[sendScoreNotificationsWebhook] [${requestId}] Both notification_state and live_scores match current status - oldStatus will be undefined for kickoff detection`);
          }
        }
      } else if (previousLiveScore.data && previousLiveScore.data.status !== status) {
        // No notification_state, but live_scores has different status - use that
        oldStatus = previousLiveScore.data.status;
        oldHomeScore = previousLiveScore.data.home_score ?? oldHomeScore;
        oldAwayScore = previousLiveScore.data.away_score ?? oldAwayScore;
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] Found previous state in live_scores: status=${oldStatus}, score=${oldHomeScore}-${oldAwayScore}`);
      } else {
        // No previous state exists - this is likely a new record or first update
        // For kickoff detection: if oldStatus is undefined/null, treat it as "not IN_PLAY"
        // This allows us to detect kickoff even for first-time inserts
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] No previous state found - treating as new record (oldStatus will be undefined/null for kickoff detection)`);
      }
    }

    // Check if goals array changed (compare JSON strings to detect any changes)
    const goalsChanged = JSON.stringify(goals || []) !== JSON.stringify(oldGoals || []);

    // Check if this is a score change
    const isScoreChange = homeScore !== oldHomeScore || awayScore !== oldAwayScore;
    const isStatusChange = status !== oldStatus;
    const isKickoff = oldStatus !== 'IN_PLAY' && status === 'IN_PLAY' && homeScore === 0 && awayScore === 0;
    const isHalfTime = oldStatus === 'IN_PLAY' && status === 'PAUSED';
    const isFinished = status === 'FINISHED' || status === 'FT';

    console.log(`[sendScoreNotificationsWebhook] [${requestId}] Change detection:`, {
      scoreChange: isScoreChange,
      goalsChanged,
      homeScore: `${oldHomeScore} -> ${homeScore}`,
      awayScore: `${oldAwayScore} -> ${awayScore}`,
      status: `${oldStatus || 'null'} -> ${status}`,
      isKickoff,
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
      let picks: any[] = [];
      if (isAppFixture) {
        const { data: appPicks } = await supabase
          .from('app_picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = appPicks || [];
      } else if (isTestFixture && testGwForPicks) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id, pick')
          .eq('matchday', testGwForPicks)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = regularPicks || [];
      }

      if (picks.length > 0) {
        // Get push subscriptions
        const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('user_id, player_id')
          .in('user_id', userIds)
          .eq('is_active', true);

        const playerIdsByUser = new Map<string, string[]>();
        (subscriptions || []).forEach((sub: any) => {
          if (!sub.player_id) return;
          if (!playerIdsByUser.has(sub.user_id)) {
            playerIdsByUser.set(sub.user_id, []);
          }
          playerIdsByUser.get(sub.user_id)!.push(sub.player_id);
        });

        // Send goal disallowed notification
        let totalSent = 0;
        const teamName = isHomeTeamDisallowed ? normalizedFixture.home_team : normalizedFixture.away_team;
        const scoreDisplay = `${normalizedFixture.home_team} ${homeScore}-${awayScore} ${normalizedFixture.away_team}`;
        const title = `🚫 Goal Disallowed`;
        const message = `${disallowedMinute} ${disallowedScorer}'s goal for ${teamName} was disallowed by VAR\n${scoreDisplay}`;

        for (const pick of picks) {
          const playerIds = playerIdsByUser.get(pick.user_id) || [];
          if (playerIds.length === 0) continue;

          const result = await sendOneSignalNotification(
            playerIds,
            title,
            message,
            {
              type: 'goal_disallowed',
              api_match_id: apiMatchId,
              fixture_index: normalizedFixture.fixture_index,
              gw: fixtureGw,
            }
          );

          if (result.success) {
            totalSent += result.sentTo;
            console.log(`[sendScoreNotificationsWebhook] [${requestId}] Sent goal disallowed notification to user ${pick.user_id} (${result.sentTo} devices)`);
          }
        }

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

    // Process goals - ALWAYS check for new goals if goals exist, regardless of score change
    // This handles cases where webhook fires after goal is already in database
    // We compare against state.last_notified_goals (what we've already notified), not old_record.goals
    // NOTE: Skip if score went down (handled above)
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
      
      // Use state as primary source, but fall back to old_record if state is missing
      // This handles cases where webhook fires before state is updated
      let previousGoals = state?.last_notified_goals;
      if (!previousGoals || !Array.isArray(previousGoals) || previousGoals.length === 0) {
        // Fall back to old_record goals if state doesn't have goals yet
        previousGoals = oldGoals || [];
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

      // Get users who have picks for this fixture - check app_picks for app_fixtures
      let picks: any[] = [];
      if (isAppFixture) {
        const { data: appPicks } = await supabase
          .from('app_picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = appPicks || [];
      } else if (isTestFixture && testGwForPicks) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id, pick')
          .eq('matchday', testGwForPicks)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = regularPicks || [];
      }

      if (picks.length === 0) {
        console.log(`[sendScoreNotificationsWebhook] No picks found for fixture ${fixture.fixture_index}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'No picks found' }),
        };
      }

      // Get push subscriptions
      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      
      // Load user notification preferences using shared utility
      const prefsMap = await loadUserNotificationPreferences(userIds);

      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, player_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      const playerIdsByUser = new Map<string, string[]>();
      (subscriptions || []).forEach((sub: any) => {
        if (!sub.player_id) return;
        if (!playerIdsByUser.has(sub.user_id)) {
          playerIdsByUser.set(sub.user_id, []);
        }
        playerIdsByUser.get(sub.user_id)!.push(sub.player_id);
      });

      // Send notification to each user
      let totalSent = 0;
      const newestGoal = newGoals.sort((a: any, b: any) => (b.minute ?? 0) - (a.minute ?? 0))[0];
      const scorer = newestGoal.scorer || 'Unknown';
      const goalMinute = newestGoal.minute !== null && newestGoal.minute !== undefined ? `${newestGoal.minute}'` : '';
      
      // Determine which team scored - use score change (most reliable)
      // Compare current score to old score to see which team scored
      const homeScoreIncreased = homeScore > (oldHomeScore || 0);
      const awayScoreIncreased = awayScore > (oldAwayScore || 0);
      const homeScoreDecreased = homeScore < (oldHomeScore || 0);
      const awayScoreDecreased = awayScore < (oldAwayScore || 0);
      
      // Check if this is a goal disallowed (score went DOWN)
      const isGoalDisallowed = homeScoreDecreased || awayScoreDecreased;
      
      // If both increased (shouldn't happen, but handle it), use teamId from goal if available
      let isHomeTeam: boolean;
      if (homeScoreIncreased && !awayScoreIncreased) {
        isHomeTeam = true;
      } else if (awayScoreIncreased && !homeScoreIncreased) {
        isHomeTeam = false;
      } else if (homeScoreDecreased && !awayScoreDecreased) {
        // Goal disallowed for home team
        isHomeTeam = true;
      } else if (awayScoreDecreased && !homeScoreIncreased) {
        // Goal disallowed for away team
        isHomeTeam = false;
      } else {
        // Fallback: try to match by teamId or team name
        const goalTeamId = newestGoal.teamId;
        const scoringTeam = newestGoal.team || '';
        const normalizedScoringTeam = scoringTeam.toLowerCase().trim();
        const normalizedHomeTeam = (normalizedFixture.home_team || '').toLowerCase().trim();
        const normalizedAwayTeam = (normalizedFixture.away_team || '').toLowerCase().trim();
        
        // Try name matching as fallback
        isHomeTeam = normalizedScoringTeam === normalizedHomeTeam ||
                     normalizedScoringTeam.includes(normalizedHomeTeam) ||
                     normalizedHomeTeam.includes(normalizedScoringTeam);
        
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] Could not determine scoring team from score change, using name matching:`, {
          goalTeamId,
          scoringTeam,
          isHomeTeam,
          homeTeam: normalizedFixture.home_team,
          awayTeam: normalizedFixture.away_team,
        });
      }
      
      // Calculate actual score from goals array if score fields are stale
      // This handles cases where webhook fires before home_score/away_score are updated
      let actualHomeScore = homeScore;
      let actualAwayScore = awayScore;
      
      if (Array.isArray(goals) && goals.length > 0) {
        // Count goals by team from goals array
        const homeTeamName = (normalizedFixture.home_team || '').toLowerCase().trim();
        const awayTeamName = (normalizedFixture.away_team || '').toLowerCase().trim();
        
        let goalsFromArrayHome = 0;
        let goalsFromArrayAway = 0;
        
        for (const goal of goals) {
          if (!goal || typeof goal !== 'object') continue;
          const goalTeam = (goal.team || '').toLowerCase().trim();
          
          // Try to match by team name (most reliable)
          const isHomeGoal = goalTeam === homeTeamName ||
                            goalTeam.includes(homeTeamName) ||
                            homeTeamName.includes(goalTeam);
          
          if (isHomeGoal) {
            goalsFromArrayHome++;
          } else {
            goalsFromArrayAway++;
          }
        }
        
        // Use goals array count if it's higher than recorded score (score fields are stale)
        if (goalsFromArrayHome > homeScore) {
          actualHomeScore = goalsFromArrayHome;
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] Score field stale - using goals array: home ${homeScore} -> ${actualHomeScore}`);
        }
        if (goalsFromArrayAway > awayScore) {
          actualAwayScore = goalsFromArrayAway;
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] Score field stale - using goals array: away ${awayScore} -> ${actualAwayScore}`);
        }
      }
      
      // Format score with new goal highlighted (FotMob style)
      // Example: "Team A 1 - [2] Team B" or "Team A [1] - 0 Team B"
      let scoreDisplay: string;
      if (isHomeTeam) {
        scoreDisplay = `${normalizedFixture.home_team} [${actualHomeScore}] - ${actualAwayScore} ${normalizedFixture.away_team}`;
      } else {
        scoreDisplay = `${normalizedFixture.home_team} ${actualHomeScore} - [${actualAwayScore}] ${normalizedFixture.away_team}`;
      }

      for (const pick of picks) {
        const playerIds = playerIdsByUser.get(pick.user_id) || [];
        if (playerIds.length === 0) continue;

        // Check if notification should be sent (OneSignal subscription + user preferences)
        // Note: sendOneSignalNotification already filters by subscription, so we just check preferences here
        const userPrefs = prefsMap.get(pick.user_id);
        if (userPrefs && userPrefs['score-updates'] === false) {
          continue; // Skip if user disabled score-updates notifications
        }

        const teamName = isHomeTeam ? normalizedFixture.home_team : normalizedFixture.away_team;
        
        // Handle goal disallowed differently
        let title: string;
        let message: string;
        if (isGoalDisallowed) {
          title = `🚫 Goal Disallowed`;
          message = `${goalMinute} ${scorer}'s goal for ${teamName} was disallowed by VAR\n${scoreDisplay}`;
        } else {
          title = `${teamName} scores!`;
          message = `${goalMinute} ${scorer}\n${scoreDisplay}`;
        }

        const result = await sendOneSignalNotification(
          playerIds,
          title,
          message,
          {
            type: isGoalDisallowed ? 'goal_disallowed' : 'goal',
            api_match_id: apiMatchId,
            fixture_index: normalizedFixture.fixture_index,
            gw: fixtureGw,
          }
        );

        if (result.success) {
          totalSent += result.sentTo;
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] Sent ${isGoalDisallowed ? 'goal disallowed' : 'goal'} notification to user ${pick.user_id} (${result.sentTo} devices)`);
        }
      }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: 'Goal notification sent',
            sentTo: totalSent,
            newGoals: newGoals.length,
          }),
        };
      }
    }

    // Handle score changes without goals (for manual updates)
    // BUT: Skip if score went DOWN (this is handled above as goal disallowed)
    if (isScoreChange && (!Array.isArray(goals) || goals.length === 0) && !scoreWentDown) {
      // Score changed but no goals data - send simple score update notification
      // Note: We skip if score went down to avoid sending "NOT SCORED" when VAR disallows
      let picks: any[] = [];
      if (isAppFixture) {
        const { data: appPicks } = await supabase
          .from('app_picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = appPicks || [];
      } else if (isTestFixture && testGwForPicks) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id, pick')
          .eq('matchday', testGwForPicks)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = regularPicks || [];
      }

      if (picks.length === 0) {
        console.log(`[sendScoreNotificationsWebhook] No picks found for fixture ${fixture.fixture_index}`);
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

      // Get push subscriptions
      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, player_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      const playerIdsByUser = new Map<string, string[]>();
      (subscriptions || []).forEach((sub: any) => {
        if (!sub.player_id) return;
        if (!playerIdsByUser.has(sub.user_id)) {
          playerIdsByUser.set(sub.user_id, []);
        }
        playerIdsByUser.get(sub.user_id)!.push(sub.player_id);
      });

      // Send notification to each user
      let totalSent = 0;
      const title = `⚽ GOAL! ${fixture.home_team} ${homeScore}-${awayScore} ${fixture.away_team}`;
      const message = `Score updated`;

      for (const pick of picks) {
        const playerIds = playerIdsByUser.get(pick.user_id) || [];
        if (playerIds.length === 0) continue;

        const result = await sendOneSignalNotification(
          playerIds,
          title,
          message,
          {
            type: 'goal',
            api_match_id: apiMatchId,
            fixture_index: normalizedFixture.fixture_index,
            gw: fixtureGw,
          }
        );

        if (result.success) {
          totalSent += result.sentTo;
          console.log(`[sendScoreNotificationsWebhook] Sent score update notification to user ${pick.user_id} (${result.sentTo} devices)`);
        }
      }

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

    // Handle kickoff
    // Check if we've already notified for kickoff - check both state and timestamp
    const hasNotifiedKickoff = state?.last_notified_status === 'IN_PLAY' && 
                               state?.last_notified_home_score === 0 && 
                               state?.last_notified_away_score === 0;
    
    // Check if notification was sent recently (within last 10 minutes) - this catches duplicates even if state doesn't match exactly
    const recentlyNotified = state?.last_notified_at && 
      (new Date(state.last_notified_at).getTime() > Date.now() - 10 * 60 * 1000) &&
      state?.last_notified_status === 'IN_PLAY' &&
      state?.last_notified_home_score === 0 &&
      state?.last_notified_away_score === 0;
    
    if (recentlyNotified || hasNotifiedKickoff) {
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 SKIPPING - already sent kickoff notification for match ${apiMatchId} at ${state?.last_notified_at}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Already notified for kickoff' }),
      };
    }

    // Detect kickoff: status changed from non-IN_PLAY to IN_PLAY with 0-0 score
    // Handle cases where oldStatus is undefined/null/TIMED/SCHEDULED (new record or missing old_record)
    // Also handle case where oldStatus is 'FT' or 'FINISHED' (match restarted - shouldn't happen but be safe)
    const isKickoffOrNewlyInPlay = isKickoff || 
      ((oldStatus === null || oldStatus === undefined || oldStatus === 'TIMED' || oldStatus === 'SCHEDULED' || oldStatus === 'FT' || oldStatus === 'FINISHED') && 
       status === 'IN_PLAY' && 
       homeScore === 0 && 
       awayScore === 0);
    
    // Enhanced logging for kickoff detection
    if (status === 'IN_PLAY' && homeScore === 0 && awayScore === 0) {
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔍 KICKOFF CHECK: oldStatus=${oldStatus || 'null/undefined'}, status=${status}, isKickoff=${isKickoff}, isKickoffOrNewlyInPlay=${isKickoffOrNewlyInPlay}, hasOldRecord=${!!old_record}`);
    }

    if (isKickoffOrNewlyInPlay) {
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF DETECTED: isKickoff=${isKickoff}, status=${status}, oldStatus=${oldStatus || 'null'}, score=${homeScore}-${awayScore}, hasNotifiedKickoff=${hasNotifiedKickoff}`);

      // CRITICAL: Update state IMMEDIATELY before sending notifications
      // This prevents duplicate notifications if webhook fires multiple times
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('notification_state')
        .upsert({
          api_match_id: apiMatchId,
          last_notified_home_score: 0,
          last_notified_away_score: 0,
          last_notified_status: 'IN_PLAY',
          last_notified_at: now,
          last_notified_goals: null,
          last_notified_red_cards: null,
        } as any, {
          onConflict: 'api_match_id',
        });

      if (updateError) {
        console.error(`[sendScoreNotificationsWebhook] [${requestId}] Error updating state:`, updateError);
        // If we can't update state, don't send notification to prevent duplicates
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Failed to update state, skipping notification' }),
        };
      }

      // Re-check state immediately after update to ensure we were the first
      const { data: verifyState } = await supabase
        .from('notification_state')
        .select('last_notified_status, last_notified_home_score, last_notified_away_score, last_notified_at')
        .eq('api_match_id', apiMatchId)
        .maybeSingle();

      const wasAlreadyNotified = verifyState?.last_notified_status === 'IN_PLAY' && 
                                 verifyState?.last_notified_home_score === 0 && 
                                 verifyState?.last_notified_away_score === 0 &&
                                 verifyState?.last_notified_at &&
                                 verifyState.last_notified_at !== now; // If timestamp is different, another webhook beat us

      if (wasAlreadyNotified) {
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🚫 RACE CONDITION DETECTED - another webhook already sent kickoff notification at ${verifyState?.last_notified_at}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Race condition: another webhook already notified' }),
        };
      }

      console.log(`[sendScoreNotificationsWebhook] [${requestId}] ✅ State updated and verified for kickoff match ${apiMatchId}`);

      // Get users who have picks
      let picks: any[] = [];
      if (isAppFixture) {
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: Checking app_picks for GW ${fixtureGw}, fixture_index ${normalizedFixture.fixture_index}`);
        const { data: appPicks, error: appPicksError } = await supabase
          .from('app_picks')
          .select('user_id')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        if (appPicksError) {
          console.error(`[sendScoreNotificationsWebhook] [${requestId}] Error fetching app_picks:`, appPicksError);
        }
        picks = appPicks || [];
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: Found ${picks.length} picks in app_picks`);
      } else if (isTestFixture && testGwForPicks) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id')
          .eq('matchday', testGwForPicks)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = regularPicks || [];
      }

      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: Found ${userIds.length} unique users with picks`);
      
      if (userIds.length === 0) {
        console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: No users with picks found for fixture ${normalizedFixture.fixture_index}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'No picks found for kickoff' }),
        };
      }

      const { data: subscriptions, error: subsError } = await supabase
        .from('push_subscriptions')
        .select('user_id, player_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (subsError) {
        console.error(`[sendScoreNotificationsWebhook] [${requestId}] Error fetching subscriptions:`, subsError);
      }

      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: Found ${(subscriptions || []).length} active subscriptions for ${userIds.length} users`);

      const playerIdsByUser = new Map<string, string[]>();
      (subscriptions || []).forEach((sub: any) => {
        if (!sub.player_id) return;
        if (!playerIdsByUser.has(sub.user_id)) {
          playerIdsByUser.set(sub.user_id, []);
        }
        playerIdsByUser.get(sub.user_id)!.push(sub.player_id);
      });

      const usersWithSubscriptions = Array.from(playerIdsByUser.keys());
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: ${usersWithSubscriptions.length} users have active subscriptions out of ${userIds.length} users with picks`);

      // Load user notification preferences (consistent with goal notifications)
      const prefsMap = await loadUserNotificationPreferences(userIds);
      console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: Loaded preferences for ${prefsMap.size} users`);

      let totalSent = 0;
      for (const userId of userIds) {
        const playerIds = playerIdsByUser.get(userId) || [];
        if (playerIds.length === 0) {
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: User ${userId} has picks but no active subscriptions, skipping`);
          continue;
        }

        // Check user preferences (consistent with goal notifications)
        const userPrefs = prefsMap.get(userId);
        if (userPrefs && userPrefs['score-updates'] === false) {
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: User ${userId} has disabled score-updates notifications, skipping`);
          continue;
        }

        const title = `⚽ ${normalizedFixture.home_team} vs ${normalizedFixture.away_team}`;
        const message = `Kickoff!`;

        console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: Sending to user ${userId} with ${playerIds.length} device(s)`);

        const result = await sendOneSignalNotification(
          playerIds,
          title,
          message,
          {
            type: 'kickoff',
            api_match_id: apiMatchId,
            fixture_index: normalizedFixture.fixture_index,
            gw: fixtureGw,
          }
        );

        if (result.success) {
          totalSent += result.sentTo;
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: Successfully sent to ${result.sentTo} device(s) for user ${userId}`);
        } else {
          console.error(`[sendScoreNotificationsWebhook] [${requestId}] 🔵 KICKOFF: Failed to send to user ${userId}:`, result.error);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Kickoff notification sent',
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
      let picks: any[] = [];
      if (isAppFixture) {
        const { data: appPicks } = await supabase
          .from('app_picks')
          .select('user_id')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = appPicks || [];
      } else if (isTestFixture && testGwForPicks) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id')
          .eq('matchday', testGwForPicks)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = regularPicks || [];
      }

      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, player_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      const playerIdsByUser = new Map<string, string[]>();
      (subscriptions || []).forEach((sub: any) => {
        if (!sub.player_id) return;
        if (!playerIdsByUser.has(sub.user_id)) {
          playerIdsByUser.set(sub.user_id, []);
        }
        playerIdsByUser.get(sub.user_id)!.push(sub.player_id);
      });

      let totalSent = 0;
      const htMinute = minute !== null && minute !== undefined ? `${minute}'` : '';
      for (const userId of userIds) {
        const playerIds = playerIdsByUser.get(userId) || [];
        if (playerIds.length === 0) continue;

        const title = `⏸️ Half-Time`;
        const message = `${normalizedFixture.home_team} ${homeScore}-${awayScore} ${normalizedFixture.away_team}${htMinute ? ` ${htMinute}` : ''}`;

        const result = await sendOneSignalNotification(
          playerIds,
          title,
          message,
          {
            type: 'half_time',
            api_match_id: apiMatchId,
            fixture_index: normalizedFixture.fixture_index,
            gw: fixtureGw,
          }
        );

        if (result.success) {
          totalSent += result.sentTo;
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] Sent half-time notification to user ${userId} (${result.sentTo} devices)`);
        }
      }

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
    if (isFinished && oldStatus !== 'FINISHED' && oldStatus !== 'FT') {
      console.log(`[sendScoreNotificationsWebhook] 🏁 Game finished detected for match ${apiMatchId}`);
      // Get users who have picks
      let picks: any[] = [];
      if (isAppFixture) {
        const { data: appPicks } = await supabase
          .from('app_picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = appPicks || [];
      } else if (isTestFixture && testGwForPicks) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id, pick')
          .eq('matchday', testGwForPicks)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', normalizedFixture.fixture_index);
        picks = regularPicks || [];
      }

      // Calculate result
      let result = 'D';
      if (homeScore > awayScore) result = 'H';
      if (awayScore > homeScore) result = 'A';

      const userIds = Array.from(new Set(picks.map((p: any) => p.user_id)));
      
      // Load user notification preferences using shared utility
      const prefsMap = await loadUserNotificationPreferences(userIds);

      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, player_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      const playerIdsByUser = new Map<string, string[]>();
      (subscriptions || []).forEach((sub: any) => {
        if (!sub.player_id) return;
        if (!playerIdsByUser.has(sub.user_id)) {
          playerIdsByUser.set(sub.user_id, []);
        }
        playerIdsByUser.get(sub.user_id)!.push(sub.player_id);
      });

      // Calculate percentage of users who got it correct
      const totalPicks = picks.length;
      const correctPicks = picks.filter((p: any) => p.pick === result).length;
      const correctPercentage = totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0;

      let totalSent = 0;
      for (const pick of picks) {
        const playerIds = playerIdsByUser.get(pick.user_id) || [];
        if (playerIds.length === 0) continue;

        // Check if notification should be sent (OneSignal subscription + user preferences)
        const userPrefs = prefsMap.get(pick.user_id);
        if (userPrefs && userPrefs['final-whistle'] === false) {
          continue; // Skip if user disabled final-whistle notifications
        }

        const isCorrect = pick.pick === result;
        const title = `FT: ${fixture.home_team} ${homeScore}-${awayScore} ${fixture.away_team}`;
        
        // Format percentage message: remove brackets, add "Only" if 20% or below
        const percentageText = correctPercentage <= 20
          ? `Only ${correctPercentage}% of players got this fixture correct`
          : `${correctPercentage}% of players got this fixture correct`;
        
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

      // Check if all games in this GW are finished (end of gameweek)
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

