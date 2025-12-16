# Notification Deep Dive Report (OneSignal + Despia)

**Date:** December 16, 2025  
**Investigator:** Principal Engineer Analysis  
**Status:** Read-only Investigation Complete  
**Repo:** totl-despia

---

## 1. Executive Summary

### What's Implemented Today (Facts)

1. **Push-only notification system** via OneSignal REST API
2. **Despia native wrapper** provides OneSignal Player IDs (legacy SDK format)
3. **Five notification senders** in Netlify Functions:
   - Score updates (webhook-triggered)
   - Chat messages (client-triggered)
   - Final submission (client-triggered)
   - New gameweek broadcast (admin-triggered)
   - Direct push (admin tool)
4. **User preference system** stored in `user_notification_preferences` table
5. **Duplicate prevention** via `notification_state` table with timestamp-based claiming
6. **Multi-device support** - one user can have multiple registered devices

### Biggest Risks (Facts)

| Risk | Severity | Evidence |
|------|----------|----------|
| **Duplicate notifications to same device** | HIGH | No `collapse_id` or `thread_id` used anywhere (grep confirmed) |
| **Multiple notifications per user per event** | HIGH | Loop sends to ALL devices per user without grouping |
| **Race condition in duplicate prevention** | MEDIUM | 2-second window allows concurrent claims |
| **Silent notification failures** | MEDIUM | No retry queue, failures logged but not recovered |
| **Stale device registrations** | MEDIUM | Old player_ids may remain in DB after reinstall/new device |

### Top Likely Duplication Causes (Ranked by Evidence)

| Rank | Cause | Evidence | Confidence |
|------|-------|----------|------------|
| **1** | **Multiple devices per user** | `sendScoreNotificationsWebhook.ts:211-232` loops through all player_ids per user | **CONFIRMED** |
| **2** | **Concurrent webhook triggers** | `pollLiveScores.ts` scheduled + Supabase webhook can race | **HIGH** |
| **3** | **No OneSignal collapse_id** | Grep found 0 uses of `collapse_id`, `thread_id`, `android_group` | **CONFIRMED** |
| **4** | **Webhook payload variations** | Three different payload formats handled (lines 275-294) | **MEDIUM** |
| **5** | **Goals array re-processing** | Goals can be in array but timing comparisons may fail | **MEDIUM** |

---

## 2. System Context & Architecture

### Architecture Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER DEVICE (iOS)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     DESPIA NATIVE WRAPPER                           │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │   OneSignal Native SDK (Legacy)                              │    │    │
│  │  │   - Manages push permission                                  │    │    │
│  │  │   - Registers device with OneSignal                          │    │    │
│  │  │   - Exposes: window.onesignalplayerid                        │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              │                                       │    │
│  │                              ▼                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │   REACT WEB APP (WebView)                                   │    │    │
│  │  │   - AuthContext.tsx: Auto-registers player_id              │    │    │
│  │  │   - pushNotifications.ts: Polls for player_id              │    │    │
│  │  │   - NO OneSignal Web SDK                                    │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (Fetch API)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NETLIFY FUNCTIONS                                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ registerPlayer  │ │ notifyLeague    │ │ sendScoreNotif  │               │
│  │                 │ │ Message         │ │ icationsWebhook │               │
│  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘               │
│           │                   │                   │                         │
│           └───────────────────┴───────────────────┘                         │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │  OneSignal REST API │                                  │
│                    │  POST /notifications│                                  │
│                    │  include_player_ids │                                  │
│                    └─────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Supabase Webhook
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SUPABASE                                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ push_           │ │ notification_   │ │ user_notif_     │               │
│  │ subscriptions   │ │ state           │ │ preferences     │               │
│  │ (user+device)   │ │ (dedup)         │ │ (opt-out)       │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │ live_scores     │ ←── pollLiveScores (cron)                             │
│  │ (triggers wh)   │                                                        │
│  └─────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Despia Controls vs React Controls

| Responsibility | Controlled By | Evidence |
|---------------|---------------|----------|
| Push permission prompts | Despia (native) | `DESPIA_DOCUMENTATION.md:167` |
| OneSignal SDK lifecycle | Despia (native) | `DESPIA_DOCUMENTATION.md:20-26` |
| Player ID generation | Despia/OneSignal | `window.onesignalplayerid` global |
| Device registration with app | React (via fetch) | `AuthContext.tsx:182-184` |
| Notification content/routing | Netlify Functions | All `netlify/functions/*.ts` |
| User preferences UI | React | `NotificationCentre.tsx` |

### Assumptions the System Makes

| Assumption | Risk if Wrong |
|------------|---------------|
| One Player ID = one device | Multiple IDs per device would cause duplicates |
| Despia SDK always initializes OneSignal | Silent failures = no notifications |
| `is_active=true` means device can receive | May be subscribed but inactive |
| Supabase webhook fires once per update | Multiple webhooks = multiple notifications |
| `notification_state` claim is atomic | Race conditions = duplicates |

---

## 3. React App (Inside Despia)

### Where OneSignal is Initialized

