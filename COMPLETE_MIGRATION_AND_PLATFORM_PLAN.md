# Complete Migration & Platform Differentiation Plan
**Status:** Ready for execution  
**Created:** 2025-01-XX  
**Purpose:** Migrate to playtotl.com and implement platform differentiation (web vs native app)

---

## Overview

This plan covers:
1. **Domain Migration**: Make the site work on `playtotl.com` (currently hardcoded to staging)
2. **Platform Differentiation**: Make features work differently for web vs Despia native app

**Current Setup:**
- **Repository V2:** `totl433/totl-despia` (this codebase - staging codebase)
- **Repository V1:** `sotbjof/totl-web` (V1 codebase - currently on playtotl.com)
- **Netlify Staging:** `totl-staging.netlify.app` (currently where Despia connects, serves V2)
- **Netlify Production:** `playtotl.com` (currently serves V1 from `sotbjof/totl-web`)
- Both are separate Netlify projects

**Migration Goal:**
- **Main Repository:** Use `totl433/totl-despia` as the main repo (move away from `sotbjof`)
- **Production:** Replace V1 on playtotl.com with V2 (from `totl433/totl-despia`)
- **Staging:** `totl-staging.netlify.app` stays the same URL (just points to `totl433/totl-despia`)
- **Despia:** Switch connection from staging to playtotl.com
- **After migration:** 
  - Both web and Despia use playtotl.com (production)
  - Staging (`totl-staging.netlify.app`) remains available for testing
  - Archive `sotbjof/totl-web` as V1 backup (keep but don't use)

**Repository Strategy:**
- `totl433/totl-despia` = Main repository (single source of truth)
  - `main` branch → playtotl.com (production)
  - `staging` branch → totl-staging.netlify.app (testing)
- `sotbjof/totl-web` = Archived V1 (backup only, not actively used)

**Timeline:** Flexible - start code changes today, test as we go, complete before next Gameweek

**Important:** Backup V1 before migration (for potential rollback) - V1 code remains in `sotbjof/totl-web`

---

# PART 1: DOMAIN MIGRATION

## Phase 1: Code Updates (Frontend)

### What This Means (Idiots Guide)
Right now, some code says "go to totl-staging.netlify.app" hardcoded. We need to change it so it works on playtotl.com too.

**Think of it like:** Instead of saying "go to John's house at 123 Main St", we say "go to the current house" - so it works whether you're at John's house or a new house.

### Files to Update

1. **`src/lib/pushNotificationsV2.ts`** (3 places)
   - **What it does:** Registers devices for push notifications
   - **Change:** Already uses relative paths (empty string), but verify it's correct
   - **Lines:** 182, 375, 412

2. **`src/lib/pushNotifications.ts`** (1 place)
   - **What it does:** Legacy push notification registration
   - **Change:** Same as above - verify relative paths work
   - **Line:** 149

3. **`src/pages/ApiAdmin.tsx`** (1 place)
   - **What it does:** Admin page for testing API calls
   - **Change:** Update localhost fallback to use `window.location.origin` instead of hardcoded staging
   - **Line:** 59

4. **`src/pages/AdminData.tsx`** (1 place)
   - **What it does:** Admin data debugging page
   - **Change:** Replace hardcoded staging URL with relative path
   - **Line:** 805

5. **`src/features/auth/useSupabaseAuth.ts`** (2 places)
   - **What it does:** Checks if email is available during signup
   - **Change:** Replace hardcoded staging URL with `window.location.origin`
   - **Lines:** 190, 241

6. **`src/pages/EmailPreferences.tsx`** (1 place)
   - **What it does:** Syncs email preferences
   - **Change:** Already uses relative path for production, but verify
   - **Line:** 66

7. **`vite.config.ts`** (1 place)
   - **What it does:** Development server proxy configuration
   - **Change:** Keep staging for dev proxy (that's fine), or make it configurable
   - **Line:** 22

### How We'll Fix It

**Pattern for frontend:**
```typescript
// Instead of: 'https://totl-staging.netlify.app'
// Use: window.location.origin (gets current domain automatically)
// Or: '' (empty string = relative path, works on any domain)

const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';
// Empty string = relative path = works on playtotl.com automatically
```

---

## Phase 2: Code Updates (Backend/Netlify Functions)

### What This Means (Idiots Guide)
Backend functions (server code) also have hardcoded staging URLs as fallbacks. Netlify automatically gives us the current site URL, so we should use that instead.

**Think of it like:** The server knows what address it's at, we just need to use that instead of assuming it's always staging.

### Files to Update

These files already check `process.env.URL` first (which Netlify provides automatically), but have staging as a fallback. We'll make the fallback safer:

1. **`netlify/functions/sendPredictionReminder.ts`** (line 46)
2. **`netlify/functions/notifyLeagueMemberJoin.ts`** (line 45)
3. **`netlify/functions/notifyLeagueMessage.ts`** (line 34)
4. **`netlify/functions/notifyLeagueMessageV2.ts`** (line 152)
5. **`netlify/functions/notifyFinalSubmission.ts`** (line 43)

### How We'll Fix It

**Pattern for backend:**
```typescript
// Netlify automatically sets process.env.URL to the site's URL
const baseUrl = process.env.URL || process.env.SITE_URL || process.env.DEPLOY_PRIME_URL;
// This automatically gets playtotl.com when deployed there
// Gets totl-staging.netlify.app when deployed to staging
```

---

## Phase 3: Supabase Webhook Updates

### What This Means (Idiots Guide)
Supabase (your database) has webhooks that automatically call your Netlify functions when data changes (like when a live score updates). Right now, these webhooks point to totl-staging.netlify.app. After migration, they need to point to playtotl.com.

**Think of it like:** You have a doorbell that rings a phone. Right now it's set to ring John's phone (staging). We need to change it to ring the new phone (production - playtotl.com).

**Note:** Currently Despia connects to staging, but after migration it will connect to playtotl.com. Webhooks should point to production (playtotl.com) where Despia will be.

### How to Check Current Setup

1. **Check Supabase Dashboard:**
   - Go to Supabase Dashboard → Database → Webhooks
   - Look for webhook named "live_scores_notifications" or similar
   - Note the current URL

2. **Check SQL Functions:**
   - Review `supabase/sql/create_live_scores_webhook.sql`
   - Review `supabase/sql/update_webhook_to_v2.sql`
   - These contain hardcoded staging URLs

### How to Update

**Option A: If using Supabase Dashboard webhooks:**
- Update URL from `https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhookV2`
- To: `https://playtotl.com/.netlify/functions/sendScoreNotificationsWebhookV2`

**Option B: If using SQL function (pg_net):**
- Update SQL files with new URL
- Run updated SQL in Supabase SQL Editor

### Files to Update

1. **`supabase/sql/create_live_scores_webhook.sql`** (line 26)
2. **`supabase/sql/update_webhook_to_v2.sql`** (lines 10, 47)

---

## Phase 4: Testing & Deployment

### What This Means (Idiots Guide)
Before we go live, we need to test everything works. Then deploy to playtotl.com.

### Testing Checklist

**Pre-Migration (on staging):**
- [ ] Test push notification registration
- [ ] Test email availability check
- [ ] Test email preferences sync
- [ ] Verify all functions work with relative paths

**Post-Migration (on production):**
- [ ] Test push notification registration
- [ ] Test email availability check
- [ ] Test email preferences sync
- [ ] Verify webhook delivery (check Supabase logs)
- [ ] Test all notification functions

### Deployment Steps

1. **Backup V1:** Create backup of current playtotl.com (V1) before migration
2. **Code Changes:** Update all files, test on staging
3. **Webhook Updates:** Update Supabase webhooks to point to playtotl.com
4. **Production Deploy:** Deploy V2 to playtotl.com Netlify project (replaces V1)
5. **Despia Configuration:** Update Despia to connect to playtotl.com instead of staging
6. **Monitor:** Watch for errors, verify everything works

---

# PART 2: PLATFORM DIFFERENTIATION

## Phase 5: Platform Detection Utility

### What This Means (Idiots Guide)
We need a way to detect if the user is on web or in the Despia app. This detection is based on whether Despia APIs are available (not the domain), so it works on playtotl.com for both web and app.

**Think of it like:** Checking if someone has a special key (Despia APIs). If they have the key, they're in the app. If not, they're on web.

### What We'll Do

1. **Create `src/lib/platform.ts`**
   - Export `isNativeApp()` - returns true if Despia APIs available
   - Export `isWebBrowser()` - returns true if NOT in app
   - This centralizes the detection logic

2. **Update existing code**
   - Replace direct `isDespiaAvailable()` calls with `isNativeApp()` where needed

### Files to Create
- `src/lib/platform.ts`

---

## Phase 6: Hide Notification Centre on Web

### What This Means (Idiots Guide)
Push notifications only work in the Despia app, not on web. So we should hide the Notification Centre menu item on web browsers.

**Think of it like:** Hiding a TV remote control button that doesn't work on that TV model.

### What We'll Do

1. **Hide menu item in Profile page**
   - Check if `isWebBrowser()` is true
   - If yes, don't show Notification Centre menu item

2. **Add route protection (optional)**
   - If someone tries to go to `/profile/notifications` on web, redirect them

### Files to Modify
- `src/pages/Profile.tsx`
- `src/main.tsx` (optional route protection)

---

## Phase 7: App Promotion Modal (Web Only)

### What This Means (Idiots Guide)
Show a popup on web browsers (not in app) encouraging users to download the app. Shows on first visit/login.

**Think of it like:** A sign at the entrance saying "Hey, we have an app that's even better! Want to download it?"

### What We'll Do

1. **Create App Promotion Modal Component**
   - Shows only on web (`isWebBrowser()`)
   - Shows on first visit/login
   - Has "Download App" button (placeholder until we have app store links)
   - Has "Maybe Later" and "Don't show again" options

2. **Design**
   - Match TOTL brand colors
   - Non-intrusive modal overlay
   - Mobile-responsive

### Files to Create
- `src/components/AppPromotionModal.tsx`
- `src/components/AppPromotionModal.stories.tsx`

### Files to Modify
- `src/main.tsx` (add modal component)

---

## Phase 8: Cookie Consent Banner (Web Only)

### What This Means (Idiots Guide)
Websites need to ask for cookie consent (GDPR/CCPA law). Apps don't need this because they handle it differently. So we show a cookie banner on web only.

**Think of it like:** A "Do you accept cookies?" popup that websites have, but apps don't need.

### What We'll Do

1. **Create Cookie Consent Component**
   - Loads Termly script (cookie consent service)
   - Only loads on web (`isWebBrowser()`)
   - Termly handles the banner automatically

2. **Integration**
   - Add to main app component
   - Loads immediately on page load (for web users)

### Files to Create
- `src/components/CookieConsent.tsx`

### Files to Modify
- `src/main.tsx` (add cookie consent component)

**Note:** We'll ask about analytics/tracking when we implement this (Termly blocks cookies until consent).

---

## Phase 9: WhatsApp Share Links

### What This Means (Idiots Guide)
WhatsApp sharing works differently in the app vs web:
- **In Despia app:** Uses `whatsapp://` deep links (opens WhatsApp app directly)
- **On web:** Uses `https://wa.me/` web links (opens WhatsApp web)

**Think of it like:** In the app, you can call WhatsApp directly. On web, you have to go through the website.

### Current Status
✅ **Already implemented correctly!** 
- File: `src/lib/whatsappShare.ts`
- Already detects platform and uses correct link type
- No changes needed

---

## Phase 10: Universal Links / App Links (Post-Migration)

### What This Means (Idiots Guide)
When someone shares a mini-league link like `https://playtotl.com/league/ABC123`, we want it to:
- **If receiver has app installed:** Open in the app automatically
- **If receiver doesn't have app:** Open in web browser

**Think of it like:** Smart links that know whether to open the app or the website.

### What We'll Do

1. **iOS Universal Links**
   - Create `apple-app-site-association` file
   - Place at: `https://playtotl.com/.well-known/apple-app-site-association`
   - Configure in Despia app settings

2. **Android App Links**
   - Create `assetlinks.json` file
   - Place at: `https://playtotl.com/.well-known/assetlinks.json`
   - Configure in Despia app settings

3. **Despia App Configuration**
   - Register `playtotl.com` domain in Despia
   - Configure which paths open in app (e.g., `/league/:code`)

### Files to Create
- `public/.well-known/apple-app-site-association` (iOS)
- `public/.well-known/assetlinks.json` (Android)

### Prerequisites
- Migration to playtotl.com completed ✅
- Despia app configured to handle deep links
- App store links available

### Status
⏳ Planned for after domain migration

---

## Phase 11: Testing Checklist (Platform Differentiation)

### Platform Detection
- [ ] `isNativeApp()` returns `true` in Despia app
- [ ] `isNativeApp()` returns `false` in web browser
- [ ] `isWebBrowser()` returns opposite of `isNativeApp()`

### Notification Centre
- [ ] Notification Centre menu item hidden on web
- [ ] Notification Centre menu item visible in native app
- [ ] Direct navigation to `/profile/notifications` on web redirects (if implemented)

### App Promotion Modal
- [ ] Modal shows on first visit (web only)
- [ ] Modal shows on first login (web only)
- [ ] Modal does NOT show in native app
- [ ] "Maybe Later" dismisses for current session only
- [ ] "Don't show again" permanently dismisses

### Cookie Consent
- [ ] Cookie consent banner appears on web (first visit)
- [ ] Cookie consent banner does NOT appear in native app
- [ ] Banner can be dismissed/accepted
- [ ] Consent preference persists across sessions

### WhatsApp Share
- [ ] In Despia app: Uses `whatsapp://` deep links ✅ (already working)
- [ ] On web: Uses `https://wa.me/` web links ✅ (already working)

### Universal Links (Future)
- [ ] iOS: League links open in app if installed
- [ ] Android: League links open in app if installed
- [ ] Fallback: Opens in web if app not installed

---

## Execution Order

### Domain Migration (Do First)
1. Phase 1: Frontend code updates
2. Phase 2: Backend code updates
3. Phase 3: Supabase webhook updates
4. Phase 4: Testing & deployment

### Platform Differentiation (Do After Migration)
5. Phase 5: Platform detection utility
6. Phase 6: Hide Notification Centre
7. Phase 8: Cookie consent (legal requirement)
8. Phase 7: App promotion modal
9. Phase 9: WhatsApp share (already done ✅)
10. Phase 10: Universal Links (future)
11. Phase 11: Testing

---

## Success Criteria

### Domain Migration
- ✅ All hardcoded staging URLs replaced
- ✅ Relative paths work on both staging and production
- ✅ Supabase webhooks point to production
- ✅ All notification functions work correctly
- ✅ No errors in production logs

### Platform Differentiation
- ✅ Notification Centre hidden on web
- ✅ App promotion modal shows on web first visit/login
- ✅ Cookie consent banner appears on web
- ✅ All features work correctly in native app (no regressions)
- ✅ Platform detection works correctly on playtotl.com

---

## Notes

- **Repository:** `totl433/totl-despia` is the main repository (single source of truth)
- **Current State:** Despia connects to staging, playtotl.com has V1 from `sotbjof/totl-web`
- **After Migration:** Both web and Despia use playtotl.com (V2 from `totl433/totl-despia`)
- **Staging:** `totl-staging.netlify.app` remains available for testing (same URL, points to `totl433/totl-despia`)
- **V1 Backup:** V1 code remains in `sotbjof/totl-web` repository (archived, not deleted)
- **Netlify Sites:** Both staging and production Netlify sites connect to `totl433/totl-despia` (different branches)
- **Platform Detection:** Works on any domain (API-based, not domain-based)
- **WhatsApp Share:** Already implemented correctly, no changes needed
- **Universal Links:** Requires Despia app configuration, planned for after migration
- **Timeline:** Flexible - start code changes today, test as we go

---

## Related Documentation

- `PROJECT_CONTEXT.md` - Platform Differentiation section
- `PR.md` - Updated rule #5 for platform-aware development
- `PLATFORM_DIFFERENTIATION_PLAN.md` - Original detailed plan
- `GAME_STATE.md` - Game state system (unaffected by these changes)
