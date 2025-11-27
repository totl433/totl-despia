#!/bin/bash

# Script to view Home, Global, and Tables pages at different points in time

echo "=== PAGE VERSION VIEWER ==="
echo ""
echo "Key commits:"
echo "  4477c5d - Component-based version created (Nov 26)"
echo "  d886910 - Optimize Home page: extract leaderboard cards (Nov 19)"
echo "  43ea888 - Most recent: Update app to use current_test_gw (Nov 26)"
echo "  HEAD    - Current working directory"
echo ""
echo "Usage examples:"
echo "  View Home.tsx at commit 4477c5d: git show 4477c5d:src/pages/Home.tsx | head -50"
echo "  View Home.tsx at commit 43ea888: git show 43ea888:src/pages/Home.tsx | head -50"
echo "  View current Home.tsx: cat src/pages/Home.tsx | head -50"
echo ""
echo "=== COMPARING IMPORTS ==="
echo ""

echo "--- Commit 4477c5d (Component-based created) ---"
git show 4477c5d:src/pages/Home.tsx 2>/dev/null | grep -E "^import|^export" | head -15 || echo "Not found"
echo ""

echo "--- Commit 43ea888 (Most recent) ---"
git show 43ea888:src/pages/Home.tsx 2>/dev/null | grep -E "^import|^export" | head -15 || echo "Not found"
echo ""

echo "--- Current HEAD ---"
grep -E "^import|^export" src/pages/Home.tsx | head -15
echo ""

echo "=== CHECKING FOR COMPONENT USAGE ==="
echo ""

echo "Commit 4477c5d uses FixtureCard:"
git show 4477c5d:src/pages/Home.tsx 2>/dev/null | grep -c "FixtureCard" || echo "0"
echo ""

echo "Commit 43ea888 uses FixtureCard:"
git show 43ea888:src/pages/Home.tsx 2>/dev/null | grep -c "FixtureCard" || echo "0"
echo ""

echo "Current HEAD uses FixtureCard:"
grep -c "FixtureCard" src/pages/Home.tsx || echo "0"
echo ""

echo "=== FILE SIZES ==="
echo ""

echo "Commit 4477c5d Home.tsx:"
git show 4477c5d:src/pages/Home.tsx 2>/dev/null | wc -l || echo "Not found"
echo ""

echo "Commit 43ea888 Home.tsx:"
git show 43ea888:src/pages/Home.tsx 2>/dev/null | wc -l || echo "Not found"
echo ""

echo "Current Home.tsx:"
wc -l src/pages/Home.tsx
echo ""

echo "TempHome.tsx:"
wc -l src/pages/TempHome.tsx 2>/dev/null || echo "Not found"

