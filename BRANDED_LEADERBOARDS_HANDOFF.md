# Branded Leaderboards — Implementation Handoff

## Status: Implemented and deployed

Branded leaderboards are now implemented across the web app, mobile app, and BFF.

Current production shape:
- Netlify serves the web app at `playtotl.com`
- Railway serves the BFF at `https://totl-despia-production.up.railway.app`
- Admins manage branded leaderboards from the web admin
- Hosts receive a Resend email when added and open a dedicated read-only host review page
- Members join via join code and view the leaderboard in the mobile app flow

This document explains how the system currently works for each party, where the code lives, and what to check when testing or troubleshooting.

---

## What was built

### Party flows

#### Admin

Admins manage branded leaderboards from the existing web admin.

Primary responsibilities:
- create and edit branded leaderboards
- set pricing / RevenueCat offering metadata
- add and remove hosts
- manage join codes
- review revenue and payout information

Primary routes:
- `/admin/leaderboards`
- `/admin/leaderboards/new`
- `/admin/leaderboards/:id`
- `/admin/leaderboards/:id/edit`
- `/admin/leaderboards/:id/revenue`

Access model:
- all admin leaderboard routes stay behind `RequireAuth` + `RequireAdmin`
- admins can also open the host review route because host review access is `host OR admin`

#### Host

Hosts do **not** get admin access.

Primary responsibilities:
- receive a campaign review email when added by an admin
- open the branded leaderboard review page
- review campaign basics, host roster, and default join code

Primary route:
- `/host/leaderboards/:id`

Access model:
- the route is behind `RequireAuth` + `RequireHostOrAdmin`
- access is granted if the signed-in user is either:
  - an admin, or
  - listed in `branded_leaderboard_hosts` for that leaderboard

Important:
- the host route is intentionally read-only
- hosts cannot use admin edit, delete, revenue, or host-management controls unless they are also admins

#### Member / User

Members join branded leaderboards with a join code, then access standings and paid access in the mobile branded leaderboard flow.

Primary actions:
- resolve a join code
- join a branded leaderboard
- activate paid access after a RevenueCat purchase if needed
- view standings and leaderboard access state

---

### 1. Database schema

**File:** `supabase/sql/create_branded_leaderboards.sql`

Creates 8 new tables, adds `is_admin` column to `users`, sets up RLS policies, indexes, and a Supabase Storage bucket for header images.

| Table | Purpose |
|-------|---------|
| `branded_leaderboards` | Core leaderboard entity (name, slug, pricing, visibility, RC offering) |
| `branded_leaderboard_hosts` | Host accounts attached to a leaderboard |
| `branded_leaderboard_memberships` | Users who have joined a leaderboard |
| `branded_leaderboard_subscriptions` | Paid subscription records synced with RevenueCat |
| `branded_leaderboard_join_codes` | Shareable join codes with optional expiry/max uses |
| `branded_leaderboard_payouts` | Revenue share payout records |
| `branded_leaderboard_revenue_events` | Individual revenue events from RC webhooks |
| `branded_leaderboard_metrics` | Aggregated performance metrics |

**RLS approach:**
- Admin writes gated by `is_admin = true` on `public.users`
- Public reads for active leaderboards
- Users can manage their own memberships
- Admin-only access for payouts, revenue events, metrics

This schema file remains the source of truth for the branded leaderboard data model and RLS rules.

---

### 2. Domain types

**File:** `packages/domain/src/index.ts`

Added Zod schemas and TypeScript types for all branded leaderboard entities:
- `BrandedLeaderboardSchema`, `BrandedLeaderboardHostSchema`, `BrandedLeaderboardMembershipSchema`, `BrandedLeaderboardSubscriptionSchema`, `BrandedLeaderboardJoinCodeSchema`
- `BrandedLeaderboardDetailSchema` (composite: leaderboard + hosts + membership + subscription + hasAccess)
- `BrandedLeaderboardStandingsSchema`, `BrandedLeaderboardStandingsRowSchema`
- `BrandedLeaderboardMyItemSchema`, `BrandedLeaderboardPayoutSchema`

