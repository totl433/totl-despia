# Mobile architecture

Verified against `mobile/shared-release-base` commit `a01d2a07`. Paths are
repository-relative. “Historical” and “unknown” labels are intentional.

## System overview

TOTL is an npm-workspaces monorepo:

- `apps/mobile` — Expo 54 React Native application for iOS and Android.
- `apps/bff` — Fastify BFF used for authenticated aggregate reads and writes.
- `packages/domain` — shared Zod schemas and TypeScript domain types.
- `packages/api-client` — typed client for the BFF.
- `packages/ui` — shared native tokens, typography, themes, and primitives.

The web application and Netlify functions remain separate but affect mobile
where they provide public links, account/profile helpers, chat notification
sends, and OneSignal device registration.

### Runtime data flow

```text
React Native screens
  ├─ TanStack Query -> @totl/api-client -> Fastify BFF -> Supabase
  ├─ Supabase client -> RLS tables, storage, and Realtime
  ├─ playtotl.com Netlify functions -> OneSignal/profile helpers
  ├─ RevenueCat native SDK -> App Store / Google Play
  └─ OneSignal native SDK -> push subscription and notification taps
```

This is deliberately hybrid. Do not assume all data belongs behind one layer:

- Prefer BFF methods for home snapshots, predictions, league aggregate data,
  profile summaries, and branded leaderboard operations.
- Existing direct Supabase access supports chat, reactions, presence,
  realtime live scores, avatars/storage, some leaderboard calculations, and
  The Players scores. RLS behavior is part of those contracts.
- `apps/mobile/src/lib/push.ts` and parts of `userProfile.ts` call Netlify
  functions through the public site origin. The BFF has a legacy
  `/v1/push/register` route that the current OneSignal registration path does
  not use.

## Versions and dependencies

`apps/mobile/package.json` defines:

- Expo `~54.0.33`
- React Native `0.81.5`
- React `19.1.0`
- TypeScript `~5.9.2`
- React Navigation 7
- TanStack Query 5 with AsyncStorage persistence
- Supabase JS 2
- Reanimated 4, Gesture Handler, Screens, Safe Area Context, Worklets
- Gifted Chat, keyboard controller, Gorhom bottom sheets/portal
- OneSignal, RevenueCat, Sentry
- Expo image picker, sharing, file system, font, haptics, blur, AV, clipboard
- `react-native-share`, `react-native-view-shot`, and the local
  `apps/mobile/modules/totl-social-share` Expo module

`expo-notifications` and `expo-build-properties` are installed but no active
TypeScript import/config use was found at this snapshot. Do not remove them
without inspecting native build output and release history.

## Entry point and provider tree

Entry is `apps/mobile/index.ts` -> `apps/mobile/App.tsx` ->
`apps/mobile/src/AppRoot.tsx`.

`App.tsx` establishes:

1. `GestureHandlerRootView`
2. `KeyboardProvider`
3. `BottomSheetModalProvider`
4. Main app or on-device Storybook

`AppRoot.tsx` then:

1. Initializes Sentry when `EXPO_PUBLIC_SENTRY_DSN` exists.
2. Loads Gramatika, Barlow Condensed, and Press Start 2P fonts, with an
   eight-second fallback.
3. Restores the Supabase session and consumes auth callback URLs, with a
   ten-second fallback to sign-in rather than a blank screen.
4. Initializes OneSignal; authenticated sessions register/heartbeat the
   device and re-register when the app becomes active.
5. Configures RevenueCat and logs the Supabase user into the purchase SDK.
6. Resolves profile completeness and sends users without a username to
   `ChooseUsernameScreen`.
7. Mounts safe-area, deep-link, theme, persisted-query, join-intent, confetti,
   unread-count, and popup-card providers.

If validated runtime config is absent, the app renders a “Setup needed”
screen. Font/session/profile errors have timeout or retry behavior; preserve
these safeguards.

## Navigation

Navigation uses React Navigation, not Expo Router.

### Root stack

`apps/mobile/src/navigation/AppNavigator.tsx` contains:

- `Tabs`
- Mini-league detail, join, create, and legacy chat screens
- Chat2 hub/thread
- Profile stack
- Predictions full-screen flows
- Retro TOTL Daily and The Players full-screen flows
- Gameweek results/share modal
- Branded leaderboard list/detail/join screens

### Bottom tabs

`apps/mobile/src/navigation/TabsNavigator.tsx` presents:

1. **Predictions** — `HomeNavigator`: Home and Match Center.
2. **Mini leagues** — `LeaguesNavigator`.
3. **Leaderboards** — branded leaderboard list or the single joined board.
4. **Season label** — global leaderboard (`GlobalScreen`).

The tab bar hides for the keyboard. Pressing Predictions while nested returns
to `HomeMain`.