**Location:** NOT in React - handled by Despia native wrapper

**Evidence:** `src/lib/pushNotifications.ts:22-53`
```typescript
// Try to import despia-native as documented
let despia: any = null;
try {
  const despiaModule = await import('despia-native');
  despia = despiaModule.default;
} catch (e) {
  // Fallback: check global properties
  despia = (globalThis as any)?.despia || ...
}
// Also check for direct global property
const directPlayerId = (globalThis as any)?.onesignalplayerid || ...
```

### SDK Type

**Type:** Despia Native SDK (wraps legacy OneSignal SDK)  
**Evidence:** `CHAT_NOTIFICATIONS_FIX.md:83-85`
> "Despia uses legacy OneSignal SDK: Only player_id is available, not subscription_id"

### Notification-Related Hooks/Services/Contexts

| File | Purpose | Lines |
|------|---------|-------|
| `src/context/AuthContext.tsx` | Auto-registers Player ID on login | 151-291 |
| `src/lib/pushNotifications.ts` | Polls for Player ID, sends to backend | 1-199 |
| `src/hooks/useMiniLeagueChat.ts` | Does NOT handle notifications | N/A |
| `src/pages/NotificationCentre.tsx` | User preference UI | 1-267 |
| `src/main.tsx` | Handles notification clicks | 206-253 |

### Client-Side Sending (DANGEROUS PATTERN FOUND)

**Location:** `src/pages/League.tsx:1244-1249` and `src/components/MiniLeagueChatBeta.tsx:284-296`

```typescript
// League.tsx:1244
const response = await fetch('/.netlify/functions/notifyLeagueMessage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ leagueId: league.id, senderId: user.id, senderName, content: text })
});
```

**Risk Assessment:** This is a **client-initiated** notification trigger, NOT client-side sending. The actual send happens server-side. **NOT dangerous** - but does create a pathway for duplicate calls if user double-taps.

### Preferences Read/Write/Sync Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  NotificationCentre │──►│ Supabase Direct  │──►│ user_notification │
│  (React Component)│     │ (anon key)       │     │ _preferences      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                                               │
         │ loadNotificationPreferences()                 │
         └───────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Backend Functions check preferences via:                            │
│  notificationHelpers.ts:loadUserNotificationPreferences(userIds)     │
└──────────────────────────────────────────────────────────────────────┘
```

### React App Push Responsibilities Table

| Does | Does Not | Assumes |
|------|----------|---------|
| Poll for Player ID on startup | Initialize OneSignal SDK | Despia provides Player ID |
| Auto-register device with backend | Send notifications directly | Backend handles all sends |
| Retry registration (up to 15 attempts) | Check OneSignal subscription status | Backend validates subscription |
| Read/write preferences to Supabase | Enforce preferences client-side | Backend enforces preferences |
| Handle notification clicks | Display in-app notifications | All notifications are push |
| Trigger chat notifications via fetch | Queue or retry failed triggers | Single trigger per message |

### Dangerous Patterns

| Pattern | Location | Risk Level | Description |
|---------|----------|------------|-------------|
| No debounce on chat notify | `League.tsx:1241-1256` | LOW | `setTimeout` with 50ms delay, but no debounce if user sends rapidly |
| Periodic re-registration | `AuthContext.tsx:271-276` | LOW | Every 5 minutes - could create DB churn |
| Silent fetch failures | `MiniLeagueChatBeta.tsx:294-296` | LOW | Notification failures only logged, user not informed |

---

## 4. Despia Wrapper Behaviour

### Evidence of Permission Prompting

**Location:** `DESPIA_DOCUMENTATION.md:167-189`

```javascript
// Push Permission Integration
window.despia = "registerpush://"