**Important:** After editing `packages/domain/src/index.ts`, you must rebuild:
```bash
cd packages/domain && npm run build
```
This was already done during implementation. If you edit the domain types again, rebuild before the api-client or BFF can see the changes.

---

### 3. BFF endpoints

**File:** `apps/bff/src/brandedLeaderboards.ts`

A single module registered in `apps/bff/src/server.ts` via `registerBrandedLeaderboardRoutes(app, env)`.

#### Admin endpoints (require `is_admin = true`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/admin/branded-leaderboards` | List all |
| POST | `/v1/admin/branded-leaderboards` | Create |
| GET | `/v1/admin/branded-leaderboards/:id` | Detail + hosts + codes |
| PUT | `/v1/admin/branded-leaderboards/:id` | Update |
| DELETE | `/v1/admin/branded-leaderboards/:id` | Delete |
| POST | `/v1/admin/branded-leaderboards/:id/hosts` | Add host |
| DELETE | `/v1/admin/branded-leaderboards/:id/hosts/:hostId` | Remove host |
| GET | `/v1/admin/branded-leaderboards/:id/codes` | List codes |
| POST | `/v1/admin/branded-leaderboards/:id/codes` | Generate code |
| PUT | `/v1/admin/branded-leaderboards/:id/codes/:codeId` | Update code |
| GET | `/v1/admin/branded-leaderboards/:id/metrics` | Metrics |
| GET | `/v1/admin/branded-leaderboards/:id/revenue` | Revenue detail |
| GET | `/v1/admin/payouts` | All payouts |
| PUT | `/v1/admin/payouts/:id` | Update payout status |
| GET | `/v1/admin/users/search?q=` | User search for host/owner assignment |
| POST | `/v1/admin/branded-leaderboards/:id/notify-host-review` | Best-effort host review email send |

This host review email endpoint lives in `apps/bff/src/server.ts` rather than `apps/bff/src/brandedLeaderboards.ts`.
It:
- verifies the caller is an admin
- loads the leaderboard name and host email
- sends a direct transactional email via Resend
- links the recipient to `/host/leaderboards/:id`
- does not block host assignment if the email send fails in the web admin flow

#### Host review endpoint (require host or admin)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/host/branded-leaderboards/:id/review` | Read-only host review page payload |

The endpoint returns:
- leaderboard summary
- host list
- default join code

It does **not** expose admin mutation controls.

#### Public endpoints (require auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/branded-leaderboards/:idOrSlug` | Leaderboard detail with access state |
| GET | `/v1/branded-leaderboards/:id/standings` | Standings (scope=gw\|month\|season) |
| GET | `/v1/branded-leaderboards/mine` | User's joined leaderboards |
| GET | `/v1/branded-leaderboards/resolve-code/:code` | Resolve a join code |
| POST | `/v1/branded-leaderboards/:id/join` | Join with code |
| POST | `/v1/branded-leaderboards/:id/leave` | Leave |
| POST | `/v1/branded-leaderboards/:id/activate` | Activate subscription after RC purchase |

