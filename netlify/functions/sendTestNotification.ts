/**
 * Test Notification Sender
 * 
 * Allows developers to trigger test notifications from the docs site.
 * Requires admin authorization in production.
 */
import type { Handler } from '@netlify/functions';
import { dispatchNotification } from './lib/notifications/dispatch';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    },
    body: JSON.stringify(body),
  };
}

// Generate event_id based on notification type and params
function generateEventId(notificationType: string, params: Record<string, any>): string {
  const timestamp = Date.now();
  
  switch (notificationType) {
    case 'goal-scored':
      return `goal:${params.api_match_id || 'test'}:${params.scorer || 'test'}:${params.minute || 0}:test_${timestamp}`;
    case 'goal-disallowed':
      return `goal_disallowed:${params.api_match_id || 'test'}:${params.minute || 0}:test_${timestamp}`;
    case 'kickoff':
      return `kickoff:${params.api_match_id || 'test'}:${params.half || 1}:test_${timestamp}`;
    case 'half-time':
      return `halftime:${params.api_match_id || 'test'}:test_${timestamp}`;
    case 'final-whistle':
      return `ft:${params.api_match_id || 'test'}:test_${timestamp}`;
    case 'gameweek-complete':
      return `gw_complete:${params.gw || 1}:test_${timestamp}`;
    case 'chat-message':
      return `chat:${params.league_id || 'test'}:${params.message_id || timestamp}:test_${timestamp}`;
    case 'final-submission':
      return `final_sub:${params.league_id || 'test'}:${params.gw || 1}:test_${timestamp}`;
    case 'new-gameweek':
      return `new_gw:${params.gw || 1}:test_${timestamp}`;
    default:
      return `test:${notificationType}:${timestamp}`;
  }
}

