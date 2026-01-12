# Environment Variables Migration Guide
**Purpose:** Copy environment variables from staging to production Netlify site

---

## Step-by-Step Instructions

### Step 1: View Staging Environment Variables

1. Go to **Netlify Dashboard**: https://app.netlify.com
2. Find and click on your **staging site** (`totl-staging` or similar)
3. Navigate to: **Site Settings** → **Environment variables** (in the left sidebar)
4. You'll see a list of all environment variables for staging
5. **Take a screenshot or write down** all the variable names and values

**Important variables to look for:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `MAILERLITE_API_KEY` (if used)
- Any other custom variables

---

### Step 2: View Production Environment Variables

1. In **Netlify Dashboard**, find and click on your **production site** (`playtotl.com`)
2. Navigate to: **Site Settings** → **Environment variables**
3. Review what's currently set (might be empty or have V1 variables)

---

### Step 3: Copy Variables from Staging to Production

For each variable from staging:

1. In **production site** (playtotl.com) → **Environment variables**
2. Click **"Add a variable"** or **"Add variable"**
3. Enter the **variable name** (exactly as it appears in staging)
4. Enter the **variable value** (copy from staging)
5. Select **scopes** (usually "All scopes" or "Production")
6. Click **"Save"** or **"Add variable"**

**Repeat for each variable** you found in staging.

---

### Step 4: Verify All Variables Are Set

1. Compare the list of variables in production with staging
2. Make sure all variables from staging are present in production
3. Check that values match (be careful with sensitive keys!)

---

## Quick Reference: Common Variables

Based on your codebase, these are likely needed:

| Variable Name | Purpose | Required? |
|--------------|---------|-----------|
| `SUPABASE_URL` | Supabase project URL | ✅ Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for functions) | ✅ Yes |
| `ONESIGNAL_APP_ID` | OneSignal app ID for push notifications | ✅ Yes |
| `ONESIGNAL_REST_API_KEY` | OneSignal REST API key | ✅ Yes |
| `MAILERLITE_API_KEY` | MailerLite API key (if using email) | ⚠️ Maybe |

---

## Alternative: Export/Import (If Available)

Some Netlify accounts have export/import features:

1. In **staging site** → **Environment variables**
2. Look for **"Export"** or **"Download"** button (if available)
3. Export variables to a file
4. In **production site** → **Environment variables**
5. Look for **"Import"** button (if available)
6. Upload the exported file

**Note:** This feature may not be available in all Netlify plans.

---

## Important Notes

⚠️ **Security:**
- Environment variables contain sensitive keys
- Don't share screenshots publicly
- Verify values are correct before saving

⚠️ **Variable Scopes:**
- "All scopes" = Available to all deploys (production, preview, branch)
- "Production" = Only production deploys
- "Preview" = Only preview/branch deploys
- Usually set to "All scopes" or "Production"

⚠️ **After Adding Variables:**
- You may need to **redeploy** the site for variables to take effect
- Or Netlify may automatically trigger a redeploy

---

## Verification Checklist

After copying all variables:

- [ ] All staging variables are present in production
- [ ] Variable names match exactly (case-sensitive!)
- [ ] Variable values are correct
- [ ] Scopes are set appropriately
- [ ] No typos in variable names or values

---

## Troubleshooting

**Q: Can't find Environment variables section?**
- Make sure you're in **Site Settings** (not Deploys or Functions)
- It should be in the left sidebar under "Build & deploy"

**Q: Variables not working after deployment?**
- Check variable names match exactly (case-sensitive)
- Verify scopes are set correctly
- Try redeploying the site
- Check Netlify function logs for errors

**Q: Need to update a variable later?**
- Go to Environment variables
- Find the variable
- Click "Edit" or the pencil icon
- Update the value
- Save
- Redeploy if needed

---

**Need help?** Check Netlify docs: https://docs.netlify.com/environment-variables/overview/