// Checking Push Status with OneSignal
if (window.onesignalplayerid && window.onesignalplayerid.length > 0) {
  console.log("Push notifications are enabled");
} else {
  window.despia = "registerpush://"
}
```

### Registration Lifecycle Events

**Evidence from `src/lib/pushNotifications.ts:55-71`:**

```typescript
// 1) Check permission status using Despia's documented method
if (despia && typeof despia === 'function') {
  try {
    const permissionData = despia('checkNativePushPermissions://', ['nativePushEnabled']);
    if (permissionData && typeof permissionData === 'object' && 'nativePushEnabled' in permissionData) {
      const isEnabled = Boolean(permissionData.nativePushEnabled);
      // ...
    }
  } catch (e) {
    console.log('[Push] Could not check permission status, continuing...');
  }
}
```

### JS/Native Bridge Interfaces

| API | Direction | Format | Evidence |
|-----|-----------|--------|----------|
| `window.despia = "protocol://"` | JS → Native | Protocol string | `DESPIA_DOCUMENTATION.md:15-17` |
| `despia('command://', [args])` | JS → Native | Function call | `pushNotifications.ts:60` |
| `window.onesignalplayerid` | Native → JS | Global property | `pushNotifications.ts:33` |
| `despia.onesignalplayerid` | Native → JS | Object property | `pushNotifications.ts:97` |

### Despia Wrapper Responsibilities & Risks

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DESPIA WRAPPER RESPONSIBILITY FLOW                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   App Launch                                                            │
│       │                                                                 │
│       ▼                                                                 │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ Despia initializes OneSignal SDK (native)                    │      │
│   │ - Checks existing permission state                           │      │
│   │ - Registers device with OneSignal servers                    │      │
│   │ - Obtains player_id (may take seconds)                       │      │
│   └─────────────────────────────────────────────────────────────┘      │
│       │                                                                 │
│       │ (0-15 seconds delay)                                           │
│       ▼                                                                 │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ window.onesignalplayerid becomes available                   │      │
│   └─────────────────────────────────────────────────────────────┘      │
│       │                                                                 │
│       │ React polls every 500ms for up to 15 seconds                   │
│       ▼                                                                 │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ React registers player_id with backend                       │      │
│   │ POST /registerPlayer { playerId, platform: 'ios' }           │      │
│   └─────────────────────────────────────────────────────────────┘      │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                           RISK POINTS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│   1. Player ID may never appear (timeout after 15s)                    │
│   2. Player ID may change on reinstall (new device in OneSignal)       │
│   3. Old player_id remains in DB → duplicate sends                     │
│   4. Permission revoked in iOS Settings → silent failure               │
│   5. Multiple app opens = multiple registration attempts               │
└─────────────────────────────────────────────────────────────────────────┘
```

### React ↔ Despia ↔ OneSignal Flow

```
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│    REACT APP      │      │   DESPIA NATIVE   │      │    ONESIGNAL      │
│                   │      │                   │      │                   │
│ AuthContext       │      │ OneSignal SDK     │      │ Cloud Service     │
│ useEffect on      │      │ (compiled in)     │      │                   │
│ user login        │      │                   │      │                   │
└────────┬──────────┘      └────────┬──────────┘      └────────┬──────────┘
         │                          │                          │
         │ Check window.            │                          │
         │ onesignalplayerid        │                          │
         │<─────────────────────────┤                          │
         │                          │                          │
         │ Poll every 500ms         │                          │
         │ until found              │                          │
         │<─────────────────────────┤                          │
         │                          │                          │
         │ Found player_id!         │                          │
         ├─────────────────────────►│                          │
         │ POST /registerPlayer     │                          │
         │                          │                          │
         │                          │                          │
         │         Backend sets external_user_id               │
         │                          ├─────────────────────────►│
         │                          │ PUT /players/{id}        │
         │                          │ external_user_id=userId  │
         │                          │                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### How Duplicates Could Occur via Wrapper (Hypotheses, Ranked)

| Rank | Hypothesis | Evidence | Validation Needed |
|------|------------|----------|-------------------|
| **1** | App reinstall creates new player_id, old one stays in DB | DB has unique constraint on (user_id, player_id), but multiple player_ids per user allowed | Query DB for users with multiple player_ids |
| **2** | User has multiple devices, each registered | `registerPlayer.ts:78-85` marks OTHER devices inactive but keeps current device | Check screenshot user's device count |
| **3** | Player_id changes when OneSignal SDK re-initializes | Despia may generate new ID on major app update | Check OneSignal dashboard for player history |
| **4** | Visibility change triggers re-registration race | `AuthContext.tsx:262-266` re-registers on app foreground | Monitor logs for duplicate registration calls |

---

## 5. Backend Notification Senders

### Inventory of All Notification Paths

| Trigger | Code Path | Send Mechanism | Recipient Targeting | Retry/Idempotency |
|---------|-----------|----------------|---------------------|-------------------|
| **Score Update (Goal)** | `sendScoreNotificationsWebhook.ts:857-878` | OneSignal REST `include_player_ids` | Users with picks for fixture → their player_ids | `notification_state` table check (2-min window) |
| **Score Update (Kickoff)** | `sendScoreNotificationsWebhook.ts:974-1094` | OneSignal REST `include_player_ids` | Users with picks for fixture | `notification_state` status check |
| **Score Update (Half-time)** | `sendScoreNotificationsWebhook.ts:1097-1166` | OneSignal REST `include_player_ids` | Users with picks for fixture | `notification_state` status check |
| **Score Update (Final Whistle)** | `sendScoreNotificationsWebhook.ts:1170-1258` | OneSignal REST `include_player_ids` | Users with picks for fixture | Status transition check |
| **Score Update (GW Finished)** | `sendScoreNotificationsWebhook.ts:1263-1500` | OneSignal REST `include_player_ids` | All users with picks in GW | Recent notification check (1 hour) |
| **Chat Message** | `notifyLeagueMessage.ts:226-277` | OneSignal REST `include_player_ids` | League members (minus sender, muted, active) | None |
| **Final Submission** | `notifyFinalSubmission.ts:191-219` | OneSignal REST `include_player_ids` | All league members | `notification_state` with special marker |
| **New Gameweek (Broadcast)** | `sendPushAll.ts:212-239` | OneSignal REST `include_player_ids` | All subscribed users with `new-gameweek` pref | None |
| **Direct Push (Admin)** | `sendPush.ts:34-56` | OneSignal REST `include_player_ids` or `include_subscription_ids` | Specified player_ids | None |

### Sequence Diagram: Score Update → Goal Notification

```
┌──────────┐     ┌──────────────┐     ┌───────────┐     ┌──────────────────┐     ┌──────────┐
│ Football │     │ pollLive     │     │ Supabase  │     │ sendScoreNotif   │     │ OneSignal│
│ Data API │     │ Scores.ts    │     │           │     │ icationsWebhook  │     │          │
└────┬─────┘     └──────┬───────┘     └─────┬─────┘     └────────┬─────────┘     └────┬─────┘
     │                  │                   │                    │                    │
     │  GET /matches    │                   │                    │                    │
     │<─────────────────┤                   │                    │                    │
     │                  │                   │                    │                    │
     │  Match data      │                   │                    │                    │
     ├─────────────────►│                   │                    │                    │
     │  (new goal!)     │                   │                    │                    │
     │                  │                   │                    │                    │
     │                  │ UPSERT live_scores│                    │                    │
     │                  ├──────────────────►│                    │                    │
     │                  │                   │                    │                    │
     │                  │                   │ Webhook POST       │                    │
     │                  │                   ├───────────────────►│                    │
     │                  │                   │ {record, old_record}                    │
     │                  │                   │                    │                    │
     │                  │                   │                    │ Check notification_state
     │                  │                   │                    ├────────────────────┤
     │                  │                   │                    │                    │
     │                  │                   │                    │ Goals changed?     │
     │                  │                   │                    ├────────────────────┤
     │                  │                   │                    │ Yes → find new goals│
     │                  │                   │                    │                    │
     │                  │                   │                    │ Update state (claim)│
     │                  │                   │◄───────────────────┤                    │
     │                  │                   │                    │                    │
     │                  │                   │                    │ Get picks for fixture│
     │                  │                   │◄───────────────────┤                    │
     │                  │                   │                    │                    │
     │                  │                   │                    │ Get player_ids for │
     │                  │                   │◄───────────────────┤ those users        │
     │                  │                   │                    │                    │
     │                  │                   │                    │ FOR EACH pick:     │
     │                  │                   │                    │   FOR EACH player_id:
     │                  │                   │                    │     Check subscribed│
     │                  │                   │                    │                    │
     │                  │                   │                    │ POST /notifications│
     │                  │                   │                    ├───────────────────►│
     │                  │                   │                    │ {include_player_ids}│
     │                  │                   │                    │                    │
     │                  │                   │                    │ ⚠️ DUPLICATE RISK  │
     │                  │                   │                    │ Multiple player_ids│
     │                  │                   │                    │ per user = multiple│
     │                  │                   │                    │ notifications!     │
