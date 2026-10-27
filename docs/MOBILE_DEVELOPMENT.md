# Mobile development and release guide

Verified against `mobile/shared-release-base` commit `a01d2a07`. This guide
documents repository behavior without credential values. External console
state must be checked at release time.

## Prerequisites

- macOS with a compatible Xcode for iOS work
- Android Studio, Android SDK, and an emulator for Android work
- Node.js compatible with Expo SDK 54 and the repository lockfile
- npm
- EAS CLI and access to the correct Expo account/project for store builds
- access to the mobile Supabase/BFF/OneSignal/RevenueCat environments

Install from the repository root:

```bash
npm install
```

Use `npm install`, not `npm ci`. `.npmrc` sets
`legacy-peer-deps=true`, and `postinstall` runs `patch-package`.
Inspect `patches/` before dependency upgrades, especially Gifted Chat and
Storybook React Native patches.

## Repository and configuration boundaries

The canonical mobile project is `apps/mobile`.

Use:

- `apps/mobile/app.json`
- `apps/mobile/app.config.ts`
- `apps/mobile/eas.json`
- `apps/mobile/package.json`

Do not build from the root `app.json`/`eas.json`: they reference a different
Expo project/configuration.

Before work:

```bash
git fetch origin
git switch mobile/shared-release-base
git pull --ff-only
git switch -c feat/short-mobile-feature-name
```

Implement shared React Native behavior once and use `Platform.OS` only for a
real platform difference. Platform hotfixes must be merged back into the
shared baseline.

## Environment configuration

Local mobile configuration lives in:

```text
apps/mobile/env.local
```

It is intentionally not a dotfile. Start from `apps/mobile/env.example` and
obtain values through the team's secure channel.

Mobile variable names:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_BFF_URL`
- `EXPO_PUBLIC_SITE_URL`
- `EXPO_PUBLIC_ONESIGNAL_APP_ID` (optional to the schema, required for push)
- `EXPO_PUBLIC_SENTRY_DSN` (optional)
- `EXPO_PUBLIC_STORYBOOK_ENABLED` (development only)
- `EXPO_PUBLIC_ONESIGNAL_MODE` (build-time)

`app.config.ts` gives `env.local` precedence for local development and reads
EAS/CI process values for builds. It deliberately fixes the public site origin
to `https://playtotl.com`; the former staging host is retained only as an
inbound iOS associated domain.

Never commit `env.local`, service-role credentials, signing materials, store
API keys, or copied console output containing secrets. Existing public client
configuration in tracked files is not permission to duplicate it.

### BFF

Run locally:

```bash
npm run bff:dev
```

Default port is `8787`. Health check:

```bash
curl http://localhost:8787/v1/health
```

The BFF environment schema is `apps/bff/src/env.ts`. Local development can
reuse approved Supabase public values, but server-only service credentials
must never enter the mobile bundle. `JOF_HANDOFF_RAILWAY_BFF.md` contains
historical Railway details; verify current deployment state before acting.

## Running the app

### Metro

From the root:

```bash
npm run mobile:dev
```

Equivalent:

```bash
cd apps/mobile
npm run start
```

Clear Metro state with:

```bash
cd apps/mobile
npm run start:clear
```

Use tunnel mode when localhost/LAN routing fails:

```bash
npm run mobile:dev:tunnel
```

### iOS Simulator

```bash
npm run mobile:ios
```

or:

```bash
cd apps/mobile
npm run ios
```

This invokes `expo run:ios` and creates/uses native generated projects. A
development build is required for OneSignal, RevenueCat, Sentry native
frames, custom sharing, and other native modules.

If the simulator opens an installed client with a stale Metro URL:

1. fully quit the app in the simulator
2. restart Metro with `npm run mobile:dev`
3. launch by pressing `i` in Metro rather than tapping a stale app icon
4. use tunnel mode if localhost remains unreachable

The current machine history includes an Xcode license blocker. If
`xcodebuild` is restricted by device management, local iOS compilation cannot
be completed on that machine; use an approved Mac or EAS Build. Accepting the
license in App Store Connect does not replace the local Xcode license.

### Android Emulator

Start an emulator in Android Studio, then:

```bash
npm run mobile:android
```

or:

```bash
cd apps/mobile
npm run android
```

Android uses Hermes, edge-to-edge layout, keyboard resize, and has predictive
back disabled. Test hardware back, bottom sheets, keyboard/chat resizing,
safe-area/navigation-bar spacing, and the system photo picker.

