# Jof Handoff: Railway BFF + iOS Simulator (TOTL Despia)

This repo is a monorepo. The **mobile app** lives in `apps/mobile` and the **BFF** (Backend-for-Frontend) lives in `apps/bff`.

The mobile app calls the BFF via `EXPO_PUBLIC_BFF_URL` (see `apps/mobile/src/env.ts`). The BFF is a small **Fastify** service that proxies to Supabase using the user’s bearer token (RLS-safe).

## 0) Prereqs

- Node + npm installed
- Xcode + iOS Simulator installed
- Expo tooling works locally (we run scripts from repo root)

From repo root:

```bash
npm install
```

## 1) BFF (local dev) — run it the same way we do

### BFF env vars

The BFF requires:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- (optional) `CORS_ORIGIN`
- (optional) `PORT` (defaults to `8787`)

Convenience behavior: the BFF will **auto-read** Supabase values from the mobile app’s `env.local` if you don’t set them directly.

Specifically, `apps/bff/src/env.ts` looks for:

- `apps/bff/env.local` (preferred if present)
- then falls back to `apps/mobile/env.local` using:
  - `EXPO_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`

### Create `apps/mobile/env.local`

In `apps/mobile/env.local` add:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_BFF_URL=http://localhost:8787
EXPO_PUBLIC_SITE_URL=https://playtotl.com
```

### Start the BFF

From repo root (in a terminal):

```bash
cd apps/bff
npm run dev
```

Sanity check:

```bash
curl http://localhost:8787/v1/health
```

You should see:

```json
{ "ok": true }
```

## 2) Railway BFF — how it should be configured

Railway should run the same BFF in `apps/bff`.

### Required Railway variables

Set these in Railway service variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CORS_ORIGIN` (recommended: your Expo dev URL(s) and prod domains; or leave unset to allow all)

Railway already provides `PORT` automatically on most templates; our server reads `PORT` and binds `0.0.0.0`.

### Build / start

The BFF package has:

- `npm run build` → `tsc -p tsconfig.json`
- `npm run start` → `node dist/server.js`
- `npm run dev` → `tsx watch src/server.ts`

For Railway, use **build** + **start** (not `dev`).

If Railway is set up from the repo root, ensure it targets `apps/bff` as the working directory (or equivalent setting).

## 3) Point the mobile app at Railway (simulator)

In `apps/mobile/env.local`, set:

```bash
EXPO_PUBLIC_BFF_URL=https://<your-railway-bff-domain>
```

Restart Metro/dev server after changing env values (Expo reads them at startup).

The Home screen prints the BFF URL in dev builds, so you can confirm it’s picking it up:
- `Dev: BFF ...` (see `apps/mobile/src/screens/HomeScreen.tsx`)

## 4) Run the iOS simulator

From repo root:

```bash
npm run mobile:dev
```

If you need to explicitly run iOS:

```bash
cd apps/mobile
npx expo run:ios
```

## 5) Common “it’s not working” checks

- **BFF not reachable**: verify `EXPO_PUBLIC_BFF_URL` points to the right place (local vs Railway).
- **Localhost on device vs simulator**: iOS Simulator can hit `http://localhost:8787` fine. (On a physical device you’d need your machine IP.)
- **Auth issues**: the mobile app passes the Supabase access token; the BFF enforces auth via `requireUser()` and then uses an authed Supabase client per-request.
- **CORS**: if you’re testing from web or odd dev origins, set `CORS_ORIGIN` in BFF/Railway.

## 6) Where things live

- **BFF entrypoint**: `apps/bff/src/server.ts`
- **BFF env parsing**: `apps/bff/src/env.ts`
- **Mobile env parsing**: `apps/mobile/src/env.ts`
- **Mobile API client base URL**: `apps/mobile/src/lib/api.ts` (uses `EXPO_PUBLIC_BFF_URL`)

