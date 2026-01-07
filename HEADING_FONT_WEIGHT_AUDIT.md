# Heading Font Weight Audit Report

## Current Heading Font Weight Usage

### Category 1: Page Titles (H1 - Largest)
**Current weights found:**
- `font-extrabold` - Used in:
  - `src/pages/Predictions.tsx:2430` - "Predictions" page title (text-3xl sm:text-4xl)
  - `src/pages/_unused/TestApiPredictions.tsx:2133` - Test page title

- `font-bold` - Used in:
  - `src/pages/AdminData.tsx:139` - "Admin Data" title (text-2xl sm:text-3xl)
  - `src/features/auth/ResetPasswordForm.tsx:98,122,166` - Auth page titles (text-2xl)
  - `src/components/ErrorBoundary.tsx:38` - Error title (text-xl)
  - `src/features/auth/EmailConfirmation.tsx:34` - Email confirmation (text-2xl)
  - `src/pages/CookiePolicy.tsx:86` - Cookie Policy (text-2xl)

- `font-semibold` - Used in:
  - `src/pages/Admin.tsx:375` - "⚙️ Admin" (text-2xl)
  - `src/context/UserContext.tsx:333` - League name (text-2xl)

- `font-normal` - Used in:
  - `src/features/auth/SignInForm.tsx:46` - "Sign in" (text-[40px])
  - `src/features/auth/SignUpForm.tsx:68` - "Sign up" (text-[40px])
  - `src/pages/League.tsx:3052` - League name in header (text-lg)

**Recommendation:** Standardize to `font-semibold` for all page titles (H1)

---

### Category 2: Section Titles (H2 - Large Sections)
**Current weights found:**
- `font-bold` - Used in:
  - `src/pages/League.tsx:3301` - "League Management" modal (text-2xl)
  - `src/pages/League.tsx:3382` - "League Badge" modal (text-xl)
  - `src/components/Section.tsx:66` - Section component title (text-lg)
  - `src/DesignTokens.stories.tsx:38,128,440` - Storybook section titles (text-2xl)

- `font-semibold` - Used in:
  - `src/pages/Admin.tsx:532,597` - Section headings (text-lg)
  - `src/pages/AdminData.tsx:156,495,682,1040,1104,1160` - Various section headings (text-lg, text-md)

**Recommendation:** Standardize to `font-semibold` for all section titles (H2)

---

### Category 3: Subsection Titles (H3 - Medium Sections)
**Current weights found:**
- `font-semibold` - Used in:
  - `src/pages/League.tsx:2069,3603,3633,3661,3689,3717` - Modal titles (text-xl, text-lg)
  - `src/pages/League.tsx:3305` - "Remove Members:" label (text-sm)
  - `src/pages/Admin.tsx:536` - "Add Fixtures" (text-base)
  - `src/pages/AdminData.tsx:156,495,682,1040,1104,1160` - Subsection headings (text-lg, text-md)
  - `src/pages/Predictions.tsx:2106` - Date group labels (text-lg)
  - `src/components/MiniLeagueGwTableCard.tsx:841` - Card title (text-base)

- `font-bold` - Used in:
  - `src/components/MiniLeagueGwTableCard.tsx:841` - Card title (text-base)
  - `src/pages/Predictions.tsx:2209,2214` - Test labels (text-lg, text-2xl)

**Recommendation:** Standardize to `font-semibold` for all subsection titles (H3)

---

### Category 4: Small Labels/Headers (H4+ or small text)
**Current weights found:**
- `font-semibold` - Used in:
  - `src/pages/League.tsx:3088` - Admin name (text-sm)
  - `src/pages/League.tsx:2149,2465` - "No Predictions/Results Available" (text-lg)
  - `src/pages/Predictions.tsx:2114,2120` - Team names (text-sm)

- `font-medium` - Used in:
  - `src/pages/League.tsx:3311` - Member names (text-sm)
  - `src/pages/League.tsx:3389,3417,3507,3522` - Form labels (text-xs)

- `font-bold` - Used in:
  - `src/pages/League.tsx:3606` - League code (text-lg font-mono)
  - `src/pages/Predictions.tsx:1741,2051,2362` - Mode labels (text-lg)

**Recommendation:** Keep current weights for small labels (semibold for emphasis, medium for regular)

---

## Summary by File

### Files with Multiple Heading Font Weights:

1. **`src/pages/League.tsx`**
   - `font-bold` - Modal titles (3301, 3382)
   - `font-semibold` - Modal titles (2069, 3603, 3633, 3661, 3689, 3717), Labels (3305, 3088, 2149, 2465)
   - `font-normal` - League name header (3052)
   - `font-medium` - Member names, form labels

2. **`src/pages/Predictions.tsx`**
   - `font-extrabold` - Page title (2430)
   - `font-semibold` - Date groups (2106), Team names (2114, 2120)
   - `font-bold` - Test labels (2209, 2214), Mode labels (1741, 2051, 2362)

3. **`src/pages/Admin.tsx`**
   - `font-semibold` - Page title (375), Section headings (532, 597), Subsection (536)

4. **`src/pages/AdminData.tsx`**
   - `font-bold` - Page title (139)
   - `font-semibold` - Section headings (156, 495, 682, 1040, 1104, 1160)

5. **`src/components/Section.tsx`**
   - `font-bold` - Section title (66)

6. **`src/features/auth/`**
   - `font-bold` - ResetPasswordForm titles (98, 122, 166), EmailConfirmation (34)
   - `font-normal` - SignInForm (46), SignUpForm (68)

---

## Proposed Standardization

### Standard 1: Page Titles (H1)
**Weight:** `font-semibold`
**Usage:** Main page titles, largest headings
**Files to update:**
- `src/pages/Predictions.tsx:2430` - Change `font-extrabold` → `font-semibold`
- `src/pages/AdminData.tsx:139` - Change `font-bold` → `font-semibold`
- `src/features/auth/ResetPasswordForm.tsx:98,122,166` - Change `font-bold` → `font-semibold`
- `src/components/ErrorBoundary.tsx:38` - Change `font-bold` → `font-semibold`
- `src/features/auth/EmailConfirmation.tsx:34` - Change `font-bold` → `font-semibold`
- `src/pages/CookiePolicy.tsx:86` - Change `font-bold` → `font-semibold`
- `src/features/auth/SignInForm.tsx:46` - Change `font-normal` → `font-semibold`
- `src/features/auth/SignUpForm.tsx:68` - Change `font-normal` → `font-semibold`
- `src/pages/League.tsx:3052` - Change `font-normal` → `font-semibold` (league name in header)

### Standard 2: Section Titles (H2)
**Weight:** `font-semibold`
**Usage:** Section headings, modal titles
**Files to update:**
- `src/pages/League.tsx:3301,3382` - Change `font-bold` → `font-semibold`
- `src/components/Section.tsx:66` - Change `font-bold` → `font-semibold`
- `src/DesignTokens.stories.tsx:38,128,440` - Change `font-bold` → `font-semibold` (Storybook)

### Standard 3: Subsection Titles (H3)
**Weight:** `font-semibold`
**Usage:** Subsection headings, card titles
**Status:** ✅ Mostly already consistent (some bold instances to review)

---

## Next Steps

1. Update page titles (H1) to `font-semibold`
2. Update section titles (H2) to `font-semibold`
3. Review subsection titles (H3) - most are already semibold
4. Review each change one by one for user approval




