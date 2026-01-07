# Button Font Weight Audit Report

## Current Button Font Weight Usage

### Category 1: Primary Action Buttons (Main CTAs)
**Current weights found:**
- `font-bold` - Used in:
  - `src/pages/Predictions.tsx:2224` - "SUBMIT YOUR PREDICTIONS" button
  - `src/pages/League.tsx:3096,3115,3128,3140` - Menu buttons (View Results, View Picks, etc.)
  - `src/pages/League.tsx:3152` - Delete League button

- `font-semibold` - Used in:
  - `src/features/auth/SignInForm.tsx:78` - "Sign in" button
  - `src/components/predictions/ConfirmationModal.tsx:56` - "Close" button
  - `src/pages/League.tsx:2073` - "Share League Code" button
  - `src/components/GamesSection.tsx:686` - "Share" button

**Recommendation:** Standardize to `font-semibold` for all primary action buttons

---

### Category 2: Secondary Action Buttons (Cancel, Close, etc.)
**Current weights found:**
- `font-medium` - Used in:
  - `src/pages/Predictions.tsx:2229` - "Cancel" button
  - `src/components/PickButton.tsx:28` - Pick buttons (Home/Draw/Away)
  - `src/components/league/SubmissionStatusTable.tsx:105,181` - "Share Reminder" buttons
  - `src/pages/League.tsx:3318,3337` - "Remove" and "End League" buttons
  - `src/pages/League.tsx:3406` - "Remove" badge button

**Recommendation:** Keep `font-medium` for secondary actions

---

### Category 3: Tab/Filter Buttons
**Current weights found:**
- `font-semibold` - Used in:
  - `src/pages/League.tsx:3173,3193,3227,3246` - Tab buttons (Chat, GWR, GW, MLT)
  - `src/components/LeaderboardTabs.tsx` - Tab buttons

**Recommendation:** Keep `font-semibold` for tabs (provides clear hierarchy)

---

### Category 4: Icon-Only Buttons
**Current weights found:**
- `font-bold` - Used in:
  - `src/pages/_unused/SwipePredictions.tsx:2078,459` - Close (✕) buttons

- No font weight specified (inherits) - Most icon buttons

**Recommendation:** No font weight needed for icon-only buttons

---

## Summary by File

### Files with Multiple Button Font Weights:

1. **`src/pages/League.tsx`**
   - `font-bold` - Menu buttons (lines 3096, 3115, 3128, 3140, 3152)
   - `font-semibold` - Share League Code (2073), Tabs (3173, 3193, 3227, 3246)
   - `font-medium` - Remove/End League buttons (3318, 3337, 3406)

2. **`src/pages/Predictions.tsx`**
   - `font-bold` - Submit button (2224)
   - `font-medium` - Cancel button (2229)

3. **`src/components/league/SubmissionStatusTable.tsx`**
   - `font-medium` - Share Reminder buttons (105, 181)

4. **`src/components/PickButton.tsx`**
   - `font-medium` - Pick buttons (28)

5. **`src/features/auth/SignInForm.tsx`**
   - `font-semibold` - Sign in button (78)

6. **`src/components/predictions/ConfirmationModal.tsx`**
   - `font-semibold` - Close button (56)

7. **`src/components/GamesSection.tsx`**
   - `font-medium` - Share button (686)

---

## Proposed Standardization

### Standard 1: Primary Action Buttons
**Weight:** `font-semibold`
**Usage:** Main CTAs, submit buttons, primary actions
**Files to update:**
- `src/pages/Predictions.tsx:2224` - Change `font-bold` → `font-semibold`
- `src/pages/League.tsx:3096,3115,3128,3140` - Change `font-bold` → `font-semibold`
- `src/pages/League.tsx:3152` - Change `font-bold` → `font-semibold` (or keep bold for destructive?)

### Standard 2: Secondary Action Buttons
**Weight:** `font-medium`
**Usage:** Cancel, close, secondary actions
**Status:** ✅ Already consistent

### Standard 3: Tab/Filter Buttons
**Weight:** `font-semibold`
**Usage:** Navigation tabs, filter buttons
**Status:** ✅ Already consistent

### Standard 4: Destructive Actions
**Weight:** `font-semibold` or `font-bold`?
**Usage:** Delete, remove, end league
**Files to review:**
- `src/pages/League.tsx:3152` - Delete League (currently `font-bold`)
- `src/pages/League.tsx:3318,3337,3406` - Remove/End League (currently `font-medium`)

**Question:** Should destructive actions be `font-bold` for emphasis, or `font-semibold` for consistency?

---

## Next Steps

1. Decide on destructive action button weight (bold vs semibold)
2. Update primary action buttons to `font-semibold`
3. Review each change one by one for user approval




