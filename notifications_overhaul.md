You are a principal engineer. Your job is to implement a production-grade push notification pipeline for this repo.

Context (treat as facts from the deep dive report):
- React web app runs inside a Despia wrapper; Despia provides a legacy OneSignal player id exposed to JS (`despia.onesignalplayerid` / `window.onesignalplayerid`).
- Push is delivered via OneSignal.
- Backend uses Supabase.
- Notification Centre preferences exist and are stored in Supabase and (partially) enforced server-side.
- Duplicate notifications are currently likely due to:
  (1) per-user/per-device sending loops + multiple registered devices,
  (2) weak/missing idempotency on some paths (e.g., chat),
  (3) missing OneSignal grouping fields (collapse/thread/group),
  (4) webhook/job concurrency causing re-processing.
Do not guess; validate all of this in code and reference file paths/line ranges in PR notes. :contentReference[oaicite:1]{index=1}

Hard rules
- Do NOT change OneSignal dashboard settings.
- Do NOT modify Supabase data manually (rows/schemas) outside of adding migrations requested below.
- Do NOT deploy anything.
- Do NOT rewrite unrelated code. Keep diffs focused.
- All pushes must be sent ONLY via a single new dispatcher module (no direct OneSignal calls elsewhere).

Deliverables (single PR)
1) A Netlify-hosted docs site under `notification_catalog/` documenting every push (source of truth).
2) A Supabase-backed send log that records every attempted send and provides hard idempotency.
3) A clean, efficient sender pipeline:
   - one dispatcher
   - deterministic event_id per notification
   - server-side enforcement: prefs + cooldown + quiet hours + mutes
   - OneSignal grouping fields set on every push
   - stop duplicate sends caused by multi-device or per-user loops
4) Registration hardening (React/Despia):
   - register once per session
   - check permission state via Despia
   - prevent ghost subscriptions on logout/account switching
   - Notification Centre shows “effective state” (preference + OS permission + registration present)

========================
PHASE 1 — Notification Catalog docs (Netlify)
========================
A) Add `notification_catalog/site` as an Astro Starlight docs site.
B) Add one markdown file per notification under:
   `notification_catalog/site/src/content/docs/notifications/*.md`
   Each must include frontmatter keys:
   - notification_key, owner, status, channels
   - audience, source
   - trigger.name + trigger.event_id_format
   - dedupe scope/ttl
   - cooldown per_user_seconds
   - quiet_hours start/end
   - preferences.preference_key
   - onesignal collapse_id_format, thread_id_format, android_group_format
   - deep_links.url_format
   - rollout enabled/percentage
C) Add templates under:
   `notification_catalog/site/src/content/docs/templates/en/*.txt`
D) Add netlify config snippet (or update repo netlify.toml) so the docs site publishes and creates deploy previews.

If a docs site already exists, reuse it. Keep it minimal.

========================
PHASE 2 — Catalog export (recommended)
========================
Create `scripts/build-notification-catalog.ts` to:
- Parse frontmatter from `notification_catalog/site/src/content/docs/notifications/*.md`
- Emit `notification_catalog/generated/catalog.json` with an array/dict keyed by notification_key
- Validate required fields exist (fail build if missing)

Add a small helper module for the backend:
- `getCatalogEntry(notification_key)` reads/imports catalog.json and returns policy metadata.

========================
PHASE 3 — Supabase send log + idempotency (Option A, mandatory)
========================
Add a migration SQL file (e.g. `supabase/migrations/<timestamp>_notification_send_log.sql`) that creates:

Table: `notification_send_log`
Columns:
- environment ("prod"|"dev")
- notification_key
- event_id
- user_id (uuid, nullable)
- external_id (text, nullable)
- onesignal_notification_id (text, nullable)
- target_type ("external_user_ids"|"player_ids"|"segment"|"filters")
- targeting_summary (jsonb)
- payload_summary (jsonb)
- result enum-like (accepted/failed/suppressed_*)
- error jsonb
- created_at, updated_at

Hard idempotency:
- Unique index on (environment, notification_key, event_id, user_id) where user_id is not null.

Security:
- Enable RLS and create a “deny all” policy for public; ensure only service role can write.

========================
PHASE 4 — Build the unified notifications-core dispatcher
========================
Create:
`netlify/functions/lib/notifications/` (or equivalent folder used by this repo)

Modules required:
- `types.ts`
- `catalog.ts` (loads catalog.json)
- `idempotency.ts` (insert-first lock into notification_send_log)
- `policy.ts` (prefs, cooldown, quiet hours, mutes)
- `targeting.ts` (resolve OneSignal targets)
- `onesignal.ts` (payload builder + API call)
- `sendLog.ts` (create/update log rows)
- `dispatch.ts` (the orchestrator)

