import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { filterEligiblePlayerIds, loadUserNotificationPreferences } from './utils/notificationHelpers';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/**
 * Sends prediction reminder notifications to users 5 hours before the deadline
 * Deadline is 75 minutes before first kickoff, so reminder is 5 hours 75 minutes before first kickoff
 * 
 * This function should be called on a schedule (e.g., every 15-30 minutes) to check if it's time to send reminders
 */
export const handler: Handler = async (event) => {
  console.log('[sendPredictionReminder] Function invoked');
  
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[sendPredictionReminder] Missing Supabase env vars');
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('[sendPredictionReminder] Missing OneSignal env vars');
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  try {
    // Initialize Supabase admin client
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Get current gameweek
    const { data: meta, error: metaError } = await admin
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();

    if (metaError || !meta?.current_gw) {
      console.error('[sendPredictionReminder] Failed to get current GW:', metaError);
      return json(500, { error: 'Failed to get current gameweek' });
    }

    const currentGw = meta.current_gw;
    console.log(`[sendPredictionReminder] Current GW: ${currentGw}`);

    // Get first kickoff time for current GW
    const { data: fixtures, error: fixturesError } = await admin
      .from('app_fixtures')
      .select('kickoff_time')
      .eq('gw', currentGw)
      .order('kickoff_time', { ascending: true })
      .limit(1);

    if (fixturesError || !fixtures || fixtures.length === 0 || !fixtures[0].kickoff_time) {
      console.log(`[sendPredictionReminder] No fixtures found for GW ${currentGw} or no kickoff time`);
      return json(200, { 
        ok: true, 
        message: 'No fixtures found for current GW',
        sentTo: 0 
      });
    }

    const firstKickoff = new Date(fixtures[0].kickoff_time);
    const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before kickoff
    const reminderTime = new Date(deadlineTime.getTime() - (5 * 60 * 60 * 1000)); // 5 hours before deadline
    const now = new Date();

    console.log(`[sendPredictionReminder] First kickoff: ${firstKickoff.toISOString()}`);
    console.log(`[sendPredictionReminder] Deadline: ${deadlineTime.toISOString()}`);
    console.log(`[sendPredictionReminder] Reminder time: ${reminderTime.toISOString()}`);
    console.log(`[sendPredictionReminder] Current time: ${now.toISOString()}`);

    // Check if we're within the reminder window (30 minutes before or after reminder time)
    const reminderWindowStart = new Date(reminderTime.getTime() - (30 * 60 * 1000));
    const reminderWindowEnd = new Date(reminderTime.getTime() + (30 * 60 * 1000));

    if (now < reminderWindowStart) {
      console.log(`[sendPredictionReminder] Too early - reminder window starts at ${reminderWindowStart.toISOString()}`);
      return json(200, { 
        ok: true, 
        message: 'Too early for reminder',
        reminderTime: reminderTime.toISOString(),
        sentTo: 0 
      });
    }

    if (now > reminderWindowEnd) {
      console.log(`[sendPredictionReminder] Too late - reminder window ended at ${reminderWindowEnd.toISOString()}`);
      return json(200, { 
        ok: true, 
        message: 'Reminder window has passed',
        sentTo: 0 
      });
    }

    // Check if we've already sent reminders for this GW (prevent duplicates)
    // We'll use a simple approach: check notification_send_log or just send and let OneSignal handle deduplication
    // For now, we'll rely on OneSignal's deduplication via collapse_id

    // Get all users who have submitted predictions for this GW (we don't want to remind them)
    const { data: submittedUsers, error: submittedError } = await admin
      .from('app_gw_submissions')
      .select('user_id')
      .eq('gw', currentGw)
      .not('submitted_at', 'is', null);

    const submittedUserIds = new Set((submittedUsers || []).map((s: any) => s.user_id));
    console.log(`[sendPredictionReminder] Found ${submittedUserIds.size} users who have already submitted`);

    // Get all users with push subscriptions
    const { data: allSubs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('user_id, player_id, is_active')
      .eq('is_active', true);

    if (subsError) {
      console.error('[sendPredictionReminder] Failed to fetch subscriptions:', subsError);
      return json(500, { error: 'Failed to load subscriptions' });
    }

    if (!allSubs || allSubs.length === 0) {
      console.log('[sendPredictionReminder] No active subscriptions found');
      return json(200, { ok: true, sentTo: 0, message: 'No active subscriptions' });
    }

    // Group player IDs by user
    const playerIdsByUser = new Map<string, string[]>();
    const allUserIds = new Set<string>();

    allSubs.forEach((sub: any) => {
      if (!sub.player_id) return;
      const userId = sub.user_id;
      allUserIds.add(userId);
      if (!playerIdsByUser.has(userId)) {
        playerIdsByUser.set(userId, []);
      }
      playerIdsByUser.get(userId)!.push(sub.player_id);
    });

    // Filter out users who have already submitted
    const usersNeedingReminder = Array.from(allUserIds).filter(userId => !submittedUserIds.has(userId));
    console.log(`[sendPredictionReminder] ${usersNeedingReminder.length} users need reminders (${allUserIds.size} total, ${submittedUserIds.size} already submitted)`);

    if (usersNeedingReminder.length === 0) {
      return json(200, { 
        ok: true, 
        message: 'All users have already submitted',
        sentTo: 0 
      });
    }

    // Filter to only users who have 'prediction-reminder' preference enabled
    const userPrefs = await loadUserNotificationPreferences(usersNeedingReminder);
    const eligibleUserIds = usersNeedingReminder.filter(userId => {
      const prefs = userPrefs.get(userId);
      // Default to enabled if preference not set (opt-in by default)
      return prefs?.['prediction-reminder'] !== false;
    });

    console.log(`[sendPredictionReminder] ${eligibleUserIds.length} users have prediction-reminder enabled`);

    if (eligibleUserIds.length === 0) {
      return json(200, { 
        ok: true, 
        message: 'No users with prediction-reminder preference enabled',
        sentTo: 0 
      });
    }

    // Get player IDs for eligible users
    const eligiblePlayerIdsByUser = new Map<string, string[]>();
    eligibleUserIds.forEach(userId => {
      const playerIds = playerIdsByUser.get(userId) || [];
      if (playerIds.length > 0) {
        eligiblePlayerIdsByUser.set(userId, playerIds);
      }
    });

    // Filter to only subscribed devices
    const eligiblePlayerIds = await filterEligiblePlayerIds(
      eligibleUserIds,
      eligiblePlayerIdsByUser,
      'prediction-reminder',
      ONESIGNAL_APP_ID,
      ONESIGNAL_REST_API_KEY
    );

    console.log(`[sendPredictionReminder] ${eligiblePlayerIds.length} eligible Player IDs after filtering`);

    if (eligiblePlayerIds.length === 0) {
      return json(200, { 
        ok: true, 
        message: 'No eligible devices found',
        sentTo: 0 
      });
    }

    // Format deadline for notification message
    const deadlineFormatted = deadlineTime.toLocaleString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });

    // Send notification via OneSignal
    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: eligiblePlayerIds,
      headings: { en: `Gameweek ${currentGw} Predictions Due Soon!` },
      contents: { en: `Don't forget to make your predictions! Deadline: ${deadlineFormatted}` },
      collapse_id: `prediction_reminder_gw${currentGw}`, // Prevent duplicate notifications
      thread_id: 'totl_predictions',
      android_group: 'totl_predictions',
      data: {
        type: 'prediction-reminder',
        gw: currentGw,
        deadline: deadlineTime.toISOString(),
        url: '/predictions'
      },
      ios_badgeType: 'Increase',
      ios_badgeCount: 1,
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[sendPredictionReminder] OneSignal API error:', result);
      return json(500, { 
        error: 'Failed to send notifications', 
        details: result 
      });
    }

    console.log(`[sendPredictionReminder] Successfully sent reminders to ${eligiblePlayerIds.length} devices`);
    console.log(`[sendPredictionReminder] OneSignal result:`, result);

    return json(200, {
      ok: true,
      sentTo: eligiblePlayerIds.length,
      gw: currentGw,
      reminderTime: reminderTime.toISOString(),
      deadline: deadlineTime.toISOString(),
      result
    });

  } catch (e: any) {
    console.error('[sendPredictionReminder] Exception:', e);
    return json(500, { error: e?.message || 'Unknown error' });
  }
};






