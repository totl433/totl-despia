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
    console.error(`[sendScoreNotifications] Error checking subscription for ${playerId}:`, e);
    return { subscribed: false };
  }
}

// Send notification via OneSignal
async function sendOneSignalNotification(
  playerIds: string[],
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<{ success: boolean; sentTo: number; errors?: any[] }> {
  if (playerIds.length === 0) {
    return { success: true, sentTo: 0 };
  }

  // Verify subscriptions first
  const checks = await Promise.allSettled(
    playerIds.map(async (playerId) => {
      const result = await isSubscribed(playerId, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);
      return { playerId, subscribed: result.subscribed };
    })
  );

  const validPlayerIds = playerIds.filter((playerId, i) => {
    const check = checks[i];
    if (check.status === 'fulfilled') {
      return check.value.subscribed;
    }
    return false;
  });

  if (validPlayerIds.length === 0) {
    return { success: true, sentTo: 0 };
  }

  const payload: any = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: message },
    include_player_ids: validPlayerIds,
  };

  if (data) {
    payload.data = data;
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('[sendScoreNotifications] OneSignal API error:', result);
      return { success: false, sentTo: 0, errors: result.errors };
    }

    return { success: true, sentTo: result.recipients || 0 };
  } catch (error: any) {
    console.error('[sendScoreNotifications] Error sending notification:', error);
    return { success: false, sentTo: 0, errors: [error.message] };
  }
}

// Format minute display
function formatMinuteDisplay(status: string, minute: number | null | undefined): string {
  if (status === 'FINISHED') return 'FT';
  if (status === 'PAUSED') return 'HT';
  if (minute === null || minute === undefined) return 'LIVE';
  if (minute > 45 && minute <= 90) return 'Second Half';
  if (minute >= 1 && minute <= 45) return 'First Half';
  return 'LIVE';
}

