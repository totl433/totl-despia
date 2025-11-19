<objective>
Perform housekeeping and light refactoring on the League page (`src/pages/League.tsx`) to improve load times, runtime efficiency, and code maintainability. The page is currently 3927 lines with 68 React hooks, indicating opportunities for optimization without changing UI/UX behavior.
</objective>

<context>
The League page displays mini-league details including:
- League table/standings
- Game week picks and results
- Chat functionality (real-time messaging)
- Member management

Current state:
- Single massive file (3927 lines)
- Heavy use of hooks (68 instances of useEffect/useState/useMemo/useCallback)
- Chat functionality with complex keyboard handling
- Real-time data subscriptions
- Multiple data fetching patterns

Goal: Improve performance and code organization while maintaining exact UI/UX behavior.
</context>

<data_sources>
Examine the following:
1. **Main Component**: `src/pages/League.tsx` (full file - 3927 lines)
2. **Dependencies**: Check imports and how data flows
3. **Related Components**: `src/components/` for any shared patterns
4. **State Management**: How chat, picks, and league data are managed
</data_sources>

<requirements>
Perform light refactoring focused on:

1. **Code Organization**:
   - Extract large sub-components (ChatTab, LeagueTable, etc.) into separate files if they're >200 lines
   - Group related hooks together
   - Extract helper functions to utility files if reusable

2. **Performance Optimization**:
   - Identify unnecessary re-renders (use React.memo where appropriate)
   - Optimize expensive computations with useMemo/useCallback
   - Review data fetching patterns - avoid waterfall requests
   - Check if chat subscriptions can be optimized

3. **Hook Optimization**:
   - Consolidate related useState calls where possible
   - Review useEffect dependencies to prevent unnecessary runs
   - Ensure cleanup functions are properly implemented

4. **Code Quality**:
   - Remove dead code or commented-out sections
   - Simplify complex conditional logic
   - Improve type safety where possible
   - Add brief comments for complex logic

5. **Constraints**:
   - **DO NOT** change UI/UX behavior
   - **DO NOT** modify API calls or data structures
   - **DO NOT** break existing functionality
   - Keep changes incremental and testable
</requirements>

<implementation>
Approach:
1. Start by analyzing the file structure - identify natural component boundaries
2. Extract components that are self-contained (ChatTab is already separate, check for others)
3. Review hook usage patterns - look for opportunities to combine or optimize
4. Check for duplicate logic that can be extracted to helpers
5. Clean up any obvious inefficiencies (multiple timeouts, redundant calculations)

Focus areas:
- Chat functionality (complex keyboard handling - can it be simplified?)
- Data fetching (are there waterfall requests?)
- Table rendering (is it optimized for large member lists?)
- Real-time subscriptions (are they properly cleaned up?)
</implementation>

<output>
1. **Refactored Code**: Updated `src/pages/League.tsx` with optimizations
2. **Extracted Components** (if any): New component files in `src/components/` if components were extracted
3. **Summary Report**: Brief notes on what was optimized saved to `./LEAGUE_OPTIMIZATION_NOTES.md`

The refactored code should:
- Be faster to load and render
- Have better code organization
- Maintain 100% UI/UX compatibility
- Be easier to maintain
</output>

<verification>
Before declaring complete, verify:
- [ ] No UI changes visible to users
- [ ] Chat still works correctly (keyboard handling, scrolling)
- [ ] League table displays correctly
- [ ] All interactions work as before
- [ ] No console errors introduced
- [ ] Code is cleaner and more maintainable
</verification>

<success_criteria>
- League page loads faster (fewer initial renders)
- Code is better organized (components extracted if >200 lines)
- Hooks are optimized (fewer unnecessary re-renders)
- No functionality broken
- File size reduced or better organized
</success_criteria>