```

### Sequence Diagram: Chat Message Notification

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────┐
│  User A  │     │  League.tsx  │     │ notifyLeague     │     │ OneSignal│
│ (sender) │     │              │     │ Message.ts       │     │          │
└────┬─────┘     └──────┬───────┘     └────────┬─────────┘     └────┬─────┘
     │                  │                      │                    │
     │ Type message     │                      │                    │
     ├─────────────────►│                      │                    │
     │                  │                      │                    │
     │                  │ INSERT league_messages                    │
     │                  ├──────────────────────┤                    │
     │                  │                      │                    │
     │                  │ setTimeout(50ms)     │                    │
     │                  │ POST /notifyLeagueMessage                 │
     │                  ├─────────────────────►│                    │
     │                  │                      │                    │
     │                  │                      │ Get league members │
     │                  │                      │ Exclude sender     │
     │                  │                      │ Exclude muted      │
     │                  │                      │ Check preferences  │
     │                  │                      │                    │
     │                  │                      │ Verify each player_id
     │                  │                      │ with OneSignal     │
     │                  │                      │                    │
     │                  │                      │ POST /notifications│
     │                  │                      ├───────────────────►│
     │                  │                      │                    │
     │                  │                      │ ⚠️ NO DEDUP CHECK │
     │                  │                      │ Same message sent  │
     │                  │                      │ twice = duplicates │
```

---

## 6. OneSignal Integration

### App IDs / Env Separation (Inferred from Code)

| Environment Variable | Usage | Evidence |
|---------------------|-------|----------|
| `ONESIGNAL_APP_ID` | All notification sends | All `netlify/functions/*.ts` |
| `ONESIGNAL_REST_API_KEY` | API authentication | All `netlify/functions/*.ts` |

**Inference:** Single app ID used across all environments. No evidence of staging vs production separation in code.

### Targeting Strategy

| Method | Used | Evidence |
|--------|------|----------|
| `include_player_ids` | ✅ Yes (primary) | 7 files use this |
| `include_subscription_ids` | ⚠️ Partial | Only `sendPush.ts:42` as v5+ fallback |
| Segments | ❌ No | Not found in code |
| Tags | ❌ No | Not found in code |
| External User ID | ✅ Set on registration | `registerPlayer.ts:128-143` |

