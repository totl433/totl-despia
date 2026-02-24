# AGENTS.md

## Cursor Cloud specific instructions

### Scope

Only work on the **Expo mobile app** (`apps/mobile`) and **BFF** (`apps/bff`). Ignore the web/Despia frontend in the repo root (`src/`, `netlify/`, etc.).

### Project overview

TOTL (Top of the League) is a Premier League predictions game. The Expo app is an npm-workspaces monorepo:

| Path | Purpose |
|---|---|
| `apps/mobile` | Expo 54 React Native app (iOS/Android + web fallback) |
| `apps/bff` | Fastify BFF that proxies to Supabase (port 8787) |
| `packages/domain` | Shared Zod schemas and types |
| `packages/api-client` | Typed API client for the BFF |
| `packages/ui` | Shared React Native UI primitives |

### Running services

All commands run from the repo root unless noted.

| Service | Command | Port | Notes |
|---|---|---|---|
| BFF | `npm run bff:dev` (or `cd apps/bff && npm run dev`) | 8787 | Health check: `curl localhost:8787/v1/health` |
| Expo (Metro) | `npm run mobile:dev` (or `cd apps/mobile && CI=0 expo start`) | 8081 | Press `w` for web, `i` for iOS sim |
| Expo web | `cd apps/mobile && CI=0 npx expo start --web --port 8081` | 8081 | Needs `react-native-web` installed |

### TypeScript checks

- BFF: `npm run bff:check`
- Mobile: `cd apps/mobile && npx tsc --noEmit` (pre-existing third-party lib errors from react-native-gifted-chat — not from app code)

### Environment variables

Create `apps/mobile/env.local` (not a dotfile — see `app.config.ts`):

```
EXPO_PUBLIC_SUPABASE_URL=https://gyjagrtwrhctmgkootjj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
EXPO_PUBLIC_BFF_URL=http://localhost:8787
EXPO_PUBLIC_SITE_URL=https://playtotl.com
```

The BFF auto-reads Supabase values from the mobile `env.local`, so a separate BFF env file is usually unnecessary. See `JOF_HANDOFF_RAILWAY_BFF.md` for full details.

### Key gotchas

- `.npmrc` has `legacy-peer-deps=true` — always use `npm install` (not `npm ci`).
- `postinstall` runs `patch-package` (patches `react-native-gifted-chat`). If the `patches/` dir is missing, `npm install` still succeeds but the patch won't apply.
- The `env.local` file (not `.env`) is read by `app.config.ts` at startup. Restart Metro after changing it.
- The app gracefully handles missing Supabase credentials (shows auth UI instead of crashing).
- No iOS simulator available in Cloud Agent VM; use `expo start --web` for UI verification.
- No git hooks or pre-commit config in this repo.
