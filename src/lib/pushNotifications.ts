/**
 * Push notification utilities for Despia native app
 * Ensures devices are properly subscribed before registering Player IDs
 */

export interface PushSubscriptionResult {
  ok: boolean;
  reason?: 'permission-denied' | 'no-player-id' | 'api-not-available' | 'unknown';
  playerId?: string;
}

/**
 * Ensures push notifications are enabled and device is subscribed
 * Requests OS permission if needed, waits for OneSignal initialization, then registers Player ID
 */
export async function ensurePushSubscribed(
  session: { access_token: string } | null
): Promise<PushSubscriptionResult> {
  const despia: any = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);

  if (!despia) {
    console.warn('[Push] Despia not available - not in native app?');
    return { ok: false, reason: 'api-not-available' };
  }

  try {
    // 1) Request OS permission if API available
    // Note: Despia may expose this differently - adjust method name if needed
    if (typeof despia.oneSignalRequestPermission === 'function') {
      console.log('[Push] Requesting OS permission...');
      const granted = await despia.oneSignalRequestPermission();
      if (!granted) {
        console.warn('[Push] Permission denied by user');
        return { ok: false, reason: 'permission-denied' };
      }
      console.log('[Push] Permission granted');
    } else if (typeof despia.requestPermission === 'function') {
      // Alternative API name
      const granted = await despia.requestPermission();
      if (!granted) {
        return { ok: false, reason: 'permission-denied' };
      }
    } else {
      console.log('[Push] Permission API not found - assuming already granted or handled by OS');
    }

    // 2) Wait for OneSignal to finish initialization and get Player ID
    console.log('[Push] Waiting for OneSignal initialization...');
    await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5s delay

    // Try multiple ways to get Player ID
    let playerId: string | null = null;
    
    if (typeof despia.oneSignalPlayerId === 'function') {
      playerId = await despia.oneSignalPlayerId();
    } else if (despia.onesignalplayerid) {
      playerId = typeof despia.onesignalplayerid === 'string' 
        ? despia.onesignalplayerid.trim() 
        : null;
    } else if (despia.oneSignalPlayerId) {
      playerId = typeof despia.oneSignalPlayerId === 'string'
        ? despia.oneSignalPlayerId.trim()
        : null;
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