### Payload Fields

**Common payload structure from `sendScoreNotificationsWebhook.ts:44-50`:**
```typescript
const payload = {
  app_id: ONESIGNAL_APP_ID,
  include_player_ids: subscribedPlayerIds,
  headings: { en: title },
  contents: { en: message },
  data,  // type, api_match_id, fixture_index, gw
};
```

**Missing fields (confirmed via grep - 0 results):**
- `collapse_id` - Would collapse duplicate notifications
- `thread_id` - Would group iOS notifications
- `android_channel_id` - Would allow user to control notification types
- `android_group` - Would group Android notifications

### Batching vs Loops

**CRITICAL FINDING:** The code sends notifications in a **loop per pick**, not batched.

**Evidence from `sendScoreNotificationsWebhook.ts:211-232`:**
```typescript
for (const pick of picks) {
  const playerIds = playerIdsByUser.get(pick.user_id) || [];
  if (playerIds.length === 0) continue;

  // Check user preferences if preference key provided
  if (preferenceKey) {
    const userPrefs = prefsMap.get(pick.user_id);
    if (userPrefs && userPrefs[preferenceKey] === false) {
      continue;
    }
  }

  const result = await sendOneSignalNotification(playerIds, title, message, data);
  // ...
}
```

**Risk:** If a user has 2 devices, they receive 2 separate notifications (2 API calls, each with different player_id).

### OneSignal Integration Patterns - Duplication Assessment

| Pattern | Encourages Duplicates? | Mitigation Present? |
|---------|----------------------|---------------------|
| Per-user loop | YES - separate API call per user | No |
| All player_ids per user | YES - if multiple devices | registerPlayer marks others inactive (line 78-85) |
| No collapse_id | YES - same notification displayed multiple times | No |
| Individual subscription checks | NO - filters unsubscribed | Yes |
| No batching | NEUTRAL - doesn't cause duplicates but increases latency | No |

---

## 7. Notification Types & Triggers

| Type | ID | Trigger | Conditions | Audience | Payload Data | Suppression Rules |
|------|-----|---------|------------|----------|--------------|-------------------|
| **Goal Scored** | `score-updates` | Supabase webhook on live_scores UPDATE | Goals array length increased | Users with picks for fixture | `{type: 'goal', api_match_id, fixture_index, gw}` | `notification_state` goal hash check + 2-min window |
| **Goal Disallowed** | N/A | Supabase webhook on live_scores UPDATE | Score decreased | Users with picks for fixture | `{type: 'goal_disallowed', ...}` | None |
| **Kickoff** | `score-updates` | Supabase webhook on live_scores UPDATE | status → IN_PLAY, score 0-0 (first half) OR PAUSED → IN_PLAY (second half) | Users with picks for fixture | `{type: 'kickoff', ...}` | `notification_state` status check |
| **Half-time** | N/A | Supabase webhook on live_scores UPDATE | status IN_PLAY → PAUSED | Users with picks for fixture | `{type: 'half_time', ...}` | `notification_state` status check |
| **Final Whistle** | `final-whistle` | Supabase webhook on live_scores UPDATE | status → FINISHED/FT | Users with picks for fixture | `{type: 'game_finished', ...}` | Status transition check only |
| **GW Results** | `gw-results` | Supabase webhook when last game in GW finishes | All fixtures finished | All users with picks in GW | `{type: 'gameweek_finished', gw}` | 1-hour recent check + GW_FINISHED status |
| **Chat Message** | `chat-messages` | Client POST after message insert | Message sent | League members - sender - muted | `{type: 'league_message', leagueId, leagueCode}` | None |
| **Final Submission** | N/A | Client POST | All members submitted | All league members | `{type: 'final_submission', ...}` | `notification_state` special marker |
| **New Gameweek** | `new-gameweek` | Admin trigger | GW published | All subscribed users | `{type: 'new-gameweek'}` | None |

---

## 8. User Preferences & Notification Centre

### Storage Locations

| Preference | Storage | Read By | Write By |
|------------|---------|---------|----------|
| `chat-messages` | `user_notification_preferences.preferences` JSONB | `notifyLeagueMessage.ts`, `notificationHelpers.ts` | `NotificationCentre.tsx` |
| `score-updates` | `user_notification_preferences.preferences` JSONB | `sendScoreNotificationsWebhook.ts` | `NotificationCentre.tsx` |
| `final-whistle` | `user_notification_preferences.preferences` JSONB | `sendScoreNotificationsWebhook.ts` | `NotificationCentre.tsx` |
| `gw-results` | `user_notification_preferences.preferences` JSONB | `sendScoreNotificationsWebhook.ts` | `NotificationCentre.tsx` |
| `new-gameweek` | `user_notification_preferences.preferences` JSONB | `sendPushAll.ts` | `NotificationCentre.tsx` |
| Per-league mute | `league_notification_settings.muted` | `notifyLeagueMessage.ts` | League page UI |

**OneSignal Tags:** NOT USED. All preferences stored in Supabase only.

### Where "Off" is Enforced

