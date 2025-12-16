/**
 * Push Notification Service V2
 * 
 * Improved registration handling:
 * - Register ONCE per session (not repeatedly)
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

/**
 * Reset session state (call on logout)
 */
export function resetPushSessionState(): void {
  hasRegisteredThisSession = false;
  currentPlayerId = null;
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
 */
export async function registerPushSubscription(
  session: { access_token: string } | null,
  options: { force?: boolean } = {}
): Promise<PushSubscriptionResult> {
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
  
  // Check session
  if (!session?.access_token) {
    console.warn('[PushV2] No session token available');
    return { ok: false, reason: 'no-session', subscriptionStatus: 'not-registered' };
  }
  
  // Check OS permission
  const hasPermission = checkOsPermission();
  if (!hasPermission) {
    console.warn('[PushV2] OS permission not granted');
    return { ok: false, reason: 'permission-denied', subscriptionStatus: 'permission-denied' };
  }
  
  // Get Player ID (poll with timeout)
  console.log('[PushV2] Waiting for Player ID...');
  const playerId = await pollForPlayerId(15000);
  
  if (!playerId) {
    console.warn('[PushV2] Player ID not available after 15 seconds');
    return { 
      ok: false, 
      reason: 'no-player-id', 
      error: 'OneSignal Player ID not available. Please restart the app.',
      subscriptionStatus: 'not-registered'
    };
  }
  
  console.log(`[PushV2] Got Player ID: ${playerId.slice(0, 8)}...`);
  
  // Register with backend
  try {
    const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
    const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';
    
    const res = await fetch(`${baseUrl}/.netlify/functions/registerPlayer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        playerId,
        platform: 'ios', // TODO: detect platform
      }),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[PushV2] Registration failed:', errorData);
      return { 
        ok: false, 
        reason: res.status === 401 ? 'no-session' : 'unknown',
        error: errorData.error || `Server error (${res.status})`,
        subscriptionStatus: 'not-registered'
      };
    }
    
    // Success - mark as registered for this session
    hasRegisteredThisSession = true;
    currentPlayerId = playerId;
    
    console.log('[PushV2] ✅ Successfully registered device');
    return { ok: true, playerId, subscriptionStatus: 'subscribed' };
    
  } catch (e: any) {
    console.error('[PushV2] Registration error:', e);
    return { ok: false, reason: 'unknown', error: e.message, subscriptionStatus: 'not-registered' };
  }
}

/**
 * Update heartbeat (last_seen_at) without re-registering
 */
export async function updateHeartbeat(
  session: { access_token: string } | null
): Promise<void> {
  if (!currentPlayerId || !session?.access_token) {
    return;
  }
  
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
 */
export async function getEffectivePushState(
  _userId: string | null
): Promise<EffectivePushState> {
  const hasOsPermission = isDespiaAvailable() ? checkOsPermission() : false;
  const playerId = getPlayerIdFromDespia();
  const isRegistered = hasRegisteredThisSession && !!currentPlayerId;
  
  // Determine effective state
  let effectiveState: EffectivePushState['effectiveState'];
  if (!isDespiaAvailable()) {
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

