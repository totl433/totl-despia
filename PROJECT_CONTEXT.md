# TOTL Project Handoff

Last verified: 19 September 2026

This is the primary context file for a fresh Cursor session. Read it before
changing code or releasing any build. Do not add credentials, API keys,
passwords, signing files, or customer data to this document.

## Repository

- GitHub: `https://github.com/totl433/totl-despia`
- Product: Top of the League (TotL)
- Website: `https://playtotl.com`
- Android package: `com.despia.totlnative`
- iOS bundle ID: `com.despia.totlnative`
- Production Supabase project URL starts with:
  `https://gyjagrtwrhctmgkootjj.supabase.co`

The repository has materially different web and mobile branches. Do not assume
that `main` is the mobile release branch.

## Branches and Ownership

### `main`

- Production website and Netlify functions.
- Current reference commit when this file was written:
  `4b6ed65022f9515cf12e11434e66682ca45ed808`
- Merging a pull request to `main` triggers Netlify deployment.
- Verify `playtotl.com` after each merge.

### `expo-ui-carl`

- Shared Expo iOS/Android development branch used by Carl and Jof.
- Current reference commit when this file was written:
  `2cc167690f9cf77866e9ed18e6203ba63bf5e5a3`
- Pull this branch before starting general mobile feature work.

### `hotfix/android-blank-screens`

- Exact source used for Android release `2.0.27 (2022222)`.
- Current branch tip:
  `75435f503b49fe1db1072ccc5a65bbefb32bb3db`
- Contains Android rendering and authentication hardening not guaranteed to be
  present on `expo-ui-carl`.
- Reconcile this branch into the long-lived mobile branch deliberately. Do not
  discard it or overwrite it with a broad merge.

## Current Production Status

### Website

- Live at `https://playtotl.com`.
- Google Analytics ID: `G-5HWWJWTRRD`.
- GA bootstrap and cookie-consent integration are implemented.
- App Store clicks are tracked.
- The landing page has live App Store and Google Play links.
- Google Play destination:
  `https://play.google.com/store/apps/details?id=com.despia.totlnative`
- Official store badges are present on:
  - Splash slide
  - All four feature slides
  - Final download slide
- Splash and final stacked badges use matched visible widths and exact shared
  centerlines.
- Feature-slide badges are side by side in one shared absolute CTA band with
  optically matched visible heights and identical positioning.
- Recent website pull requests:
  - PR #4: enable Google Play links
  - PR #5: use official Google Play artwork
  - PR #6/#7: correct visible badge sizing
  - PR #8: add Google Play badge to feature slides
  - PR #9: precisely center stacked badges

### Android

- Production release: `2.0.27`
- Production version code: `2022222`
- Released through Google Play on 19 September 2026.
- The release was first submitted to Internal testing and then promoted to
  Production.
- Managed publishing was enabled during review; the approved release was
  manually published.
- Play Console release name may display as `12 March`; the actual current
  version code is `2022222`.

Important Android fixes in `hotfix/android-blank-screens`:

- Removed Android `RefreshControl` usage from Predictions/Home, Mini leagues,
  and branded leaderboard list screens. Under React Native New Architecture it
  caused valid loaded content to paint as a blank screen.
- Confirmed affected screens render on the Android emulator with real account
  data.
- Added visible session/profile loading and failure states.
- Added authentication timeouts, normalized email handling, inline friendly
  errors, and keyboard dismissal.
- Busted persisted React Query cache for version `2.0.27`.
- Disabled problematic Android layout transitions where required.

Do not reintroduce `TotlRefreshControl` on the three fixed Android screens
without testing a release/New Architecture build on Android.

### iOS

- The app uses EAS/TestFlight.
- `supportsTablet` is false.
- Branded leaderboard products are consumable season-access purchases:
  - `totl_access_099`
  - `totl_access_199`
- Confirm the current TestFlight build and App Store submission in EAS/App
  Store Connect before incrementing versions. Do not infer it from this file.

## Platform Rules

- Supported surfaces are:
  1. Web (`playtotl.com`)
  2. Expo native app (iOS and Android)
- Despia is deprecated. Do not propose Despia-specific implementations.
- The website and mobile app are released independently.
- A mobile/TestFlight request does not authorize a Netlify deployment.
- A website request does not require an EAS build.

## Project Areas