### Deep links

Deep links are custom-dispatched rather than passed through React Navigation's
`linking` prop:

- URL parsing: `apps/mobile/src/lib/deepLinks.ts`
- URL queue/deduplication: `apps/mobile/src/context/DeepLinkContext.tsx`
- Navigation dispatch: `AppNavigator.tsx`
- OneSignal tap translation: `apps/mobile/src/lib/push.ts`
- Auth callback parsing: `authCallback.ts` and `authCallbackUrl.ts`

Supported destinations include joins, mini-league invites/details/chat,
Predictions, leagues, Match Center, The Players, and branded leaderboard
tabs. Public league URLs carry a code; native navigation resolves membership
through `api.listLeagues()` before selecting a league ID, because a direct
Supabase lookup may be hidden by RLS.

The native scheme is `com.despia.totlnative`. iOS associated domains include
`playtotl.com` and the former staging host for links shared by older builds.
See `docs/EXPO_PUSH_DEEP_LINK_RISK_MEMO.md` before changing push URLs: server
payloads are shared with the legacy web/Despia audience.

## State, fetching, caching, and persistence

### TanStack Query

`apps/mobile/src/lib/queryClient.ts` configures:

- 30-second default stale time
- one-hour garbage collection
- two retries
- reconnect and focus refetching
- AsyncStorage persistence for up to 24 hours
- cache key `totl.react-query.v2`
- cache buster `2.4`

Use stable, feature-namespaced keys. Invalidate all affected views after
mutations; many features share `homeSnapshot`, leagues, ranks, profile, and
leaderboard caches. Bump the persistence key or buster when response shapes
or season bootstrap semantics become incompatible.

### Other persisted state

AsyncStorage is also used for:

- Supabase session (`supabase.auth.token`)
- prediction drafts/tutorial dismissal
- theme preference
- pending join intent
- popup-card gates/read markers
- chat/read state
- daily-game local state and score fallback

Do not store secrets or large unbounded datasets.

### Realtime and polling

- `useLiveScores.ts` overlays Supabase Realtime live scores on BFF snapshots.
- `useLeagueChat.ts`, reaction, presence, and read-receipt hooks use Supabase
  Realtime plus optimistic Query updates.
- Branded broadcasts use dedicated hooks for messages, reactions, and reads.
- Selected live leaderboard queries poll while the gameweek is active.

There is no general offline mutation queue. Persisted Query data provides
limited read resilience, but writes, auth, purchases, chat, and submissions
require connectivity. UI should explicitly show stale/error/retry states.

## Authentication and user lifecycle

`apps/mobile/src/lib/supabase.ts` persists and refreshes sessions in
AsyncStorage with URL detection disabled. `AppRoot` consumes links manually.

`AuthScreen.tsx` provides email/password sign-up, sign-in, forgot password,
and set-new-password flows. Sign-up checks the display name, passes metadata,
and saves the username for immediate sessions. Email confirmation and
password reset use universal/custom links. `userProfile.ts` determines
whether an authenticated user still needs a username.

`signOut.ts` deactivates/reset push state and signs out. `AppRoot` also logs
out RevenueCat. Account deletion is exposed through the BFF from the Profile
stack.

## API and backend contracts

`apps/mobile/src/lib/api.ts` constructs `@totl/api-client` using the BFF URL
and current Supabase access token. `packages/api-client/src/index.ts`:

- applies bearer auth and JSON headers
- aborts after 12 seconds
- throws structured `ApiError` for non-2xx responses
- validates key response shapes with schemas from `packages/domain`

Add shared schemas first for new stable contracts. Avoid untyped `any`
responses where the API already has a domain model.

The BFF (`apps/bff/src/server.ts` and feature modules) owns home/predictions,
league aggregates, profile, standings, branded leaderboard management and
activation, reporting, and related server-only access. It uses Supabase
service credentials only on the server; never expose those values to mobile.

## Native integrations

### Push notifications

OneSignal is configured in `app.config.ts` and implemented in `lib/push.ts`.
Registration:

1. Requires a physical device.
2. Logs the Supabase user ID into OneSignal.
3. Requests OS permission.
4. waits for a OneSignal subscription/player ID.
5. posts it to the Netlify `registerPlayer` function.
6. records local diagnostics and sends periodic heartbeats.

Foreground iOS notifications are explicitly displayed. Notification taps
translate web/relative URLs into the app scheme and enter the same deep-link
queue. Diagnostics are available under Profile/Admin. Backend operations are
documented in `docs/NOTIFICATIONS_RUNBOOK.md`.

### Purchases

`lib/purchases.ts`, `usePurchases.ts`, and branded leaderboard hooks integrate
RevenueCat. Platform-specific public SDK keys are selected by `Platform.OS`;
do not copy them to documentation. The app logs RevenueCat into the same
Supabase user ID to support server verification.

