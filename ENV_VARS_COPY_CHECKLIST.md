# Environment Variables Copy Checklist
**From:** Staging site (totl-staging)  
**To:** Production site (playtotl.com)

---

## ✅ Variables You Have (From Staging)

Based on what you've viewed, here are the variables from staging:

### 1. SUPABASE_URL
- **Value:** `https://gyjagrtwrhctmgkootjj.supabase.co`
- **Status:** ✅ Found (you viewed this)
- **Scope:** All scopes · Same value in all deploy contexts

### 2. SUPABASE_ANON_KEY
- **Value:** `eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi0iJzdXBhYmFzZSIsInJlZiI6Imd5amFncnR3cmhjdG1na29vdGpqIiwicm9sZSI6ImFub24iLCJpYXQi0jE3NTg3MzM2OTIsImV4cCI6MjA3NDMwOTY5Mn0.S6TrCrZWkISC7g14QmVriEQSBawLwxpcGYQKcNqpazA`
- **Status:** ✅ Found (you viewed this)
- **Scope:** All scopes · Same value in all deploy contexts

### 3. SUPABASE_SERVICE_ROLE_KEY
- **Value:** Masked in UI (ends with `a-wE`)
- **Status:** ⚠️ Needs to be revealed/copied
- **Scope:** Scoped to Builds, Functions, Runtime · 4 values in 4 deploy contexts
- **Note:** You have this in a WhatsApp message - use that value!

### 4. ONESIGNAL_APP_ID
- **Value:** `b4f056ec-6753-4a80-ba72-bdfbe8527f9e`
- **Status:** ✅ Found (you viewed this)
- **Scope:** All scopes · Same value in all deploy contexts

### 5. ONESIGNAL_REST_API_KEY
- **Value:** Masked in UI (ends with `byra`)
- **Status:** ⚠️ Needs to be revealed/copied
- **Scope:** Scoped to Builds, Functions, Runtime · 4 values in 4 deploy contexts

### 6. VITE_SUPABASE_URL
- **Value:** `https://gyjagrtwrhctmgkootjj.supabase.co`
- **Status:** ✅ Found (you viewed this)
- **Scope:** All scopes · Same value in all deploy contexts

### 7. VITE_SUPABASE_ANON_KEY
- **Value:** `eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi0iJzdXBhYmFzZSIsInJlZiI6Imd5amFncnR3cmhjdG1na29vdGpqIiwicm9sZSI6ImFub24iLCJpYXQi0jE3NTg3MzM2OTIsImV4cCI6MjA3NDMwOTY5Mn0.S6TrCrZWkISC7g14QmVriEQSBawLwxpcGYQKcNqpazA`
- **Status:** ✅ Found (you viewed this)
- **Scope:** All scopes · Same value in all deploy contexts

### 8. MAILERLITE_API_KEY
- **Value:** Long base64 string (you viewed this)
- **Status:** ✅ Found (you viewed this)
- **Scope:** Scoped to Builds, Functions, Runtime · Same value in all deploy contexts

### 9. ADMIN_DEVICE_REGISTRATION_SECRET
- **Value:** Masked in UI
- **Status:** ⚠️ Needs to be revealed/copied
- **Scope:** Scoped to Builds, Functions, Runtime · 4 values in 4 deploy contexts