async function checkAndSendScoreNotifications() {
  try {
    // Get current GW
    const { data: metaData, error: metaError } = await supabase
      .from('meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();

    if (metaError || !metaData) {
      console.error('[sendScoreNotifications] Failed to get current GW:', metaError);
      return;
    }

    const currentGw = (metaData as any)?.current_gw ?? 1;

    // Get all live scores for current GW
    const { data: liveScores, error: scoresError } = await supabase
      .from('live_scores')
      .select('*')
      .eq('gw', currentGw)
      .in('status', ['IN_PLAY', 'PAUSED', 'FINISHED']);

    if (scoresError) {
      console.error('[sendScoreNotifications] Error fetching live scores:', scoresError);
      return;
    }

    if (!liveScores || liveScores.length === 0) {
      console.log('[sendScoreNotifications] No live scores found for GW', currentGw);
      return;
    }

    console.log(`[sendScoreNotifications] Checking ${liveScores.length} live scores for notifications`);

    // Get notification state for all matches
    const apiMatchIds = liveScores.map(s => s.api_match_id);
    const { data: notificationStates, error: stateError } = await supabase
      .from('notification_state')
      .select('*')
      .in('api_match_id', apiMatchIds);

    if (stateError) {
      console.error('[sendScoreNotifications] Error fetching notification state:', stateError);
    }

    const stateMap = new Map<number, any>();
    (notificationStates || []).forEach((state: any) => {
      stateMap.set(state.api_match_id, state);
    });

    // Get fixtures to get team names
    const { data: testFixtures } = await supabase
      .from('test_api_fixtures')
      .select('api_match_id, fixture_index, home_team, away_team')
      .in('api_match_id', apiMatchIds);

    const { data: regularFixtures } = await supabase
      .from('fixtures')
      .select('api_match_id, fixture_index, home_team, away_team')
      .in('api_match_id', apiMatchIds);

    const allFixtures = [
      ...(testFixtures || []),
      ...(regularFixtures || []),
    ];

    const fixtureMap = new Map<number, any>();
    allFixtures.forEach((f: any) => {
      fixtureMap.set(f.api_match_id, f);
    });

    // Check each live score for changes
    const notificationsToSend: Array<{
      apiMatchId: number;
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      status: string;
      minute: number | null;
      isFinished: boolean;
      isScoreChange: boolean;
      isGameFinished: boolean;
    }> = [];

    for (const score of liveScores) {
      const state = stateMap.get(score.api_match_id);
      const fixture = fixtureMap.get(score.api_match_id);

      if (!fixture) {
        console.warn(`[sendScoreNotifications] No fixture found for api_match_id ${score.api_match_id}`);
        continue;
      }

      const homeScore = score.home_score ?? 0;
      const awayScore = score.away_score ?? 0;
      const status = score.status || 'SCHEDULED';
      const isFinished = status === 'FINISHED';

      // Check if this is a new match (no state) or if scores changed
      const isNewMatch = !state;
      const scoreChanged = isNewMatch || 
        state.last_notified_home_score !== homeScore || 
        state.last_notified_away_score !== awayScore;
      const statusChanged = isNewMatch || state.last_notified_status !== status;
      const justFinished = !isNewMatch && state.last_notified_status !== 'FINISHED' && isFinished;

      // Only notify on score changes or game finishing
      if (scoreChanged || justFinished) {
        notificationsToSend.push({
          apiMatchId: score.api_match_id,
          homeTeam: fixture.home_team || 'Home',
          awayTeam: fixture.away_team || 'Away',
          homeScore,
          awayScore,
          status,
          minute: score.minute,
          isFinished,
          isScoreChange: scoreChanged && !justFinished,
          isGameFinished: justFinished,
        });
      }
    }

    if (notificationsToSend.length === 0) {
      console.log('[sendScoreNotifications] No score changes detected, no notifications to send');
      return;
    }

    console.log(`[sendScoreNotifications] Sending ${notificationsToSend.length} notifications`);

    // Get all users who have picks for these fixtures
    const fixtureIndices = notificationsToSend
      .map(n => fixtureMap.get(n.apiMatchId)?.fixture_index)
      .filter(Boolean);

    if (fixtureIndices.length === 0) {
      console.log('[sendScoreNotifications] No fixture indices found, skipping user-specific notifications');
      return;
    }

    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('user_id, fixture_index, pick, gw')
      .eq('gw', currentGw)
      .in('fixture_index', fixtureIndices);

    if (picksError) {
      console.error('[sendScoreNotifications] Error fetching picks:', picksError);
    }

    // Group picks by user and fixture
    const picksByUserAndFixture = new Map<string, Map<number, string>>();
    (picks || []).forEach((pick: any) => {
      if (!picksByUserAndFixture.has(pick.user_id)) {
        picksByUserAndFixture.set(pick.user_id, new Map());
      }
      picksByUserAndFixture.get(pick.user_id)!.set(pick.fixture_index, pick.pick);
    });

    // Get player IDs for users who have picks
    const userIds = Array.from(picksByUserAndFixture.keys());
    if (userIds.length === 0) {
      console.log('[sendScoreNotifications] No users with picks found');
      return;
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, player_id')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (subsError) {
      console.error('[sendScoreNotifications] Error fetching subscriptions:', subsError);
      return;
    }

    // Group player IDs by user
    const playerIdsByUser = new Map<string, string[]>();
    (subscriptions || []).forEach((sub: any) => {
      if (!sub.player_id) return;
      if (!playerIdsByUser.has(sub.user_id)) {
        playerIdsByUser.set(sub.user_id, []);
      }
      playerIdsByUser.get(sub.user_id)!.push(sub.player_id);
    });

    // Send notifications
    let totalSent = 0;
    for (const notification of notificationsToSend) {
      const fixture = fixtureMap.get(notification.apiMatchId);
      const fixtureIndex = fixture?.fixture_index;

      // Find users who have picks for this fixture
      const relevantUserIds = Array.from(picksByUserAndFixture.keys()).filter(userId => {
        const userPicks = picksByUserAndFixture.get(userId);
        return userPicks && userPicks.has(fixtureIndex);
      });

      // Get all player IDs for these users
      const allPlayerIds: string[] = [];
      relevantUserIds.forEach(userId => {
        const playerIds = playerIdsByUser.get(userId) || [];
        allPlayerIds.push(...playerIds);
      });

      if (allPlayerIds.length === 0) {
        console.log(`[sendScoreNotifications] No player IDs found for fixture ${fixtureIndex}`);
        continue;
      }

      // Create notification message
      const minuteText = formatMinuteDisplay(notification.status, notification.minute);
      let title: string;
      let message: string;

      if (notification.isGameFinished) {
        title = `FT: ${notification.homeTeam} ${notification.homeScore}-${notification.awayScore} ${notification.awayTeam}`;
        message = `Game finished!`;
      } else if (notification.isScoreChange) {
        title = `⚽ GOAL! ${notification.homeTeam} ${notification.homeScore}-${notification.awayScore} ${notification.awayTeam}`;
        message = `${minuteText}`;
      } else {
        continue; // Skip if no meaningful change
      }

      // Send notification
      const result = await sendOneSignalNotification(
        allPlayerIds,
        title,
        message,
        {
          type: 'score_update',
          api_match_id: notification.apiMatchId,
          fixture_index: fixtureIndex,
          gw: currentGw,
        }
      );

      if (result.success) {
        totalSent += result.sentTo;
        console.log(`[sendScoreNotifications] Sent notification for match ${notification.apiMatchId} to ${result.sentTo} devices`);
      } else {
        console.error(`[sendScoreNotifications] Failed to send notification for match ${notification.apiMatchId}:`, result.errors);
      }

      // Update notification state
      await supabase
        .from('notification_state')
        .upsert({
          api_match_id: notification.apiMatchId,
          last_notified_home_score: notification.homeScore,
          last_notified_away_score: notification.awayScore,
          last_notified_status: notification.status,
          last_notified_at: new Date().toISOString(),
        }, {
          onConflict: 'api_match_id',
        });
    }

    console.log(`[sendScoreNotifications] Total notifications sent: ${totalSent}`);

    // Check if all games in the GW are finished (end-of-GW detection)
    // Get ALL fixtures for this GW (regular + test) to check if all are finished
    const { data: regularGwFixtures } = await supabase
      .from('fixtures')
      .select('api_match_id')
      .eq('gw', currentGw)
      .not('api_match_id', 'is', null);

    const { data: testGwFixtures } = await supabase
      .from('test_api_fixtures')
      .select('api_match_id')
      .eq('test_gw', currentGw)
      .not('api_match_id', 'is', null);

    const allGwApiMatchIds = [
      ...((regularGwFixtures || []).map((f: any) => f.api_match_id)),
      ...((testGwFixtures || []).map((f: any) => f.api_match_id)),
    ];

    if (allGwApiMatchIds.length > 0) {
      // Get status of all fixtures for this GW
      const { data: allGwScores } = await supabase
        .from('live_scores')
        .select('status')
        .in('api_match_id', allGwApiMatchIds);

      const allFinished = allGwScores && 
        allGwScores.length === allGwApiMatchIds.length &&
        allGwScores.every((score: any) => score.status === 'FINISHED');

      if (allFinished) {
        // Check if we've already sent end-of-GW notification (use a special marker)
        const { data: gwEndState } = await supabase
          .from('notification_state')
          .select('*')
          .eq('api_match_id', 999999 - currentGw) // Use a special marker ID
          .maybeSingle();

        if (!gwEndState) {
          console.log(`[sendScoreNotifications] All ${allGwApiMatchIds.length} games finished for GW ${currentGw}, sending end-of-GW notification`);

          // Get all users who have picks for this GW
          const { data: gwPicks } = await supabase
            .from('picks')
            .select('user_id')
            .eq('gw', currentGw);

          const userIdsWithPicks = [...new Set((gwPicks || []).map((p: any) => p.user_id))];

          if (userIdsWithPicks.length > 0) {
            const { data: subscriptions } = await supabase
              .from('push_subscriptions')
              .select('player_id')
              .in('user_id', userIdsWithPicks)
              .eq('is_active', true);

            const allPlayerIds = (subscriptions || []).map((s: any) => s.player_id).filter(Boolean);

            if (allPlayerIds.length > 0) {
              const result = await sendOneSignalNotification(
                allPlayerIds,
                `GW${currentGw} Complete! 🎉`,
                `All games finished. Check your results!`,
                {
                  type: 'gw_complete',
                  gw: currentGw,
                }
              );

              if (result.success) {
                console.log(`[sendScoreNotifications] Sent end-of-GW notification to ${result.sentTo} devices`);
                
                // Mark that we've sent the end-of-GW notification (use special marker ID)
                await supabase
                  .from('notification_state')
                  .upsert({
                    api_match_id: 999999 - currentGw, // Special marker ID
                    last_notified_home_score: 0,
                    last_notified_away_score: 0,
                    last_notified_status: 'GW_COMPLETE',
                    last_notified_at: new Date().toISOString(),
                  }, {
                    onConflict: 'api_match_id',
                  });
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[sendScoreNotifications] Error:', error);
    throw error;
  }
}

export const handler: Handler = async (event) => {
  console.log('[sendScoreNotifications] Invoked', event.source || 'manually');
  
  try {
    await checkAndSendScoreNotifications();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: true, message: 'Score notifications checked and sent' }),
    };
  } catch (error: any) {
    console.error('[sendScoreNotifications] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error?.message || 'Failed to send score notifications' }),
    };
  }
};

