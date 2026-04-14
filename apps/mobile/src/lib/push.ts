import { Linking, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { env } from '../env';
import {
  getPushDiagnosticsState,
  recordPushDiagnosticEvent,
  setLastLoginUserId,
  setLastPushOperationTrace,
} from './pushDiagnostics';

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
    const { NativeModules } = require('react-native');
    if (!NativeModules.OneSignal && !NativeModules.RNOneSignal) {
      cachedOneSignalSdk = null;
      return cachedOneSignalSdk;
    }
    const mod = require('react-native-onesignal');
    cachedOneSignalSdk = mod?.OneSignal && mod?.LogLevel ? { OneSignal: mod.OneSignal, LogLevel: mod.LogLevel } : null;
  } catch {
    cachedOneSignalSdk = null;
  }
  return cachedOneSignalSdk;
}

function siteBaseUrl(): string {
  return String(env.EXPO_PUBLIC_SITE_URL ?? 'https://totl-staging.netlify.app').replace(/\/+$/, '');
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
  if (!appId) {
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'OneSignal app ID missing in Expo config',
    });
    return false;
  }
  if (hasInitialized) return true;
  const sdk = getOneSignalSdk();
  if (!sdk) {
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'OneSignal native SDK unavailable at init',
    });
    return false;
  }
  const { OneSignal, LogLevel } = sdk;

  OneSignal.Debug.setLogLevel(__DEV__ ? LogLevel.Warn : LogLevel.None);
  OneSignal.initialize(appId);
  attachClickHandlerOnce();
  hasInitialized = true;
  setLastPushOperationTrace({
    at: new Date().toISOString(),
    operation: 'init',
    ok: true,
  });
  recordPushDiagnosticEvent({
    scope: 'push',
    status: 'success',
    message: 'OneSignal SDK initialized',
    data: { appId },
  });
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

