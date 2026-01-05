# Platform Differentiation Implementation Plan
**Status:** ⏳ Planned (Ready for execution after migration to playtotl.com)  
**Created:** 2025-01-XX  
**Purpose:** Ensure proper platform differentiation between web and Despia native app, add cookie consent, and promote app downloads on web

---

## Prerequisites

- ✅ Migration to playtotl.com completed
- ✅ Complete backup of V1 created and verified (for potential rollback)
- ⏳ App Store links obtained (iOS and Android) - *Placeholder text will be used initially*

---

## Phase 1: Platform Detection Utility

### Goal
Centralize platform detection logic for consistent use across the entire app.

### Tasks

1. **Create `src/lib/platform.ts`**
   - Export `isNativeApp()` function - returns boolean (uses `isDespiaAvailable()`)
   - Export `isWebBrowser()` function - returns `!isNativeApp()`
   - Add JSDoc comments explaining usage

2. **Update existing imports**
   - Replace direct `isDespiaAvailable()` calls with `isNativeApp()` where appropriate
   - Files to check: `src/pages/Profile.tsx`, `src/lib/whatsappShare.ts` (already uses it, but verify)

### Files to Create/Modify
- **Create**: `src/lib/platform.ts`
- **Verify**: Existing platform detection usage throughout codebase

---

## Phase 2: Hide Notification Centre on Web

### Goal
Hide notification-related UI completely on web platforms (push notifications only work in native app).

### Tasks

1. **Hide Notification Centre menu item in Profile**
   - **File**: `src/pages/Profile.tsx`
   - Conditionally exclude the notification menu item when `isWebBrowser() === true`
   - Location: Lines 116-123 (menuItems array)

2. **Add route protection (optional safety)**
   - **File**: `src/main.tsx` or create redirect component
   - If user navigates directly to `/profile/notifications` on web, redirect to `/profile`

### Files to Modify
- `src/pages/Profile.tsx` (remove notification menu item on web)
- `src/main.tsx` (add redirect protection for notification route - optional)

---

## Phase 3: App Promotion Modal (Web Only)

### Goal
Show an app promotion modal on first visit/login for web users, encouraging them to download the app for better experience and notifications.

### Tasks

1. **Create App Promotion Modal Component**
   - **File**: `src/components/AppPromotionModal.tsx`
   - Based on `FirstVisitInfoBanner` pattern (modal overlay with backdrop)
   - **Features**:
     - Centered modal with backdrop blur (similar to `ConfirmationModal` styling)
     - Key benefits messaging: notifications, better experience, live updates, etc.
     - "Download App" button (placeholder text for now, will be replaced with app store links later)
     - "Maybe Later" button (dismisses for current session only)
     - "Don't show again" link (permanent dismiss via localStorage)
     - Shows ONLY on web (`isWebBrowser()`)
     - Shows on first visit OR first login (track via localStorage key)

2. **Design Specifications**
   - Use `FirstVisitInfoBanner` styling pattern (rounded-2xl, shadow-2xl, backdrop-blur)
   - Match TOTL brand colors (`#1C8376` for primary buttons)
   - Include app icon/screenshot placeholder
   - **Message text**: "Get the TotL app for push notifications, live score updates, and the best experience! Download now to never miss a gameweek."
   - Industry standard: Non-intrusive, clear value proposition, easy dismissal

3. **Integration**
   - Add to `src/main.tsx` in `AppContent` component
   - Show after user is authenticated (check `user` exists)
   - localStorage key: `appPromotionDismissed` or `appPromotionSeen`

4. **Create Storybook story**
   - **File**: `src/components/AppPromotionModal.stories.tsx`

### Files to Create
- `src/components/AppPromotionModal.tsx`
- `src/components/AppPromotionModal.stories.tsx`

### Files to Modify
- `src/main.tsx` (add AppPromotionModal component)

### Industry Standard Features
- ✅ Non-intrusive modal overlay
- ✅ Clear value proposition
- ✅ Easy dismissal options
- ✅ One-time display (respects "don't show again")
- ✅ Mobile-responsive

---

## Phase 4: Cookie Consent Banner (Web Only)

### Goal
Implement GDPR/CCPA-compliant cookie consent on web platform only.

### Tasks

