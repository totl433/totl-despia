/**
 * Final Submission Notification (V2 - using unified dispatcher)
 * 
 * Migrated to use the new notification system.
 * 
 * Changes:
 * - Uses dispatchNotification() instead of direct OneSignal API calls
 * - Works for all mini-leagues (not just test league)
 * - Checks all pick tables (picks, app_picks, test_api_picks)
 * - Uses unified idempotency via notification_send_log
 * - Removed emoji from title
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification, formatEventId } from './lib/notifications';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Check if all members have submitted and notify league members
 * Works for all mini-leagues by checking all pick tables
 */
async function checkAndNotifyFinalSubmission(
  leagueId: string,
  gw: number
) {
  try {
    // Get all league members
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId);

    if (membersError || !members || members.length === 0) {
      console.error('[notifyFinalSubmission] Error fetching league members:', membersError);
      return { success: false, error: 'Failed to fetch league members' };
    }

    const memberIds = members.map((m: any) => m.user_id);
    console.log(`[notifyFinalSubmission] Checking ${memberIds.length} members for league ${leagueId}, GW ${gw}`);

    // Check submissions across all pick tables
    // Try app_gw_submissions first (for app tables), then gw_submissions, then test_api_submissions
    let submissions: any[] = [];
    
    // 1. Try app_gw_submissions (for app tables)
    const { data: appSubmissions } = await supabase
      .from('app_gw_submissions')
      .select('user_id')
      .eq('gw', gw)
      .in('user_id', memberIds)
      .not('submitted_at', 'is', null);
    
    if (appSubmissions && appSubmissions.length > 0) {
      submissions = appSubmissions;
      console.log(`[notifyFinalSubmission] Using app_gw_submissions: ${submissions.length} submissions found`);
    } else {
      // 2. Try gw_submissions (for web tables)
      const { data: webSubmissions } = await supabase
        .from('gw_submissions')
        .select('user_id')
        .eq('gw', gw)
        .in('user_id', memberIds)
        .not('submitted_at', 'is', null);
      
      if (webSubmissions && webSubmissions.length > 0) {
        submissions = webSubmissions;
        console.log(`[notifyFinalSubmission] Using gw_submissions: ${submissions.length} submissions found`);
      } else {
        // 3. Try test_api_submissions (for test API)
        const { data: testSubmissions } = await supabase
          .from('test_api_submissions')
          .select('user_id')
          .eq('matchday', gw)
          .in('user_id', memberIds)
          .not('submitted_at', 'is', null);
        
        if (testSubmissions && testSubmissions.length > 0) {
          submissions = testSubmissions;
          console.log(`[notifyFinalSubmission] Using test_api_submissions: ${submissions.length} submissions found`);
        }
      }
    }

    const submittedUserIds = new Set((submissions || []).map((s: any) => s.user_id));
    const allSubmitted = submittedUserIds.size === memberIds.length && memberIds.length > 0;

    if (!allSubmitted) {
      const remaining = memberIds.length - submittedUserIds.size;
      console.log(`[notifyFinalSubmission] Not all submitted yet: ${remaining} remaining in league ${leagueId}`);
      return { success: true, message: 'Not all members have submitted yet', remaining };
    }

    console.log(`[notifyFinalSubmission] All ${memberIds.length} members have submitted for league ${leagueId}, GW ${gw}`);

    // Get league name
    const { data: league } = await supabase
      .from('leagues')
      .select('name, code')
      .eq('id', leagueId)
      .maybeSingle();

    const leagueName = league?.name || 'your league';
    const leagueCode = league?.code;

    // Build event ID using catalog format
    const eventId = formatEventId('final-submission', { league_id: leagueId, gw });
    if (!eventId) {
      console.error('[notifyFinalSubmission] Failed to format event ID');
      return { success: false, error: 'Failed to format event ID' };
    }

    // Dispatch via unified system
    const result = await dispatchNotification({
      notification_key: 'final-submission',
      event_id: eventId,
      user_ids: memberIds,
      title: 'All predictions submitted!',
      body: `Everyone in ${leagueName} has submitted for GW ${gw}. Check out who picked what!`,
      data: {
        type: 'final_submission',
        league_id: leagueId,
        league_code: leagueCode,
        gw,
      },
      url: leagueCode ? `/league/${leagueCode}` : undefined,
      grouping_params: {
        league_id: leagueId,
        gw,
      },
      league_id: leagueId,
    });

    console.log('[notifyFinalSubmission] Dispatch result:', {
      accepted: result.results.accepted,
      failed: result.results.failed,
      suppressed_duplicate: result.results.suppressed_duplicate,
    });

    return {
      success: true,
      sent: result.results.accepted,
      results: result.results,
      event_id: eventId,
    };
  } catch (error: any) {
    console.error('[notifyFinalSubmission] Error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

export const handler: Handler = async (event) => {
  console.log('[notifyFinalSubmission] Invoked', event.source || 'manually');
  
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    let payload: any;
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' });
    }

    // Support both 'matchday' (legacy) and 'gw' (new) parameters
    const { leagueId, matchday, gw, isTestApi } = payload;
    const gameweek = gw !== undefined ? gw : matchday;

    if (!leagueId || gameweek === undefined) {
      return json(400, { error: 'Missing leagueId or gw/matchday' });
    }

    const result = await checkAndNotifyFinalSubmission(leagueId, gameweek);

    if (result.success) {
      return json(200, result);
    } else {
      return json(500, result);
    }
  } catch (error: any) {
    console.error('[notifyFinalSubmission] Error:', error);
    return json(500, { error: error?.message || 'Failed to check final submission' });
  }
};
