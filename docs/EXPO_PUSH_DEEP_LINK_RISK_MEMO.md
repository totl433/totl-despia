# Expo Push Deep-Link Risk Memo

**Status:** Pre-weekend audit complete  
**Recommendation:** Do not change server-side push payload generation before the gameweek

## Summary

Expo/native and Despia/web are still sharing the live OneSignal send path for current push notifications.

The shared boundary is the notification dispatcher in `netlify/functions/lib/notifications/dispatch.ts`, which:

- loads all active devices for a user
- verifies all eligible `player_id`s
- builds one payload
- sends that same payload to all valid devices for that user

There is no evidence of an Expo-only server send path today.

## Key Findings

### 1. Shared payload builder is live

`netlify/functions/lib/notifications/onesignal.ts` still uses the top-level `url` field when a sender passes one:

```ts
if (url) {
  payload.url = url;
}
```

This means any sender using the shared dispatcher is still relying on common URL behavior across devices.

### 2. Chat notifications are shared

`netlify/functions/notifyLeagueMessageV2.ts` constructs a full web URL and passes it into both:

- `data.url`
- top-level `url`

That payload then flows through the shared dispatcher and is sent to all valid devices for each user.

### 3. Registration explicitly supports multi-device delivery

`netlify/functions/registerPlayer.ts` documents that users can have both Despia and Expo installed and both should receive notifications.

This is strong evidence that the current send path is intentionally shared rather than app-specific.

### 4. The system is mixed, not fully unified

At least one legacy sender, `netlify/functions/sendPredictionReminder.ts`, still uses direct OneSignal calls with `web_url` instead of the shared V2 `url` behavior.

That means the live system is not only shared, but also inconsistent across notification types.

## Verified Send Path Map

| Notification type | Sender | Payload deep-link fields | Targeting path | Shared between Expo and Despia |
| --- | --- | --- | --- | --- |
| `chat-message` | `netlify/functions/notifyLeagueMessageV2.ts` | `url`, `data.url`, `data.navigateTo` | `dispatchNotification()` -> all valid `player_id`s | Yes |
| `gameweek-complete` | `netlify/functions/lib/notifications/scoreHelpers.ts` | `url` | `dispatchNotification()` -> all valid `player_id`s | Yes |
| `new-gameweek` | `netlify/functions/sendPushAllV2.ts` | no URL in current sender path | `dispatchNotification()` -> all subscribed users | Yes |
| `prediction-reminder` | `netlify/functions/sendPredictionReminder.ts` | `web_url`, `data.url` | direct OneSignal send -> eligible `player_id`s | Yes |
| legacy score notifications | `netlify/functions/sendScoreNotificationsWebhook.ts` | no URL in shown payload block | direct OneSignal send -> subscribed `player_id`s | Yes |

## Expo-Only Isolation Check

I looked for:

- device/app tags
- subscription segmentation
- alias or external user distinctions used to split payloads
- separate OneSignal apps
- per-platform payload branching at send time

Result: none found in the live send path reviewed for this audit.

## Native-Only Handling Boundary

Expo already has a safe native-side translation layer:

- custom scheme: `com.despia.totlnative`
- notification click handler rewrites incoming relative/web URLs into the app scheme

That means Expo can consume web-style notification URLs on the client side without requiring an immediate server payload change.

### URL shapes safely handled natively

Confirmed in `apps/mobile/src/lib/push.ts`, `apps/mobile/src/navigation/AppNavigator.tsx`, and `apps/mobile/app.config.ts`:

- `/join/{code}`
- `/leagues`
- `/predictions`
- `/league/{CODE}`
- `/league/{CODE}?tab=chat`
- `/?leagueCode={CODE}&tab=gw`
- `/league/{CODE}?tab=predictions`
- `/league/{CODE}?tab=season`

## Payload Examples

### Current shared chat notification

Example shape:

- `url`: `https://playtotl.com/league/XYZ99?tab=chat&leagueCode=XYZ99`
- `data.url`: `https://playtotl.com/league/XYZ99?tab=chat&leagueCode=XYZ99`
- `data.navigateTo`: `https://playtotl.com/league/XYZ99?tab=chat&leagueCode=XYZ99`

### Current gameweek/score-style notification with URL

Example shape:

- `url`: absolute web URL generated from catalog deep-link templates

### Proposed Expo-only payload after the weekend

Expo/native:

- `url`: `com.despia.totlnative://league/XYZ99?tab=chat`

Despia/web unchanged:

- `url`: `https://playtotl.com/league/XYZ99?tab=chat&leagueCode=XYZ99`

## Go / No-Go

### Pre-weekend decision

**No-go** for server-side payload changes.

Why:

- shared dispatcher targets all active devices for a user
- chat notifications use the shared top-level `url` path
- legacy senders still use `web_url`
- no isolated Expo-only server send path was found

## Recommended Post-Gameweek Plan

1. Split payload generation by audience/platform before the final OneSignal send.
2. Keep Despia/web on current web URLs.
3. Move Expo/native to app-specific deep links or app-specific payload fields.
4. Migrate legacy `web_url` senders behind the same platform-aware abstraction.
5. Test notification taps separately for:
   - Expo only installed
   - Despia only installed
   - both apps installed on the same user

## Bottom Line

The lowest-risk pre-weekend posture is:

- do not touch shared server payload generation
- rely on native URL translation already present in Expo
- perform the platform split only after the weekend, when shared notification behavior can be regression tested safely
