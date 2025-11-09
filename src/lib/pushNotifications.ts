/**
 * Push notification utilities for Despia native app
 * Ensures devices are properly subscribed before registering Player IDs
 * Based on: https://lovable.despia.com/default-guide/native-features/onesignal
 */

export interface PushSubscriptionResult {
  ok: boolean;
  reason?: 'permission-denied' | 'no-player-id' | 'api-not-available' | 'no-session' | 'unknown';
  playerId?: string;
}

/**
 * Ensures push notifications are enabled and device is subscribed
 * Requests OS permission if needed, waits for OneSignal initialization, then registers Player ID
 * Follows Despia documentation: https://lovable.despia.com/default-guide/native-features/onesignal
 */
export async function ensurePushSubscribed(
  session: { access_token: string } | null
): Promise<PushSubscriptionResult> {
  // Try to import despia-native as documented
  let despia: any = null;
  try {
    const despiaModule = await import('despia-native');
    despia = despiaModule.default;
  } catch (e) {
    // Fallback: check global properties (Despia may inject directly)
    despia = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
  }
  
  // Also check for direct global property (Despia exposes onesignalplayerid directly)
  const directPlayerId = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
  
  // If we have direct player ID, we're in native app even without despia object
  const isNativeApp = !!despia || !!directPlayerId;

  if (!isNativeApp) {
    console.warn('[Push] Despia not available - not in native app?');
    return { ok: false, reason: 'api-not-available' };
  }

  try {
    // 1) Check permission status using Despia's documented method
    // From docs: despia('checkNativePushPermissions://', ['nativePushEnabled'])
    if (despia && typeof despia === 'function') {
      try {
        const permissionData = despia('checkNativePushPermissions://', ['nativePushEnabled']);
        if (permissionData && typeof permissionData === 'object' && 'nativePushEnabled' in permissionData) {
          const isEnabled = Boolean(permissionData.nativePushEnabled);
          if (!isEnabled) {
            console.warn('[Push] Push notifications not enabled in OS settings');
            // Don't return error - user can enable via OS Settings button
          }
        }
      } catch (e) {
        console.log('[Push] Could not check permission status, continuing...');
      }
    }

    // 2) Wait for OneSignal to finish initialization and get Player ID
    console.log('[Push] Waiting for OneSignal initialization...');
    await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5s delay

    // Try multiple ways to get Player ID
    // From docs: despia.onesignalplayerid (lowercase)
    // Despia also exposes onesignalplayerid directly on window/globalThis as a global property
    let playerId: string | null = null;
    
    // First check direct global property (Despia's actual implementation)
    const directPid = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
    if (directPid && typeof directPid === 'string') {
      playerId = directPid.trim();
    }
    
    // Fallback to despia object if it exists (from import or global)
    if (!playerId && despia) {
      // From documentation: despia.onesignalplayerid
      if (despia.onesignalplayerid && typeof despia.onesignalplayerid === 'string') {
        playerId = despia.onesignalplayerid.trim();
      } else if (despia.oneSignalPlayerId && typeof despia.oneSignalPlayerId === 'string') {
        playerId = despia.oneSignalPlayerId.trim();
      }
    }

    if (!playerId || playerId.length === 0) {
      console.warn('[Push] Player ID not available after initialization');
      return { ok: false, reason: 'no-player-id' };
    }

    console.log(`[Push] Got Player ID: ${playerId.slice(0, 8)}…`);

    // 3) Send to backend
    if (!session?.access_token) {
      console.warn('[Push] No session token available');
      return { ok: false, reason: 'no-session' };
    }

    const res = await fetch('/.netlify/functions/registerPlayer', {
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
      console.error('[Push] Failed to register device:', errorData);
      return { ok: false, reason: 'unknown' };
    }

    console.log('[Push] Successfully registered device');
    return { ok: true, playerId };
  } catch (e: any) {
    console.error('[Push] Error in ensurePushSubscribed:', e);
    return { ok: false, reason: 'unknown' };
  }
}

