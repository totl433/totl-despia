# Environment Variables - Copy One by One
**From:** Staging → **To:** Production (playtotl.com)

---

## Variable 1: SUPABASE_URL

**Steps:**
1. Go to **playtotl.com** site in Netlify Dashboard
2. **Project configuration** → **Environment variables**
3. Click the **"+"** icon (top right)
4. Fill in:
   - **Key:** `SUPABASE_URL`
   - **Value:** (paste this):
```
https://gyjagrtwrhctmgkootjj.supabase.co
```
   - **Scope:** Select "All scopes"
5. Click **"Add variable"** or **"Save"**

---

## Variable 2: SUPABASE_ANON_KEY

**Steps:**
1. Still in **playtotl.com** → Environment variables
2. Click the **"+"** icon
3. Fill in:
   - **Key:** `SUPABASE_ANON_KEY`
   - **Value:** (paste this):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5amFncnR3cmhjdG1na29vdGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzM2OTIsImV4cCI6MjA3NDMwOTY5Mn0.S6TrCrZWkISC7g14QmVriEQSBawLwxpcGYQKcNqpazA
```
   - **Scope:** "All scopes"
4. Save

---

## Variable 3: SUPABASE_SERVICE_ROLE_KEY

**Steps:**
1. Still in **playtotl.com** → Environment variables
2. Click the **"+"** icon
3. Fill in:
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** (paste this - from your WhatsApp message):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYxNzA2NDY0MiwiZXhwIjoxNzc0ODMyNjQyfQ.rLXDM5_xPnOWC1sIOXDliYdCGM-Mj7DGHvP_Jd8a-wE
```
   - **Scope:** "All scopes"
4. Save

**Note:** This is the service_role secret from your WhatsApp message. If you need to get the real one from staging, go to staging → Environment variables → click `SUPABASE_SERVICE_ROLE_KEY` → click eye icon to reveal → copy.

---

## Variable 4: ONESIGNAL_APP_ID

**Steps:**
1. Still in **playtotl.com** → Environment variables
2. Click the **"+"** icon
3. Fill in:
   - **Key:** `ONESIGNAL_APP_ID`
   - **Value:** (paste this):
```
b4f056ec-6753-4a80-ba72-bdfbe8527f9e
```
   - **Scope:** "All scopes"
4. Save

---

## Variable 5: ONESIGNAL_REST_API_KEY

**⚠️ NEED TO REVEAL IN STAGING FIRST**

**Steps to get value:**
1. Go to **staging site** → Environment variables
2. Click on `ONESIGNAL_REST_API_KEY` (the variable name)
3. You'll see the detail page
4. Click the **eye icon with slash** (👁️🚫) next to "Production" row to reveal the value
5. Click the **copy icon** (document with plus 📄+) to copy the value
6. **Come back to this list and use that value**

**Then in Production:**
1. Go to **playtotl.com** → Environment variables
2. Click the **"+"** icon
3. Fill in:
   - **Key:** `ONESIGNAL_REST_API_KEY`
   - **Value:** (paste the value you just copied)
   - **Scope:** "All scopes"
4. Save

---

## Variable 6: VITE_SUPABASE_URL

**Steps:**
1. Still in **playtotl.com** → Environment variables
2. Click the **"+"** icon
3. Fill in:
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** (paste this):
```
https://gyjagrtwrhctmgkootjj.supabase.co
```
   - **Scope:** "All scopes"
4. Save

---

## Variable 7: VITE_SUPABASE_ANON_KEY

**Steps:**
1. Still in **playtotl.com** → Environment variables
2. Click the **"+"** icon
3. Fill in:
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** (paste this):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5amFncnR3cmhjdG1na29vdGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzM2OTIsImV4cCI6MjA3NDMwOTY5Mn0.S6TrCrZWkISC7g14QmVriEQSBawLwxpcGYQKcNqpazA
```
   - **Scope:** "All scopes"
4. Save

---

## Variable 8: MAILERLITE_API_KEY

**⚠️ NEED TO COPY FROM STAGING**

**Steps to get value:**
1. Go to **staging site** → Environment variables
2. Click on `MAILERLITE_API_KEY` (the variable name)
3. You'll see the detail page with the full value
4. Click the **copy icon** (document with plus 📄+) next to "Production" row to copy the value
5. **Come back to this list and use that value**

**Then in Production:**
1. Go to **playtotl.com** → Environment variables
2. Click the **"+"** icon
3. Fill in:
   - **Key:** `MAILERLITE_API_KEY`
   - **Value:** (paste the value you just copied)
   - **Scope:** "All scopes"
4. Save

---

## Variable 9: ADMIN_DEVICE_REGISTRATION_SECRET

**⚠️ NEED TO REVEAL IN STAGING FIRST**

**Steps to get value:**
1. Go to **staging site** → Environment variables
2. Click on `ADMIN_DEVICE_REGISTRATION_SECRET` (the variable name)
3. You'll see the detail page
4. Click the **eye icon with slash** (👁️🚫) next to "Production" row to reveal the value
5. Click the **copy icon** (document with plus 📄+) to copy the value
6. **Come back to this list and use that value**

**Then in Production:**
1. Go to **playtotl.com** → Environment variables
2. Click the **"+"** icon
3. Fill in:
   - **Key:** `ADMIN_DEVICE_REGISTRATION_SECRET`
   - **Value:** (paste the value you just copied)
   - **Scope:** "All scopes"
4. Save

---

## Variable 10: ALLOW_UNAUTH_DEV (Optional - Probably Skip)

**Status:** This is usually a development-only variable. You probably don't need this in production.

**If you want to check:**
1. Go to **staging site** → Environment variables
2. Look for `ALLOW_UNAUTH_DEV` in the list
3. If it exists, check its value (usually `true` or `false`)
4. **Recommendation:** Skip this for production (it's for local dev only)

---

## ✅ Quick Copy Checklist

Copy these in order:

- [ ] 1. SUPABASE_URL ✅ (value provided above)
- [ ] 2. SUPABASE_ANON_KEY ✅ (value provided above)
- [ ] 3. SUPABASE_SERVICE_ROLE_KEY ✅ (value provided above - from WhatsApp)
- [ ] 4. ONESIGNAL_APP_ID ✅ (value provided above)
- [ ] 5. ONESIGNAL_REST_API_KEY ⚠️ (need to reveal in staging)
- [ ] 6. VITE_SUPABASE_URL ✅ (value provided above)
- [ ] 7. VITE_SUPABASE_ANON_KEY ✅ (value provided above)
- [ ] 8. MAILERLITE_API_KEY ⚠️ (need to copy from staging)
- [ ] 9. ADMIN_DEVICE_REGISTRATION_SECRET ⚠️ (need to reveal in staging)
- [ ] 10. ALLOW_UNAUTH_DEV (skip - dev only)

---

**Start with Variable 1 and work your way through!** 🚀
