# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

TOTL (Top of the League) is a Premier League predictions game — a React + TypeScript + Vite SPA with Supabase as the backend (cloud-hosted, no local DB). See `.cursorrules` for full architecture details.

### Running the app

- **Dev server**: `npm run dev` (runs Vite on port 5173 + TailwindCSS watcher concurrently)
- **Build**: `npm run build` (or `npm run check` — both do tailwind build + tsc + vite build)
- **Lint**: `npx eslint .` (flat config in `eslint.config.js`; pre-existing lint warnings/errors exist)
- **Unit tests**: `npx vitest run -c vitest.unit.config.ts` (pure Node tests in `src/**/*.test.ts`)
- **Storybook**: `npm run storybook` (port 6006, optional)

### Environment variables

The frontend requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to connect to the Supabase backend. Without these the app will still start and render the onboarding/auth UI, but all data operations will fail. These should be provided via Cursor Cloud Secrets or a `.env` file at the repo root.

Netlify Functions (server-side) additionally need `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `FOOTBALL_DATA_API_KEY`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `MAILERLITE_API_KEY`. These are only needed when running `netlify dev` locally.

### Key gotchas

- `.npmrc` has `legacy-peer-deps=true` — always use `npm install` (not `npm ci`) to respect this.
- Vite proxies `/.netlify/functions/*` to the production staging site by default; set `NETLIFY_DEV=true` env var if running Netlify CLI locally to proxy to `localhost:8888` instead.
- No Docker, no local database, no version-pinning files (`.nvmrc`, `.node-version`). Node 22 works.
- The project uses `"type": "module"` in `package.json` — ESM throughout.
- No git hooks or pre-commit config exists.
