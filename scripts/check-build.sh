#!/bin/bash
# Pre-push build check script
# Run this before pushing to ensure Netlify build will succeed

set -e  # Exit on error

echo "🔍 Running pre-push build checks..."
echo ""

# Check 1: TypeScript type checking
echo "1️⃣  Checking TypeScript types..."
npm run tailwind:build
tsc -b
echo "✅ TypeScript check passed"
echo ""

# Check 2: Full build (same as Netlify)
echo "2️⃣  Running full build (same as Netlify)..."
npm run build
echo "✅ Build check passed"
echo ""

echo "🎉 All checks passed! Safe to push."
echo ""
echo "To push: git push"
