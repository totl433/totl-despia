# Design Uniformity Review - One-by-One Issues

This document contains all issues that need your input, organized for review one at a time.

---

## PART 1: REMOVE ALL HOVER STATES

**Status**: Ready to remove all hover states (app-first, no hover needed)

**Files with hover states to remove**: ~69 instances found

I can remove ALL hover states automatically - no guidance needed. Should I proceed?

---

## PART 2: INLINE STYLES IN TABLE COMPONENTS

### Example 1: MiniLeagueGwTableCard.tsx - Table Headers

**File**: `src/components/MiniLeagueGwTableCard.tsx`  
**Lines**: 595, 596, 599, 602

**Current Code**:
```tsx
<th className="py-2 text-left font-semibold text-xs uppercase tracking-wide" 
    style={{ backgroundColor: '#ffffff', width: '24px', paddingLeft: '0.5rem', paddingRight: '0.25rem', color: '#1C8376' }}></th>

<th className="py-2 text-left font-semibold text-xs text-slate-300" 
    style={{ backgroundColor: '#ffffff', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>Player</th>

<th className="py-2 text-center font-semibold text-xs text-slate-300" 
    style={{ backgroundColor: '#ffffff', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>Score</th>

<th className="py-2 text-center font-semibold text-xs" 
    style={{ backgroundColor: '#ffffff', width: '32px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#1C8376', fontSize: '1rem' }}>🦄</th>
```

**Proposed Change**:
```tsx
<th className="py-2 text-left font-semibold text-xs uppercase tracking-wide bg-white w-6 pl-2 pr-1 text-[#1C8376]"></th>

<th className="py-2 text-left font-semibold text-xs text-slate-300 bg-white px-2">Player</th>

<th className="py-2 text-center font-semibold text-xs text-slate-300 bg-white w-10 px-1">Score</th>

<th className="py-2 text-center font-semibold text-xs bg-white w-8 px-1 text-[#1C8376] text-base">🦄</th>
```

**Questions**: 
- Are these precise widths necessary, or can we use standard Tailwind widths?
- Is `#ffffff` intentionally different from `bg-white`, or just redundant?

---

### Example 2: MiniLeagueGwTableCard.tsx - Table Body Cells

**File**: `src/components/MiniLeagueGwTableCard.tsx`  
**Lines**: 618-631

**Current Code**:
```tsx
<td className="py-2 text-left tabular-nums whitespace-nowrap" 
    style={{ paddingLeft: '0.5rem', paddingRight: '0.25rem', backgroundColor: '#ffffff', width: '24px', fontSize: '0.75rem' }}>
  {i + 1}
</td>

<td className="py-2 truncate whitespace-nowrap" 
    style={{ backgroundColor: '#ffffff', paddingLeft: '0.5rem', paddingRight: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem' }}>
  <span>{r.name}</span>
</td>

<td className={`py-2 text-center tabular-nums font-bold ${isLive ? 'pulse-live-score' : ''}`} 
    style={{ width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#ffffff', color: '#1C8376', fontSize: '0.75rem' }}>
  {r.score}
</td>

<td className={`py-2 text-center tabular-nums ${isLive ? 'pulse-live-score' : ''}`} 
    style={{ width: '32px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#ffffff', fontSize: '0.75rem' }}>
  {r.unicorns}
</td>
```

