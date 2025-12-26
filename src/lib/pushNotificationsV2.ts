/**
 * Push Notification Service V2
 * 
 * Following Despia OneSignal V2 best practices:
 * https://lovable.despia.com/default-guide/native-features/onesignal-v2
 * 
 * Key approach:
 * - Call despia('setonesignalplayerid://?user_id=${userId}') on every app load
 * - This links the device to the user in OneSignal's native SDK
 * - Send notifications using include_external_user_ids (not player_ids)
 * 
 * Additional features:
 * - Heartbeat updates (last_seen_at) on app open
 * - Deactivate subscription on logout
 * - Track effective state for Notification Centre UI
 */

export interface PushSubscriptionResult {
  ok: boolean;
  reason?: 'permission-denied' | 'no-player-id' | 'api-not-available' | 'no-session' | 'unknown';
  playerId?: string;
  error?: string;
  subscriptionStatus?: 'subscribed' | 'not-subscribed' | 'permission-denied' | 'not-registered';
}

export interface EffectivePushState {
  hasOsPermission: boolean;
  isRegistered: boolean;
  isSubscribedInOneSignal: boolean;
  effectiveState: 'allowed' | 'muted_by_os' | 'not_registered';
  playerId?: string;
}

// Session-level flag to prevent duplicate registrations
let hasRegisteredThisSession = false;
let currentPlayerId: string | null = null;
let hasSetExternalUserId = false;

/**
 * Reset session state (call on logout)
 */
export function resetPushSessionState(): void {
  hasRegisteredThisSession = false;
  currentPlayerId = null;
  hasSetExternalUserId = false;
}

/**
 * Set the external user ID in OneSignal via Despia
 * This is the KEY step for Despia V2 integration!
 * 
 * Per Despia docs: "on every app load call despia(`setonesignalplayerid://?user_id=${YOUR-LOGGEDIN-USER-ID}`)"
 * https://lovable.despia.com/default-guide/native-features/onesignal-v2
 * 
 * This connects your Supabase user ID with the device in OneSignal,
 * enabling notifications via include_external_user_ids targeting.
 */
export function setOneSignalExternalUserId(userId: string): boolean {
  if (!userId) {
    console.warn('[PushV2] Cannot set external user ID: no userId provided');
    return false;
  }
  
  const despia = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
  
  if (!despia || typeof despia !== 'function') {
    console.warn('[PushV2] Despia bridge not available - cannot set external user ID (native rebuild or bridge issue?)');
    return false;
  }
  
  try {
    // This is the critical Despia V2 call that links the device to the user
    console.log(`[PushV2] Setting OneSignal external user ID: ${userId.slice(0, 8)}...`);
    despia(`setonesignalplayerid://?user_id=${userId}`);
    hasSetExternalUserId = true;
    console.log('[PushV2] ✅ External user ID set successfully');
    return true;
  } catch (e) {
    console.error('[PushV2] Failed to set external user ID:', e);
    return false;
  }
}

/**
 * Get the current player ID if registered this session
 */
export function getCurrentPlayerId(): string | null {
  return currentPlayerId;
}

/**
 * Check if Despia native app is available
 */
export function isDespiaAvailable(): boolean {
  const despia = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
  const directPlayerId = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
  return !!despia || !!directPlayerId;
}

/**
 * Check OS permission status via Despia
 */
export function checkOsPermission(): boolean {
  const despia = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
  
  if (despia && typeof despia === 'function') {
    try {
      const permissionData = despia('checkNativePushPermissions://', ['nativePushEnabled']);
      if (permissionData && typeof permissionData === 'object' && 'nativePushEnabled' in permissionData) {
        return Boolean(permissionData.nativePushEnabled);
      }
    } catch (e) {
      console.log('[PushV2] Could not check OS permission:', e);
    }
  }
  
  // If we have a player ID, assume permission is granted
  const directPlayerId = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
  return !!directPlayerId;
}

/**
 * Get the OneSignal Player ID from Despia
 */
export function getPlayerIdFromDespia(): string | null {
  // Try direct global property first (Despia's actual implementation)
  const directPid = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
  if (directPid && typeof directPid === 'string' && directPid.trim().length > 0) {
    return directPid.trim();
  }
  
  // Fallback to despia object
  const despia = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
  if (despia) {
    if (despia.onesignalplayerid && typeof despia.onesignalplayerid === 'string') {
      return despia.onesignalplayerid.trim();
    }
    if (despia.oneSignalPlayerId && typeof despia.oneSignalPlayerId === 'string') {
      return despia.oneSignalPlayerId.trim();
    }
  }
  
  return null;
}

/**
 * Poll for Player ID with timeout
 */