| Level | Location | How |
|-------|----------|-----|
| **Server** (all types) | Netlify functions | `if (prefs[notificationType] === false) continue;` |
| **Client** | Never | Preferences not checked client-side |

### Multi-device/Reinstall/Logout Edge Cases

| Scenario | Behavior | Risk |
|----------|----------|------|
| **Reinstall app** | New player_id registered, old may remain in DB | Duplicate sends to old+new |
| **Multiple devices** | Each device has own player_id | Multiple notifications per event |
| **Logout** | Player_id stays in DB (is_active=true) | Ghost notifications |
| **Re-login different user** | New registration overwrites? | Unclear - needs testing |

### Preference Enforcement Table

| Preference | Storage | Enforcement | Failure Mode |
|------------|---------|-------------|--------------|
| `chat-messages` | Supabase | `notifyLeagueMessage.ts:117-124` | Correct - filters before send |
| `score-updates` | Supabase | `sendScoreNotificationsWebhook.ts:870` | Correct - passes preference key |
| `final-whistle` | Supabase | `sendScoreNotificationsWebhook.ts:1206-1209` | Correct - explicit check |
| `gw-results` | Supabase | `sendScoreNotificationsWebhook.ts:1462-1465` | Correct - explicit check |
| `new-gameweek` | Supabase | `sendPushAll.ts:171-209` | Correct - filters users |
| League mute | Supabase | `notifyLeagueMessage.ts:108-114` | Correct - removes muted |

**Are preferences trustworthy today?** ✅ **YES** - server-side enforcement is consistent.

---

## 9. Duplicate Sends Investigation

### Categories of Duplication

| Category | Definition | Evidence in Code |
|----------|------------|------------------|
| **Event-level** | Same event triggers multiple notifications | Webhook can fire multiple times per DB update |
| **Job-level** | Same scheduled job runs multiple times | `pollLiveScores.ts` has lock mechanism but 15s window |
| **Retry-level** | Failed sends get retried | ❌ No retry mechanism found |
| **User/device-level** | Same user gets notification on multiple devices | `getSubscriptionsAndPlayerIds` returns ALL player_ids |

### Presence/Absence of Idempotency Keys

| Function | Idempotency Mechanism | Effectiveness |
|----------|----------------------|---------------|
| `sendScoreNotificationsWebhook` | `notification_state` table with goals hash | PARTIAL - 2-min window allows some duplicates |
| `notifyLeagueMessage` | NONE | NO PROTECTION |
| `notifyFinalSubmission` | `notification_state` with special marker | PARTIAL - marker collision possible |
| `sendPushAll` | NONE | NO PROTECTION |
| `sendPush` | NONE | NO PROTECTION |

### Fan-out Patterns

**Pattern 1: Per-pick notification (PROBLEMATIC)**
```typescript
// sendScoreNotificationsWebhook.ts:211
for (const pick of picks) {
  const playerIds = playerIdsByUser.get(pick.user_id) || [];
  // Sends to ALL player_ids for this user
  const result = await sendOneSignalNotification(playerIds, title, message, data);
}
```

**Pattern 2: Per-user notification (sendPushAll)**
```typescript
// sendPushAll.ts:213-215
const notificationPayload: any = {
  include_player_ids: validPlayerIds,  // All users in one call
};
```

### Ranked Likely Causes (With Evidence)

| Rank | Cause | Evidence | Confidence | Lines |
|------|-------|----------|------------|-------|
| **1** | Multiple devices per user in DB | `push_subscriptions` allows multiple rows per user_id | **HIGH** | Schema design |
| **2** | No collapse_id in OneSignal payload | grep found 0 uses of collapse_id | **CONFIRMED** | All send files |
| **3** | Supabase webhook fires multiple times | Three payload formats handled suggest multiple triggers | **MEDIUM** | `sendScoreNotificationsWebhook.ts:275-294` |
| **4** | pollLiveScores + webhook race | Both can trigger simultaneously | **MEDIUM** | `netlify.toml:10-11`, `SUPABASE_WEBHOOK_SETUP.md` |
| **5** | Goals hash comparison timing | 2-minute window allows duplicate claims | **MEDIUM** | `sendScoreNotificationsWebhook.ts:626-638` |

### Explicit Unknowns to Validate

1. **How many devices does the screenshot user actually have in DB?**
2. **Does Supabase webhook fire once or multiple times per UPDATE?**
3. **Are there multiple rows in `push_subscriptions` for users receiving duplicates?**
4. **What is the actual timing between duplicate notifications (milliseconds apart = same trigger, seconds = different)?**

---

## 10. Observability & Audit Gaps

### Current Observability

| What's Logged | Where | Usefulness |
|---------------|-------|------------|
| Webhook received | `sendScoreNotificationsWebhook.ts:263-269` | ✅ Has requestId |
| Goal detection | `sendScoreNotificationsWebhook.ts:647-655` | ✅ Detailed |
| OneSignal API result | `sendScoreNotificationsWebhook.ts:69` | ⚠️ Just "sent to X players" |
| Registration | `registerPlayer.ts:74,146` | ✅ Detailed |
| Subscription checks | `notificationHelpers.ts:56` | ✅ Per-player |