1. **Create Cookie Consent Component**
   - **File**: `src/components/CookieConsent.tsx`
   - Load Termly resource blocker script
   - **Script URL**: `https://app.termly.io/resource-blocker/38809fcc-d539-485d-9d06-ac8990b76555?autoBlock=on`
   - Only load when `isWebBrowser() === true`
   - Use `useEffect` to inject script into document head
   - Check if script already exists before adding (id: `termly-cookie-consent`)

2. **Integration**
   - Add to `src/main.tsx` in `AppContent` (early in component tree)
   - Should load immediately on page load (for web users)

3. **Styling**
   - Termly handles banner styling automatically
   - Verify banner matches TOTL colors (may need Termly dashboard customization)
   - Default Termly banner appears at bottom of screen

4. **Analytics Integration (Future)**
   - ⚠️ **REMINDER**: Ask user about analytics/tracking when executing this phase
   - Ensure analytics only load after cookie consent (Termly handles this with `autoBlock=on`)

### Files to Create
- `src/components/CookieConsent.tsx`

### Files to Modify
- `src/main.tsx` (add CookieConsent component)

---

## Phase 5: Testing Checklist

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
- [ ] Modal styling matches TOTL brand
- [ ] Modal is responsive (mobile/desktop)
- [ ] "Download App" button placeholder text visible (will be replaced with links)

### Cookie Consent
- [ ] Cookie consent banner appears on web (first visit)
- [ ] Cookie consent banner does NOT appear in native app
- [ ] Banner appears at bottom of screen (Termly default)
- [ ] Banner styling acceptable (verify with user)
- [ ] Banner can be dismissed/accepted
- [ ] Consent preference persists across sessions

### Cross-Platform
- [ ] All features work correctly in native app (no regressions)
- [ ] All features work correctly on web
- [ ] No console errors in either platform
- [ ] Performance acceptable (no slowdowns)

---

## Phase 6: Domain Migration Considerations

### Backup V1
- [ ] Complete backup of current V1 site (playtotl.com)
- [ ] Backup stored in safe location (git branch, separate repo, or documented location)
- [ ] Rollback procedure documented

### URL Updates (if needed)
- [ ] Review hardcoded URLs pointing to `totl-staging.netlify.app`
- [ ] Update environment variables if domain-specific
- [ ] Check Netlify configuration for domain settings
- [ ] Verify all internal links work with new domain

---

## Notes & Reminders

1. **Analytics**: Ask user about analytics/tracking when executing Phase 4 (cookie consent)
2. **App Store Links**: App promotion modal uses placeholder text until links are available
3. **Termly Styling**: Verify cookie banner styling matches brand (may need Termly dashboard customization)
4. **Testing**: Execute full testing checklist before deployment
5. **Storybook**: Create Storybook stories for new components (AppPromotionModal)

---

## Execution Order

1. **Phase 1**: Platform Detection Utility (foundation for everything else)
2. **Phase 2**: Hide Notification Centre (simple change)
3. **Phase 4**: Cookie Consent (critical for legal compliance)
4. **Phase 3**: App Promotion Modal (user experience enhancement)
5. **Phase 5**: Testing (before deployment)
6. **Phase 6**: Domain migration (separate process, but verify backups)

---

## Estimated Complexity

- **Phase 1**: Low (~15 minutes)
- **Phase 2**: Low (~15 minutes)
- **Phase 3**: Medium (~1-2 hours)
- **Phase 4**: Low (~30 minutes)
- **Phase 5**: Medium (depends on thoroughness)
- **Phase 6**: Low-Medium (mainly verification)

**Total Estimated Time**: 2-3 hours (excluding testing)

---

## Success Criteria

✅ Notification Centre hidden on web  
✅ App promotion modal shows on web first visit/login  
✅ Cookie consent banner appears on web  
✅ All features work correctly in native app (no regressions)  
✅ Code follows existing patterns and conventions  
✅ All new components have Storybook stories  
✅ Testing checklist completed  

---

## Related Documentation

- `PROJECT_CONTEXT.md` - Platform Differentiation section
- `PR.md` - Updated rule #5 for platform-aware development
- `GAME_STATE.md` - Game state system (unaffected by platform changes)

---

**Ready for execution after migration to playtotl.com and when app store links are available.**




