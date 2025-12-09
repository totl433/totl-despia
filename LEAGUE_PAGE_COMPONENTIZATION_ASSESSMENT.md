# League Page Componentization & Performance Assessment

## Current State
- **File**: `src/pages/League.tsx` (4,438 lines)
- **Tabs**: Chat (beta), GW Results, GW Picks, Mini League Table
- **Status**: All tabs except Chat are inline functions within the main component

## Componentization Opportunities

### 1. **Mini League Table Tab (MltTab)** - Lines 2028-2272

**Extractable Components:**
- ✅ **`MiniLeagueTable`** - Main table component
  - Props: `rows`, `members`, `showForm`, `onToggleForm`, `currentUserId`
  - Storybook: Yes
- ✅ **`FormDisplay`** - The 5-week form indicator (W/D/L circles)
  - Props: `form: ("W" | "D" | "L")[]`
  - Storybook: Yes
- ✅ **`PointsFormToggle`** - Toggle between Points/Form view
  - Props: `showForm`, `onToggle`
  - Storybook: Yes
- ✅ **`RulesButton`** - Rules button (already used in GwResultsTab)
  - Props: `onClick`
  - Storybook: Yes (reusable)

**Performance Improvements:**
- Memoize `rows` calculation
- Use `React.memo` for table rows
- Virtualize table if > 20 members

---

### 2. **GW Picks Tab (GwPicksTab)** - Lines 2274-3225

**Extractable Components:**
- ✅ **`SubmissionStatusTable`** - "Who's submitted" view
  - Props: `members`, `submittedMap`, `picksGw`, `deadline`, `onShareReminder`
  - Storybook: Yes
- ✅ **`FixtureSection`** - Date-grouped fixture sections
  - Props: `sections`, `picksByFixture`, `members`, `outcomes`, `liveScores`, `submittedMap`
  - Storybook: Yes
- ✅ **`FixtureCard`** - Individual fixture with picks (ALREADY EXISTS!)
  - Check: `src/components/FixtureCard.tsx`
  - May need enhancement for league-specific features
- ✅ **`Chip`** - Pick indicator chip (ALREADY EXISTS as inline function)
  - Extract to: `src/components/PickChip.tsx`
  - Storybook: Yes
- ✅ **`SectionHeader`** - Date header with status badges
  - Props: `label`, `isLive`, `allGamesFinished`, `allSubmitted`
  - Storybook: Yes

**Performance Improvements:**
- Memoize `sections` calculation (already using `useMemo`)
- Memoize `picksByFixture` Map
- Lazy load fixture cards (only render visible ones)
- Debounce live score updates

---

### 3. **GW Results Tab (GwResultsTab)** - Lines 3227-3681

**Extractable Components:**
- ✅ **`ResultsTable`** - Main results table
  - Props: `rows`, `members`, `currentUserId`, `isLive`, `positionChangeKeys`
  - Storybook: Yes
- ✅ **`WinnerBanner`** - Shiny gradient winner announcement
  - Props: `winner`, `isDraw`
  - Storybook: Yes
- ✅ **`GwSelector`** - Gameweek dropdown selector
  - Props: `availableGws`, `selectedGw`, `onChange`, `currentGw`
  - Storybook: Yes
- ✅ **`RulesButton`** - Reusable (same as MltTab)
- ✅ **`ScoringModal`** - Rules explanation modal
  - Props: `isOpen`, `onClose`
  - Storybook: Yes

**Performance Improvements:**
- Memoize `rows` calculation
- Optimize position change detection (already using refs)
- Debounce live score updates

---

## Recommended Component Structure

```
src/components/league/
├── MiniLeagueTable.tsx
├── MiniLeagueTable.stories.tsx
├── FormDisplay.tsx
├── FormDisplay.stories.tsx
├── PointsFormToggle.tsx
├── PointsFormToggle.stories.tsx
├── SubmissionStatusTable.tsx
├── SubmissionStatusTable.stories.tsx
├── FixtureSection.tsx
├── FixtureSection.stories.tsx
├── PickChip.tsx (extract from inline)
├── PickChip.stories.tsx
├── SectionHeader.tsx
├── SectionHeader.stories.tsx
├── ResultsTable.tsx
├── ResultsTable.stories.tsx
├── WinnerBanner.tsx
├── WinnerBanner.stories.tsx
├── GwSelector.tsx
├── GwSelector.stories.tsx
├── RulesButton.tsx (reusable)
├── RulesButton.stories.tsx
└── ScoringModal.tsx
└── ScoringModal.stories.tsx
```

---

## Performance Optimization Strategy

### 1. **Code Splitting**
- Lazy load each tab component
- Use React.lazy() for tab components

### 2. **Memoization**
- Memoize expensive calculations (`rows`, `sections`, `picksByFixture`)
- Use `React.memo` for table rows and fixture cards
- Use `useMemo` for derived state

### 3. **Virtualization**
- Consider `react-window` for long tables (>20 rows)
- Only render visible fixture cards

### 4. **Data Fetching**
- Optimize Supabase queries (select only needed fields)
- Cache frequently accessed data
- Use Supabase real-time subscriptions efficiently

### 5. **Bundle Size**
- Extract components to reduce main bundle
- Tree-shake unused code

---

## Implementation Priority

### Phase 1: Quick Wins (High Impact, Low Effort)
1. Extract `Chip` component (already exists inline)
2. Extract `RulesButton` (used in 2 places)
3. Extract `WinnerBanner` (standalone, visually distinct)
4. Extract `GwSelector` (standalone, reusable)

### Phase 2: Medium Priority
1. Extract `SubmissionStatusTable` (complex but isolated)
2. Extract `FormDisplay` (small, reusable)
3. Extract `PointsFormToggle` (small, reusable)

### Phase 3: Large Refactors
1. Extract `MiniLeagueTable` (requires careful prop passing)
2. Extract `ResultsTable` (requires careful prop passing)
3. Extract `FixtureSection` (most complex, many dependencies)

---

## Despia-Specific Considerations

- ✅ All components should be mobile-first
- ✅ Touch-friendly sizing (min 44x44px touch targets)
- ✅ Avoid compact layouts
- ✅ Test on actual Despia app, not just browser

---

## Next Steps

1. **Start with Phase 1** - Extract simple, reusable components
2. **Add Storybook stories** for each component
3. **Test in Despia** after each extraction
4. **Measure performance** before/after (React DevTools Profiler)
5. **Iterate** based on performance metrics

