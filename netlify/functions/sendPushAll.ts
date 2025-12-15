import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isSubscribed, loadUserNotificationPreferences } from './utils/notificationHelpers';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  console.log('[sendPushAll] Function invoked');
  
  if (event.httpMethod !== 'POST') {
    console.log('[sendPushAll] Method not allowed:', event.httpMethod);
    return json(405, { error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[sendPushAll] Missing Supabase env vars');
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('[sendPushAll] Missing OneSignal env vars');
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  // Optional debug
  if (event.queryStringParameters?.debug === '1') {
    return json(200, {
      appId: ONESIGNAL_APP_ID.slice(0, 8) + '…',
      authHeader: 'Basic ' + ONESIGNAL_REST_API_KEY.slice(0, 4) + '…',
    });
  }

  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
    console.log('[sendPushAll] Payload parsed:', { 
      title: payload?.title, 
      message: payload?.message?.slice(0, 50) + '…',
      hasData: !!payload?.data 
    });
  } catch (e) {
    console.error('[sendPushAll] Failed to parse JSON:', e);
    return json(400, { error: 'Invalid JSON body' });
  }

  const { title, message, data } = payload || {};
  if (!title || !message) {
    console.log('[sendPushAll] Missing required fields:', { title: !!title, message: !!message });
    return json(400, { error: 'Missing title or message' });
  }

  try {
    // Initialize Supabase admin client
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Get all Player IDs from database (we'll verify subscription status and update is_active)
    // Include both active and potentially active devices to ensure we catch any that should be active
    console.log('[sendPushAll] Fetching Player IDs from database...');
    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('user_id, player_id, is_active, subscribed, last_checked_at')
      .or('is_active.eq.true,subscribed.eq.true'); // Include active OR subscribed devices

    if (subErr) {
      console.error('[sendPushAll] Failed to fetch subscriptions:', subErr);
      return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
    }

    const candidatePlayerIds = (subs || [])
      .map((s: any) => s.player_id)
      .filter(Boolean);

    // Remove duplicates (in case query returns same device multiple times)
    const uniquePlayerIds = Array.from(new Set(candidatePlayerIds));

    console.log(`[sendPushAll] Found ${uniquePlayerIds.length} candidate Player IDs (${candidatePlayerIds.length} total before deduplication)`);

    if (uniquePlayerIds.length === 0) {
      console.warn('[sendPushAll] No Player IDs found in database');
      return json(200, { 
        ok: true, 
        warning: 'No subscribed devices found',
        sentTo: 0,
        result: null 
      });
    }

    // Check subscription status for each Player ID (with caching from DB)
    // Use DB 'subscribed' flag if recently checked (< 1 hour), otherwise verify with OneSignal
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

    const checks = await Promise.allSettled(
      uniquePlayerIds.map(async (playerId: string) => {
        const sub = subs.find((s: any) => s.player_id === playerId);
        
        // Use cached status if recently checked
        if (sub?.subscribed === true && sub?.last_checked_at && sub.last_checked_at > oneHourAgo) {
          console.log(`[sendPushAll] Using cached subscription status for ${playerId.slice(0, 8)}…`);
          return { playerId, subscribed: true };
        }

        // Otherwise verify with OneSignal
        const result = await isSubscribed(playerId, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);

        // Update DB with subscription health and is_active status
        if (result.player) {
          const shouldBeActive = result.subscribed && !result.player.invalid_identifier;
          await admin
            .from('push_subscriptions')
            .update({
              subscribed: result.subscribed,
              is_active: shouldBeActive, // Ensure is_active matches subscription status
              last_checked_at: new Date().toISOString(),
              last_active_at: result.player.last_active ? new Date(result.player.last_active * 1000).toISOString() : null,
              invalid: !!result.player.invalid_identifier,
              os_payload: result.player,
            })
            .eq('player_id', playerId)
            .then(() => {}, (err) => console.error(`[sendPushAll] Failed to update subscription health for ${playerId}:`, err));
        }
        
        return { playerId, subscribed: result.subscribed };
      })
    );

    let validPlayerIds = uniquePlayerIds.filter((playerId, i) => {
      const check = checks[i];
      if (check.status === 'fulfilled') {
        return (check as PromiseFulfilledResult<{ playerId: string; subscribed: boolean }>).value.subscribed;
      }
      return false;
    });

    console.log(`[sendPushAll] Filtered to ${validPlayerIds.length} subscribed Player IDs (out of ${uniquePlayerIds.length} total)`);

    if (validPlayerIds.length === 0) {
      console.warn('[sendPushAll] No subscribed Player IDs found after filtering');
      return json(200, { 
        ok: true, 
        warning: 'No subscribed devices found',
        sentTo: 0,
        checked: uniquePlayerIds.length,
        result: null 
      });
    }

    // Send notification to subscribed devices
    console.log(`[sendPushAll] Sending notification to ${validPlayerIds.length} subscribed devices...`);
    
    // Map player IDs to user IDs for response
    const userIdsIncluded = new Set<string>();
    validPlayerIds.forEach(playerId => {
      const sub = subs.find((s: any) => s.player_id === playerId);
      if (sub?.user_id) {
        userIdsIncluded.add(sub.user_id);
      }
    });
    
    console.log(`[sendPushAll] Sending to ${userIdsIncluded.size} unique users`);
    
    // Load user notification preferences if notification type is provided
    let userIdsToFilter: string[] = [];
    if (data?.type === 'new-gameweek' || data?.type === 'fixtures_published') {
      // Get user IDs from subscriptions
      userIdsToFilter = Array.from(new Set((subs || []).map((s: any) => s.user_id).filter(Boolean)));
      
      if (userIdsToFilter.length > 0) {
        // Load user notification preferences using shared utility
        const prefsMap = await loadUserNotificationPreferences(userIdsToFilter);
        
        // Filter out users who disabled new-gameweek notifications
        const filteredSubs = (subs || []).filter((sub: any) => {
          if (!sub.user_id) return true; // Keep if no user_id
          const userPrefs = prefsMap.get(sub.user_id);
          return userPrefs?.['new-gameweek'] !== false; // Keep if not explicitly disabled
        });
        
        // Update subs to only include users who want notifications
        const filteredPlayerIds = filteredSubs
          .map((s: any) => s.player_id)
          .filter(Boolean);
        
        // Re-check subscriptions for filtered list
        const filteredChecks = await Promise.allSettled(
          filteredPlayerIds.map(async (playerId) => {
            const result = await isSubscribed(playerId, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);
            return { playerId, subscribed: result.subscribed };
          })
        );
        
        validPlayerIds = filteredPlayerIds.filter((playerId, i) => {
          const check = filteredChecks[i];
          if (check.status === 'fulfilled') {
            return (check as PromiseFulfilledResult<{ playerId: string; subscribed: boolean }>).value.subscribed;
          }
          return false;
        });
        
        console.log(`[sendPushAll] Filtered to ${validPlayerIds.length} users who want new-gameweek notifications (from ${userIdsToFilter.length} total users)`);
      }
    }

    // Build notification payload
    const notificationPayload: any = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: validPlayerIds,
      headings: { en: title },
      contents: { en: message },
      // Add iOS badge to app icon (shows red number badge)
      // Used for new gameweek published notifications and manual admin notifications
      ios_badgeType: 'SetTo',
      ios_badgeCount: 1,
    };
    
    // Add data field if provided (for deep linking, etc.)
    if (data) {
      notificationPayload.data = data;
    }
    
    console.log(`[sendPushAll] Sending to ${validPlayerIds.length} Player IDs`);
    console.log(`[sendPushAll] Badge settings: ios_badgeType=${notificationPayload.ios_badgeType}, ios_badgeCount=${notificationPayload.ios_badgeCount}`);
    
    const resp = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const body = await resp.json().catch(() => ({}));
    
    if (!resp.ok) {
      console.error('[sendPushAll] OneSignal API error:', body);
      return json(resp.status, { 
        error: 'OneSignal error', 
        details: body,
        oneSignalErrors: body.errors || [],
        fullResponse: body
      });
    }

    // Check for errors in the response even if HTTP status is OK
    const oneSignalErrors = body.errors || [];
    const oneSignalRecipients = body.recipients || 0;
    const oneSignalId = body.id; // OneSignal notification ID - if present, notification was created
    
    // OneSignal's recipients field is often 0 for iOS even when notifications are sent successfully
    // If we have a notification ID and no errors, assume it was sent successfully
    const hasNotificationId = !!oneSignalId;
    const hasErrors = oneSignalErrors.length > 0;
    
    // Use our count as the primary indicator, OneSignal's recipients as secondary
    // If OneSignal returned an ID and no errors, trust our count
    const estimatedSentTo = hasNotificationId && !hasErrors 
      ? validPlayerIds.length 
      : Math.max(oneSignalRecipients, 0);
    
    if (oneSignalErrors.length > 0) {
      console.warn('[sendPushAll] OneSignal returned errors:', oneSignalErrors);
      console.warn('[sendPushAll] OneSignal recipients:', oneSignalRecipients, 'Our count:', validPlayerIds.length);
    } else {
      console.log(`[sendPushAll] OneSignal notification ID: ${oneSignalId || 'none'}, OneSignal recipients: ${oneSignalRecipients}, Our count: ${validPlayerIds.length}`);
    }
    
    // Get user names for included users (for better feedback)
    const userIdsArray = Array.from(userIdsIncluded);
    const { data: users } = await admin
      .from('users')
      .select('id, name')
      .in('id', userIdsArray)
      .then((result) => result, () => ({ data: null }));
    
    const userNames = users ? userIdsArray.map(uid => {
      const user = users.find((u: any) => u.id === uid);
      return user?.name || uid.slice(0, 8) + '...';
    }) : [];
    
    return json(200, { 
      ok: true, 
      sentTo: estimatedSentTo, // Use our count if OneSignal returned ID with no errors
      oneSignalRecipients: oneSignalRecipients, // Include OneSignal's count for reference
      expected: validPlayerIds.length,
      checked: uniquePlayerIds.length,
      userCount: userIdsIncluded.size,
      userIds: userIdsArray,
      userNames: userNames,
      hasNotificationId: hasNotificationId,
      invalidPlayerIds: body.invalid_player_ids || [],
      oneSignalErrors: oneSignalErrors.length > 0 ? oneSignalErrors : undefined,
      result: body 
    });
  } catch (e: any) {
    console.error('[sendPushAll] Unexpected error:', e);
    return json(500, { error: 'Failed to send notification', details: e?.message || String(e) });
  }
};