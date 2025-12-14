# How to Check Before Pushing

## How I Push

I use standard git commands:
```bash
git add <files>
git commit -m "message"
git push
```

## How to Prevent Netlify Build Failures

Netlify runs `npm run build` which does:
1. `npm run tailwind:build` - Builds Tailwind CSS
2. `tsc -b` - TypeScript type checking
3. `vite build` - Production build

### Option 1: Run the Check Script (Recommended)

Before pushing, run:
```bash
npm run check:build
```

This runs the same checks Netlify will run. If it passes, your push should succeed on Netlify.

### Option 2: Run Build Directly

You can also run:
```bash
npm run build
```

This is the exact command Netlify runs.

### Option 3: Quick Type Check

For a faster check (just TypeScript, no full build):
```bash
npm run tailwind:build && tsc -b
```

## What to Check

The build will fail if:
- ❌ TypeScript errors (unused variables, type mismatches, etc.)
- ❌ Missing imports
- ❌ Syntax errors
- ❌ Build-time errors

Always run `npm run check:build` before pushing to catch these early!