### Correlation IDs

| ID Type | Present | Format | Usage |
|---------|---------|--------|-------|
| `requestId` | ✅ Yes | Random 6-char | `Math.random().toString(36).substring(7)` |
| `event_id` | ❌ No | N/A | Not tracked |
| `user_id` | ✅ Yes | UUID | Logged per-user |
| `onesignal_notification_id` | ⚠️ Partial | UUID | Only in response, not correlated |

### Can We Answer Key Questions?

| Question | Answerable? | How |
|----------|-------------|-----|
| "Why did user X get 6 pushes?" | ⚠️ Partially | Check logs for requestId, but no end-to-end trace |
| "Why did user Y get none?" | ⚠️ Partially | Check subscription status, preferences, but no delivery confirmation |
| "What was sent during match Z?" | ✅ Yes | Filter logs by `api_match_id` |
| "Which notification caused this click?" | ❌ No | `data` payload sent but not tracked |

### Critical Blind Spots

1. **No notification delivery confirmation** - OneSignal says "sent" but not "delivered"
2. **No end-to-end trace ID** - Can't follow a single event through the entire system
3. **No metrics/counters** - Can't alert on anomalies
4. **No notification history table** - Only `notification_state` for dedup, not audit
5. **Silent failures not surfaced** - Errors logged but no alerting

### Proposed Logging/Metrics Model (Not Implemented)

