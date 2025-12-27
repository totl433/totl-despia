/**
 * Shared notification utilities for Netlify functions
 * Provides unified checking of OneSignal subscription status and user preferences
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase admin client for shared use
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Check if a Player ID is subscribed in OneSignal
 * This is the technical check - verifies the device is actually subscribed to push notifications
 */
export async function isSubscribed(
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
    
    // OneSignal subscription status logic:
    // - notification_types === 1 (explicitly subscribed)
    // - notification_types is null/undefined BUT has valid token (legacy SDK, still initializing)
    // - notification_types === -2 (unsubscribed)
    // - notification_types === 0 (disabled)
    const explicitlySubscribed = notificationTypes === 1;
    const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
    const stillInitializing = (notificationTypes === null || notificationTypes === undefined) && hasToken && notInvalid;
    
    const subscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);
    return { subscribed, player };
  } catch (e) {
    console.error(`[notificationHelpers] Error checking subscription for ${playerId}:`, e);
    return { subscribed: false };
  }
}

/**
 * Load user notification preferences from database
 * Returns a map of userId -> preferences object
 */
export async function loadUserNotificationPreferences(
  userIds: string[]
): Promise<Map<string, Record<string, boolean>>> {
  const prefsMap = new Map<string, Record<string, boolean>>();
  
  if (userIds.length === 0) {
    return prefsMap;
  }

  try {
    const { data: userPrefs, error } = await supabase
      .from('user_notification_preferences')
      .select('user_id, preferences')
      .in('user_id', userIds);

    if (error) {
      console.error('[notificationHelpers] Error loading user preferences:', error);
      return prefsMap;
    }

    if (userPrefs) {
      userPrefs.forEach((pref: any) => {
        prefsMap.set(pref.user_id, pref.preferences || {});
      });
    }
  } catch (e) {
    console.error('[notificationHelpers] Exception loading user preferences:', e);
  }

  return prefsMap;
}

/**
 * Unified function to check if a notification should be sent to a user
 * Combines both technical (OneSignal subscription) and preference checks
 * 
 * @param userId - The user ID to check
 * @param playerId - The OneSignal Player ID for the device
 * @param notificationType - The notification type (e.g., 'score-updates', 'chat-messages', 'new-gameweek', 'gw-results', 'final-whistle')
 * @param appId - OneSignal App ID
 * @param restKey - OneSignal REST API Key
 * @param userPreferences - Optional pre-loaded user preferences map (for batch operations)
 * @returns Object with shouldSend boolean and reason if not sending
 */
export async function shouldSendNotification(
  userId: string,
  playerId: string,
  notificationType: string,
  appId: string,
  restKey: string,
  userPreferences?: Map<string, Record<string, boolean>>
): Promise<{ shouldSend: boolean; reason?: string }> {
  // Level 1: Check OneSignal subscription (technical check)
  const { subscribed } = await isSubscribed(playerId, appId, restKey);
  if (!subscribed) {
    return { shouldSend: false, reason: 'device-not-subscribed' };
  }

  // Level 2: Check user preferences (user choice)
  let prefs: Record<string, boolean> | undefined;
  
  if (userPreferences) {
    // Use pre-loaded preferences (more efficient for batch operations)
    prefs = userPreferences.get(userId);
  } else {
    // Load preferences on-demand (for single checks)
    const prefsMap = await loadUserNotificationPreferences([userId]);
    prefs = prefsMap.get(userId);
  }

  // If user has explicitly disabled this notification type, don't send
  if (prefs && prefs[notificationType] === false) {
    return { shouldSend: false, reason: 'user-preference-disabled' };
  }

  // Default: send if subscribed and not explicitly disabled
  return { shouldSend: true };
}

/**
 * Filter a list of player IDs to only those that should receive notifications
 * More efficient for batch operations - loads preferences once and checks all devices
 * 
 * @param userIds - Array of user IDs
 * @param playerIdsByUser - Map of userId -> array of playerIds
 * @param notificationType - The notification type
 * @param appId - OneSignal App ID
 * @param restKey - OneSignal REST API Key
 * @returns Array of player IDs that should receive the notification
 */
export async function filterEligiblePlayerIds(
  userIds: string[],
  playerIdsByUser: Map<string, string[]>,
  notificationType: string,
  appId: string,
  restKey: string
): Promise<string[]> {
  // Load all user preferences in one query
  const userPrefs = await loadUserNotificationPreferences(userIds);

  const eligiblePlayerIds: string[] = [];

  // Check each user's devices
  for (const userId of userIds) {
    const playerIds = playerIdsByUser.get(userId) || [];
    const prefs = userPrefs.get(userId);

    // Check user preference first (quick check)
    if (prefs && prefs[notificationType] === false) {
      continue; // User disabled this notification type
    }

    // Check each device's subscription status
    for (const playerId of playerIds) {
      const { subscribed } = await isSubscribed(playerId, appId, restKey);
      if (subscribed) {
        eligiblePlayerIds.push(playerId);
      }
    }
  }

  return eligiblePlayerIds;
}

/**
 * Set external_user_id for a player in OneSignal
 * This is critical for user-based targeting via include_external_user_ids
 * 
 * @param playerId - The OneSignal Player ID
 * @param userId - The Supabase user ID to set as external_user_id
 * @param appId - OneSignal App ID
 * @param restKey - OneSignal REST API Key
 * @returns Object with success boolean and error if failed
 */
export async function setExternalUserId(
  playerId: string,
  userId: string,
  appId: string,
  restKey: string
): Promise<{ success: boolean; error?: any }> {
  const OS_BASE = 'https://onesignal.com/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${restKey}`,
  };

  try {
    const url = `${OS_BASE}/players/${playerId}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        app_id: appId,
        external_user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorData: any;
      try {
        errorData = JSON.parse(errorBody);
      } catch {
        errorData = { message: errorBody };
      }
      return { success: false, error: { status: response.status, body: errorData } };
    }

    return { success: true };
  } catch (e) {
    console.error(`[notificationHelpers] Error setting external_user_id for ${playerId}:`, e);
    return { success: false, error: e };
  }
}

/**
 * Verify that external_user_id is set correctly for a player in OneSignal
 * 
 * @param playerId - The OneSignal Player ID
 * @param expectedUserId - The expected Supabase user ID
 * @param appId - OneSignal App ID
 * @param restKey - OneSignal REST API Key
 * @returns Object with verified boolean and actual external_user_id if different
 */
export async function verifyExternalUserId(
  playerId: string,
  expectedUserId: string,
  appId: string,
  restKey: string
): Promise<{ verified: boolean; actualExternalUserId?: string; error?: any }> {
  const OS_BASE = 'https://onesignal.com/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${restKey}`,
  };

  try {
    const url = `${OS_BASE}/players/${playerId}?app_id=${appId}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorData: any;
      try {
        errorData = JSON.parse(errorBody);
      } catch {
        errorData = { message: errorBody };
      }
      return { verified: false, error: { status: response.status, body: errorData } };
    }

    const player = await response.json();
    const actualExternalUserId = player.external_user_id;

    if (!actualExternalUserId) {
      return { verified: false, actualExternalUserId: undefined };
    }

    if (actualExternalUserId !== expectedUserId) {
      return { verified: false, actualExternalUserId };
    }

    return { verified: true };
  } catch (e) {
    console.error(`[notificationHelpers] Error verifying external_user_id for ${playerId}:`, e);
    return { verified: false, error: e };
  }
}
