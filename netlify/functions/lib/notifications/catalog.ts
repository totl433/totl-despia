/**
 * Notification Catalog Loader
 * 
 * Loads and provides access to notification catalog metadata.
 * Used by the dispatcher to get configuration for each notification type.
 * 
 * NOTE: The catalog is embedded directly to avoid build-time dependencies.
 * Run `npx tsx scripts/build-notification-catalog.ts` after modifying
 * notification markdown files to regenerate the embedded catalog.
 */

// Embedded catalog data (generated from notification_catalog/site/src/content/docs/notifications/*.md)
const catalogData = {
  "chat-message": {
    "notification_key": "chat-message",
    "owner": "client-triggered",
    "status": "active",
    "channels": ["push"],
    "audience": "league_members_except_sender",
    "source": "client_post",
    "trigger": { "name": "league_message_sent", "event_id_format": "chat:{league_id}:{message_id}" },
    "dedupe": { "scope": "per_user_per_event", "ttl_seconds": 60 },
    "cooldown": { "per_user_seconds": 30 },
    "quiet_hours": { "start": "23:00", "end": "07:00" },
    "preferences": { "preference_key": "chat-messages", "default": true },
    "onesignal": { "collapse_id_format": "ml_updates:{league_id}", "thread_id_format": "league:{league_id}", "android_group_format": "totl_leagues" },
    "deep_links": { "url_format": "/league/{leagueCode}" },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "member-join": {
    "notification_key": "member-join",
    "owner": "client-triggered",
    "status": "active",
    "channels": ["push"],
    "audience": "league_members_except_joiner",
    "source": "client_post",
    "trigger": { "name": "league_member_joined", "event_id_format": "member_join:{league_id}:{user_id}" },
    "dedupe": { "scope": "per_user_per_event", "ttl_seconds": 300 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": "mini-league-updates", "default": true },
    "onesignal": { "collapse_id_format": "ml_updates:{league_id}", "thread_id_format": "league:{league_id}", "android_group_format": "totl_leagues" },
    "deep_links": { "url_format": "/league/{leagueCode}" },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "final-submission": {
    "notification_key": "final-submission",
    "owner": "client-triggered",
    "status": "active",
    "channels": ["push"],
    "audience": "all_league_members",
    "source": "client_post",
    "trigger": { "name": "all_members_submitted", "event_id_format": "final_sub:{league_id}:{gw}" },
    "dedupe": { "scope": "per_league_per_gw", "ttl_seconds": 86400 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": "mini-league-updates", "default": true },
    "onesignal": { "collapse_id_format": "ml_updates:{league_id}", "thread_id_format": "league:{league_id}", "android_group_format": "totl_leagues" },
    "deep_links": { "url_format": "/league/{leagueCode}" },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "final-whistle": {
    "notification_key": "final-whistle",
    "owner": "score-webhook",
    "status": "active",
    "channels": ["push"],
    "audience": "users_with_picks_for_fixture",
    "source": "supabase_webhook",
    "trigger": { "name": "live_scores_status_finished", "event_id_format": "ft:{api_match_id}" },
    "dedupe": { "scope": "per_user_per_event", "ttl_seconds": 3600 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": "final-whistle", "default": true },
    "onesignal": { "collapse_id_format": "ft:{api_match_id}", "thread_id_format": "match:{api_match_id}", "android_group_format": "totl_results" },
    "deep_links": { "url_format": null },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "gameweek-complete": {
    "notification_key": "gameweek-complete",
    "owner": "score-webhook",
    "status": "active",
    "channels": ["push"],
    "audience": "users_with_picks_in_gameweek",
    "source": "supabase_webhook",
    "trigger": { "name": "all_gw_fixtures_finished", "event_id_format": "gw_complete:{gw}" },
    "dedupe": { "scope": "per_user_per_event", "ttl_seconds": 7200 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": "gw-results", "default": true },
    "onesignal": { "collapse_id_format": "gw_complete:{gw}", "thread_id_format": "totl_gameweek", "android_group_format": "totl_results" },
    "deep_links": { "url_format": null },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "goal-disallowed": {
    "notification_key": "goal-disallowed",
    "owner": "score-webhook",
    "status": "active",
    "channels": ["push"],
    "audience": "users_with_picks_for_fixture",
    "source": "supabase_webhook",
    "trigger": { "name": "live_scores_update_score_decrease", "event_id_format": "goal_disallowed:{api_match_id}:{minute}" },
    "dedupe": { "scope": "per_user_per_event", "ttl_seconds": 120 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": "score-updates", "default": true },
    "onesignal": { "collapse_id_format": "goal_disallowed:{api_match_id}", "thread_id_format": "match:{api_match_id}", "android_group_format": "totl_scores" },
    "deep_links": { "url_format": null },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "goal-scored": {
    "notification_key": "goal-scored",
    "owner": "score-webhook",
    "status": "active",
    "channels": ["push"],
    "audience": "users_with_picks_for_fixture",
    "source": "supabase_webhook",
    "trigger": { "name": "live_scores_update", "event_id_format": "goal:{api_match_id}:{scorer_normalized}:{minute}" },
    "dedupe": { "scope": "per_user_per_event", "ttl_seconds": 120 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": "score-updates", "default": true },
    "onesignal": { "collapse_id_format": "goal:{api_match_id}", "thread_id_format": "match:{api_match_id}", "android_group_format": "totl_scores" },
    "deep_links": { "url_format": null },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "half-time": {
    "notification_key": "half-time",
    "owner": "score-webhook",
    "status": "active",
    "channels": ["push"],
    "audience": "users_with_picks_for_fixture",
    "source": "supabase_webhook",
    "trigger": { "name": "live_scores_status_change", "event_id_format": "halftime:{api_match_id}" },
    "dedupe": { "scope": "per_user_per_event", "ttl_seconds": 600 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": null, "default": true },
    "onesignal": { "collapse_id_format": "halftime:{api_match_id}", "thread_id_format": "match:{api_match_id}", "android_group_format": "totl_scores" },
    "deep_links": { "url_format": null },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "kickoff": {
    "notification_key": "kickoff",
    "owner": "score-webhook",
    "status": "active",
    "channels": ["push"],
    "audience": "users_with_picks_for_fixture",
    "source": "supabase_webhook",
    "trigger": { "name": "live_scores_status_change", "event_id_format": "kickoff:{api_match_id}:{half}" },
    "dedupe": { "scope": "per_user_per_event", "ttl_seconds": 300 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": "score-updates", "default": true },
    "onesignal": { "collapse_id_format": "kickoff:{api_match_id}:{half}", "thread_id_format": "match:{api_match_id}", "android_group_format": "totl_scores" },
    "deep_links": { "url_format": null },
    "rollout": { "enabled": true, "percentage": 100 }
  },
  "new-gameweek": {
    "notification_key": "new-gameweek",
    "owner": "admin-triggered",
    "status": "active",
    "channels": ["push"],
    "audience": "all_subscribed_users",
    "source": "admin_trigger",
    "trigger": { "name": "admin_broadcast", "event_id_format": "new_gw:{gw}" },
    "dedupe": { "scope": "global", "ttl_seconds": 86400 },
    "cooldown": { "per_user_seconds": 0 },
    "quiet_hours": { "start": null, "end": null },
    "preferences": { "preference_key": "new-gameweek", "default": true },
    "onesignal": { "collapse_id_format": "new_gw:{gw}", "thread_id_format": "totl_gameweek", "android_group_format": "totl_gameweek" },
    "deep_links": { "url_format": null },
    "rollout": { "enabled": true, "percentage": 100 }
  }
};

export interface NotificationTrigger {
  name: string;
  event_id_format: string;
}

export interface NotificationDedupe {
  scope: string;
  ttl_seconds: number;
}

export interface NotificationCooldown {
  per_user_seconds: number;
}

export interface NotificationQuietHours {
  start: string | null;
  end: string | null;
}

export interface NotificationPreferences {
  preference_key: string | null;
  default: boolean;
}

export interface NotificationOneSignal {
  collapse_id_format: string;
  thread_id_format: string;
  android_group_format: string;
}

export interface NotificationDeepLinks {
  url_format: string | null;
}

export interface NotificationRollout {
  enabled: boolean;
  percentage: number;
}

export interface NotificationCatalogEntry {
  notification_key: string;
  owner: string;
  status: 'active' | 'deprecated' | 'disabled';
  channels: string[];
  audience: string;
  source: string;
  trigger: NotificationTrigger;
  dedupe: NotificationDedupe;
  cooldown: NotificationCooldown;
  quiet_hours: NotificationQuietHours;
  preferences: NotificationPreferences;
  onesignal: NotificationOneSignal;
  deep_links: NotificationDeepLinks;
  rollout: NotificationRollout;
}

const catalog = catalogData as Record<string, NotificationCatalogEntry>;

/**
 * Get a catalog entry by notification key
 */
export function getCatalogEntry(notificationKey: string): NotificationCatalogEntry | null {
  return catalog[notificationKey] || null;
}

/**
 * Get all catalog entries
 */
export function getAllCatalogEntries(): Record<string, NotificationCatalogEntry> {
  return catalog;
}

/**
 * Get all notification keys in the catalog
 */
export function getAllCatalogKeys(): string[] {
  return Object.keys(catalog);
}

/**
 * Check if a notification type is enabled
 */
export function isNotificationEnabled(notificationKey: string): boolean {
  const entry = catalog[notificationKey];
  if (!entry) return false;
  return entry.status === 'active' && entry.rollout.enabled;
}

/**
 * Format an event ID using the catalog template
 * 
 * @param notificationKey - The notification type key
 * @param params - Parameters to substitute into the template
 * @returns Formatted event ID or null if notification type not found
 */
export function formatEventId(
  notificationKey: string,
  params: Record<string, string | number>
): string | null {
  const entry = catalog[notificationKey];
  if (!entry) return null;
  
  let eventId = entry.trigger.event_id_format;
  
  // Substitute parameters
  for (const [key, value] of Object.entries(params)) {
    eventId = eventId.replace(`{${key}}`, String(value));
  }
  
  return eventId;
}

/**
 * Format a collapse ID using the catalog template
 */
export function formatCollapseId(
  notificationKey: string,
  params: Record<string, string | number>
): string | null {
  const entry = catalog[notificationKey];
  if (!entry) return null;
  
  let collapseId = entry.onesignal.collapse_id_format;
  
  for (const [key, value] of Object.entries(params)) {
    collapseId = collapseId.replace(`{${key}}`, String(value));
  }
  
  return collapseId;
}

/**
 * Format a thread ID using the catalog template
 */
export function formatThreadId(
  notificationKey: string,
  params: Record<string, string | number>
): string | null {
  const entry = catalog[notificationKey];
  if (!entry) return null;
  
  let threadId = entry.onesignal.thread_id_format;
  
  for (const [key, value] of Object.entries(params)) {
    threadId = threadId.replace(`{${key}}`, String(value));
  }
  
  return threadId;
}

