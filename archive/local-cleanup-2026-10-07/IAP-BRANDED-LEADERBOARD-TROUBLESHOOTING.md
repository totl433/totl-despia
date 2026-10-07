# IAP & Branded Leaderboard Troubleshooting Guide

Reference document from the April 2026 debugging session that brought the full purchase → activate → leaderboard flow end-to-end.

---

## 1. StoreKit / In-App Purchase Setup

### What went wrong
Products weren't loading in the app. RevenueCat reported missing products.

### Root causes
- The StoreKit Configuration file (`.storekit`) had incorrect product types (Auto-Renewable Subscription instead of Non-Consumable).
- Product IDs in the `.storekit` file didn't match what was registered in App Store Connect.
- The RevenueCat public certificate (exported from the `.storekit` file) hadn't been uploaded to the RevenueCat dashboard.

### How to fix
1. **StoreKit Config must match App Store Connect exactly** — product IDs, product types, and pricing must be identical.
2. Season passes use **Non-Consumable** type (one-time purchase, no expiration), not Auto-Renewable Subscription.
3. After creating or modifying a `.storekit` file, export the public certificate (right-click in Xcode → "Export Public Certificate") and upload it to **RevenueCat → Project Settings → Apps → [Your App] → StoreKit certificate**.
4. In RevenueCat, verify the **Offering** contains the correct **Package** pointing to the correct **Product** (with matching product ID).
5. The entitlement identifier in RevenueCat must match what the app checks for (e.g., `season_access`).

### Key files
- `ios/totldespia/Products.storekit`
- `src/features/paywall/`

---

## 2. BFF Error Handler — `[object Object]`

### What went wrong
The BFF returned `[object Object]` as error messages instead of human-readable strings.

### Root cause
The global error handler did `String(err)` on caught errors. Supabase client throws `PostgrestError` objects (plain objects, **not** `Error` instances), so `String({...})` produces `[object Object]`.

### Fix applied

```typescript
// Before
const message = err instanceof Error ? err.message : String(err);

// After
const message = err instanceof Error
  ? err.message
  : (typeof err === 'object' && err !== null && 'message' in err)
    ? (err as any).message
    : String(err);
```

### How to fix in the future
- Any time you see `[object Object]` in an error response, the issue is error serialization.
- Supabase errors are `PostgrestError` objects with `.message`, `.details`, `.hint`, and `.code` — they are **not** instances of `Error`.
- Always check for a `.message` property before falling back to `String()`.

### Key file
`bff/src/index.ts` (global error handler)

---

## 3. Missing Error Check on Supabase Calls

### What went wrong
The `/activate` endpoint silently swallowed errors when upserting into `branded_leaderboard_subscriptions`.

### Root cause
The code did `await supabase.from(...).upsert(...)` but never checked the returned `{ error }`.

### Fix applied
Added error check after the upsert call, throwing if it fails.

### Critical pattern
**Every** Supabase query must destructure and check `{ error }`. The Supabase JS client does **not** throw on query errors — it returns them in the response object.

```typescript
const { data, error } = await supabase.from('table').select('*');
if (error) throw error;
```

### Key file
`bff/src/routes/activate.ts`

---

## 4. Database Constraints & RLS Policies

### What went wrong
Duplicate rows appeared in `branded_leaderboard_subscriptions`, and permission-denied errors occurred on insert.

### Fixes applied
- Added `UNIQUE(leaderboard_id, user_id)` constraint on `branded_leaderboard_subscriptions` (also enables `upsert` with `onConflict`).
- Added RLS **INSERT** policy: users can insert rows where `user_id = auth.uid()`.
- Added RLS **UPDATE** policy: users can update their own rows.

### How to fix in the future
- `duplicate key` errors → check that the table has the appropriate unique constraint.
- `new row violates row-level security policy` → check RLS policies in **Supabase Dashboard → Authentication → Policies**.
- For user-facing tables, you typically need SELECT, INSERT, UPDATE, and sometimes DELETE policies.
- **Upsert requires both INSERT and UPDATE policies**, plus a unique constraint on the conflict columns.

---

## 5. PostgREST Join Ambiguity

### What went wrong
Standings query failed with an ambiguous relationship error when joining `users`.

### Root cause
PostgREST couldn't determine which foreign key to use when `branded_leaderboard_subscriptions` had multiple possible relationships to `users` (via `public.users` and `auth.users`).

### Fix applied
Separated the query into two calls — first fetch subscriptions, then fetch user details with an `in` filter on user IDs.

### How to fix in the future
If you get `Could not embed because more than one relationship was found`, either:
1. Use the `!foreign_key_name` hint syntax:
   ```typescript
   .select('*, users!branded_leaderboard_subscriptions_user_id_fkey(*)')
   ```
2. Split into two queries (simpler, avoids PostgREST quirks).

Check foreign key names in **Supabase Dashboard → Database → Tables → [table] → Foreign Keys**.

---

## 6. Mobile App UX Fixes

### Paywall decoupling
Purchase success and BFF activation are now independent. If the purchase succeeds but activation fails, the user sees a success message with a note that leaderboard access may take a moment. This prevents users from thinking their purchase failed.

### Join code text field
- Added paste support.
- Set `letterSpacing: 0` to prevent cursor offset issues on iOS.

### Key files
- `src/features/paywall/PaywallSheet.tsx`
- `src/features/join/JoinLeaderboardScreen.tsx`

---

## Quick Debugging Checklist

| Symptom | Likely Cause | Where to Look |
|---|---|---|
| Products not loading | StoreKit config mismatch | `.storekit` file vs App Store Connect |
| `[object Object]` in errors | Error serialization | BFF error handler in `bff/src/index.ts` |
| Silent failures after Supabase calls | Missing `{ error }` check | Any BFF route |
| `row-level security policy` error | Missing RLS policy | Supabase Dashboard → Policies |
| `duplicate key` error | Missing unique constraint | Supabase Dashboard → Tables |
| Ambiguous join error | Multiple FKs to same table | PostgREST query; split into two queries |
| Purchase succeeds but nothing happens | BFF activation failed silently | BFF `/activate` endpoint + app error handling |