### Physical devices

Use development builds or store/internal builds. Physical devices are
mandatory for trustworthy verification of:

- OneSignal permission/subscription/player IDs and notification taps
- RevenueCat/store purchases
- Instagram/WhatsApp sharing and photo permissions
- APNs/FCM behavior
- performance and Android OEM keyboard/navigation variations

Be careful when signing the same user into simulator and phone: device
registration changes can make push diagnostics misleading.

### Storybook

On-device Storybook:

```bash
cd apps/mobile
npm run storybook
```

or build directly:

```bash
EXPO_PUBLIC_STORYBOOK_ENABLED=true npm run ios
```

Storybook enables a different New Architecture path in `app.config.ts`.
Rebuild the native client when changing this flag. Stories live in
`apps/mobile/src/stories`.

Expo web is useful only for basic data/navigation checks. Native carousel,
gradient, SVG, Reanimated, sharing, push, and purchase behavior is incomplete
or absent; never use web mode as mobile release QA.

## Native configuration

`apps/mobile/app.config.ts` adds:

- custom URL scheme
- iOS associated domains
- OneSignal plugin and app group
- social-app query schemes
- `react-native-share` platform configuration
- date-time picker plugin
- runtime `extra` variables

`apps/mobile/app.json` controls:

- app/bundle/package identity
- version and platform build numbers
- iOS JSC and Android Hermes
- portrait orientation and light shell
- image-picker permission text
- Android keyboard and permission safeguards

Run this before a native build and inspect the resolved result:

```bash
cd apps/mobile
npx expo config --type public
```

For sensitive config, inspect locally and do not paste values into commits or
chat. Confirm that the resolved EAS project ID belongs to the mobile project.

Native rebuild triggers include changing plugins, permissions, native
dependencies, schemes/associated domains, app groups, bundle identifiers,
engines, New Architecture, or the local Expo module.

## Data and backend development

For new BFF functionality:

1. define/extend schemas and types in `packages/domain`
2. add a typed method in `packages/api-client`
3. implement and test the Fastify route/module in `apps/bff`
4. consume it through `apps/mobile/src/lib/api.ts`
5. use a feature hook and stable Query keys in mobile UI

Use direct Supabase only when matching an established realtime/RLS pattern.
Do not use service-role behavior from the client. Test RLS with a normal user,
not only an admin.

After mutations, invalidate every affected cache. Home, ranks, mini leagues,
profile, branded boards, unread state, and persisted Query snapshots often
overlap.

## Testing and quality checks

### Unit tests

From the root:

```bash
npx vitest run -c vitest.unit.config.ts
```

The config includes pure mobile and BFF tests. Add tests for:

- pure ranking/scoring/deadline rules
- URL/deep-link parsing
- auth callback normalization
- access and activation state machines
- date/time-zone boundaries
- cache/read-marker helpers

No verified Detox/Maestro mobile E2E suite exists.

### TypeScript

```bash
cd apps/mobile && npm run check
cd apps/bff && npm run check
```

The repository has had known mobile-wide/third-party TypeScript failures,
including Gifted Chat types, and historical BFF implicit-any errors. Capture a
baseline before a feature, compare changed-file failures, and fix new errors.
Do not claim the whole repository is clean unless the commands prove it.

There is no mobile-specific lint script in `apps/mobile/package.json`.
Root build/lint scripts primarily target the web app.

### Manual smoke test

For normal product changes:

1. cold start, session restore, sign-in/sign-up, password links
2. Home loading/error/refresh and active GW state
3. draft, swipe/list, submit, and locked predictions
4. mini-league list/detail/join/create and Chat2 send/reply/react/report
5. global and branded leaderboards
6. profile/avatar/notifications/sign-out
7. deep links from cold and warm state
8. keyboard, scrolling, safe areas, back behavior
9. photo selection and result sharing

For a release, add physical iOS and Android push/purchase tests.

## Debugging

### Blank or stuck startup

`AppRoot.tsx` has explicit font, session, and profile safeguards. Check:

- resolved Expo `extra`
- Metro logs
- BFF health
- Supabase session storage
- profile resolution/RLS

Do not remove timeouts to hide an underlying configuration/network issue.

### Stale data

Inspect Query keys and persisted cache behavior in `lib/queryClient.ts`.
When a response shape or season bootstrap changes incompatibly, bump the
persister key/buster. Prefer targeted invalidation during normal mutations.

