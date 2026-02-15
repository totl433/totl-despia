# TOTL Expo Load + Work (Carl Handoff)

> **Status**: The `apps/mobile` and `apps/bff` folders exist with `.env` and `node_modules` only. **The BFF and mobile app source code is not yet in this repo** (no `package.json`, no `src/`, no `server.ts`, etc.). Get the actual code from Carl and add it, then use this runbook.

---

## Repo structure (monorepo)

| App | Path | Purpose |
|-----|------|---------|
| **Mobile** | `apps/mobile` | Expo/React Native app (TOTL Despia) |
| **BFF** | `apps/bff` | Fastify Backend-for-Frontend (proxies to Supabase with RLS-safe auth) |

The mobile app talks to Supabase via the BFF using `EXPO_PUBLIC_BFF_URL`. The BFF accepts bearer tokens and forwards them to Supabase (RLS-safe).

---

## 0) Prerequisites

- Node + npm
- Xcode + iOS Simulator
- Expo tooling (scripts run from repo root)

From repo root:

```bash
npm install
```

---

## 1) BFF (local dev)

### BFF env vars

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `SUPABASE_URL` | ✅ | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | — | Supabase anon key |
| `CORS_ORIGIN` | ❌ | — | e.g. `http://localhost:5173` |
| `PORT` | ❌ | `8787` | Server port |

The BFF can **auto-read** from the mobile app’s env if not set:

- `apps/bff/env.local` (preferred)
- then `apps/mobile/env.local`:
  - `EXPO_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`

### Create `apps/mobile/env.local` (or use `.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BFF_URL=http://localhost:8787
EXPO_PUBLIC_SITE_URL=https://playtotl.com
```

### Start the BFF

```bash
cd apps/bff
npm run dev
```

Health check:

```bash
curl http://localhost:8787/v1/health
# Expected: { "ok": true }
```

---

## 2) Railway BFF (deployment)

Run the same BFF in `apps/bff` on Railway.

### Railway variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CORS_ORIGIN` (optional; set to Expo dev URLs + prod domains, or leave unset to allow all)

`PORT` is provided by Railway.

### Build / start

- `npm run build` → `tsc -p tsconfig.json`
- `npm run start` → `node dist/server.js`
- `npm run dev` → `tsx watch src/server.ts`

Use **build** + **start** on Railway, not `dev`. Set root directory to `apps/bff` if deploying from repo root.

---

## 3) Point mobile app at BFF

In `apps/mobile/env.local` (or `.env`):

- Local: `EXPO_PUBLIC_BFF_URL=http://localhost:8787`
- Railway: `EXPO_PUBLIC_BFF_URL=https://<your-railway-bff-domain>`

Restart Metro/Expo after changing env vars.

The Home screen shows the BFF URL in dev: `Dev: BFF ...` (see `apps/mobile/src/screens/HomeScreen.tsx`).

---

## 4) Run iOS simulator

From repo root:

```bash
npm run mobile:dev
```

Or from `apps/mobile`:

```bash
cd apps/mobile
npx expo run:ios
```

---

## 5) Common issues

| Issue | Check |
|-------|-------|
| BFF not reachable | Verify `EXPO_PUBLIC_BFF_URL` (local vs Railway) |
| Localhost on device vs simulator | Simulator can use `http://localhost:8787`; physical device needs your machine IP |
| Auth failures | Mobile sends Supabase access token; BFF uses `requireUser()` and authed Supabase client |
| CORS errors | Set `CORS_ORIGIN` in BFF/Railway for your dev origins |

---

## 6) File locations (once code is present)

| File | Purpose |
|------|---------|
| `apps/bff/src/server.ts` | BFF entrypoint |
| `apps/bff/src/env.ts` | BFF env parsing |
| `apps/mobile/src/env.ts` | Mobile env parsing |
| `apps/mobile/src/lib/api.ts` | Mobile API client base URL (`EXPO_PUBLIC_BFF_URL`) |

---

## 7) Root `package.json` scripts (to add)

Once the apps exist, add to root `package.json`:

```json
{
  "scripts": {
    "mobile:dev": "cd apps/mobile && npx expo start",
    "bff:dev": "cd apps/bff && npm run dev"
  }
}
```

---

## 8) Current repo state

- `apps/mobile/.env` – has Supabase URL and anon key; **add** `EXPO_PUBLIC_BFF_URL` and `EXPO_PUBLIC_SITE_URL`
- `apps/bff/.env` – has Supabase vars; **fix** `SUPABASE_ANON_KEY` (remove duplicated key name)
- `apps/mobile/` and `apps/bff/` – contain `.env` and `node_modules` only; **no source code yet**