async function pollForPlayerId(maxMs: number = 15000): Promise<string | null> {
  const startTime = Date.now();
  const pollInterval = 500;
  
  while (Date.now() - startTime < maxMs) {
    const playerId = getPlayerIdFromDespia();
    if (playerId) {
      return playerId;
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return null;
}

/**
 * Register device with backend (once per session)
 * 
 * This function does TWO things:
 * 1. Calls setOneSignalExternalUserId() - the Despia V2 way to link device to user
 * 2. Registers with our backend for tracking/auditing purposes
 */
type BackendRegisterResult =
  | { ok: true }
  | { ok: false; reason: PushSubscriptionResult['reason']; error?: string };

export async function registerPushSubscription(
  session: { access_token: string; user?: { id: string } } | null,
  options: { force?: boolean; userId?: string } = {}
): Promise<PushSubscriptionResult> {
  const registerBackend = async (playerId: string): Promise<BackendRegisterResult> => {
    try {
      const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
      const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';
      
      const res = await fetch(`${baseUrl}/.netlify/functions/registerPlayer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          playerId,
          platform: 'ios', // TODO: detect platform
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[PushV2] Backend registration failed:', errorData);
        return { ok: false, reason: res.status === 401 ? 'no-session' : 'unknown', error: errorData.error || `Server error (${res.status})` };
      }
      
      return { ok: true };
    } catch (e: any) {
      console.error('[PushV2] Registration error:', e);
      return { ok: false, reason: 'unknown', error: e.message };
    }
  };
  // Check if already registered this session
  if (hasRegisteredThisSession && !options.force) {
    console.log('[PushV2] Already registered this session, skipping');
    return { 
      ok: true, 
      playerId: currentPlayerId || undefined,
      reason: undefined,
      subscriptionStatus: 'subscribed'
    };
  }
  
  // Check if Despia is available
  if (!isDespiaAvailable()) {
    console.log('[PushV2] Despia not available - not in native app');
    return { ok: false, reason: 'api-not-available', subscriptionStatus: 'not-registered' };
  }

  // Explicitly trigger native push permission/registration via Despia bridge
  const despiaFn = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
  if (despiaFn && typeof despiaFn === 'function') {
    try {
      despiaFn('registerpush://');
      console.log('[PushV2] Triggered native push registration via despia registerpush://');
    } catch (e) {
      console.warn('[PushV2] Failed to trigger native push registration:', e);
    }
  } else {
    console.warn('[PushV2] Despia bridge not available to request push permissions');
  }
  
  // Check session
  if (!session?.access_token) {
    console.warn('[PushV2] No session token available');
    return { ok: false, reason: 'no-session', subscriptionStatus: 'not-registered' };
  }
  
  // Get user ID from session or options
  const userId = options.userId || session.user?.id;
  
  // CRITICAL: Set external user ID via Despia V2 API
  // This is the primary mechanism for linking device to user in OneSignal
  if (userId) {
    const externalIdSet = setOneSignalExternalUserId(userId);
    if (externalIdSet) {
      console.log('[PushV2] ✅ Despia V2: External user ID linked to device');
    } else {
      console.warn('[PushV2] Could not set external user ID via Despia');
    }
  } else {
    console.warn('[PushV2] No user ID available for setOneSignalExternalUserId');
  }
  
  // Check OS permission
  const hasPermission = checkOsPermission();
  if (!hasPermission) {
    console.warn('[PushV2] OS permission not granted');
    return { ok: false, reason: 'permission-denied', subscriptionStatus: 'permission-denied' };
  }
  
  // Get Player ID (poll with timeout) - still useful for tracking/debugging
  console.log('[PushV2] Waiting for Player ID...');
  let playerId = await pollForPlayerId(15000);

  // If still not available, extend the wait with a backoff to reduce flakiness
  if (!playerId) {
    console.log('[PushV2] Player ID not found in first window, retrying with extended backoff...');
    playerId = await pollForPlayerId(15000); // extra 15s
  }
  
  if (!playerId) {
    // With Despia V2, not having a player ID is less critical
    // The external_user_id link via despia() is the primary mechanism
    console.warn('[PushV2] Player ID not available after 15 seconds');
    
    // If we successfully set external user ID, consider it a partial success
    if (hasSetExternalUserId) {
      console.log('[PushV2] External user ID was set, proceeding without player ID');
      hasRegisteredThisSession = true;
      return { 
        ok: true, 
        reason: undefined,
        subscriptionStatus: 'subscribed'
      };
    }
    
    // Fire a background retry to capture the token if it becomes available shortly after
    if (session?.access_token) {
      setTimeout(async () => {
        const retryId = await pollForPlayerId(15000);
        if (retryId) {
          console.log('[PushV2] ✅ Background retry obtained Player ID:', retryId.slice(0, 8) + '…');
          const backendRes = await registerBackend(retryId);
          if (backendRes.ok) {
            hasRegisteredThisSession = true;
            currentPlayerId = retryId;
            console.log('[PushV2] ✅ Background registration succeeded');
          } else {
            console.warn('[PushV2] Background registration failed:', backendRes.reason, backendRes.error || '');
          }
        }
      }, 3000);
    }

    return { 
      ok: false, 
      reason: 'no-player-id', 
      error: 'OneSignal Player ID not available. Please restart the app and re-enable notifications in OS settings.',
      subscriptionStatus: 'not-registered'
    };
  }
  
  console.log(`[PushV2] Got Player ID: ${playerId.slice(0, 8)}...`);
  
  // Register with backend (for tracking/auditing, not strictly required for V2)
  const backendRes = await registerBackend(playerId);
  if (backendRes.ok) {
    hasRegisteredThisSession = true;
    currentPlayerId = playerId;
    console.log('[PushV2] ✅ Successfully registered device (Despia V2 + backend)');
    return { ok: true, playerId, subscriptionStatus: 'subscribed' };
  }

  // With V2, if external_user_id is set, we can still consider it successful
  if (hasSetExternalUserId) {
    console.log('[PushV2] External user ID is set, marking as registered despite backend error');
    hasRegisteredThisSession = true;
    currentPlayerId = playerId;
    return { ok: true, playerId, subscriptionStatus: 'subscribed' };
  }

  const fallbackReason: PushSubscriptionResult['reason'] = backendRes.reason ?? 'unknown';
  return { 
    ok: false, 
    reason: fallbackReason, 
    error: backendRes.error,
    subscriptionStatus: 'not-registered' 
  };
}

/**
 * Update heartbeat (last_seen_at) and re-link external_user_id
 * This ensures the device stays linked to the user even if OneSignal clears it
 */
export async function updateHeartbeat(
  session: { access_token: string; user?: { id: string } } | null,
  options: { userId?: string } = {}
): Promise<void> {
  if (!session?.access_token) {
    return;
  }
  
  const userId = options.userId || session.user?.id;
  
  // CRITICAL: Re-set external_user_id on every heartbeat
  // This ensures the device stays linked even if OneSignal clears it
  if (userId) {
    const externalIdSet = setOneSignalExternalUserId(userId);
    if (externalIdSet) {
      console.log('[PushV2] Heartbeat: External user ID re-linked');
    }
  }
  
  // If we have a Player ID, update backend heartbeat
  if (currentPlayerId) {
    try {
      const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
      const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';
      
      // Use registerPlayer with same playerId - it will update last_checked_at
      await fetch(`${baseUrl}/.netlify/functions/registerPlayer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          playerId: currentPlayerId,
          platform: 'ios',
        }),
      });
      
      console.log('[PushV2] Heartbeat updated');
    } catch (e) {
      console.warn('[PushV2] Heartbeat update failed:', e);
    }
  }
}

