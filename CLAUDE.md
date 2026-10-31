# CLAUDE.md

Context for Claude Code on TOTL. Read this first, then `AGENTS.md` (setup, commands, simulator fixes), which is imported below.

@AGENTS.md

## Who's who

- **Carl** owns the product, design system and releases. He merges every PR and runs every TestFlight build.
- **Jof** works on the app and the BFF.
- Both work through Claude Code. Open a PR; don't push straight to a shared branch.

## Scope

Work in `apps/mobile` (Expo 54, React Native 0.81, React 19), `apps/bff` (Fastify) and `packages/*`. The repo root (`src/`, `netlify/`, Vite, Tailwind) is the old Despia web app. Only touch it when asked; the Netlify notification functions in `netlify/functions` still run in production.

The root is full of old one-off `.md` reports (`*_AUDIT.md`, `*_HANDOFF.md`, `PROJECT_CONTEXT.md`, `.cursorrules`). Most of them describe the web app and are out of date. Don't treat them as current unless the task is about that area.

## Branches and deploys

Get this wrong and work never ships, or ships by accident.

| Branch | What it deploys | Notes |
|---|---|---|
| `mobile/game-centre-redesign` | Nothing on its own; TestFlight builds come from it | Day-to-day branch for app work. Base PRs here. |
| `expo-ui-carl` | **Production BFF on Railway**, on every merge | https://totl-despia-production.up.railway.app. BFF changes only go live once they reach this branch. |
| `main` | **playtotl.com on Netlify**, including the scheduled notification functions | Anything in `public/` goes live on the next deploy. |

- **BFF changes:** open the PR to `mobile/game-centre-redesign`, then a second PR to `expo-ui-carl`. If the second one is missing, the app calls routes that 404 in production.
- **Checking a deploy:** a new route should return 401 when you call it without a login. 404 means it hasn't deployed.
- **Before a BFF PR:** run `cd apps/bff && npm run check`, because Railway runs `tsc` and a type error, even in a test file, fails the deploy.

## Safety rules

- **The Supabase database is live, with real users.** Never insert, update or delete data, and never run migrations. To change the schema, write the SQL into `supabase/sql/` and give it to Carl to run himself.
- **Never use the service-role key or commit secrets.** Scripts that need it are run by a human in their own terminal.
- **Test account:** only `sotbjof+cursor@gmail.com` / `cursor123`. Don't create accounts.
- **Ask first** before merging, deploying, starting an EAS build, posting to Slack or GitHub on someone's behalf, or changing repo settings.
- **Don't trust what the client sends.** RLS lets users edit their own `user_notification_preferences` row, and league invites are stored in it (`__league_invites`, `__league_invites_sent`). So the BFF must check every invite against the inviter's sent list before acting on it (`apps/bff/src/leagueInviteRoutes.ts`). Follow the same pattern for any other data a user can edit.

## Workspace packages

- **`dist/` is committed.** `packages/ui` and `packages/domain` ship a built `dist/`, and the app imports from it, not from `src/`. After changing `src/`, run `npm run build` in that package and commit `dist/` too. If you skip this, your change silently does nothing.
- **What's in them:**
  - `packages/domain`: shared Zod schemas.
  - `packages/api-client`: typed BFF client.
  - `packages/ui`: tokens, theme and primitives.

## Checks

| What | Command |
|---|---|
| Unit tests (repo root) | `npx vitest run -c vitest.unit.config.ts` |
| BFF types | `cd apps/bff && npm run check` (must be clean) |
| Mobile types | `cd apps/mobile && npx tsc --noEmit` |

- **Mobile type errors:** about 83 already exist, mostly third-party types such as gifted-chat and ReactNode clashes. Compare the count before and after your change; don't try to get to zero.
- **UI changes:** verify them in the iOS simulator. Expo web doesn't render most native components.

## TestFlight builds

Only when Carl asks for one.