// Build notification content based on type
function buildNotificationContent(
  notificationType: string,
  params: Record<string, any>
): { title: string; body: string; data: Record<string, any> } {
  switch (notificationType) {
    case 'goal-scored':
      return {
        title: `⚽ ${params.team_name || 'Team'} scores!`,
        body: `${params.minute || '?'}' ${params.scorer || 'Goal'}\n${params.home_team || 'Home'} [${params.home_score ?? 0}] - ${params.away_score ?? 0} ${params.away_team || 'Away'}`,
        data: {
          type: 'goal',
          api_match_id: params.api_match_id,
          fixture_index: params.fixture_index,
          gw: params.gw,
          is_test: true,
        },
      };
    case 'goal-disallowed':
      return {
        title: `❌ Goal Disallowed`,
        body: `${params.minute || '?'}' ${params.team_name || 'Team'}'s goal ruled out by VAR`,
        data: {
          type: 'goal_disallowed',
          api_match_id: params.api_match_id,
          is_test: true,
        },
      };
    case 'kickoff':
      return {
        title: `🟢 ${params.half === 2 ? 'Second Half' : 'Kick Off'}!`,
        body: `${params.home_team || 'Home'} vs ${params.away_team || 'Away'} is underway`,
        data: {
          type: 'kickoff',
          api_match_id: params.api_match_id,
          half: params.half || 1,
          is_test: true,
        },
      };
    case 'half-time':
      return {
        title: `⏸️ Half-Time`,
        body: `${params.home_team || 'Home'} ${params.home_score ?? 0} - ${params.away_score ?? 0} ${params.away_team || 'Away'}`,
        data: {
          type: 'half-time',
          api_match_id: params.api_match_id,
          is_test: true,
        },
      };
    case 'final-whistle':
      return {
        title: `🏁 Full Time`,
        body: `${params.home_team || 'Home'} ${params.home_score ?? 0} - ${params.away_score ?? 0} ${params.away_team || 'Away'}`,
        data: {
          type: 'final-whistle',
          api_match_id: params.api_match_id,
          is_test: true,
        },
      };
    case 'gameweek-complete':
      return {
        title: `🎉 Gameweek ${params.gw || '?'} Complete`,
        body: `All matches finished. Check your results!`,
        data: {
          type: 'gameweek-complete',
          gw: params.gw,
          is_test: true,
        },
      };
    case 'chat-message':
      return {
        title: `💬 ${params.sender_name || 'Someone'}`,
        body: params.content || 'New message in league chat',
        data: {
          type: 'chat',
          league_id: params.league_id,
          is_test: true,
        },
      };
    case 'member-join':
      return {
        title: `👤 ${params.user_name || 'Someone'} Joined!`,
        body: `${params.user_name || 'Someone'} joined ${params.league_name || 'your league'}`,
        data: {
          type: 'member-join',
          league_id: params.league_id,
          user_id: params.user_id,
          is_test: true,
        },
      };
    case 'prediction-reminder':
      return {
        title: `⏰ Gameweek ${params.gw || '?'} Predictions Due Soon!`,
        body: '5 hours to go!',
        data: {
          type: 'prediction-reminder',
          gw: params.gw,
          is_test: true,
        },
      };
    case 'final-submission':
      return {
        title: `✅ All Picks Submitted`,
        body: `Everyone in your league has submitted their GW${params.gw || '?'} picks`,
        data: {
          type: 'final-submission',
          league_id: params.league_id,
          gw: params.gw,
          is_test: true,
        },
      };
    case 'new-gameweek':
      return {
        title: `🆕 Gameweek ${params.gw || '?'} is Open!`,
        body: `New fixtures available. Make your picks now!`,
        data: {
          type: 'new-gameweek',
          gw: params.gw,
          is_test: true,
        },
      };
    default:
      return {
        title: `🔔 Test Notification`,
        body: `This is a test notification of type: ${notificationType}`,
        data: { type: notificationType, is_test: true },
      };
  }
}

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { notification_type, user_id, params = {} } = payload;

  // Validate required fields
  if (!notification_type) {
    return json(400, { error: 'notification_type is required' });
  }

  if (!user_id) {
    return json(400, { error: 'user_id is required' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(user_id)) {
    return json(400, { error: 'user_id must be a valid UUID' });
  }

  // Valid notification types
  const validTypes = [
    'goal-scored',
    'goal-disallowed',
    'kickoff',
    'half-time',
    'final-whistle',
    'gameweek-complete',
    'chat-message',
    'member-join',
    'final-submission',
    'prediction-reminder',
    'new-gameweek',
  ];

  if (!validTypes.includes(notification_type)) {
    return json(400, {
      error: `Invalid notification_type. Must be one of: ${validTypes.join(', ')}`,
    });
  }

  try {
    // Generate event ID
    const event_id = generateEventId(notification_type, params);

    // Build notification content
    const { title, body, data } = buildNotificationContent(notification_type, params);

    // Build grouping params
    const grouping_params: Record<string, string | number> = {};
    if (params.api_match_id) grouping_params.api_match_id = params.api_match_id;
    if (params.league_id) grouping_params.league_id = params.league_id;
    if (params.gw) grouping_params.gw = params.gw;
    if (params.half) grouping_params.half = params.half;

    console.log(`[sendTestNotification] Sending ${notification_type} to user ${user_id}`);
    console.log(`[sendTestNotification] Event ID: ${event_id}`);
    console.log(`[sendTestNotification] Title: ${title}`);
    console.log(`[sendTestNotification] Body: ${body}`);

    // Dispatch the notification
    const result = await dispatchNotification({
      notification_key: notification_type,
      event_id,
      user_ids: [user_id],
      title,
      body,
      data,
      grouping_params,
      skip_preference_check: true, // Skip prefs for test notifications
      skip_cooldown_check: true,   // Skip cooldown for test notifications
      league_id: params.league_id,
    });

    console.log(`[sendTestNotification] Result:`, JSON.stringify(result, null, 2));

    // Return detailed result
    return json(200, {
      success: result.results.accepted > 0,
      notification_type,
      event_id,
      title,
      body,
      result: {
        accepted: result.results.accepted,
        failed: result.results.failed,
        suppressed_duplicate: result.results.suppressed_duplicate,
        suppressed_unsubscribed: result.results.suppressed_unsubscribed,
      },
      user_result: result.user_results[0] || null,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error: any) {
    console.error('[sendTestNotification] Error:', error);
    return json(500, {
      error: 'Failed to send notification',
      details: error.message,
    });
  }
};

