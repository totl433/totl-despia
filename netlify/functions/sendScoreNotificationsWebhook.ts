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
    console.log('[sendScoreNotificationsWebhook] Webhook received:', JSON.stringify(webhookPayload, null, 2));

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
      console.log('[sendScoreNotificationsWebhook] Ignoring webhook - not a live_scores update');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Ignored - not a live_scores update' }),
      };
    }

    const apiMatchId = record.api_match_id;
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

    // Check if this is a score change
    const isScoreChange = homeScore !== oldHomeScore || awayScore !== oldAwayScore;
    const isStatusChange = status !== oldStatus;
    const isKickoff = oldStatus !== 'IN_PLAY' && status === 'IN_PLAY' && homeScore === 0 && awayScore === 0;
    const isFinished = status === 'FINISHED' || status === 'FT';

    // Get fixture info
    const { data: fixture } = await supabase
      .from('fixtures')
      .select('fixture_index, gw, home_team, away_team')
      .eq('api_match_id', apiMatchId)
      .maybeSingle();

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

    // Get test GW
    const { data: testMeta } = await supabase
      .from('test_api_meta')
      .select('current_test_gw')
      .eq('id', 1)
      .maybeSingle();
    const testGw = testMeta?.current_test_gw;

    // Determine which GW this fixture belongs to
    const fixtureGw = fixture.gw || currentGw;
    const isTestFixture = fixtureGw === testGw;

    // Get notification state
    const { data: state } = await supabase
      .from('notification_state')
      .select('*')
      .eq('api_match_id', apiMatchId)
      .maybeSingle();

    // Process goals - check for new goals
    // Also handle score changes even if goals array is empty (for manual updates)
    if (isScoreChange) {
      // If no goals array or empty, create a simple notification for score change
      if (!Array.isArray(goals) || goals.length === 0) {
        // Score changed but no goals data - send simple score update notification
        let picks: any[] = [];
        if (isTestFixture && testGw) {
          const { data: testPicks } = await supabase
            .from('test_api_picks')
            .select('user_id, pick')
            .eq('matchday', testGw)
            .eq('fixture_index', fixture.fixture_index);
          picks = testPicks || [];
        } else {
          const { data: regularPicks } = await supabase
            .from('picks')
            .select('user_id, pick')
            .eq('gw', fixtureGw)
            .eq('fixture_index', fixture.fixture_index);
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
              fixture_index: fixture.fixture_index,
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

      // Original logic for when goals array exists and has items
      if (Array.isArray(goals) && goals.length > 0) {
      const normalizeGoalKey = (g: any): string => {
        if (!g || typeof g !== 'object') return '';
        const scorer = (g.scorer || '').toString().trim().toLowerCase();
        const minute = g.minute !== null && g.minute !== undefined ? String(g.minute) : '';
        const teamId = g.teamId !== null && g.teamId !== undefined ? String(g.teamId) : '';
        return `${scorer}|${minute}|${teamId}`;
      };

      const currentGoalsHash = JSON.stringify(goals.map(normalizeGoalKey).sort());
      const previousGoals = state?.last_notified_goals || oldGoals || [];
      const previousGoalsArray = Array.isArray(previousGoals) ? previousGoals : [];
      const previousGoalsHash = JSON.stringify(previousGoalsArray.map(normalizeGoalKey).sort());

      // Skip if we've already notified for these exact goals (within last 2 minutes)
      if (previousGoalsHash === currentGoalsHash && state?.last_notified_at) {
        const lastNotifiedTime = new Date(state.last_notified_at).getTime();
        const now = Date.now();
        const twoMinutes = 2 * 60 * 1000;
        if (now - lastNotifiedTime < twoMinutes) {
          console.log(`[sendScoreNotificationsWebhook] 🚫 SKIPPING - already notified for these goals`);
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
        return !previousGoalKeys.has(key);
      });

      if (newGoals.length === 0) {
        console.log(`[sendScoreNotificationsWebhook] 🚫 SKIPPING - no new goals`);
        // Update state but don't send notification
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
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'No new goals' }),
        };
      }

      // Update state immediately before sending
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

      // Get users who have picks for this fixture
      let picks: any[] = [];
      if (isTestFixture && testGw) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id, pick')
          .eq('matchday', testGw)
          .eq('fixture_index', fixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', fixture.fixture_index);
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

      for (const pick of picks) {
        const playerIds = playerIdsByUser.get(pick.user_id) || [];
        if (playerIds.length === 0) continue;

        const title = `⚽ GOAL! ${fixture.home_team} ${homeScore}-${awayScore} ${fixture.away_team}`;
        const message = `${scorer}${goalMinute ? ` ${goalMinute}` : ''}`;

        const result = await sendOneSignalNotification(
          playerIds,
          title,
          message,
          {
            type: 'goal',
            api_match_id: apiMatchId,
            fixture_index: fixture.fixture_index,
            gw: fixtureGw,
          }
        );

        if (result.success) {
          totalSent += result.sentTo;
          console.log(`[sendScoreNotificationsWebhook] Sent goal notification to user ${pick.user_id} (${result.sentTo} devices)`);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Notification sent',
          sentTo: totalSent,
          newGoals: newGoals.length,
        }),
      };
      }
    }

    // Handle kickoff
    if (isKickoff) {
      // Get users who have picks
      let picks: any[] = [];
      if (isTestFixture && testGw) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id')
          .eq('matchday', testGw)
          .eq('fixture_index', fixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id')
          .eq('gw', fixtureGw)
          .eq('fixture_index', fixture.fixture_index);
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

        const title = `⚽ ${fixture.home_team} vs ${fixture.away_team}`;
        const message = `Kickoff!`;

        const result = await sendOneSignalNotification(
          playerIds,
          title,
          message,
          {
            type: 'kickoff',
            api_match_id: apiMatchId,
            fixture_index: fixture.fixture_index,
            gw: fixtureGw,
          }
        );

        if (result.success) {
          totalSent += result.sentTo;
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
          last_notified_goals: goals,
          last_notified_red_cards: redCards || null,
        } as any, {
          onConflict: 'api_match_id',
        });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Kickoff notification sent',
          sentTo: totalSent,
        }),
      };
    }

    // Handle game finished
    if (isFinished && oldStatus !== 'FINISHED' && oldStatus !== 'FT') {
      // Get users who have picks
      let picks: any[] = [];
      if (isTestFixture && testGw) {
        const { data: testPicks } = await supabase
          .from('test_api_picks')
          .select('user_id, pick')
          .eq('matchday', testGw)
          .eq('fixture_index', fixture.fixture_index);
        picks = testPicks || [];
      } else {
        const { data: regularPicks } = await supabase
          .from('picks')
          .select('user_id, pick')
          .eq('gw', fixtureGw)
          .eq('fixture_index', fixture.fixture_index);
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

      let totalSent = 0;
      for (const pick of picks) {
        const playerIds = playerIdsByUser.get(pick.user_id) || [];
        if (playerIds.length === 0) continue;

        const isCorrect = pick.pick === result;
        const title = `FT: ${fixture.home_team} ${homeScore}-${awayScore} ${fixture.away_team}`;
        const message = isCorrect ? `✅ Got it right!` : `❌ Wrong pick`;

        const result2 = await sendOneSignalNotification(
          playerIds,
          title,
          message,
          {
            type: 'game_finished',
            api_match_id: apiMatchId,
            fixture_index: fixture.fixture_index,
            gw: fixtureGw,
          }
        );

        if (result2.success) {
          totalSent += result2.sentTo;
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

