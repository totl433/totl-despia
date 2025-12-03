import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Check if a Player ID is subscribed in OneSignal
async function isSubscribed(
  playerId: string,
  appId: string,
  restKey: string
): Promise<{ subscribed: boolean; player?: any }> {
  const OS_BASE = 'https://onesignal.com/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${restKey}`,
  };

  try {
    const url = `${OS_BASE}/players/${playerId}?app_id=${appId}`;
    const r = await fetch(url, { headers });
    
    if (!r.ok) {
      return { subscribed: false };
    }

    const player = await r.json();
    const hasToken = !!player.identifier;
    const notInvalid = !player.invalid_identifier;
    const notificationTypes = player.notification_types;
    
    const explicitlySubscribed = notificationTypes === 1;
    const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
    const stillInitializing = (notificationTypes === null || notificationTypes === undefined) && hasToken && notInvalid;
    
    const subscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);
    return { subscribed, player };
  } catch (e) {
    console.error(`[sendScoreNotificationsWebhook] Error checking subscription for ${playerId}:`, e);
    return { subscribed: false };
  }
}

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

  // Filter to only subscribed players
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

    const oldHomeScore = old_record?.home_score ?? 0;
    const oldAwayScore = old_record?.away_score ?? 0;
    const oldStatus = old_record?.status;
    const oldGoals = old_record?.goals || [];

    // Check if goals array changed (compare JSON strings to detect any changes)
    const goalsChanged = JSON.stringify(goals || []) !== JSON.stringify(oldGoals || []);

    // Check if this is a score change
    const isScoreChange = homeScore !== oldHomeScore || awayScore !== oldAwayScore;
    const isStatusChange = status !== oldStatus;
    const isKickoff = oldStatus !== 'IN_PLAY' && status === 'IN_PLAY' && homeScore === 0 && awayScore === 0;
    const isHalfTime = oldStatus === 'IN_PLAY' && status === 'PAUSED';
    const isFinished = status === 'FINISHED' || status === 'FT';

    console.log(`[sendScoreNotificationsWebhook] Change detection:`, {
      scoreChange: isScoreChange,
      goalsChanged,
      homeScore: `${oldHomeScore} -> ${homeScore}`,
      awayScore: `${oldAwayScore} -> ${awayScore}`,
      currentGoalsCount: Array.isArray(goals) ? goals.length : 0,
      oldGoalsCount: Array.isArray(oldGoals) ? oldGoals.length : 0,
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

    // Process goals - ALWAYS check for new goals if goals exist, regardless of score change
    // This handles cases where webhook fires after goal is already in database
    // We compare against state.last_notified_goals (what we've already notified), not old_record.goals
    if (Array.isArray(goals) && goals.length > 0) {
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
      
      // If both increased (shouldn't happen, but handle it), use teamId from goal if available
      let isHomeTeam: boolean;
      if (homeScoreIncreased && !awayScoreIncreased) {
        isHomeTeam = true;
      } else if (awayScoreIncreased && !homeScoreIncreased) {
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
      
      // Format score with new goal highlighted (FotMob style)
      // Example: "Team A 1 - [2] Team B" or "Team A [1] - 0 Team B"
      let scoreDisplay: string;
      if (isHomeTeam) {
        scoreDisplay = `${normalizedFixture.home_team} [${homeScore}] - ${awayScore} ${normalizedFixture.away_team}`;
      } else {
        scoreDisplay = `${normalizedFixture.home_team} ${homeScore} - [${awayScore}] ${normalizedFixture.away_team}`;
      }

      for (const pick of picks) {
        const playerIds = playerIdsByUser.get(pick.user_id) || [];
        if (playerIds.length === 0) continue;

        const teamName = isHomeTeam ? normalizedFixture.home_team : normalizedFixture.away_team;
        const title = `${teamName} scores!`;
        const message = `${goalMinute} ${scorer}\n${scoreDisplay}`;

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
          console.log(`[sendScoreNotificationsWebhook] [${requestId}] Sent goal notification to user ${pick.user_id} (${result.sentTo} devices)`);
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
    if (isScoreChange && (!Array.isArray(goals) || goals.length === 0)) {
      // Score changed but no goals data - send simple score update notification
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
    if (isKickoff) {
      // Check if we've already sent a kickoff notification for this match
      // Only send if we haven't notified for kickoff yet
      const hasNotifiedKickoff = state?.last_notified_status === 'IN_PLAY' && 
                                 state?.last_notified_home_score === 0 && 
                                 state?.last_notified_away_score === 0;
      
      if (hasNotifiedKickoff) {
        console.log(`[sendScoreNotificationsWebhook] 🚫 SKIPPING - already sent kickoff notification for match ${apiMatchId}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Already notified for kickoff' }),
        };
      }

      // CRITICAL: Update state IMMEDIATELY before sending notifications
      // This prevents duplicate notifications if webhook fires multiple times
      await supabase
        .from('notification_state')
        .upsert({
          api_match_id: apiMatchId,
          last_notified_home_score: 0,
          last_notified_away_score: 0,
          last_notified_status: 'IN_PLAY',
          last_notified_at: new Date().toISOString(),
          last_notified_goals: null,
          last_notified_red_cards: null,
        } as any, {
          onConflict: 'api_match_id',
        });
      console.log(`[sendScoreNotificationsWebhook] ✅ State updated IMMEDIATELY for kickoff match ${apiMatchId}`);

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
      for (const userId of userIds) {
        const playerIds = playerIdsByUser.get(userId) || [];
        if (playerIds.length === 0) continue;

        const title = `⚽ ${normalizedFixture.home_team} vs ${normalizedFixture.away_team}`;
        const message = `Kickoff!`;

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

