/**
 * OneSignal Module
 * 
 * Handles OneSignal payload building and API communication.
 * Sets grouping fields (collapse_id, thread_id, android_group) on every send.
 */

import type { NotificationCatalogEntry } from './catalog';
import { formatCollapseId, formatThreadId } from './catalog';
import type { OneSignalPayload } from './types';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

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
  }
): OneSignalPayload {
  const appId = process.env.ONESIGNAL_APP_ID;
  if (!appId) {
    throw new Error('ONESIGNAL_APP_ID not configured');
  }
  
  const { title, body, externalUserIds, playerIds, data, url, groupingParams = {} } = options;
  
  // Build grouping fields from catalog templates
  const collapseId = formatCollapseId(catalogEntry.notification_key, groupingParams);
  const threadId = formatThreadId(catalogEntry.notification_key, groupingParams);
  const androidGroup = catalogEntry.onesignal.android_group_format;
  
  const payload: OneSignalPayload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: body },
  };
  
  // Prefer external_user_ids targeting (uses Supabase user ID)
  // This avoids the player_id vs subscription_id confusion
  if (externalUserIds && externalUserIds.length > 0) {
    payload.include_external_user_ids = externalUserIds;
  } else if (playerIds && playerIds.length > 0) {
    payload.include_player_ids = playerIds;
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
  
  // Add data payload
  if (data) {
    payload.data = data;
  }
  
  // Add deep link URL
  if (url) {
    payload.url = url;
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
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restKey) {
    return {
      success: false,
      error: { message: 'ONESIGNAL_REST_API_KEY not configured' },
    };
  }
  
  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${restKey}`,
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
    
    // Check for errors in response body
    if (body.errors && Array.isArray(body.errors) && body.errors.length > 0) {
      return {
        success: false,
        error: {
          errors: body.errors,
        },
      };
    }
    
    return {
      success: true,
      notification_id: body.id,
      recipients: body.recipients || 0,
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
    player_ids_count: payload.include_player_ids?.length || 0,
    target_type: payload.include_external_user_ids ? 'external_user_ids' : 'player_ids',
    has_data: !!payload.data,
    has_url: !!payload.url,
    collapse_id: payload.collapse_id,
    thread_id: payload.thread_id,
    android_group: payload.android_group,
  };
}

