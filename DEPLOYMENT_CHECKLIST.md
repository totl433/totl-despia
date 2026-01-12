# Deployment Checklist - V2 to playtotl.com
**Date:** 2025-01-XX  
**Status:** Ready for deployment

---

## ✅ Pre-Deployment (Already Complete)

- [x] **Phase 1:** Frontend code updates (hardcoded URLs fixed)
- [x] **Phase 2:** Backend code updates (fallback logic improved)
- [x] **Phase 3:** Supabase webhooks updated to playtotl.com
- [x] **V1 Backup:** V1 code safely backed up in `sotbjof/totl-web` repository

---

## 🚀 Deployment Steps

### Step 1: Update Netlify Site Configuration

**Action Required:** Update playtotl.com Netlify site to connect to new repository

1. Go to **Netlify Dashboard** → **playtotl.com** site
2. Navigate to: **Site Settings** → **Build & deploy**
3. Under **Continuous Deployment**, click **"Link to a different repository"** (or **"Change repository"**)
4. Select: **`totl433/totl-despia`** (the V2 repository)
5. Configure settings:
   - **Branch:** `main` (for production)
   - **Publish directory:** `dist`
   - **Build command:** `npm run build`
6. Click **Save**

**Expected Result:** Netlify will connect to the new repository and may trigger a deploy

---

### Step 2: Verify Environment Variables

**Action Required:** Ensure all environment variables are set in playtotl.com Netlify site

1. Go to **Netlify Dashboard** → **playtotl.com** → **Site Settings** → **Environment variables**
2. Verify these are set (copy from staging if needed):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ONESIGNAL_APP_ID`
   - `ONESIGNAL_REST_API_KEY`
   - `MAILERLITE_API_KEY` (if used)
   - Any other environment variables from staging

**Note:** Check staging site environment variables to ensure all are copied over

---

### Step 3: Trigger Deployment

**Action Required:** Deploy V2 code to playtotl.com

1. Go to **Netlify Dashboard** → **playtotl.com** → **Deploys** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Or: Push a commit to `main` branch in `totl433/totl-despia` (will auto-deploy)
4. Wait for deployment to complete (usually 2-5 minutes)

**Verify:**
- Build completes successfully
- Functions deploy successfully
- Site is live on playtotl.com

---

### Step 4: Post-Deployment Testing

**Action Required:** Test the deployed site

Test on `playtotl.com`:

- [ ] **Site loads:** Visit playtotl.com - site loads correctly
- [ ] **Sign up flow:** Test email availability check (try signing up with existing email)
- [ ] **Push notifications:** Test push notification registration (if in app)
- [ ] **Email preferences:** Test email preferences sync
- [ ] **Functions:** Test key functions (check logs in Netlify)
- [ ] **Webhooks:** Check Supabase logs to verify webhooks are delivering to playtotl.com
- [ ] **Navigation:** Test key pages (Home, Leagues, Profile, etc.)

**Check Netlify Function Logs:**
- Go to Netlify Dashboard → playtotl.com → Functions tab
- Check for any errors
- Test a function if needed (e.g., checkEmailAvailable)

**Check Supabase Logs:**
- Go to Supabase Dashboard → Database → Webhooks
- Check webhook delivery logs
- Verify webhooks are calling playtotl.com (not staging)

---

### Step 5: Update Despia Connection

**Action Required:** Switch Despia from staging to production

1. Go to **Despia Dashboard/Settings**
2. Find the site/connection configuration
3. Update the URL from: `https://totl-staging.netlify.app`
4. To: `https://playtotl.com`
5. Save changes

**Note:** This will make Despia native app users connect to playtotl.com instead of staging

---

### Step 6: Final Verification

**Action Required:** Verify everything works in production

- [ ] **Web users:** Can access playtotl.com, sign up, use features
- [ ] **Despia app users:** Can connect to playtotl.com, receive notifications
- [ ] **Notifications:** Push notifications work in app
- [ ] **Webhooks:** Live score updates trigger notifications correctly
- [ ] **No errors:** Check Netlify logs for errors
- [ ] **Staging still works:** Verify staging (totl-staging.netlify.app) still works for testing

---

## 🎯 Success Criteria

✅ playtotl.com serves V2 code (not V1)  
✅ Despia connects to playtotl.com (not staging)  
✅ Webhooks deliver to playtotl.com  
✅ All functions work correctly  
✅ No critical errors in logs  
✅ Both web and app users can use the site  

---

## 📋 Rollback Plan (If Needed)

If something goes wrong:

1. **Quick rollback:** In Netlify Dashboard → playtotl.com → Deploys → find previous V1 deploy → click "Publish deploy"
2. **Repository rollback:** Change Netlify site back to `sotbjof/totl-web` repository (V1)
3. **Despia rollback:** Change Despia connection back to `totl-staging.netlify.app`
4. **Webhook rollback:** Change Supabase webhooks back to staging (if needed)

**Note:** V1 code is safely backed up in `sotbjof/totl-web` repository

---

## 📝 Notes

- **Staging:** `totl-staging.netlify.app` remains available for testing (points to `totl433/totl-despia` staging branch)
- **Repository:** Both staging and production Netlify sites now use `totl433/totl-despia` (different branches)
- **V1:** Safely archived in `sotbjof/totl-web` repository (keep as backup)

---

## ⚠️ Important Reminders

1. **Environment Variables:** Make sure all env vars are copied from staging to production
2. **Webhooks:** Already updated to playtotl.com (Phase 3 complete)
3. **Testing:** Test thoroughly before announcing to users
4. **Monitor:** Watch logs closely after deployment
5. **Staging:** Keep staging available for future testing

---

**Ready to deploy?** Start with Step 1 (Netlify configuration)