Paid branded leaderboards use consumable season-access products. The client
fetches a configured offering, purchases a package, then asks the BFF to
activate access; activation retries briefly while store/RevenueCat state
propagates. There is intentionally no restore-purchases UI for these
consumables.

### Sharing and media

Result cards are captured with `react-native-view-shot`.
`lib/shareToSocial.ts`, `react-native-share`, Expo sharing/file APIs, and the
local `totl-social-share` module implement Instagram/WhatsApp/system sharing.
Image picker supports profile and league images.

iOS declares read/add photo reasons and URL schemes for supported social
apps. Android uses the system photo picker and blocks broad storage/media
permissions. Camera and microphone permission requests are disabled in the
image-picker plugin.

### Observability

Sentry is best-effort and optional (`lib/sentry.ts`). Push has a richer local
diagnostic trace. Most screen errors are user-facing cards/messages plus
console warnings. There is no single global error boundary in the reviewed
tree.

## Design system and interaction architecture

`packages/ui/src/tokens.ts` defines:

- brand `#1C8376`
- dark slate background/surfaces and semantic status colours
- 4-point-based spacing tokens
- 8/12/16/20/pill radii
- Gramatika body/heading and Press Start 2P mono roles

`packages/ui/src/typography.ts` is the source of truth for `TotlText`
variants. Core primitives are `Screen`, `Card`, `Button`, and `TotlText`.
`apps/mobile/src/lib/lightThemeTokens.ts` supplies the production light
override. Theme preference can still select the base dark palette.

Common interaction conventions:

- `AppTopHeader` and `PageHeader` for top-level chrome.
- Native stacks for screen transitions; full-screen modals for predictions
  and retro games; transparent/fade modal for fixture sharing.
- Gorhom/custom sheets for create/join, league menus/rules/invites, chat
  actions, paywalls, and tutorials.
- Underline tabs or segmented pill controls within complex screens.
- Swipe decks for Predictions and retro games; horizontal swipes in league
  detail; pull-to-refresh on major feeds/tables.
- Reanimated for decks, layout, shimmer, and transitions; haptics/confetti
  for successful interactions.

`Screen` applies safe areas to top/left/right but not bottom. Scroll content
usually adds explicit floating-tab/bottom-inset padding. Keyboard-sensitive
flows use `react-native-keyboard-controller`; Android is configured with
`softwareKeyboardLayoutMode: resize`.

Accessibility labels/roles exist on many custom pressables but coverage is
not systematic. When adding controls, provide labels, roles, adequate hit
areas, dynamic text behavior, and non-colour-only state.

### Known design inconsistencies

- Large screens contain many inline colour/spacing values instead of tokens.
- Light mode is the normal product appearance while base UI tokens are dark.
- Multiple tab/control implementations coexist.
- Legacy chat screens remain registered alongside Chat2.
- Several screen files are very large, making behavior and layout tightly
  coupled.
- Android disables selected Reanimated layout transitions to avoid crashes;
  preserve those guards until tested on representative devices.

## Platform differences

| Concern | iOS | Android |
| --- | --- | --- |
| JS engine | JSC | Hermes |
| Keyboard | interactive/will-show behavior in several flows | resize mode and did-show/offset workarounds |
| Layout animation | generally enabled | disabled in selected heavy lists/screens |
| Purchases | App Store RevenueCat configuration | Google Play RevenueCat configuration |
| Sharing | explicit Instagram Stories/Photos path | Android package intents/system sheet |
| Media | Info.plist photo read/add descriptions | system picker; broad media permissions blocked |
| Back | native-stack minimal join buttons | predictive back disabled; hardware back must be tested |

Both platforms use the same bundle/package identifier
`com.despia.totlnative`, common React Native code, Supabase project, BFF,
OneSignal app, and domain logic.

## Configuration risks and technical debt

Confirmed:

- Root and mobile Expo/EAS configs point at different projects. Use
  `apps/mobile`.
- `app.json` says New Architecture enabled, while `app.config.ts` keeps the
  main app on legacy unless Storybook is enabled. Inspect `expo config` before
  every native build.
- Marketing/build versions drift across `app.json`, `package.json`, old
  handoffs, and actual store releases.
- Public client configuration values are committed in existing files. Do not
  reproduce them; review repository sharing and rotation policy separately.
- The data layer spans BFF, direct Supabase, and Netlify functions.
- No active `expo-updates` dependency or channel strategy was found.
- Expo web cannot render several native-only app surfaces and is not adequate
  release verification.

Unknown until checked in the external consoles:

- Current EAS credential ownership and expiry state.
- Live OneSignal/APNs setup.
- Current RevenueCat offering/entitlement configuration.
- Current App Store agreements and Play upload-key status.