### Push

Use Profile push diagnostics plus:

- `apps/mobile/src/lib/push.ts`
- `apps/mobile/src/lib/pushDiagnostics.ts`
- `docs/NOTIFICATIONS_RUNBOOK.md`
- `docs/EXPO_PUSH_DEEP_LINK_RISK_MEMO.md`

Verify permission, OneSignal login, subscription ID, backend registration,
heartbeat, send logs, and tap URL separately. Avoid server payload changes
without testing both native and legacy web/Despia clients.

### Purchases

Verify:

- native RevenueCat module exists in the installed build
- correct platform key selected
- Supabase user ID is the RevenueCat app user ID
- offering exists and has a package for that store
- sandbox/test account store configuration
- BFF activation and receipt propagation

Do not add restore UI without revisiting the consumable product model and
App Review notes.

## EAS builds

Build from `apps/mobile`:

```bash
cd apps/mobile
eas build --platform ios --profile production
eas build --platform android --profile production
```

For one source commit:

```bash
eas build --platform all --profile production
```

The profiles are:

- `development` — development client, internal distribution
- `preview` — internal distribution
- `production` — store build, no automatic version increment

Because `autoIncrement` is false and `appVersionSource` is local, version
metadata must be bumped deliberately in `apps/mobile/app.json`.

No active `expo-updates` dependency/channel/runtimeVersion workflow was found.
Do not promise OTA delivery; plan a binary build.

## Signing and credentials

EAS manages or references:

- iOS distribution certificate and provisioning profiles
- App Store Connect submission access
- Android keystore/upload key
- Google Play service account submission access

Do not commit or document private materials. Use `eas credentials` and the
provider consoles with an authorized account. Historical upload-key and Apple
agreement notes may be stale; verify current external state rather than
following old handoffs literally.

The iOS bundle ID and Android package are both
`com.despia.totlnative`. Changing identity would affect entitlements,
universal links, OneSignal, RevenueCat, Supabase redirects, and both stores.

## Store submission

### iOS / TestFlight

```bash
cd apps/mobile
eas build --platform ios --profile production --auto-submit
```

The production submit profile identifies the existing App Store Connect app.
After EAS reports submission success, App Store Connect may still process the
binary before TestFlight availability.

Before submission:

- increment iOS build number
- verify marketing version and exact Git commit
- verify agreements/tax/banking in App Store Connect
- verify app-review account/join code outside source control
- test paid branded leaderboard products in sandbox
- confirm permission descriptions and account deletion

### Android / Play internal testing

```bash
cd apps/mobile
eas build --platform android --profile production --auto-submit
```

The production submit profile targets `internal` with release status
`completed`. Before submission:

- increment `versionCode`
- verify target track and exact Git commit
- verify upload key/service-account access in Play Console
- inspect merged permissions; broad media permissions must remain blocked
- test Hermes startup, keyboard resize, edge-to-edge, photo picker, purchases

EAS submission success means Google accepted the artifact for the configured
track; Play processing/policy status should still be checked.

### Release provenance and current baseline

At handover time:

- source commit: `a01d2a07`
- iOS release made from it: `2.6 (63)`, submitted successfully to TestFlight
- Android release made from it: `2.6 (2022230)`, submitted successfully to
  Play internal testing

Those metadata changes were intentionally temporary/uncommitted in an
isolated release worktree. The source branch still contains older numbers.
Never infer the next build number solely from Git; compare App Store Connect,
Play Console, EAS build history, and `app.json`.

## Release checklist

1. Fast-forward `mobile/shared-release-base`; record full commit SHA.
2. Create an isolated release branch/worktree.
3. Confirm only intended source changes are present.
4. Resolve Expo config and verify mobile EAS project ID.
5. Set marketing version, iOS build, and Android versionCode.
6. Run unit tests and TypeScript baseline comparison.
7. Smoke-test the same source commit on both platforms.
8. Test RevenueCat and OneSignal on physical devices.
9. Build/submit from `apps/mobile`.
10. Confirm EAS build and submission statuses.
11. Confirm TestFlight processing and Play internal-track availability.
12. Record release provenance without committing credentials.
13. Merge every platform hotfix back into the shared baseline.

Do not deploy the mobile branch to Netlify/playtotl.com. Website and backend
deployments must be handled as separate, explicit changes.