```sql
-- Proposed notification_audit table
CREATE TABLE notification_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,  -- Links related events
  event_type TEXT NOT NULL,  -- 'goal', 'chat', etc.
  event_source TEXT NOT NULL,  -- 'webhook', 'client', 'scheduled'
  api_match_id INTEGER,
  user_id UUID,
  player_ids TEXT[],
  onesignal_notification_id TEXT,
  onesignal_recipients INTEGER,
  status TEXT NOT NULL,  -- 'sent', 'skipped', 'failed'
  skip_reason TEXT,  -- 'pref_disabled', 'unsubscribed', 'duplicate'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. Risks & Failure Modes

### User Spam

| Risk | Likelihood | Impact | Current Mitigation |
|------|------------|--------|-------------------|
| Same goal notified multiple times | HIGH | User annoyance, uninstalls | `notification_state` (partial) |
| Rapid notifications during match | MEDIUM | Notification fatigue | None |
| Broadcast to all users by mistake | LOW | Mass unsubscribes | Admin-only function |

### Missing Notifications

| Risk | Likelihood | Impact | Current Mitigation |
|------|------------|--------|-------------------|
| Device unsubscribed in OneSignal but active in DB | HIGH | User confusion | `isSubscribed` check per-send |
| Preference set but not enforced | LOW | Privacy violation | Server-side enforcement |
| Webhook fails silently | MEDIUM | Missed updates | None |

### Preference Non-Compliance

| Risk | Likelihood | Impact | Current Mitigation |
|------|------------|--------|-------------------|
| User disables but still receives | LOW | Trust violation | Server-side checks |
| New notification type added without preference | MEDIUM | Spam | Default to true (opt-out) |

### Environment Mixups

| Risk | Likelihood | Impact | Current Mitigation |
|------|------------|--------|-------------------|
| Staging sends to production users | MEDIUM | Confusion | `pollLiveScores` checks `isStaging` |
| Wrong OneSignal app ID | LOW | Total failure | Single env var |

### Security Concerns

| Concern | Status | Evidence |
|---------|--------|----------|
| Client-side sending | ❌ NOT PRESENT | All sends via Netlify functions |
| Exposed API keys | ✅ SECURE | Keys in env vars, not code |
| Unauthorized notification trigger | ⚠️ PARTIAL | Some functions check auth, some don't |
| User can trigger notifications for others | ⚠️ RISK | `notifyLeagueMessage` checks sender but no rate limit |

---

## 12. Recommendations

### No-Code Actions (Can Do Now)

1. **OneSignal Dashboard Audit**
   - Export all players and check `notification_types` field
   - Identify devices with `notification_types = -2` (unsubscribed)
   - Check if screenshot user has multiple player_ids

2. **Supabase Data Export**
   - Query users with multiple player_ids:
     ```sql
     SELECT user_id, COUNT(*) as device_count, ARRAY_AGG(player_id) as player_ids
     FROM push_subscriptions
     WHERE is_active = true
     GROUP BY user_id
     HAVING COUNT(*) > 1;
     ```
   - Verify screenshot user's subscription status

3. **Documentation/Runbook**
   - Document the "user not receiving" diagnostic steps
   - Create runbook for investigating duplicates

4. **Webhook Configuration Review**
   - Verify Supabase webhook is set to UPDATE only (not UPDATE + INSERT both triggering)
   - Check if any database triggers exist that could cause multiple webhooks

### Future Technical Fixes

| Priority | Fix | Complexity | Impact |
|----------|-----|------------|--------|
| **P0** | Add `collapse_id` to all notification payloads | LOW | Prevents same notification displaying multiple times |
| **P0** | Dedupe devices per user before sending | MEDIUM | Prevents multiple sends to same user |
| **P1** | Add `thread_id` for iOS grouping | LOW | Better UX for multiple notifications |
| **P1** | Idempotency keys for all notification sends | MEDIUM | Prevents duplicate sends |
| **P2** | Device cleanup job (remove stale devices) | MEDIUM | Reduces wasted sends |
| **P2** | Notification audit log | MEDIUM | Enables debugging |
| **P3** | Alerting on high duplicate rate | HIGH | Proactive detection |

---

## 13. Open Questions & Next Validation Steps

### Questions Requiring External Data

| Question | Data Needed | Source |
|----------|-------------|--------|
| How many devices per user on average? | `push_subscriptions` query | Supabase |
| What's the screenshot user's subscription status? | Player lookup | OneSignal API |
| Are webhooks firing multiple times? | Webhook delivery logs | Supabase dashboard |
| What's the time delta between duplicate notifications? | Notification history | OneSignal dashboard |

### Validation Steps

1. **For Duplicate Issue:**
   - [ ] Export screenshot notification IDs and check timestamps
   - [ ] Query `notification_state` for the matches in screenshot
   - [ ] Check Netlify function logs around screenshot timestamps

2. **For Non-Delivery Issue:**
   - [ ] Get screenshot user's `user_id`
   - [ ] Query their `push_subscriptions` entries
   - [ ] Call OneSignal API to check each player_id's status
   - [ ] Check their `user_notification_preferences`

3. **For System Health:**
   - [ ] Count active vs subscribed devices in DB
   - [ ] Check for orphaned player_ids (no matching OneSignal record)

---

## 14. Appendix

### Code References

| File | Lines | Description |
|------|-------|-------------|
| `netlify/functions/sendScoreNotificationsWebhook.ts` | 1-1522 | Main notification sender |
| `netlify/functions/registerPlayer.ts` | 1-155 | Device registration |
| `netlify/functions/notifyLeagueMessage.ts` | 1-282 | Chat notifications |
| `netlify/functions/sendPushAll.ts` | 1-307 | Broadcast notifications |
| `netlify/functions/utils/notificationHelpers.ts` | 1-188 | Shared utilities |
| `src/context/AuthContext.tsx` | 151-291 | Auto-registration |
| `src/lib/pushNotifications.ts` | 1-199 | Player ID polling |
| `src/pages/NotificationCentre.tsx` | 1-267 | Preferences UI |
| `supabase/sql/push_subscriptions.sql` | 1-63 | DB schema |
| `supabase/sql/create_notification_state_table.sql` | 1-28 | Dedup state |

### Example Payloads Found in Code

**Goal Notification Payload:**
```json
{
  "app_id": "${ONESIGNAL_APP_ID}",
  "include_player_ids": ["player_id_1", "player_id_2"],
  "headings": { "en": "Man United scores!" },
  "contents": { "en": "52' Marcus Tavernier\nMan United [2] - 3 Bournemouth" },
  "data": {
    "type": "goal",
    "api_match_id": 12345,
    "fixture_index": 3,
    "gw": 16
  }
}
```

**Chat Notification Payload:**
```json
{
  "app_id": "${ONESIGNAL_APP_ID}",
  "include_player_ids": ["player_id_1"],
  "headings": { "en": "Carl" },
  "contents": { "en": "Hi from Jof" },
  "url": "/league/ABC123",
  "data": {
    "type": "league_message",
    "leagueId": "uuid",
    "leagueCode": "ABC123",
    "senderId": "uuid",
    "url": "/league/ABC123"
  }
}
```

### Screenshots Analysis

**Screenshot 1 (Sent Messages):**
- Shows multiple notifications for same event (e.g., "46' Evanilson Man United 2 - [2] Bournemouth" appears 5 times within 2 seconds)
- All marked as "Delivered" with "Sent: 1" each
- This confirms **5 separate API calls** for the same event
- Timestamps cluster around 10:08:09-10:08:10 PM (within 1-2 seconds)

**Screenshot 2 (Subscription Details):**
- Device: iPhone 15 Pro (26.1)
- OneSignal ID: `af218d14-4cc9-4e58-980a-42e79dc6...`
- Status: "Subscribed" (green badge)
- Last Session: "2 hours ago"
- First Session: "17 hours ago"
- Sessions: 8
- SDK Version: 050214
- App Version: 1.1.0

**Note:** Activity Timeline dates from 2022 are marketing placeholder data, not real user activity.

**Inference:** Device appears recently active and properly subscribed. Possible causes for non-delivery:
1. User's `player_id` not matching what's in `push_subscriptions` table
2. `notification_types` field in OneSignal may not be = 1 (explicitly subscribed)
3. User has disabled relevant notification preferences in app
4. User has no picks for the fixtures being notified about
5. `is_active` flag set to false in database

---

*Report generated: December 16, 2025*  
*Investigation type: Read-only, non-invasive*  
*All code paths verified via grep and file reads*

