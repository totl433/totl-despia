# Instructions for Admin: Fix Vercel Integration Issue

## Problem
Many commits show red X (1/2 checks failing) because **Vercel** is trying to deploy but failing. Since we're using **Netlify**, Vercel shouldn't be deploying this repo.

## Solution Options

### Option 1: Disable Vercel Integration (Recommended)
1. Go to: https://github.com/sotbjof/totl-web/settings/installations
2. Find "Vercel" in the list
3. Click "Configure" → Remove access to `totl-web` repository
4. Or: Go to https://vercel.com/dashboard → Find `totl-web` project → Delete/Disconnect it

### Option 2: Fix Vercel (if you want to keep it)
1. Go to: https://vercel.com/jonathan-middletons-projects/totl-web
2. Check deployment logs to see why it's failing
3. Likely issues:
   - Missing environment variables
   - Wrong build command
   - Wrong publish directory

### Option 3: Check Branch Protection Rules
If branch protection requires all checks to pass:
1. Go to: https://github.com/sotbjof/totl-web/settings/branches
2. Check if `staging` branch has protection rules
3. If it requires "Vercel" checks, either:
   - Remove that requirement
   - Or fix Vercel deployments

## Current Status
- Latest commit (`cca2ee4`) shows "2/2" passing ✅
- This suggests Vercel might be working now OR Netlify is deploying independently
- Netlify deployments should work regardless of Vercel status

## Verify Netlify is Working
1. Go to Netlify Dashboard → Your site → Deploys tab
2. Check if commit `cca2ee4` appears in deploy history
3. Verify it deployed successfully

## Next Steps
1. Check Netlify Dashboard to confirm deployments are happening
2. If Netlify is deploying successfully, Vercel failures are just noise (can be ignored)
3. If Netlify is NOT deploying, check Netlify site settings:
   - Repository: `sotbjof/totl-web`
   - Branch: `staging`
   - Publish directory: `dist`