1. **Bump the build numbers** in a small PR to `mobile/game-centre-redesign`: `expo.ios.buildNumber` and `expo.android.versionCode` in `apps/mobile/app.json`. `eas.json` sets `autoIncrement: false`, so EAS won't do it for you. Reusing a number fails at submission.
2. **Start the build** from `apps/mobile`:
   `npx eas-cli build --platform ios --profile production --auto-submit --non-interactive --no-wait`
3. **Share the result:** give Carl the build and submission links.

## Design system

**Figma**
- **Totl design system**, file `a1oc8uGjlmX4gqH10cmRPw`: the source of truth. The Cards page (`33635:38`) holds the pinned card, game card and personal card components.
- **totl-assets**, file `XGhSdwCkk4eu53aUhmxR9y`: older assets.
- Use the Figma plugin skills below to read and write these files.

**In code**
- **Tokens:** in `packages/ui/src/tokens.ts`, read through the theme (`t.color.*`, `t.font.*`, `t.space.*`). Don't hard-code hex values, font names or slate/status colours in components. Add a token instead.
- **Fonts:**
  - Gramatika for UI: `t.font.regular`, `t.font.medium` and `t.font.bold`, with `body` and `heading` as aliases.
  - Tourney Condensed Bold for kickers, feed headers and The Players.
  - PressStart2P (`t.font.mono`) for retro bits.
  - Gramatika isn't available in the Figma plugin, so Figma frames made through the API fall back to Inter. Say so when that happens.
- **Shared components:**
  - `apps/mobile/src/components/*`, for example `UnderlineTabs`, `PageHeader`, `SegmentedPillControl`, plus the feature folders.
  - `GameCentreCardHeader` and the pinned cards under `components/gameCentre`.
  - Reuse these before building new ones. Storybook: `cd apps/mobile && npm run storybook`.

**Game Centre feed**
- **Where it lives:** `apps/mobile/src/features/matchCenter/`.
- **How cards are built:** `derivedFeed.ts` builds the cards. `copyBank.ts` holds the A/B/C copy, picked by `pickCopy`, which is seeded by card id. `shoutOutSlots.ts` places shout-outs.
- **Admin posts:** from `apps/bff/src/matchCenterBroadcast.ts`.
- **Every card kind:** see Carl's "Game Centre feed cards" doc. Ask him for the link.
- **When you add a card kind,** update that doc and the Figma Cards page.

## Skills and plugins we use

Install these in Claude Code so both of us work the same way.

**Plugins**

Official marketplace (`/plugin install <name>@claude-plugins-official`):

| Plugin | Use it for |
|---|---|
| `figma` | Reading and writing the Figma files. Skills: `figma-use` (required before any write), `figma-design-to-code`, `figma-generate-design`, `figma-generate-library`, `figma-code-connect`. Run `/mcp` to sign in to Figma. |
| `expo` | Expo and EAS help: builds, config, native modules. |
| `frontend-design` | Visual design quality on UI work. |

Impeccable (`/plugin marketplace add pbakaus/impeccable`, then `/plugin install impeccable@impeccable`):

| Plugin | Use it for |
|---|---|
| `impeccable` | Design direction, building and reviewing polished UI. |

**User skills** (in `~/.claude/skills`; Carl can share the folder)

| Skill | Use it for |
|---|---|
| `react-native-best-practices` | Performance: re-renders, FlashList, Reanimated, JS thread. |
| `react-navigation` | Stacks, tabs, sheets, headers, safe areas. |
| `upgrading-react-native` | Expo SDK and React Native upgrades. |
| `github-actions` | CI for simulator and emulator builds. |
| `writing-user-docs` | Anything users read: release notes, help text. |

## How to work here

- **Branches:** start each task on a fresh branch off `mobile/game-centre-redesign`.
- **Size:** keep PRs small, one topic each.
- **PR description:** say what changed, why, how it was tested, and what Carl needs to do (SQL, merge order, build).
- **Match the code around you:** naming, comment density, and the theme and token patterns.
- **Changes users will notice:** call out copy, fonts, layout and notifications so Carl can check them on TestFlight.
- **Push notifications:** catalogued in `notification_catalog/`. Read `NOTIFICATION_CATALOG_WORKFLOW.md` before adding one.