- Web application: `src/`
- Web entry/router: `src/main.tsx`
- Download landing page: `src/pages/GetApp.tsx`
- Google Analytics: `src/lib/googleAnalytics.ts`
- Cookie consent: `src/features/auth/consentStorage.ts`
- Netlify functions: `netlify/functions/`
- Expo app: `apps/mobile/`
- Mobile root/session handling: `apps/mobile/src/AppRoot.tsx`
- Mobile navigation: `apps/mobile/src/navigation/`
- Mobile Predictions/Home: `apps/mobile/src/screens/HomeScreen.tsx`
- Mobile mini leagues: `apps/mobile/src/screens/LeaguesScreen.tsx`
- Branded leaderboard list:
  `apps/mobile/src/screens/brandedLeaderboards/BrandedLeaderboardListScreen.tsx`
- BFF: `apps/bff/`
- Shared domain package: `packages/domain/`
- Database SQL/migrations: `supabase/`

## Safe Setup on a New Laptop

```bash
git clone https://github.com/totl433/totl-despia.git
cd totl-despia
git fetch --all --prune
npm install
```

For website work:

```bash
git switch main
git pull --ff-only origin main
npm install
npm run build
```

For general mobile work:

```bash
git switch expo-ui-carl
git pull --ff-only origin expo-ui-carl
npm install
cd apps/mobile
```

For Android production-hotfix investigation:

```bash
git switch hotfix/android-blank-screens
git pull --ff-only origin hotfix/android-blank-screens
npm install
cd apps/mobile
```

Install and authenticate these tools as needed:

- GitHub CLI (`gh`)
- EAS CLI
- Android Studio/SDK and `adb`
- Xcode (for iOS)
- Supabase CLI only when the correct production account is available

## Release Commands

Run EAS commands from `apps/mobile`.

Android:

```bash
npx eas build --platform android --profile production
```

iOS/TestFlight:

```bash
npx eas build --platform ios --profile production --auto-submit
```

Before either build:

1. Confirm the intended branch and commit.
2. Confirm the store version/build number.
3. Build/export locally where practical.
4. Confirm app name, icon, bundle/package identity, and environment.
5. Do not trigger unrelated web deployment.

## Validation Expectations

Website:

- Run `npm run build`.
- Use a pull request and wait for Netlify preview checks.
- Visually verify responsive CTA/layout changes in the preview.
- After merge, verify the production URL rather than assuming deployment.

Mobile:

- Validate production bundles before EAS when practical.
- Test fresh install, upgrade, logged-out, logged-in, background, and
  cold-start paths for risky changes.
- For Android UI issues, collect Metro logs and `adb logcat`, but trust visible
  runtime behavior over harmless emulator graphics warnings.
- RevenueCat `BILLING_UNAVAILABLE` is expected on a sideloaded emulator and is
  not evidence of a rendering failure.

## Services and Security

- Supabase is production infrastructure. Inspect before changing schema.
- Never expose or commit service-role keys.
- The Supabase MCP connection previously visible on one machine pointed to an
  unrelated inactive project, not the production TOTL project. Verify project
  ref `gyjagrtwrhctmgkootjj` before any remote operation.
- EAS already has Android signing credentials and a Google Play service account
  configured.
- Apple/Google store actions are external production changes: verify target
  track and release number before confirming.

## Known Local-Machine Issue

On the previous Mac, system Git exited with status 69 because the Xcode licence
had not been accepted. A pure-Python Dulwich workaround was temporarily used.
On a new laptop, fix this normally by installing Xcode command-line tools and
accepting the Xcode licence; do not preserve the temporary workaround.

## First Actions in a New Cursor Session

Ask Cursor to:

1. Read `AGENTS.md`, this file, and relevant `.cursor/rules/`.
2. Run `git status`, identify the current branch, and fetch remote refs.
3. Compare branch tip with its remote before editing.
4. Confirm whether the task is web, iOS, Android, BFF, or database work.
5. Preserve unrelated local changes.
6. Use a focused feature/fix branch and pull request for website changes.

## Remaining Follow-up

- Deliberately reconcile `hotfix/android-blank-screens` into the long-lived
  mobile branch after reviewing the diff.
- Confirm the Google Play Billing policy warning is cleared for the production
  bundle in Play Console.
- Keep this file updated after meaningful releases, branch changes, or
  architecture decisions.
