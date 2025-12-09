# Reusable Components Analysis for League Page

## ✅ Components Already Used
- `TeamBadge` - Used in League.tsx for fixture displays
- `MiniLeagueChatBeta` - Used for chat tab
- `MessageBubble` - Used in chat

## 🎯 Components That Can Be Reused (With Adaptation)

### 1. **DateHeader** ✅ **READY TO USE**
- **Location**: `src/components/DateHeader.tsx`
- **Current Usage**: Used in `DateGroupedFixtures` for Predictions page
- **Can Reuse For**: GW Picks tab fixture sections (date grouping)
- **Adaptation Needed**: None - drop-in replacement
- **Storybook**: ✅ Has story

```tsx
// Current League.tsx uses inline date formatting
// Can replace with:
import DateHeader from "../components/DateHeader";
```

---

### 2. **DateGroupedFixtures** ⚠️ **NEEDS ADAPTATION**
- **Location**: `src/components/DateGroupedFixtures.tsx`
- **Current Usage**: Predictions page
- **Can Reuse For**: GW Picks tab fixture sections
- **Adaptation Needed**: 
  - Currently uses `FixtureCard` which is for predictions (has pick buttons)
  - League page needs to show member picks as chips, not buttons
  - Would need to create a league-specific variant or adapt props
- **Storybook**: ✅ Has story

**Recommendation**: Extract fixture section logic from League.tsx into a new `LeagueFixtureSection` component instead of adapting this one.

---

### 3. **LeaderboardTable & LeaderboardRow** ⚠️ **POTENTIALLY REUSABLE**
- **Location**: `src/components/LeaderboardTable.tsx`, `src/components/LeaderboardRow.tsx`
- **Current Usage**: Global Leaderboard page
- **Can Reuse For**: 
  - Mini League Table tab
  - GW Results tab
- **Adaptation Needed**:
  - Different column structure (W/D/OCP/Unicorns vs GW/OCP)
  - Different styling (form display vs points)
  - Different data structure
- **Storybook**: ✅ Has stories

**Recommendation**: Create league-specific table components (`MiniLeagueTable`, `ResultsTable`) that share common table styling/logic but have different column structures.

**Shared Logic to Extract**:
- Table container styling
- Sticky header logic
- Row highlighting (current user)
- Rank display logic

---

### 4. **ConfirmationModal** ⚠️ **CAN BE ADAPTED**
- **Location**: `src/components/predictions/ConfirmationModal.tsx`
- **Current Usage**: Predictions page confirmation
- **Can Reuse For**: ScoringModal in GW Results tab
- **Adaptation Needed**:
  - Different content (rules explanation vs confirmation)
  - Different styling (info modal vs success/warning)
- **Storybook**: ✅ Has story

**Recommendation**: Create a generic `Modal` component that both can use, or create `ScoringModal` as a separate component with similar structure.

---

### 5. **PickButton** ❌ **NOT SUITABLE**
- **Location**: `src/components/PickButton.tsx`
- **Current Usage**: Predictions page for making picks
- **Why Not Reusable**: 
  - League page uses `Chip` component (shows who picked what)
  - Different use case (display vs interaction)
- **Storybook**: ✅ Has story

**Recommendation**: Keep `Chip` as separate component (extract from inline).

---

### 6. **FixtureCard** ⚠️ **DIFFERENT USE CASE**
- **Location**: `src/components/FixtureCard.tsx`
- **Current Usage**: Predictions page
- **Why Not Directly Reusable**:
  - Shows pick buttons (for making predictions)
  - League page shows member picks as chips (display only)
  - Different layout and data needs
- **Storybook**: ✅ Has story

**Recommendation**: Create `LeagueFixtureCard` component that:
- Reuses team badge logic
- Reuses live score display logic
- Shows picks as chips instead of buttons
- Shares common fixture display patterns

---

### 7. **Score** ❌ **NOT NEEDED**
- **Location**: `src/components/Score.tsx`
- **Current Usage**: Displaying score badges
- **Why Not Needed**: League page doesn't use this format
- **Storybook**: ✅ Has story

---

## 📋 Summary: What to Extract vs Reuse

### **Extract New Components** (League-Specific)
1. ✅ `PickChip` - Extract from inline `Chip` function
2. ✅ `MiniLeagueTable` - League-specific table
3. ✅ `ResultsTable` - League-specific results table
4. ✅ `LeagueFixtureCard` - League-specific fixture display
5. ✅ `SubmissionStatusTable` - League-specific submission view
6. ✅ `ScoringModal` - League-specific rules modal
7. ✅ `WinnerBanner` - League-specific winner display
8. ✅ `GwSelector` - League-specific GW dropdown
9. ✅ `RulesButton` - Reusable button (extract from inline)

### **Reuse Existing Components** (With Minimal Changes)
1. ✅ `DateHeader` - Drop-in replacement
2. ⚠️ `LeaderboardTable` - Share table container logic, but create league variants
3. ⚠️ `ConfirmationModal` - Use as reference for modal structure

### **Shared Utilities to Extract**
1. Table container styling (sticky header, scroll behavior)
2. Row highlighting logic (current user)
3. Rank calculation logic
4. Modal backdrop/container logic

---

## 🎨 Component Reuse Strategy

### Phase 1: Extract Simple Components
- Extract `PickChip` (already inline)
- Extract `RulesButton` (used in 2 places)
- Extract `DateHeader` usage (replace inline date formatting)

### Phase 2: Create League-Specific Components
- Create `LeagueFixtureCard` (inspired by `FixtureCard` but different)
- Create `MiniLeagueTable` (inspired by `LeaderboardTable` but different)
- Create `ResultsTable` (inspired by `LeaderboardTable` but different)

### Phase 3: Extract Shared Logic
- Extract table container wrapper
- Extract modal wrapper
- Extract common styling patterns

---

## 💡 Key Insight

**Most components are context-specific** (Predictions vs League vs Global), but we can:
1. **Reuse styling patterns** (table containers, modals, badges)
2. **Reuse utility logic** (date formatting, rank calculation)
3. **Extract shared primitives** (buttons, chips, headers)

**Best approach**: Extract league-specific components that follow the same patterns as existing components, ensuring consistency across the app.

