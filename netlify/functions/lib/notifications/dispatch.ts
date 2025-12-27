/**
 * Unified Notification Dispatcher
 * 
 * The orchestrator for all notification sends. All notification senders
 * MUST go through this module.
 * 
 * Flow:
 * 1. Receive intent
 * 2. Load catalog entry
 * 3. For each user:
 *    a. Claim idempotency lock (INSERT-first)
 *    b. Run policy checks (prefs, cooldown, quiet hours, mutes)
 *    c. Resolve OneSignal targets
 *    d. Build and send notification
 *    e. Update send log with result
 */

import { getCatalogEntry, isNotificationEnabled } from './catalog';
import type { NotificationCatalogEntry } from './catalog';
import {
  claimIdempotencyLock,
  updateSendLog,
  getEnvironment,
} from './idempotency';
import { getSupabase } from './targeting';
import {
  loadUserPreferences,
  runAllPolicyChecks,
} from './policy';
import {
  loadPushSubscriptions,
  resolveTargets,
  verifyAndFilterSubscriptions,
  getSinglePlayerIdPerUser,
  checkUserHasActiveSubscription,
} from './targeting';
import {
  buildPayload,
  sendNotification,
  createPayloadSummary,
} from './onesignal';
import type {
  NotificationIntent,
  DispatchResult,
  BatchDispatchResult,
  NotificationResult,
} from './types';

/**
 * Dispatch a notification to multiple users
 * 
 * This is the main entry point for sending notifications.
 */
