import { Linking, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as Device from 'expo-device';

import { env } from '../env';

type PushReason = 'permission-denied' | 'no-player-id' | 'api-not-available' | 'no-session' | 'unknown';

export interface PushSubscriptionResult {
  ok: boolean;
  reason?: PushReason;
  playerId?: string;
  error?: string;
}

let hasInitialized = false;
let hasRegisteredThisSession = false;
let currentPlayerId: string | null = null;
let clickHandlerAttached = false;
let cachedOneSignalSdk: { OneSignal: any; LogLevel: any } | null | undefined;

function getOneSignalSdk(): { OneSignal: any; LogLevel: any } | null {
  if (cachedOneSignalSdk !== undefined) return cachedOneSignalSdk;
  try {
    // Lazy-load to avoid runtime crashes when native module is unavailable
    // (e.g. simulator / stale dev client without the OneSignal native build).
    const mod = require('react-native-onesignal');
    cachedOneSignalSdk = mod?.OneSignal && mod?.LogLevel ? { OneSignal: mod.OneSignal, LogLevel: mod.LogLevel } : null;
  } catch {
    cachedOneSignalSdk = null;
  }
  return cachedOneSignalSdk;
}

function siteBaseUrl(): string {
  return String(env.EXPO_PUBLIC_SITE_URL ?? 'https://playtotl.com').replace(/\/+$/, '');
}

function oneSignalAppId(): string | null {
  const appId = env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim();
  return appId ? appId : null;
}

function toAppDeepLink(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('/')) {
    return `com.despia.totlnative://${trimmed.replace(/^\/+/, '')}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `com.despia.totlnative://${`${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/^\/+/, '')}`;
    }
  } catch {
    // Leave untouched when URL parsing fails.
  }

  return trimmed;
}

function attachClickHandlerOnce() {
  const sdk = getOneSignalSdk();
  if (!sdk) return;
  const { OneSignal } = sdk;
  if (clickHandlerAttached) return;
  const listener = (event: any) => {
    const fromResult = typeof event?.result?.url === 'string' ? event.result.url : '';
    const fromLaunch = typeof event?.notification?.launchURL === 'string' ? event.notification.launchURL : '';
    const fromData = typeof event?.notification?.additionalData === 'object' ? (event.notification.additionalData as any)?.url : '';
    const target = fromResult || fromLaunch || (typeof fromData === 'string' ? fromData : '');
    if (!target) return;
    void Linking.openURL(toAppDeepLink(target)).catch(() => {});
  };

  OneSignal.Notifications.addEventListener('click', listener);
  clickHandlerAttached = true;
}

export function resetPushSessionState(): void {
  hasRegisteredThisSession = false;
  currentPlayerId = null;
}

export function initPushSdk(): boolean {
  const appId = oneSignalAppId();
  if (!appId) return false;
  if (hasInitialized) return true;
  const sdk = getOneSignalSdk();
  if (!sdk) return false;
  const { OneSignal, LogLevel } = sdk;

  OneSignal.Debug.setLogLevel(__DEV__ ? LogLevel.Warn : LogLevel.None);
  OneSignal.initialize(appId);
  attachClickHandlerOnce();
  hasInitialized = true;
  return true;
}

async function waitForPlayerId(maxMs: number = 15000): Promise<string | null> {
  const sdk = getOneSignalSdk();
  if (!sdk) return null;
  const { OneSignal } = sdk;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const id = await OneSignal.User.pushSubscription.getIdAsync();
    if (id && id.trim().length > 0) return id.trim();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function registerWithBackend(accessToken: string, playerId: string): Promise<void> {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'ios';
  const response = await fetch(`${siteBaseUrl()}/.netlify/functions/registerPlayer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ playerId, platform }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`registerPlayer failed (${response.status}): ${body || 'unknown error'}`);
  }
}

export async function registerForPushNotifications(
  session: Session | null,
  options: { force?: boolean; userId?: string } = {}
): Promise<PushSubscriptionResult> {
  if (!Device.isDevice) {
    return { ok: false, reason: 'api-not-available', error: 'Push requires a physical device' };
  }
  if (!initPushSdk()) {
    return { ok: false, reason: 'api-not-available', error: 'OneSignal native SDK unavailable or app ID missing' };
  }
  const sdk = getOneSignalSdk();
  if (!sdk) return { ok: false, reason: 'api-not-available', error: 'OneSignal native SDK unavailable' };
  const { OneSignal } = sdk;
  if (!session?.access_token) return { ok: false, reason: 'no-session' };
  if (hasRegisteredThisSession && !options.force) {
    return { ok: true, playerId: currentPlayerId ?? undefined };
  }

  const userId = options.userId || session.user?.id;
  if (!userId) return { ok: false, reason: 'no-session' };

  try {
    OneSignal.login(userId);
  } catch (error) {
    return { ok: false, reason: 'unknown', error: String(error) };
  }

  const hasPermission = await OneSignal.Notifications.getPermissionAsync();
  const allowed = hasPermission || (await OneSignal.Notifications.requestPermission(true));
  if (!allowed) return { ok: false, reason: 'permission-denied' };

  const playerId = await waitForPlayerId(15000);
  if (!playerId) {
    return { ok: false, reason: 'no-player-id', error: 'OneSignal subscription ID not available yet' };
  }

  try {
    await registerWithBackend(session.access_token, playerId);
    hasRegisteredThisSession = true;
    currentPlayerId = playerId;
    return { ok: true, playerId };
  } catch (error) {
    return { ok: false, reason: 'unknown', error: String(error) };
  }
}

export async function updateHeartbeat(session: Session | null, options: { userId?: string } = {}): Promise<void> {
  if (!session?.access_token) return;
  if (!initPushSdk()) return;
  const sdk = getOneSignalSdk();
  if (!sdk) return;
  const { OneSignal } = sdk;

  const userId = options.userId || session.user?.id;
  if (userId) {
    try {
      OneSignal.login(userId);
    } catch {
      // Ignore login errors during heartbeat.
    }
  }

  const playerId = currentPlayerId ?? (await OneSignal.User.pushSubscription.getIdAsync());
  if (!playerId) return;

  try {
    await registerWithBackend(session.access_token, playerId);
    currentPlayerId = playerId;
  } catch {
    // Heartbeat is best effort.
  }
}

export async function deactivatePushSubscription(session: Session | null): Promise<void> {
  const sdk = getOneSignalSdk();
  if (!sdk) return;
  const { OneSignal } = sdk;
  if (!initPushSdk()) return;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    await fetch(`${siteBaseUrl()}/.netlify/functions/deactivateDevice`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ playerId: currentPlayerId }),
    });
  } catch {
    // Best effort: always clear local state.
  } finally {
    try {
      OneSignal.logout();
    } catch {
      // no-op
    }
    resetPushSessionState();
  }
}

