# URGENT: Netlify Not Deploying - Fix Required

## Problem
**Netlify is not deploying changes from GitHub.** The latest commits (including push notification fixes) are not appearing on the live site.

## Evidence
- ✅ Commits are successfully pushed to GitHub (`staging` branch)
- ✅ Latest commit: `cca2ee4` - "fix: sendPushAll now uses Player IDs from DB..."
- ❌ Live site still shows old code ("Mini Leagues" instead of "Mini Leaguez")
- ❌ Netlify Dashboard shows wrong repository connection

## Root Cause
Netlify is connected to the **wrong GitHub repository**:
- Currently connected to: `github.com/netlify/netlify-cms` ❌
- Should be connected to: `github.com/sotbjof/totl-web` ✅

## Fix Steps (Admin Access Required)

### 1. Fix Netlify Repository Connection
1. Go to: **Netlify Dashboard** → Your site → **Site Settings** → **Build & deploy**
2. Under **Continuous Deployment**, click **"Link to a different repository"**
3. Select: **`sotbjof/totl-web`**
4. Set **Branch**: `staging`
5. Set **Publish directory**: `dist`
6. Click **Save**

### 2. Verify Build Settings
Make sure these match `netlify.toml`:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Functions directory**: `netlify/functions`

### 3. Trigger Manual Deploy (After Fixing Connection)
1. Go to: **Deploys** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. This will pull the latest commit (`cca2ee4`) and deploy it

### 4. Verify Deployment
After deployment, check:
- Live site shows: **"Mini Leaguez"** (not "Mini Leagues")
- Admin page shows push notification feedback when publishing results
- Deploy log shows commit `cca2ee4`

## Impact
**Critical fixes are not deployed:**
- ✅ Push notification fixes for chat messages
- ✅ Push notification fixes for results publishing
- ✅ Improved error handling and logging
- ✅ Self-serve notification fix screen

## Additional Notes
- Vercel integration is also failing (shows red X's on commits), but that's separate
- Netlify should deploy independently of Vercel status
- Once Netlify is connected correctly, it will auto-deploy on every push to `staging`

## Quick Test After Fix
1. Wait for deployment to complete
2. Visit home page → Should see **"Mini Leaguez"**
3. Go to Admin → Publish results → Should see **"Push notification sent to X devices"**

---

**Status**: 🔴 **BLOCKED** - Waiting on admin to fix Netlify connection

