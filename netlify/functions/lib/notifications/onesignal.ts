/**
 * OneSignal Module
 * 
 * Handles OneSignal payload building and API communication.
 * Sets grouping fields (collapse_id, thread_id, android_group) on every send.
 */

import type { NotificationCatalogEntry } from './catalog';
import { formatCollapseId, formatThreadId } from './catalog';
import type { OneSignalPayload } from './types';
import { buildOneSignalAuthorization } from '../onesignalAuth';

const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';

/**
 * Build a OneSignal notification payload
 * Supports both external_user_ids (preferred) and player_ids (legacy) targeting
 */
export function buildPayload(
  catalogEntry: NotificationCatalogEntry,
  options: {
    title: string;
    body: string;
    externalUserIds?: string[];
    playerIds?: string[];
    data?: Record<string, any>;
    url?: string;
    groupingParams?: Record<string, string | number>;
    badgeCount?: number;
  }
): OneSignalPayload {
  const appId = process.env.ONESIGNAL_APP_ID;
  if (!appId) {
    throw new Error('ONESIGNAL_APP_ID not configured');
  }
  
  const { title, body, externalUserIds, playerIds, data, url, groupingParams = {}, badgeCount } = options;
  
  // Build grouping fields from catalog templates
  const collapseId = formatCollapseId(catalogEntry.notification_key, groupingParams);
  const threadId = formatThreadId(catalogEntry.notification_key, groupingParams);
  const androidGroup = catalogEntry.onesignal.android_group_format;
  
  const payload: OneSignalPayload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: body },
  };
  
  // Stored player IDs are OneSignal subscription IDs in SDK v5+.
  // This avoids the external_user_id mapping layer that can break
  if (playerIds && playerIds.length > 0) {
    payload.include_subscription_ids = playerIds;
  } else if (externalUserIds && externalUserIds.length > 0) {
    payload.include_external_user_ids = externalUserIds;
  }
  
  // Add grouping fields (CRITICAL for preventing duplicate display)
  if (collapseId) {
    payload.collapse_id = collapseId;
  }
  if (threadId) {
    payload.thread_id = threadId;
  }
  if (androidGroup) {
    payload.android_group = androidGroup;
  }
  
  // Add iOS badge if specified
  if (badgeCount !== undefined && badgeCount > 0) {
    payload.ios_badgeType = 'SetTo';
    payload.ios_badgeCount = badgeCount;
  }
  
  // OneSignal's top-level `url` is a Launch URL: on iOS it calls openURL and
  // opens Safari. Keep destinations in Additional Data so the app's click
  // listener owns navigation without a browser bounce.
  const destinationUrl = typeof url === 'string' ? url.trim() : '';
  const additionalData = data ? { ...data } : {};
  if (destinationUrl) {
    if (typeof additionalData.url !== 'string' || !additionalData.url.trim()) {
      additionalData.url = destinationUrl;
    }
    if (typeof additionalData.navigateTo !== 'string' || !additionalData.navigateTo.trim()) {
      additionalData.navigateTo = destinationUrl;
    }
  }
  if (Object.keys(additionalData).length > 0) {
    payload.data = additionalData;
  }
  
  return payload;
}

/**
 * Send a notification via OneSignal API
 */
export async function sendNotification(
  payload: OneSignalPayload
): Promise<{
  success: boolean;
  notification_id?: string;
  recipients?: number;
  error?: any;
}> {
  const restKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();
  if (!restKey) {
    console.error('[onesignal] ONESIGNAL_REST_API_KEY not configured');
    return {
      success: false,
      error: { message: 'ONESIGNAL_REST_API_KEY not configured' },
    };
  }
  
  // Log API key status (first 4 chars only for security)
  const keyPreview = restKey.length > 4 ? `${restKey.slice(0, 4)}...` : '***';
  const keyLength = restKey.length;
  console.log(`[onesignal] Using API key: ${keyPreview} (length: ${keyLength})`);
  console.log(`[onesignal] App ID: ${payload.app_id || 'not set'}`);
  
  try {
    const authHeader = buildOneSignalAuthorization(restKey);
    console.log(`[onesignal] Authorization header length: ${authHeader.length}`);
    
    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    });
    
    const body = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      return {
        success: false,
        error: {
          status: response.status,
          body,
        },
      };
    }
    
    // Current API responses return a notification ID but no recipient count.
    // A 200 without an ID means no message was created.
    if (!body.id) {
      return {
        success: false,
        error: {
          errors: body.errors ?? 'OneSignal did not create a notification',
        },
      };
    }

    const targetCount =
      payload.include_subscription_ids?.length ||
      payload.include_external_user_ids?.length ||
      0;
    
    return {
      success: true,
      notification_id: body.id,
      recipients: typeof body.recipients === 'number' ? body.recipients : targetCount,
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        message: err.message || 'Unknown error',
      },
    };
  }
}

/**
 * Send notification to multiple users, batching if necessary
 * OneSignal limits targeting arrays to 2000 per request
 */
export async function sendBatchedNotification(
  catalogEntry: NotificationCatalogEntry,
  options: {
    title: string;
    body: string;
    externalUserIds?: string[];
    playerIds?: string[];
    data?: Record<string, any>;
    url?: string;
    groupingParams?: Record<string, string | number>;
  }
): Promise<{
  success: boolean;
  total_recipients: number;
  notification_ids: string[];
  errors: any[];
}> {
  const BATCH_SIZE = 2000;
  const { externalUserIds, playerIds } = options;
  
  // Prefer external user IDs
  const targetIds = externalUserIds && externalUserIds.length > 0 ? externalUserIds : (playerIds || []);
  const useExternalIds = externalUserIds && externalUserIds.length > 0;
  
  const results = {
    success: true,
    total_recipients: 0,
    notification_ids: [] as string[],
    errors: [] as any[],
  };
  
  // Split into batches
  for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
    const batchIds = targetIds.slice(i, i + BATCH_SIZE);
    
    const payload = buildPayload(catalogEntry, {
      ...options,
      externalUserIds: useExternalIds ? batchIds : undefined,
      playerIds: useExternalIds ? undefined : batchIds,
    });
    
    const result = await sendNotification(payload);
    
    if (result.success) {
      results.total_recipients += result.recipients || 0;
      if (result.notification_id) {
        results.notification_ids.push(result.notification_id);
      }
    } else {
      results.success = false;
      results.errors.push(result.error);
    }
  }
  
  return results;
}

/**
 * Create a summary of the payload for logging (without sensitive data)
 */
export function createPayloadSummary(payload: OneSignalPayload): Record<string, any> {
  return {
    title: payload.headings.en,
    body: payload.contents.en.slice(0, 100),
    external_user_ids_count: payload.include_external_user_ids?.length || 0,
    subscription_ids_count: payload.include_subscription_ids?.length || 0,
    target_type: payload.include_external_user_ids ? 'external_user_ids' : 'player_ids',
    has_data: !!payload.data,
    has_url: typeof payload.data?.url === 'string' && payload.data.url.length > 0,
    collapse_id: payload.collapse_id,
    thread_id: payload.thread_id,
    android_group: payload.android_group,
  };
}