**Proposed Change**:
```tsx
<td className="py-2 text-left tabular-nums whitespace-nowrap bg-white w-6 pl-2 pr-1 text-xs">
  {i + 1}
</td>

<td className="py-2 truncate whitespace-nowrap bg-white px-2 text-xs">
  <span>{r.name}</span>
</td>

<td className={`py-2 text-center tabular-nums font-bold text-[#1C8376] text-xs bg-white w-10 px-1 ${isLive ? 'pulse-live-score' : ''}`}>
  {r.score}
</td>

<td className={`py-2 text-center tabular-nums text-xs bg-white w-8 px-1 ${isLive ? 'pulse-live-score' : ''}`}>
  {r.unicorns}
</td>
```

**Questions**: 
- Are precise widths (24px, 40px, 32px) necessary for layout?
- Can `text-xs` replace `fontSize: '0.75rem'`?

---

### Example 3: ResultsTable.tsx - Score Cell

**File**: `src/components/league/ResultsTable.tsx`  
**Line**: 173

**Current Code**:
```tsx
<td className={`py-4 text-center tabular-nums font-bold ${isApiTestLeague && hasLiveFixtures ? 'pulse-live-score' : ''}`} 
    style={{ width: '50px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc', color: '#1C8376' }}>
  {r.score}
</td>
```

**Proposed Change**:
```tsx
<td className={`py-4 text-center tabular-nums font-bold text-[#1C8376] bg-slate-50 w-[50px] px-1 ${isApiTestLeague && hasLiveFixtures ? 'pulse-live-score' : ''}`}>
  {r.score}
</td>
```

**Questions**: 
- Is 50px width necessary, or can we use standard Tailwind width?
- `#f8fafc` = `slate-50`, correct?

---

### Example 4: MiniLeagueTable.tsx - Score Cell

**File**: `src/components/league/MiniLeagueTable.tsx`  
**Line**: 139

**Current Code**:
```tsx
<td className="py-4 text-center tabular-nums font-bold" 
    style={{ width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc', color: '#1C8376' }}>
  {r.mltPts}
</td>
```

**Proposed Change**:
```tsx
<td className="py-4 text-center tabular-nums font-bold text-[#1C8376] bg-slate-50 w-10 px-1">
  {r.mltPts}
</td>
```

**Questions**: 
- Same as Example 3 - is width/precision necessary?

---

## PART 3: FONT WEIGHTS ON BUTTONS

### Button Example 1: Primary Action Buttons

**Examples Found**:
- `src/pages/Home.tsx:1589` - `font-medium` 
- `src/components/PredictionsBanner.tsx:508` - `font-medium`
- `src/components/MiniLeagueCard.tsx:218` - (no font weight specified)
- `src/components/MiniLeaguesSection.tsx:157` - `font-semibold`
- `src/pages/League.tsx:1758` - `font-semibold`

**Current Mix**:
- Primary buttons: Mix of `font-medium` (500) and `font-semibold` (600)
- Some have no explicit font weight

**Question**: What font weight should PRIMARY action buttons use?
- Option A: `font-medium` (500) - lighter, more common
- Option B: `font-semibold` (600) - heavier, more emphasis
- Option C: `font-bold` (700) - heaviest

---

### Button Example 2: Secondary/Text Buttons

**Examples Found**:
- `src/components/WhatsAppBanner.tsx:127` - `font-semibold`
- `src/components/MiniLeaguesSection.tsx:105` - `font-medium`
- Cancel buttons: `font-medium`

**Current Mix**: `font-medium` and `font-semibold`

**Question**: What font weight should SECONDARY/TEXT buttons use?
- Option A: `font-medium` (500)
- Option B: `font-normal` (400)
- Option C: `font-semibold` (600)

---

### Button Example 3: Small Buttons/Badges

**Examples Found**:
- `src/components/MiniLeaguesSection.tsx:112` - `font-medium`
- `src/components/MiniLeagueCard.tsx:359` - `font-bold`
- `src/components/MiniLeagueGwTableCard.tsx:666` - `font-bold`

**Current Mix**: `font-medium` and `font-bold`

**Question**: What font weight should SMALL buttons/badges use?
- Option A: `font-medium` (500)
- Option B: `font-semibold` (600)
- Option C: `font-bold` (700)

---

## PART 4: FONT WEIGHTS ON HEADINGS

### Heading Example 1: Page Titles (H1)

**Examples Found**:
- `src/pages/AdminData.tsx:139` - `text-2xl sm:text-3xl font-bold`
- `src/pages/CookiePolicy.tsx:86` - `text-2xl font-bold`
- `src/pages/Admin.tsx:375` - `text-2xl font-semibold` ⚠️ INCONSISTENT
- `src/pages/ApiAdmin.tsx:624` - `text-2xl sm:text-3xl font-semibold` ⚠️ INCONSISTENT

**Current Mix**: Mostly `font-bold`, but some `font-semibold`

**Question**: What font weight should PAGE TITLES (H1) use?
- Option A: `font-bold` (700) - current majority
- Option B: `font-semibold` (600) - lighter
- Option C: `font-extrabold` (800) - heaviest

---

### Heading Example 2: Section Headings (H2/H3)

**Examples Found**:
- `src/pages/League.tsx:1754` - `text-xl font-semibold`
- `src/pages/League.tsx:2999` - `text-2xl font-bold`
- `src/pages/League.tsx:3003` - `text-sm font-semibold`
- `src/pages/AdminData.tsx:156` - `text-md font-semibold`
- `src/pages/ApiAdmin.tsx:692` - `text-lg font-semibold`

**Current Mix**: Mix of `font-bold` and `font-semibold` for similar sizes

**Question**: What font weight should SECTION HEADINGS (H2/H3) use?
- Option A: `font-bold` (700)
- Option B: `font-semibold` (600)
- Option C: Different weights for H2 vs H3?

---

### Heading Example 3: Card Titles/Headings

**Examples Found**:
- `src/components/MiniLeagueGwTableCard.tsx:543` - `text-base font-bold`
- `src/components/MiniLeagueCard.tsx:239` - `text-base font-semibold`
- `src/components/PredictionsBanner.tsx:498` - `text-base font-bold`

**Current Mix**: `font-bold` and `font-semibold` for same size

**Question**: What font weight should CARD TITLES use?
- Option A: `font-bold` (700)
- Option B: `font-semibold` (600)
- Option C: `font-medium` (500)

---

## NEXT STEPS

1. Confirm: Remove ALL hover states? (Yes/No)
2. Review each table inline style example above
3. Choose font weights for each button type
4. Choose font weights for each heading type

Once you answer, I'll implement all the changes systematically.


