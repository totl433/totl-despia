/**
 * Unified Notification System
 * 
 * All notification sends MUST go through this module.
 * Direct OneSignal API calls are prohibited elsewhere.
 * 
 * Usage:
 * ```typescript
 * import { dispatchNotification, formatEventId } from './lib/notifications';
 * 
 * const result = await dispatchNotification({
 *   notification_key: 'goal-scored',
 *   event_id: formatEventId('goal-scored', { api_match_id: 12345, scorer_normalized: 'haaland', minute: 52 }),
 *   user_ids: ['user-uuid-1', 'user-uuid-2'],
 *   title: 'Man City scores!',
 *   body: "52' Haaland\nMan City [2] - 1 Arsenal",
 *   data: { api_match_id: 12345, fixture_index: 3, gw: 16 },
 *   grouping_params: { api_match_id: 12345 },
 * });
 * ```
 */

// Main dispatcher
export { dispatchNotification, dispatchBroadcast } from './dispatch';

// Catalog access
export {
  getCatalogEntry,
  getAllCatalogEntries,
  getAllCatalogKeys,
  isNotificationEnabled,
  formatEventId,
  formatCollapseId,
  formatThreadId,
} from './catalog';

// Types
export type {
  NotificationIntent,
  DispatchResult,
  BatchDispatchResult,
  NotificationResult,
  SendLogEntry,
  OneSignalPayload,
  UserPreferences,
  PushSubscription,
  Environment,
  TargetType,
} from './types';

export type { NotificationCatalogEntry } from './catalog';

// Utilities (for advanced use cases)
export { getEnvironment } from './idempotency';
export { loadUserPreferences } from './policy';
export { resolveTargets, verifyAndFilterSubscriptions } from './targeting';