#### Webhook

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/webhooks/revenuecat` | Handles RC subscription lifecycle events |

---

### 4. API client

**File:** `packages/api-client/src/index.ts`

7 new methods added to the `createApiClient` return object:
- `getBrandedLeaderboard(idOrSlug)`
- `getBrandedLeaderboardStandings(id, { scope, gw })`
- `getMyBrandedLeaderboards()`
- `resolveJoinCode(code)`
- `joinBrandedLeaderboard(id, code)`
- `leaveBrandedLeaderboard(id)`
- `activateBrandedLeaderboardSubscription(id, { rc_subscription_id, rc_product_id })`

---

### 5. Web admin pages

All behind `RequireAuth` + `RequireAdmin` wrappers.

| Route | File | Purpose |
|-------|------|---------|
| `/admin/dashboard` | `src/pages/admin/AdminDashboard.tsx` | Overview metrics, quick links |
| `/admin/leaderboards` | `src/pages/admin/AdminLeaderboards.tsx` | List all branded leaderboards |
| `/admin/leaderboards/new` | `src/pages/admin/AdminLeaderboardForm.tsx` | Create form |
| `/admin/leaderboards/:id` | `src/pages/admin/AdminLeaderboardDetail.tsx` | Detail view, host management, join codes |
| `/admin/leaderboards/:id/edit` | `src/pages/admin/AdminLeaderboardForm.tsx` | Edit form (reuses create) |
| `/admin/leaderboards/:id/revenue` | `src/pages/admin/AdminLeaderboardRevenue.tsx` | Per-leaderboard revenue |
| `/admin/payouts` | `src/pages/admin/AdminPayouts.tsx` | Cross-leaderboard payouts |
| `/admin/reporting` | `src/pages/admin/AdminReporting.tsx` | Aggregated reporting |
| `/host/leaderboards/:id` | `src/pages/HostLeaderboardReview.tsx` | Read-only host review page |

**Supporting component:** `src/components/RequireAdmin.tsx` — checks `is_admin` column on user, redirects to `/profile` if not admin.

**Supporting component:** `src/components/RequireHostOrAdmin.tsx` — checks whether the signed-in user is an admin or a host for the specific leaderboard route param.

**Routes registered in:** `src/main.tsx` (lazy imports + Route declarations).

### 5a. Host review page

**Files:**
- `src/components/RequireHostOrAdmin.tsx`
- `src/pages/HostLeaderboardReview.tsx`

The host review page shows:
- leaderboard header image, name, slug, description
- pricing, visibility, and status summary
- host roster
- default join code, active state, use count, and expiry

The page is intentionally view-only and exists so hosts can review their campaign without receiving admin access.

---

### 6. Mobile app — RevenueCat integration

| File | Purpose |
|------|---------|
| `apps/mobile/src/lib/purchases.ts` | RC configure, login, logout, getCustomerInfo, fetchOffering, restorePurchases, hasEntitlement |
| `apps/mobile/src/hooks/usePurchases.ts` | React hook: customerInfo state, listener, purchasePackage |
| `apps/mobile/src/hooks/useLeaderboardAccess.ts` | Combined access state check (RC entitlement + BFF membership) |

**API key:** `test_ktmSLccwwyfQkshQQJaPtMqlpeQ` (both platforms, dev mode)

**App lifecycle integration** (in `apps/mobile/src/AppRoot.tsx`):
- `configurePurchases()` called on mount
- `loginPurchases(userId)` called when `authed` becomes true
- `logoutPurchases()` called when `authed` becomes false

**Packages installed:** `react-native-purchases`, `react-native-purchases-ui`, `expo-blur`

---

### 7. Mobile app — Screens and components

#### Screens

| Screen | File | Purpose |
|--------|------|---------|
| BrandedLeaderboardScreen | `apps/mobile/src/screens/brandedLeaderboards/BrandedLeaderboardScreen.tsx` | Main view: header, scope tabs, standings, access states |
| BrandedLeaderboardListScreen | `apps/mobile/src/screens/brandedLeaderboards/BrandedLeaderboardListScreen.tsx` | Card list of user's leaderboards |
| JoinLeaderboardScreen | `apps/mobile/src/screens/brandedLeaderboards/JoinLeaderboardScreen.tsx` | Code entry + join flow |
| BrandedLeaderboardPaywallScreen | `apps/mobile/src/screens/brandedLeaderboards/BrandedLeaderboardPaywallScreen.tsx` | Transparent modal wrapper for paywall |

#### Components

| Component | File | Purpose |
|-----------|------|---------|
| BrandedLeaderboardHeader | `apps/mobile/src/components/brandedLeaderboards/BrandedLeaderboardHeader.tsx` | Header image + title + host badges |
| BrandedLeaderboardTable | `apps/mobile/src/components/brandedLeaderboards/BrandedLeaderboardTable.tsx` | Ranked rows with HOST badges |
| BrandedLeaderboardPaywall | `apps/mobile/src/components/brandedLeaderboards/BrandedLeaderboardPaywall.tsx` | Blurred background + purchase CTA bottom sheet |
| HostBadge | `apps/mobile/src/components/brandedLeaderboards/HostBadge.tsx` | Purple "HOST" pill |

#### Context

| File | Purpose |
|------|---------|
| `apps/mobile/src/context/JoinIntentContext.tsx` | Preserves join intent (code) across auth flow, persists to AsyncStorage |

---

### 8. Mobile app — Navigation changes

**File:** `apps/mobile/src/navigation/AppNavigator.tsx`

New stack screens added:
- `BrandedLeaderboard` → `BrandedLeaderboardScreen`
- `BrandedLeaderboardList` → `BrandedLeaderboardListScreen`
- `JoinLeaderboard` → `JoinLeaderboardScreen`
- `BrandedLeaderboardPaywall` → transparent modal

Deep link handler added for `/join/{code}` routes.

Join intent consumed from `JoinIntentContext` on navigator ready (after auth).

**File:** `apps/mobile/src/navigation/TabsNavigator.tsx`

Conditional 4th tab "Leaderboards" added:
- Only shows when user has 1+ joined leaderboards (checked via React Query `branded-leaderboards-mine`)
- 1 leaderboard → goes directly to that leaderboard screen
- 2+ leaderboards → shows list screen

---

### 9. Mobile app — Settings changes

**File:** `apps/mobile/src/screens/profile/ProfileHomeScreen.tsx`

New "Leaderboards" section added at the top of `accountSections`:
- "My Branded Leaderboards" → navigates to `BrandedLeaderboardList`
- "Restore Purchases" → calls `restorePurchases()` with success/error alert

---

## Testing and operations

### Production deployment model

- Web app: Netlify (`playtotl.com`)
- BFF: Railway (`totl-despia-production.up.railway.app`)
- Mobile app: native shell / Expo build using the production BFF URL

For host review flow changes to work in production, both the web app and BFF must be deployed.

### Core production test flows

#### Admin flow

1. Sign in as an admin on `playtotl.com`
2. Open `/admin/leaderboards`
3. Create or edit a branded leaderboard
4. Add a host
5. Confirm host assignment succeeds even if email delivery later fails

#### Host flow

1. Add a non-admin user as a host from the admin page
2. Confirm the user receives the host review email
3. Confirm the email links to `/host/leaderboards/:id`
4. Sign in as that host
5. Confirm the host review page loads and shows:
   - campaign summary
   - host roster
   - default join code
6. Confirm the host cannot access `/admin/leaderboards/:id` unless they are also an admin

#### Member flow

1. Generate or verify a join code from the admin page
2. Join the leaderboard from the mobile flow
3. Confirm the leaderboard appears in the user’s branded leaderboard list/tab
4. If the leaderboard is paid, confirm the RevenueCat offering and entitlement are configured correctly

### Local development reminders

- Start the BFF with `npm run dev -w apps/bff`
- Start the web app from repo root with `npm run dev`
- If `packages/domain/src/index.ts` changes, rebuild `packages/domain`
- Railway for this monorepo expects the repo-root workspace build, not a standalone `apps/bff` deploy context

---

## Architecture decisions

| Decision | Rationale |
|----------|-----------|
| Web admin in existing web app (`src/pages/admin/`) | Reuses existing Supabase auth, Netlify deploy, Tailwind. Simpler than a separate app for v1. |
| Separate host route (`/host/leaderboards/:id`) instead of reusing the admin page | Hosts need campaign visibility without receiving admin controls. Keeps admin permissions narrow and explicit. |
| `is_admin` column instead of hardcoded IDs | Scalable, queryable, works in RLS policies. |
| BFF module (`brandedLeaderboards.ts`) registered in `server.ts` | Keeps server.ts clean, all branded LB logic isolated. |
| RevenueCat Hybrid model (Option C) | RC handles billing; TOTL backend maps purchases to specific leaderboard access. Allows different prices per leaderboard without managing dozens of RC entitlements. |
| Single `play_totl_pro` entitlement in RC | Simple for v1. Backend checks which leaderboard the subscription covers. Can add a global "TOTL Pro" later. |
| Conditional tab via React Query | Stale time of 5 minutes. No over-fetching. Tab disappears if user leaves all leaderboards. |
| Join intent persisted to AsyncStorage | Survives app restart. Consumed on navigator ready after auth. Handles the "install app → sign up → land in leaderboard" flow. |
| Web admin uses Supabase directly (not BFF) | Consistent with all other web app pages. The BFF admin endpoints exist for programmatic access but the web admin goes direct for simplicity. |
| Host notification uses Resend direct-send instead of MailerLite campaigns | One-off transactional email is simpler, more reliable, and matches the existing chat-reporting send pattern. |

---

## File inventory

### New files created

```
supabase/sql/create_branded_leaderboards.sql

