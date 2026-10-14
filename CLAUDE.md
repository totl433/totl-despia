# Claude Code: mobile ownership

This repository contains the production **Top of the League (TOTL)** iOS and
Android app. Mobile is the priority. Work primarily in `apps/mobile`,
`apps/bff`, `packages/api-client`, `packages/domain`, and `packages/ui`.
The root Vite/Despia site is a separate product surface; change it only when a
mobile dependency explicitly requires it.

## Product in one minute

TOTL is a Premier League home/draw/away predictions game. Users predict each
gameweek, follow live scores and rank changes, compete in mini leagues and
global leaderboards, chat with league members, join free or paid branded
leaderboards, and share results. Admin-only/experimental surfaces include
Match Center, Predictions Test, Retro TOTL Daily, and The Players daily game.

Source baseline for this handover: `mobile/shared-release-base` at
`a01d2a07`. That commit was released as iOS `2.6 (63)` to TestFlight and
Android `2.6 (2022230)` to Play internal testing using temporary local release
metadata. The committed `apps/mobile/app.json` still says `2.4 (60)` /
`2022227`; always verify store state and bump metadata deliberately.

## Read these next

- [Mobile architecture](docs/MOBILE_ARCHITECTURE.md)
- [Feature and product reference](docs/MOBILE_FEATURES.md)
- [Development and release guide](docs/MOBILE_DEVELOPMENT.md)
- [Push deep-link risk](docs/EXPO_PUSH_DEEP_LINK_RISK_MEMO.md)
- [Notification operations](docs/NOTIFICATIONS_RUNBOOK.md)

Existing release handoffs are historical evidence, not authoritative version
metadata. `README.md` and `PROJECT_CONTEXT.md` are web-centric.

## Architecture map

- `apps/mobile/src/AppRoot.tsx` — bootstrap, auth gate, providers, push,
  purchases, fonts, and failure fallbacks.
- `apps/mobile/src/navigation/` — root stack, four bottom tabs, nested stacks,
  custom deep-link dispatch.
- `apps/mobile/src/screens/` — screen-level orchestration.
- `apps/mobile/src/components/` — reusable and feature-scoped UI.
- `apps/mobile/src/hooks/` — React Query, realtime, unread, purchase, and
  feature state.
- `apps/mobile/src/lib/` — Supabase, typed BFF client, rules, storage, push,
  purchases, sharing, and pure helpers.
- `apps/bff/src/` — authenticated Fastify aggregation and mutation API.
- `packages/api-client` — bearer-authenticated, partly Zod-validated BFF API.
- `packages/domain` — shared schemas and domain types.
- `packages/ui` — tokens, typography, theme, and core native primitives.

The app has a **hybrid data layer**. Prefer the BFF for aggregate/domain
operations and use existing direct Supabase patterns only for realtime or
RLS-backed features such as chat, live scores, presence, avatars, and some
leaderboard calculations. Some push/profile operations still call Netlify
functions at `EXPO_PUBLIC_SITE_URL`; do not silently move them to the BFF.

## Essential commands

Run from the repository root unless shown otherwise:

```bash
npm install
npm run bff:dev
npm run mobile:dev
npm run mobile:ios
npm run mobile:android
npx vitest run -c vitest.unit.config.ts
cd apps/mobile && npm run check
cd apps/bff && npm run check
```

Use `npm install`, not `npm ci`; `.npmrc` enables legacy peer dependencies and
`postinstall` applies patches. Native dependencies require a development
build, not Expo Go. Push, purchases, and final sharing tests require physical
devices.

## Coding conventions

- Extend the existing React Navigation stacks and typed param lists; do not
  introduce a second router.
- Use TanStack Query with stable feature keys for server state. Invalidate or
  update related caches after mutations. Persist only data safe for the
  existing 24-hour cache policy.
- Put BFF contracts in `packages/domain` and `packages/api-client`, then
  implement the route in `apps/bff`. Preserve the 12-second API timeout and
  bearer-token flow.
- Use `@totl/ui`, `useTokens`, and existing feature components before adding
  one-off styling. Gramatika is the UI font; Press Start 2P is reserved for
  retro game surfaces.
- Keep screen orchestration in `screens`, reusable view logic in
  `components`, server/realtime state in `hooks`, and pure rules/integration
  code in `lib`.
- Use `Platform.OS` only for verified native differences. Preserve Android
  Hermes, keyboard resize, blocked broad media permissions, and Android
  Reanimated stability guards.
- Handle safe areas and keyboards with the existing primitives and
  `react-native-keyboard-controller`; test compact devices and large text.
- Add loading, empty, retry, and timeout states. The app intentionally avoids
  blank-screen failures during font, session, profile, and environment setup.
- Add focused unit tests for pure business rules and URL/access helpers.
  Smoke-test the same commit on both platforms for user-facing changes.

## Critical rules and pitfalls

- Build from `apps/mobile`; the root `app.json` and `eas.json` describe a
  different Expo project and can select the wrong project ID/config.
- `apps/mobile/env.local` is the local config file. Never commit its values or
  copy keys/tokens into documentation, logs, or prompts.
- `apps/mobile/app.config.ts` forces the public site origin to
  `https://playtotl.com` and keeps the former staging domain only for inbound
  legacy universal links.
- iOS uses JSC; Android uses Hermes. Do not normalize engines casually.
- There is no verified `expo-updates`/OTA workflow. Assume a new store binary
  is required for mobile changes.
- Do not deploy a mobile branch to Netlify/playtotl.com. The website and
  Netlify functions have a separate release risk.
- OneSignal payload generation is shared with the legacy web/Despia audience.
  Preserve native URL translation until the backend is explicitly split by
  platform.
- RevenueCat products are consumable season access for branded leaderboards;
  no Apple-style restore UI is presented. Keep iOS and Android offering
  mappings aligned.
- The repository has known TypeScript noise. Compare failures with the
  baseline and do not label unrelated existing errors as regressions.
- `GlobalScreen`, `LeagueDetailScreen`, `MatchCenterScreen`, and several
  branded-leaderboard screens are large. Prefer extraction over extending
  their monoliths.

## Before a mobile release

Verify the exact source commit, both platform version identifiers, bundle
identifier/package, environment resolution, RevenueCat on physical iOS and
Android devices, OneSignal registration/taps, auth/deep links, predictions,
mini-league chat, keyboard/scroll behavior, photo selection/sharing, Android
Hermes/permissions, and the target TestFlight/Play track. Build both platforms
from the same source commit whenever possible.