async function registerWithBackend(accessToken: string, playerId: string): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'ios';
  const response = await fetch(`${siteBaseUrl()}/.netlify/functions/registerPlayer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ playerId, platform }),
  });

  const bodyText = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(`registerPlayer failed (${response.status}): ${bodyText || 'unknown error'}`);
  }

  return {
    ok: response.ok,
    status: response.status,
    bodyText,
  };
}

export async function registerForPushNotifications(
  session: Session | null,
  options: { force?: boolean; userId?: string } = {}
): Promise<PushSubscriptionResult> {
  if (!Device.isDevice) {
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'Push registration skipped on non-physical device',
    });
    return { ok: false, reason: 'api-not-available', error: 'Push requires a physical device' };
  }
  if (!initPushSdk()) {
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'OneSignal SDK unavailable during registration',
    });
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
    setLastLoginUserId(userId);
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'info',
      message: 'Called OneSignal.login',
      data: { userId },
    });
  } catch (error) {
    const errorText = String(error);
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'register',
      ok: false,
      reason: 'unknown',
      error: errorText,
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'OneSignal.login failed',
      data: { userId, error: errorText },
    });
    return { ok: false, reason: 'unknown', error: String(error) };
  }

  const hasPermission = await OneSignal.Notifications.getPermissionAsync();
  const allowed = hasPermission || (await OneSignal.Notifications.requestPermission(true));
  if (!allowed) {
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'register',
      ok: false,
      reason: 'permission-denied',
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'Push permission denied',
      data: { userId },
    });
    return { ok: false, reason: 'permission-denied' };
  }

  const playerId = await waitForPlayerId(15000);
  if (!playerId) {
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'register',
      ok: false,
      reason: 'no-player-id',
      error: 'OneSignal subscription ID not available yet',
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'No OneSignal player ID available after wait',
      data: { userId },
    });
    return { ok: false, reason: 'no-player-id', error: 'OneSignal subscription ID not available yet' };
  }

  try {
    const backend = await registerWithBackend(session.access_token, playerId);
    hasRegisteredThisSession = true;
    currentPlayerId = playerId;
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'register',
      ok: true,
      playerId,
      backend: {
        at: new Date().toISOString(),
        ok: backend.ok,
        status: backend.status,
        bodyText: backend.bodyText,
      },
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'success',
      message: 'Push registration completed',
      data: { userId, playerId, backendStatus: backend.status },
    });
    return { ok: true, playerId };
  } catch (error) {
    const errorText = String(error);
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'register',
      ok: false,
      reason: 'unknown',
      playerId,
      error: errorText,
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'Backend registerPlayer failed',
      data: { userId, playerId, error: errorText },
    });
    return { ok: false, reason: 'unknown', error: errorText };
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
    const backend = await registerWithBackend(session.access_token, playerId);
    currentPlayerId = playerId;
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'heartbeat',
      ok: true,
      playerId,
      backend: {
        at: new Date().toISOString(),
        ok: backend.ok,
        status: backend.status,
        bodyText: backend.bodyText,
      },
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'success',
      message: 'Push heartbeat updated',
      data: { userId, playerId, backendStatus: backend.status },
    });
  } catch {
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'heartbeat',
      ok: false,
      playerId,
      error: 'Heartbeat registerPlayer call failed',
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'Push heartbeat failed',
      data: { userId, playerId },
    });
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
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'deactivate',
      ok: true,
      playerId: currentPlayerId,
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'info',
      message: 'Push subscription deactivated',
      data: { playerId: currentPlayerId },
    });
  } catch {
    setLastPushOperationTrace({
      at: new Date().toISOString(),
      operation: 'deactivate',
      ok: false,
      playerId: currentPlayerId,
      error: 'deactivateDevice request failed',
    });
    recordPushDiagnosticEvent({
      scope: 'push',
      status: 'error',
      message: 'Push deactivation request failed',
      data: { playerId: currentPlayerId },
    });
  } finally {
    try {
      OneSignal.logout();
    } catch {
      // no-op
    }
    resetPushSessionState();
  }
}

export async function getPushDebugSnapshot(): Promise<any> {
  const sdk = getOneSignalSdk();
  const oneSignal = sdk?.OneSignal;
  const pushSubscription = oneSignal?.User?.pushSubscription;
  const permission = oneSignal?.Notifications && typeof oneSignal.Notifications.getPermissionAsync === 'function'
    ? await oneSignal.Notifications.getPermissionAsync().catch(() => null)
    : null;
  const playerId = pushSubscription && typeof pushSubscription.getIdAsync === 'function'
    ? await pushSubscription.getIdAsync().catch(() => currentPlayerId)
    : currentPlayerId;
  const optedIn = pushSubscription && typeof pushSubscription.getOptedInAsync === 'function'
    ? await pushSubscription.getOptedInAsync().catch(() => null)
    : null;
  const token = pushSubscription && typeof pushSubscription.getTokenAsync === 'function'
    ? await pushSubscription.getTokenAsync().catch(() => null)
    : null;
  const externalUserId = oneSignal?.User && typeof oneSignal.User.getExternalId === 'function'
    ? await oneSignal.User.getExternalId().catch(() => null)
    : null;
  const expoConfig = (Constants.expoConfig ?? {}) as Record<string, any>;
  const iosConfig = (expoConfig.ios ?? {}) as Record<string, any>;

  return {
    generatedAt: new Date().toISOString(),
    local: {
      platform: Platform.OS,
      platformVersion: Platform.Version,
      isPhysicalDevice: Device.isDevice,
      deviceName: Device.deviceName ?? null,
      modelName: Device.modelName ?? null,
      osName: Device.osName ?? null,
      osVersion: Device.osVersion ?? null,
      bundleId: iosConfig.bundleIdentifier ?? null,
      appVersion: expoConfig.version ?? null,
      buildNumber: iosConfig.buildNumber ?? null,
      siteUrl: siteBaseUrl(),
      oneSignalAppId: oneSignalAppId(),
      sdkAvailable: !!sdk,
      initialized: hasInitialized,
      registeredThisSession: hasRegisteredThisSession,
      currentPlayerId,
      livePlayerId: typeof playerId === 'string' && playerId.trim().length > 0 ? playerId.trim() : null,
      lastLoginUserId: getPushDiagnosticsState().lastLoginUserId,
      notificationPermission: permission,
      optedIn,
      pushTokenPresent: typeof token === 'string' ? token.length > 0 : null,
      externalUserId,
    },
    traces: getPushDiagnosticsState(),
  };
}