/**
 * Deactivate subscription on logout
 * This prevents ghost notifications to users who logged out
 */
export async function deactivatePushSubscription(
  session: { access_token: string } | null
): Promise<void> {
  if (!currentPlayerId && !session?.access_token) {
    console.log('[PushV2] No subscription to deactivate');
    resetPushSessionState();
    return;
  }
  
  try {
    const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
    const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';
    
    console.log('[PushV2] Deactivating subscription for logout');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Include auth token if available (for deactivating by user_id)
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    const response = await fetch(`${baseUrl}/.netlify/functions/deactivateDevice`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ playerId: currentPlayerId }),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('[PushV2] ✅ Subscription deactivated:', result);
    } else {
      const error = await response.json().catch(() => ({}));
      console.warn('[PushV2] Deactivation response not ok:', error);
    }
    
    resetPushSessionState();
  } catch (e) {
    console.warn('[PushV2] Deactivation failed:', e);
    resetPushSessionState();
  }
}

/**
 * Get effective push notification state for UI display
 * 
 * This function checks the actual state of push notifications by:
 * 1. Checking if Despia is available (native app)
 * 2. Checking OS permission status
 * 3. Checking if we have a Player ID from Despia (indicates registration)
 * 
 * Note: We use the Player ID from Despia directly rather than relying on
 * in-memory state, so this works correctly even after page refresh.
 */
export async function getEffectivePushState(
  _userId: string | null
): Promise<EffectivePushState> {
  const isDespia = isDespiaAvailable();
  const hasOsPermission = isDespia ? checkOsPermission() : false;
  const playerId = getPlayerIdFromDespia();
  
  // If we have a Player ID from Despia, we're registered (even if in-memory state isn't set)
  // Also check in-memory state as a fallback for cases where Player ID isn't available yet
  const isRegistered = !!playerId || (hasRegisteredThisSession && !!currentPlayerId);
  
  // Determine effective state
  let effectiveState: EffectivePushState['effectiveState'];
  if (!isDespia) {
    effectiveState = 'not_registered';
  } else if (!hasOsPermission) {
    effectiveState = 'muted_by_os';
  } else if (!isRegistered) {
    effectiveState = 'not_registered';
  } else {
    effectiveState = 'allowed';
  }
  
  return {
    hasOsPermission,
    isRegistered,
    isSubscribedInOneSignal: isRegistered, // We verify on registration
    effectiveState,
    playerId: playerId || undefined,
  };
}

// Re-export for backwards compatibility
export { ensurePushSubscribed } from './pushNotifications';