apps/bff/src/brandedLeaderboards.ts

apps/mobile/src/lib/purchases.ts
apps/mobile/src/hooks/usePurchases.ts
apps/mobile/src/hooks/useLeaderboardAccess.ts
apps/mobile/src/context/JoinIntentContext.tsx
apps/mobile/src/screens/brandedLeaderboards/BrandedLeaderboardScreen.tsx
apps/mobile/src/screens/brandedLeaderboards/BrandedLeaderboardListScreen.tsx
apps/mobile/src/screens/brandedLeaderboards/JoinLeaderboardScreen.tsx
apps/mobile/src/screens/brandedLeaderboards/BrandedLeaderboardPaywallScreen.tsx
apps/mobile/src/components/brandedLeaderboards/HostBadge.tsx
apps/mobile/src/components/brandedLeaderboards/BrandedLeaderboardHeader.tsx
apps/mobile/src/components/brandedLeaderboards/BrandedLeaderboardTable.tsx
apps/mobile/src/components/brandedLeaderboards/BrandedLeaderboardPaywall.tsx

src/components/RequireAdmin.tsx
src/components/RequireHostOrAdmin.tsx
src/pages/HostLeaderboardReview.tsx
src/pages/admin/AdminLeaderboards.tsx
src/pages/admin/AdminLeaderboardForm.tsx
src/pages/admin/AdminLeaderboardDetail.tsx
src/pages/admin/AdminLeaderboardRevenue.tsx
src/pages/admin/AdminDashboard.tsx
src/pages/admin/AdminPayouts.tsx
src/pages/admin/AdminReporting.tsx
```

### Existing files modified

```
packages/domain/src/index.ts          — Added all branded leaderboard Zod schemas and types
packages/api-client/src/index.ts      — Added 7 new API client methods
apps/bff/src/server.ts                — Import + register branded leaderboard routes, host review email send
apps/bff/src/brandedLeaderboards.ts   — Admin/public/host review branded leaderboard endpoints
apps/mobile/src/AppRoot.tsx           — RC init, login/logout sync, JoinIntentProvider
apps/mobile/src/navigation/AppNavigator.tsx  — New screens, deep link handler, join intent consumption
apps/mobile/src/navigation/TabsNavigator.tsx — Conditional Leaderboards tab
apps/mobile/src/screens/profile/ProfileHomeScreen.tsx — Leaderboards settings section
src/main.tsx                          — Lazy imports + routes for admin pages and host review page
```

### Packages added

```
react-native-purchases
react-native-purchases-ui
expo-blur
```

---

## Plan reference

The full feature plan is at `.cursor/plans/branded_leaderboards_system_5ac59951.plan.md`. It contains the complete spec including data model tables, Mermaid architecture diagrams, RevenueCat strategy, user journeys, edge cases, and phased rollout timeline. Do not edit this file — use it as a reference.

---

## Known limitations for v1

- **No payout automation** — payouts are manually marked as paid by admin in the web UI.
- **RevenueCat offerings must be created manually** — each paid leaderboard needs products in App Store Connect + RC dashboard.
- **No payout splitting** — one payout owner per leaderboard, not per-host.
- **Web admin uses direct Supabase** — not the BFF admin endpoints (those exist for future programmatic use).
- **No offline standings** — RC caches entitlements locally (access checks work offline), but standings data requires network.
- **Host page is read-only** — hosts can review campaign details but cannot edit settings, hosts, or revenue data unless they are also admins.