### 10. ALLOW_UNAUTH_DEV
- **Status:** ❓ Need to check (you saw this in the list but didn't view details)
- **Scope:** Unknown (need to check)

---

## 📋 Step-by-Step: Copy Each Variable to Production

### Step 1: Navigate to Production Site

1. In Netlify Dashboard, switch to your **playtotl.com** site
2. Go to: **Project configuration** → **Environment variables**
3. You should see either an empty list or existing variables

---

### Step 2: Copy Variables (One by One)

#### ✅ Variable 1: SUPABASE_URL

**From Staging:**
- Value: `https://gyjagrtwrhctmgkootjj.supabase.co`

**Action in Production:**
1. Click the **"+"** icon (document with plus) in top right
2. **Key:** `SUPABASE_URL`
3. **Value:** `https://gyjagrtwrhctmgkootjj.supabase.co`
4. **Scope:** Select "All scopes" (or "Production" if available)
5. Click **"Add variable"** or **"Save"**

---

#### ✅ Variable 2: SUPABASE_ANON_KEY

**From Staging:**
- Value: `eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi0iJzdXBhYmFzZSIsInJlZiI6Imd5amFncnR3cmhjdG1na29vdGpqIiwicm9sZSI6ImFub24iLCJpYXQi0jE3NTg3MzM2OTIsImV4cCI6MjA3NDMwOTY5Mn0.S6TrCrZWkISC7g14QmVriEQSBawLwxpcGYQKcNqpazA`

**Action in Production:**
1. Click the **"+"** icon
2. **Key:** `SUPABASE_ANON_KEY`
3. **Value:** (paste the long JWT token above)
4. **Scope:** "All scopes"
5. Save

---

#### ⚠️ Variable 3: SUPABASE_SERVICE_ROLE_KEY

**From Staging:**
- Value: Masked (ends with `a-wE`)
- **You have this in WhatsApp message!**

**How to get the full value:**

**Option A: Use WhatsApp value**
- Use the value from your WhatsApp message (the service_role secret)
- Make sure it's the full JWT token

**Option B: Reveal in Netlify (if needed)**
1. Go back to **staging site** → Environment variables
2. Click on `SUPABASE_SERVICE_ROLE_KEY` variable
3. Click the **eye icon** (slash-eye) next to "Production" value to reveal it
4. Click the **copy icon** (document with plus) to copy the value
5. Paste it here or use WhatsApp value

**Action in Production:**
1. Click the **"+"** icon
2. **Key:** `SUPABASE_SERVICE_ROLE_KEY`
3. **Value:** (paste the full JWT token)
4. **Scope:** "All scopes" (or "Production" if you want to set per context)
5. Save

---

#### ✅ Variable 4: ONESIGNAL_APP_ID

**From Staging:**
- Value: `b4f056ec-6753-4a80-ba72-bdfbe8527f9e`

**Action in Production:**
1. Click the **"+"** icon
2. **Key:** `ONESIGNAL_APP_ID`
3. **Value:** `b4f056ec-6753-4a80-ba72-bdfbe8527f9e`
4. **Scope:** "All scopes"
5. Save

---

#### ⚠️ Variable 5: ONESIGNAL_REST_API_KEY

**From Staging:**
- Value: Masked (ends with `byra`)

**How to get the full value:**
1. Go back to **staging site** → Environment variables
2. Click on `ONESIGNAL_REST_API_KEY` variable
3. Click the **eye icon** (slash-eye) next to "Production" value to reveal it
4. Click the **copy icon** (document with plus) to copy the value

**Action in Production:**
1. Click the **"+"** icon
2. **Key:** `ONESIGNAL_REST_API_KEY`
3. **Value:** (paste the revealed value)
4. **Scope:** "All scopes"
5. Save

---

#### ✅ Variable 6: VITE_SUPABASE_URL

**From Staging:**
- Value: `https://gyjagrtwrhctmgkootjj.supabase.co`

**Action in Production:**
1. Click the **"+"** icon
2. **Key:** `VITE_SUPABASE_URL`
3. **Value:** `https://gyjagrtwrhctmgkootjj.supabase.co`
4. **Scope:** "All scopes"
5. Save

---

#### ✅ Variable 7: VITE_SUPABASE_ANON_KEY

**From Staging:**
- Value: `eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi0iJzdXBhYmFzZSIsInJlZiI6Imd5amFncnR3cmhjdG1na29vdGpqIiwicm9sZSI6ImFub24iLCJpYXQi0jE3NTg3MzM2OTIsImV4cCI6MjA3NDMwOTY5Mn0.S6TrCrZWkISC7g14QmVriEQSBawLwxpcGYQKcNqpazA`

**Action in Production:**
1. Click the **"+"** icon
2. **Key:** `VITE_SUPABASE_ANON_KEY`
3. **Value:** (paste the long JWT token above)
4. **Scope:** "All scopes"
5. Save

---

#### ✅ Variable 8: MAILERLITE_API_KEY

**From Staging:**
- Value: Long base64 string (you viewed the full value)

**How to get the full value:**
1. Go back to **staging site** → Environment variables
2. Click on `MAILERLITE_API_KEY` variable
3. Click the **copy icon** (document with plus) next to "Production" value

**Action in Production:**
1. Click the **"+"** icon
2. **Key:** `MAILERLITE_API_KEY`
3. **Value:** (paste the copied value)
4. **Scope:** "All scopes"
5. Save

---

#### ⚠️ Variable 9: ADMIN_DEVICE_REGISTRATION_SECRET

**From Staging:**
- Value: Masked

**How to get the full value:**
1. Go back to **staging site** → Environment variables
2. Click on `ADMIN_DEVICE_REGISTRATION_SECRET` variable
3. Click the **eye icon** (slash-eye) next to "Production" value to reveal it
4. Click the **copy icon** (document with plus) to copy the value

**Action in Production:**
1. Click the **"+"** icon
2. **Key:** `ADMIN_DEVICE_REGISTRATION_SECRET`
3. **Value:** (paste the revealed value)
4. **Scope:** "All scopes"
5. Save

---

#### ❓ Variable 10: ALLOW_UNAUTH_DEV

**Status:** Need to check if this exists

**How to check:**
1. Go to **staging site** → Environment variables
2. Look for `ALLOW_UNAUTH_DEV` in the list
3. If it exists, click on it to view the value
4. Copy the value (usually `true` or `false`)

**If it exists, copy to Production:**
1. Click the **"+"** icon
2. **Key:** `ALLOW_UNAUTH_DEV`
3. **Value:** (usually `true` or `false`)
4. **Scope:** "All scopes"
5. Save

**Note:** This is usually a development-only variable, so you might not need it in production.

---

## 🎯 Summary: What You Need to Do

### Variables Ready to Copy (Have Full Values):
1. ✅ SUPABASE_URL
2. ✅ SUPABASE_ANON_KEY
3. ✅ ONESIGNAL_APP_ID
4. ✅ VITE_SUPABASE_URL
5. ✅ VITE_SUPABASE_ANON_KEY

### Variables That Need Revealing/Copying:
6. ⚠️ SUPABASE_SERVICE_ROLE_KEY (use WhatsApp value or reveal in staging)
7. ⚠️ ONESIGNAL_REST_API_KEY (reveal in staging, then copy)
8. ⚠️ MAILERLITE_API_KEY (copy from staging)
9. ⚠️ ADMIN_DEVICE_REGISTRATION_SECRET (reveal in staging, then copy)
10. ❓ ALLOW_UNAUTH_DEV (check if exists, probably not needed in production)

---

## 🔍 How to Reveal Masked Values in Netlify

For variables that show `****************` (masked):

1. Go to **staging site** → Environment variables
2. Click on the variable name (e.g., `ONESIGNAL_REST_API_KEY`)
3. You'll see a table with "Deploy context" and "Value"
4. Click the **eye icon with slash** (👁️🚫) next to the "Production" row
5. The value will be revealed
6. Click the **copy icon** (document with plus) 📄+ to copy the value
7. Use that value in production

---

## ✅ Final Checklist

After copying all variables to production, verify:

- [ ] SUPABASE_URL - copied
- [ ] SUPABASE_ANON_KEY - copied
- [ ] SUPABASE_SERVICE_ROLE_KEY - copied
- [ ] ONESIGNAL_APP_ID - copied
- [ ] ONESIGNAL_REST_API_KEY - copied
- [ ] VITE_SUPABASE_URL - copied
- [ ] VITE_SUPABASE_ANON_KEY - copied
- [ ] MAILERLITE_API_KEY - copied
- [ ] ADMIN_DEVICE_REGISTRATION_SECRET - copied (if needed)
- [ ] ALLOW_UNAUTH_DEV - checked (probably skip for production)

---

**Ready to start?** Begin with Variable 1 (SUPABASE_URL) - it's the easiest one! 🚀