Key behavior (must implement exactly):
1) Dispatcher takes an intent:
   - notification_key
   - event_id (deterministic)
   - audience userIds[]
   - data payload + deeplink context
   - optional title/body or template inputs

2) Insert-first idempotency lock:
   For EACH user in the audience:
   - attempt to INSERT a placeholder log row keyed by (env, key, event_id, user_id)
   - if unique violation => already attempted => mark as suppressed_duplicate (or leave as-is) and skip
   - if inserted => continue evaluation + sending and update row with final result

3) Policy enforcement is server-side and consistent:
   - Preferences (Supabase `user_notification_preferences`) MUST be checked here
   - Quiet hours MUST be applied here using catalog metadata
   - Cooldowns MUST be applied here (per-user per notification_key) using send_log history
   - League chat mutes (if implemented in DB) MUST be applied here
   - All suppressions MUST be logged in notification_send_log with the right `result`

4) Targeting strategy:
   Preferred: OneSignal external identity targeting (external_id / external_user_id) to avoid per-device loops.
   Fallback: include_player_ids only if external targeting isn’t supported in this repo’s current OneSignal implementation.
   Either way: chunk/batch sends within OneSignal limits.

5) OneSignal payload:
   Every send MUST set grouping fields based on catalog metadata:
   - collapse_id
   - thread_id
   - android_group
   And MUST include a stable `data` payload with type + IDs (matchId, leagueId, etc).
   Add deeplink url if supported.

6) Observability:
   For accepted sends:
   - store OneSignal’s returned `onesignal_notification_id`
   For failures:
   - store structured error in `error` jsonb
   For all sends:
   - store `targeting_summary` + `payload_summary`

========================
PHASE 5 — Migrate ALL senders to the dispatcher
========================
Search for:
- direct OneSignal REST calls
- helpers that send pushes
- score webhook sender(s)
- chat notification sender(s)
- broadcast/admin notification sender(s)

For each sender:
- Remove direct OneSignal sending
- Compute deterministic event_id using the catalog spec
- Build one intent per event
- Call dispatchNotification()

Critical fixes based on deep dive:
- Remove per-pick/per-user sending loops in score webhook sender (likely duplicate cause).
- Add idempotency to chat notifications (missing today).
- Ensure final whistle / HT / kickoff / goal each have distinct event_id formats.

========================
PHASE 6 — Despia + React registration hardening + Notification Centre “effective state”
========================
Implement or refactor a single registration service in React:
- Reads player id from Despia (`despia.onesignalplayerid` or whatever is used in this repo)
- Checks permission state via Despia API (`checkNativePushPermissions://` etc per Despia docs)
- Registers player id to backend ONCE per session (avoid repeated registrations)
- Updates heartbeat (`last_seen_at`) on app open
- On logout/account switch: deactivate the device subscription row to prevent ghost notifications

Backend:
- Ensure `push_subscriptions` (or equivalent table) stores:
  - user_id, player_id, is_active, last_seen_at, platform/device info if available
- Add cleanup job (optional): deactivate subscriptions not seen for N days

Notification Centre UI:
- When user toggles a preference:
  - write to backend
  - show immediate feedback
- Show “effective state”:
  Allowed / Muted by preference / Blocked by OS permission / Not registered yet

========================
PHASE 7 — Environment separation (dev/prod)
========================
- Ensure OneSignal app id and REST key are environment-specific (env vars).
- Ensure notification_send_log records environment reliably.
- Ensure dev endpoints do not send via prod OneSignal keys.

========================
PR acceptance criteria checklist
========================
- `notification_catalog/site` builds locally (document in README).
- Every notification type implemented in code has a catalog entry.
- All code paths that send pushes go through the dispatcher.
- Duplicates cannot occur for the same (env, notification_key, event_id, user_id) due to DB uniqueness.
- Every attempted send appears in notification_send_log with correct result.
- OneSignal payloads include collapse_id/thread_id/android_group on every send.
- Registration does not create ghost subscriptions and is once-per-session.
- Notification Centre reflects effective state and remains consistent with backend.

When finished:
- Add a short `docs/NOTIFICATIONS_RUNBOOK.md`:
  - “Why did user get 6 pushes?”
  - “Why did user get none?”
  - “What was sent for match X?”
  Include sample SQL queries against notification_send_log.

Do the work now, in a single focused PR.
