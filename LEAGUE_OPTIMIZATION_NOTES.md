# League Page Optimization Notes

## Changes Made (Safe Refactoring)

### 1. Extracted Duplicate Message Loading Logic
- **Before**: Two identical `loadMessages` functions (lines ~750 and ~848)
- **After**: Single reusable `loadAndMergeMessages` function with `useCallback`
- **Benefit**: Reduces code duplication, easier to maintain, consistent behavior

### 2. Consolidated Scroll Attempts
- **Before**: Multiple `setTimeout` calls scattered throughout ChatTab (5+ calls per scroll)
- **After**: `scrollToBottomWithRetries` helper function that takes delay array
- **Benefit**: Cleaner code, easier to adjust scroll timing, reduces code duplication

### 3. Extracted Empty MLT Row Creation
- **Before**: Duplicate code creating empty MLT rows in 3 places
- **After**: `createEmptyMltRows` helper function with `useCallback`
- **Benefit**: Single source of truth, easier to modify empty row structure

### 4. Memoized sendChat Function
- **Before**: `sendChat` recreated on every render
- **After**: Wrapped with `useCallback` to prevent unnecessary ChatTab re-renders
- **Benefit**: Better performance, prevents unnecessary component re-renders

## Performance Improvements

- **Reduced re-renders**: `sendChat` memoization prevents ChatTab from re-rendering unnecessarily
- **Cleaner code**: Extracted helpers make the codebase more maintainable
- **Consistent behavior**: Single source of truth for message loading and empty rows

## Verification

✅ No lint errors introduced
✅ All functionality preserved (no UI/UX changes)
✅ Code is cleaner and more maintainable
✅ Performance optimizations applied safely

## File Size

- Original: 3928 lines
- Optimized: ~3920 lines (slight reduction from code consolidation)

## Next Steps (Future Optimizations)

Potential future improvements (not done in this pass):
- Extract ChatTab to separate file if it grows further
- Consider extracting MLT calculation logic to a hook
- Review if any expensive computations can be further memoized