export async function dispatchNotification(
  intent: NotificationIntent
): Promise<BatchDispatchResult> {
  const {
    notification_key,
    event_id,
    user_ids,
    title,
    body,
    data,
    url,
    grouping_params,
    skip_preference_check,
    skip_cooldown_check,
    league_id,
    badge_count,
  } = intent;
  
  const result: BatchDispatchResult = {
    notification_key,
    event_id,
    total_users: user_ids.length,
    results: {
      accepted: 0,
      failed: 0,
      suppressed_duplicate: 0,
      suppressed_preference: 0,
      suppressed_cooldown: 0,
      suppressed_quiet_hours: 0,
      suppressed_muted: 0,
      suppressed_unsubscribed: 0,
      suppressed_rollout: 0,
    },
    user_results: [],
    errors: [],
  };
  
  // 1. Load catalog entry
  const catalogEntry = getCatalogEntry(notification_key);
  if (!catalogEntry) {
    console.error(`[dispatch] Unknown notification_key: ${notification_key}`);
    return result;
  }
  
  // 2. Check if notification type is enabled
  if (!isNotificationEnabled(notification_key)) {
    console.log(`[dispatch] Notification type ${notification_key} is disabled`);
    // Mark all users as suppressed due to rollout
    for (const userId of user_ids) {
      result.results.suppressed_rollout++;
      result.user_results.push({
        user_id: userId,
        result: 'suppressed_rollout',
        reason: 'Notification type is disabled',
      });
    }
    return result;
  }
  
  // 3. Load user preferences for all users
  const userPrefsMap = await loadUserPreferences(user_ids);
  
  // 4. Process each user
  // Use direct player_id targeting - simpler and more reliable
  const environment = getEnvironment();
  
  for (const userId of user_ids) {
    const userResult: DispatchResult = {
      user_id: userId,
      result: 'pending',
    };
    
    try {
      // 4a. Claim idempotency lock
      const lock = await claimIdempotencyLock(notification_key, event_id, userId);
      
      if (!lock.claimed) {
        userResult.result = 'suppressed_duplicate';
        userResult.reason = 'Already processed (idempotency)';
        result.results.suppressed_duplicate++;
        result.user_results.push(userResult);
        continue;
      }
      
      const logId = lock.log_id!;
      
      // 4b. Run policy checks
      const userPrefs = userPrefsMap.get(userId);
      const policyResult = await runAllPolicyChecks(
        userId,
        catalogEntry,
        userPrefs,
        {
          skipPreferenceCheck: skip_preference_check,
          skipCooldownCheck: skip_cooldown_check,
          leagueId: league_id,
        }
      );
      
      if (!policyResult.allowed) {
        const suppressionResult = policyResult.suppression_reason as NotificationResult;
        userResult.result = suppressionResult;
        userResult.reason = `Policy check failed: ${suppressionResult}`;
        
        // Update counters
        const key = suppressionResult.replace('suppressed_', '') as keyof typeof result.results;
        if (result.results[key] !== undefined) {
          (result.results as any)[suppressionResult]++;
        }
        
        // Update send log
        await updateSendLog(logId, { result: suppressionResult });
        
        result.user_results.push(userResult);
        continue;
      }
      
      // 4c. Load player_id for this user
      const subscriptions = await loadPushSubscriptions([userId]);
      const activeSubscriptions = subscriptions.filter(
        sub => sub.is_active && sub.subscribed && sub.player_id
      );
      
      if (activeSubscriptions.length === 0) {
        userResult.result = 'suppressed_unsubscribed';
        userResult.reason = 'No active subscribed devices';
        result.results.suppressed_unsubscribed++;
        await updateSendLog(logId, { result: 'suppressed_unsubscribed' });
        result.user_results.push(userResult);
        continue;
      }
      
      // Use the most recent device (first one from DB query ordered by updated_at)
      const playerId = activeSubscriptions[0].player_id!;
      
      // 4c.1. Verify device is actually subscribed in OneSignal before sending
      // Don't trust DB flag - verify with OneSignal API
      const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
      const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
      
      if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
        try {
          const verifyResponse = await fetch(
            `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`,
            {
              headers: {
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
              },
            }
          );
          
          if (verifyResponse.ok) {
            const player = await verifyResponse.json();
            const hasToken = !!player.identifier;
            const notInvalid = !player.invalid_identifier;
            const notificationTypes = player.notification_types;
            
            // OneSignal subscription logic: subscribed if has token, not invalid, and not explicitly unsubscribed
            const isSubscribed = hasToken && notInvalid && 
              (notificationTypes === 1 || (notificationTypes !== -2 && notificationTypes !== 0 && notificationTypes !== null && notificationTypes !== undefined));
            
            if (!isSubscribed) {
              // Update DB to reflect actual OneSignal status
              const supabase = getSupabase();
              await supabase
                .from('push_subscriptions')
                .update({ subscribed: false, last_checked_at: new Date().toISOString() })
                .eq('player_id', playerId);
              
              userResult.result = 'suppressed_unsubscribed';
              userResult.reason = 'Device not subscribed in OneSignal (verified before send)';
              result.results.suppressed_unsubscribed++;
              await updateSendLog(logId, { result: 'suppressed_unsubscribed' });
              result.user_results.push(userResult);
              continue;
            }
          } else {
            // Device not found in OneSignal - mark as unsubscribed
            const supabase = getSupabase();
            await supabase
              .from('push_subscriptions')
              .update({ subscribed: false, last_checked_at: new Date().toISOString() })
              .eq('player_id', playerId);
            
            userResult.result = 'suppressed_unsubscribed';
            userResult.reason = 'Device not found in OneSignal';
            result.results.suppressed_unsubscribed++;
            await updateSendLog(logId, { result: 'suppressed_unsubscribed' });
            result.user_results.push(userResult);
            continue;
          }
        } catch (verifyErr) {
          console.warn(`[dispatch] Could not verify subscription for ${playerId.slice(0, 8)}…:`, verifyErr);
          // Continue anyway - OneSignal will reject if not subscribed, but at least we tried
        }
      }
      
      // 4d. Build notification payload using player_id
      const notificationTitle = title || buildDefaultTitle(catalogEntry, data);
      const notificationBody = body || buildDefaultBody(catalogEntry, data);
      
      const payload = buildPayload(catalogEntry, {
        title: notificationTitle,
        body: notificationBody,
        playerIds: [playerId], // Direct player_id targeting
        data: {
          type: notification_key,
          ...data,
        },
        url,
        groupingParams: grouping_params,
        badgeCount: badge_count,
      });
      
      // 4e. Send notification
      const sendResult = await sendNotification(payload);
      
      if (sendResult.success) {
        userResult.result = 'accepted';
        userResult.onesignal_notification_id = sendResult.notification_id;
        result.results.accepted++;
        
        await updateSendLog(logId, {
          result: 'accepted',
          onesignal_notification_id: sendResult.notification_id || null,
          target_type: 'player_ids',
          targeting_summary: { player_id: playerId },
          payload_summary: createPayloadSummary(payload),
        });
      } else {
        // Check if the error is "All included players are not subscribed"
        const isUnsubscribedError = 
          sendResult.error?.errors?.includes('All included players are not subscribed') ||
          sendResult.error?.body?.errors?.includes('All included players are not subscribed');
        
        if (isUnsubscribedError) {
          // Update DB to mark as unsubscribed
          const supabase = getSupabase();
          await supabase
            .from('push_subscriptions')
            .update({ subscribed: false, last_checked_at: new Date().toISOString() })
            .eq('player_id', playerId);
          
          userResult.result = 'suppressed_unsubscribed';
          userResult.reason = 'Device not subscribed in OneSignal';
          result.results.suppressed_unsubscribed++;
          
          await updateSendLog(logId, {
            result: 'suppressed_unsubscribed',
            error: sendResult.error,
            target_type: 'player_ids',
            targeting_summary: { player_id: playerId },
            payload_summary: createPayloadSummary(payload),
          });
        } else {
          userResult.result = 'failed';
          userResult.error = sendResult.error;
          result.results.failed++;
          result.errors.push({ userId, error: sendResult.error });
          
          await updateSendLog(logId, {
            result: 'failed',
            error: sendResult.error,
            target_type: 'player_ids',
            targeting_summary: { player_id: playerId },
            payload_summary: createPayloadSummary(payload),
          });
        }
      }
      
      result.user_results.push(userResult);
      
    } catch (err: any) {
      console.error(`[dispatch] Error processing user ${userId}:`, err);
      userResult.result = 'failed';
      userResult.error = err.message;
      result.results.failed++;
      result.errors.push({ userId, error: err.message });
      result.user_results.push(userResult);
    }
  }
  
  // Log summary
  console.log(`[dispatch] ${notification_key}/${event_id}: ${result.results.accepted} accepted, ${result.results.failed} failed, ${result.results.suppressed_duplicate} dup, ${result.results.suppressed_preference} pref, ${result.results.suppressed_unsubscribed} unsub`);
  
  return result;
}

/**
 * Build default title based on notification type
 */
function buildDefaultTitle(
  catalogEntry: NotificationCatalogEntry,
  data?: Record<string, any>
): string {
  // This would be enhanced with template interpolation
  return catalogEntry.notification_key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Build default body based on notification type
 */
function buildDefaultBody(
  catalogEntry: NotificationCatalogEntry,
  data?: Record<string, any>
): string {
  return 'You have a new notification';
}

/**
 * Dispatch a broadcast notification (no per-user targeting)
 * Used for admin broadcasts like "new gameweek"
 */
export async function dispatchBroadcast(
  intent: Omit<NotificationIntent, 'user_ids'> & { user_ids?: string[] }
): Promise<BatchDispatchResult> {
  // If user_ids provided, use normal dispatch
  if (intent.user_ids && intent.user_ids.length > 0) {
    return dispatchNotification(intent as NotificationIntent);
  }
  
  // Otherwise, this is a true broadcast - would need to fetch all subscribed users
  // For now, throw an error to ensure callers provide user_ids
  throw new Error('Broadcast without user_ids not yet implemented. Please provide user_ids.');
}

