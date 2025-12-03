/**
 * Push notification utilities for Despia native app
 * Ensures devices are properly subscribed before registering Player IDs
 * Based on: https://lovable.despia.com/default-guide/native-features/onesignal
 */

export interface PushSubscriptionResult {
  ok: boolean;
  reason?: 'permission-denied' | 'no-player-id' | 'api-not-available' | 'no-session' | 'unknown';
  playerId?: string;
  error?: string; // Additional error details
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

    // 2) Poll for OneSignal Player ID (it may take time to initialize)
    // OneSignal SDK can take a few seconds to fully initialize, especially on first load
    console.log('[Push] Waiting for OneSignal Player ID...');
    
    let playerId: string | null = null;
    const maxAttempts = 10;
    const pollInterval = 500; // Check every 500ms
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Try multiple ways to get Player ID
      // From docs: despia.onesignalplayerid (lowercase)
      // Despia also exposes onesignalplayerid directly on window/globalThis as a global property
      
      // First check direct global property (Despia's actual implementation)
      const directPid = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
      if (directPid && typeof directPid === 'string' && directPid.trim().length > 0) {
        playerId = directPid.trim();
        break;
      }
      
      // Fallback to despia object if it exists (from import or global)
      if (despia) {
        // From documentation: despia.onesignalplayerid
        if (despia.onesignalplayerid && typeof despia.onesignalplayerid === 'string' && despia.onesignalplayerid.trim().length > 0) {
          playerId = despia.onesignalplayerid.trim();
          break;
        } else if (despia.oneSignalPlayerId && typeof despia.oneSignalPlayerId === 'string' && despia.oneSignalPlayerId.trim().length > 0) {
          playerId = despia.oneSignalPlayerId.trim();
          break;
        }
      }
      
      // Wait before next attempt
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    if (!playerId || playerId.length === 0) {
      console.warn('[Push] Player ID not available after polling', maxAttempts, 'times');
      return { ok: false, reason: 'no-player-id' };
    }
    
    console.log(`[Push] ✅ Got Player ID: ${playerId.slice(0, 8)}…`);

    // 3) Send to backend
    if (!session?.access_token) {
      console.warn('[Push] No session token available');
      return { ok: false, reason: 'no-session' };
    }

    // Use staging URL in development, local path in production
    const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
    const baseUrl = isDev 
      ? 'https://totl-staging.netlify.app'
      : '';
    
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
      let errorData: any = {};
      try {
        const text = await res.text();
        errorData = text ? JSON.parse(text) : {};
      } catch (e) {
        errorData = { error: `HTTP ${res.status}: ${res.statusText}` };
      }
      console.error('[Push] Failed to register device:', {
        status: res.status,
        statusText: res.statusText,
        error: errorData,
      });
      
      // Provide more specific error reasons
      if (res.status === 401) {
        return { ok: false, reason: 'no-session' };
      }
      if (res.status === 400 && errorData.error?.includes('playerId')) {
        return { ok: false, reason: 'no-player-id' };
      }
      
      return { ok: false, reason: 'unknown', error: errorData.error || `Server error (${res.status})` };
    }

    console.log('[Push] Successfully registered device');
    return { ok: true, playerId };
  } catch (e: any) {
    console.error('[Push] Error in ensurePushSubscribed:', e);
    return { ok: false, reason: 'unknown' };
  }
}

