import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed } from './utils/notificationHelpers';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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
      console.error('[notifyFinalSubmission] OneSignal API error:', result);
      return { success: false, sentTo: 0, errors: result.errors };
    }

    return { success: true, sentTo: result.recipients || 0 };
  } catch (error: any) {
    console.error('[notifyFinalSubmission] Error sending notification:', error);
    return { success: false, sentTo: 0, errors: [error.message] };
  }
}

/**
 * Check if all members have submitted and notify league members
 * This should be called when a submission is made (via database trigger or scheduled function)
 */
async function checkAndNotifyFinalSubmission(
  leagueId: string,
  matchday: number,
  isTestApi: boolean = false
) {
  try {
    // Get all league members
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId);

    if (membersError || !members || members.length === 0) {
      console.error('[notifyFinalSubmission] Error fetching league members:', membersError);
      return;
    }

    const memberIds = members.map((m: any) => m.user_id);

    // Check submissions - try app_gw_submissions first (for GW14+ created via API Admin), 
    // then fall back to test_api_submissions or gw_submissions
    let submissions: any[] = [];
    let subsError: any = null;
    
    // First, try app_gw_submissions (for app tables)
    const { data: appSubmissions, error: appSubsError } = await supabase
      .from('app_gw_submissions')
      .select('user_id')
      .eq('gw', matchday)
      .in('user_id', memberIds)
      .not('submitted_at', 'is', null);
    
    if (!appSubsError && appSubmissions && appSubmissions.length > 0) {
      // Use app_gw_submissions
      submissions = appSubmissions;
      console.log(`[notifyFinalSubmission] Using app_gw_submissions for matchday ${matchday}`);
    } else {
      // Fall back to test_api_submissions or gw_submissions
      const submissionsTable = isTestApi ? 'test_api_submissions' : 'gw_submissions';
      const matchdayField = isTestApi ? 'matchday' : 'gw';
      
      const { data: regularSubmissions, error: regularSubsError } = await supabase
        .from(submissionsTable)
        .select('user_id')
        .eq(matchdayField, matchday)
        .in('user_id', memberIds)
        .not('submitted_at', 'is', null);
      
      submissions = regularSubmissions || [];
      subsError = regularSubsError;
    }

    if (subsError) {
      console.error('[notifyFinalSubmission] Error fetching submissions:', subsError);
      return;
    }

    const submittedUserIds = new Set((submissions || []).map((s: any) => s.user_id));
    const allSubmitted = submittedUserIds.size === memberIds.length;

    if (allSubmitted) {
      console.log(`[notifyFinalSubmission] All ${memberIds.length} members have submitted for league ${leagueId}, matchday ${matchday}`);

      // Check if we've already sent this notification
      const notificationKey = `final_submission_${leagueId}_${matchday}_${isTestApi ? 'test' : 'regular'}`;
      const { data: existingNotification } = await supabase
        .from('notification_state')
        .select('*')
        .eq('api_match_id', 888888 - matchday) // Use special marker
        .maybeSingle();

      // Use a more specific marker that includes league ID hash
      const leagueHash = leagueId.split('-')[0];
      const markerId = 888888 - matchday - parseInt(leagueHash.slice(0, 6), 16) % 10000;

      const { data: existingNotification2 } = await supabase
        .from('notification_state')
        .select('*')
        .eq('api_match_id', markerId)
        .maybeSingle();

      if (existingNotification2) {
        console.log('[notifyFinalSubmission] Notification already sent, skipping');
        return;
      }

      // Get league name
      const { data: league } = await supabase
        .from('leagues')
        .select('name')
        .eq('id', leagueId)
        .maybeSingle();

      const leagueName = league?.name || 'your league';

      // Get player IDs for all league members
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, player_id')
        .in('user_id', memberIds)
        .eq('is_active', true);

      const allPlayerIds = (subscriptions || [])
        .map((s: any) => s.player_id)
        .filter(Boolean);

      if (allPlayerIds.length > 0) {
        const matchdayLabel = isTestApi ? `Test GW ${matchday}` : `GW ${matchday}`;
        const result = await sendOneSignalNotification(
          allPlayerIds,
          `All predictions submitted! 🎉`,
          `Everyone in ${leagueName} has submitted for ${matchdayLabel}. Check out who picked what!`,
          {
            type: 'final_submission',
            league_id: leagueId,
            matchday: matchday,
            is_test_api: isTestApi,
          }
        );

        if (result.success) {
          console.log(`[notifyFinalSubmission] Sent final submission notification to ${result.sentTo} devices`);
          
          // Mark that we've sent this notification
          await supabase
            .from('notification_state')
            .upsert({
              api_match_id: markerId,
              last_notified_home_score: 0,
              last_notified_away_score: 0,
              last_notified_status: 'FINAL_SUBMISSION',
              last_notified_at: new Date().toISOString(),
            }, {
              onConflict: 'api_match_id',
            });
        } else {
          console.error('[notifyFinalSubmission] Failed to send notification:', result.errors);
        }
      } else {
        console.log('[notifyFinalSubmission] No active subscriptions found for league members');
      }
    } else {
      const remaining = memberIds.length - submittedUserIds.size;
      console.log(`[notifyFinalSubmission] Not all submitted yet: ${remaining} remaining in league ${leagueId}`);
    }
  } catch (error: any) {
    console.error('[notifyFinalSubmission] Error:', error);
    throw error;
  }
}

export const handler: Handler = async (event) => {
  console.log('[notifyFinalSubmission] Invoked', event.source || 'manually');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    let payload: any;
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const { leagueId, matchday, isTestApi } = payload;

    if (!leagueId || matchday === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing leagueId or matchday' }),
      };
    }

    await checkAndNotifyFinalSubmission(leagueId, matchday, isTestApi || false);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Final submission check completed' }),
    };
  } catch (error: any) {
    console.error('[notifyFinalSubmission] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error?.message || 'Failed to check final submission' }),
    };
  }
};

