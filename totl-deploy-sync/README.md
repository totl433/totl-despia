# Copy these into **totl-deploy** (Netlify **totl-staging**)

**totl-staging** builds from the **`totl-deploy`** GitHub repo — not from `totl-despia`.  
Until the files below are on **`totl-deploy` `main`**, `pushDebugReport` will never appear in Netlify Functions.

## Do this on **totl-deploy** (GitHub or local clone)

### 1. Add the function file

Copy **`netlify/functions/pushDebugReport.ts`** from this folder into the **same path** in **totl-deploy**:

`netlify/functions/pushDebugReport.ts`

### 2. Update **totl-deploy** `netlify.toml`

Open **`netlify-redirects-append.toml`** in this folder.  
Paste its contents **immediately above** this block in **totl-deploy**’s `netlify.toml`:

```toml
# Redirect everything else to index.html for SPA routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

(If **totl-deploy** already has similar `/totl-functions/` rules, merge carefully — avoid duplicates.)

### 3. Commit to **`main`** and let Netlify deploy

Optional: **Deploy project without cache** once in Netlify.

### 4. Check

`curl -sS "https://totl-staging.netlify.app/.netlify/functions/pushDebugReport"`  
→ should return **JSON** (e.g. `Unauthorized`), not HTML.

---

**Why this folder exists:** Cursor/CI can push to `totl-despia` but often **cannot** push to private **`totl-deploy`**. This bundle is the single place to copy from.
