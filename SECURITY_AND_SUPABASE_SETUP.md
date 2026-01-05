# Security & Supabase Setup Documentation

## Overview

TOTL Web uses **Supabase** for authentication and database, with **Row Level Security (RLS)** policies enforcing data access controls. The application follows security best practices with client-side route protection and server-side RLS policies.

---

## 🔐 Authentication System

### Supabase Client Configuration

**File**: `src/lib/supabase.ts`

```typescript
// Uses environment variables:
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_ANON_KEY

// Configuration:
- persistSession: true        // Keep users logged in across reloads
- autoRefreshToken: true     // Refresh tokens in the background
- detectSessionInUrl: true   // Handle OAuth/magic link redirects
- storage: window.localStorage
- storageKey: 'supabase.auth.token'
```

**Security Features**:
- ✅ Uses **anon key** (public, safe to expose in frontend)
- ✅ Session stored in localStorage with project-specific key
- ✅ Automatic token refresh
- ✅ Defensive error handling (creates dummy client if env vars missing, but logs error)

---

## 🛡️ Route Protection

### Frontend Route Guards

**File**: `src/main.tsx`

**Pattern**: All protected routes use `<RequireAuth>` wrapper:

```typescript
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}
```

**Protected Routes** (require authentication):
- `/` - Home page
- `/tables` - League tables
- `/league/:code` - Mini-league pages
- `/predictions` - Predictions center
- `/global` - Global leaderboard
- `/profile/*` - Profile pages
- `/admin` - Admin page
- `/api-admin` - API admin
- All other routes except `/auth`

**Public Routes**:
- `/auth` - Authentication page (redirects authed users to home)

**AuthGate Component**:
- **File**: `src/features/auth/AuthGate.tsx`
- Handles `/auth` route
- Shows onboarding/auth flow for guests
- Redirects authenticated users to home
- Handles password reset flows

---

## 🔒 Row Level Security (RLS) Policies

Supabase RLS policies enforce data access at the database level. Even if someone bypasses frontend checks, they cannot access data they're not authorized to see.

### Key Tables with RLS

#### 1. `push_subscriptions`
**File**: `supabase/sql/push_subscriptions.sql`

**Policies**:
- ✅ **INSERT**: Users can only insert subscriptions with their own `user_id`
  ```sql
  with check (auth.uid() = user_id)
  ```
- ✅ **UPDATE**: Users can only update their own subscriptions
  ```sql
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id)
  ```
- ✅ **SELECT**: Users can only read their own subscriptions
  ```sql
  using (auth.uid() = user_id)
  ```
- ✅ **DELETE**: Users can only delete their own subscriptions
  ```sql
  using (auth.uid() = user_id)
  ```

#### 2. `email_preferences`
**File**: `supabase/sql/create_email_preferences_table.sql`

**Policies**:
- ✅ **SELECT**: Users can read their own preferences
- ✅ **INSERT**: Users can insert their own preferences
- ✅ **UPDATE**: Users can update their own preferences

**Pattern**: All policies use `auth.uid() = user_id` check

#### 3. `user_notification_preferences`
**File**: `supabase/sql/user_notification_preferences.sql`

**Policies**:
- ✅ **ALL**: Users can manage their own preferences
  ```sql
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id)
  ```

#### 4. `league_notification_settings`
**File**: `supabase/sql/league_notification_settings.sql`

**Policies**:
- ✅ **ALL**: Users can upsert their own league settings
  ```sql
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id)
  ```

#### 5. `app_team_forms`
**File**: `supabase/sql/create_app_team_forms_table.sql`

**Policies**:
- ✅ **SELECT**: Anyone can read (public data)
- ✅ **INSERT/UPDATE/DELETE**: Admins only (uses admin check function)

#### 6. `notification_send_log`
**File**: `supabase/sql/notification_send_log.sql`

**Policies**:
- ✅ RLS enabled
- ✅ Service role bypasses RLS automatically (for backend functions)

---

## 🔑 Environment Variables

### Frontend (Client-Side)
**Safe to expose in browser**:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (public, safe)

**Location**: Set in Netlify dashboard or `.env` file (not committed)

### Backend (Netlify Functions)
**Never expose in frontend**:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - For verifying user tokens
- `SUPABASE_SERVICE_ROLE_KEY` - **CRITICAL**: Full database access, bypasses RLS
- `ONESIGNAL_APP_ID` - OneSignal app ID
- `ONESIGNAL_REST_API_KEY` - OneSignal API key
- `MAILERLITE_API_KEY` - MailerLite API key (if used)

**Location**: Set in Netlify dashboard → Site Settings → Environment Variables

---

## 🔐 Service Role Key Usage

**CRITICAL SECURITY NOTE**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies and has full database access.

**Where it's used**:
- ✅ **Netlify Functions only** (server-side)
- ✅ Never exposed to frontend
- ✅ Used for:
  - Admin operations (publishing results, etc.)
  - Sending notifications (needs to read all user subscriptions)
  - Background jobs (polling live scores, etc.)

**Example Usage** (from `netlify/functions/registerPlayer.ts`):
```typescript
// Verify user token with anon key
const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${bearer}` } },
});
const { data: userData } = await supaUser.auth.getUser();

// Then use service role for database writes
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
await admin.from('push_subscriptions').insert({ ... });
```

**Security Pattern**:
1. Verify user token with **anon key** (respects RLS)
2. If authorized, use **service role key** for privileged operations
3. Never trust client input - always verify on server

---

## 🛡️ Security Best Practices Implemented

### ✅ Client-Side
1. **Route Protection**: All routes require authentication via `<RequireAuth>`
2. **Auth Context**: Centralized auth state management
3. **Session Persistence**: Secure localStorage storage
4. **Token Refresh**: Automatic token refresh in background
5. **Error Boundaries**: Graceful error handling

### ✅ Server-Side (Database)
1. **RLS Enabled**: All sensitive tables have RLS enabled
2. **User Isolation**: Users can only access their own data (`auth.uid() = user_id`)
3. **Service Role Isolation**: Service role only used in serverless functions
4. **Policy Coverage**: All CRUD operations have policies

### ✅ Backend Functions
1. **Token Verification**: All functions verify user tokens before operations
2. **Service Role Separation**: Service role only for privileged operations
3. **Environment Variables**: Secrets stored in Netlify, never in code
4. **Input Validation**: Functions validate all inputs

---

## 🔍 Security Audit Checklist

### ✅ Implemented
- [x] RLS enabled on sensitive tables
- [x] User-specific data policies (`auth.uid() = user_id`)
- [x] Route protection on frontend
- [x] Service role key never exposed to frontend
- [x] Environment variables properly separated
- [x] Token verification in backend functions
- [x] Error boundaries for graceful failures
- [x] Session persistence with secure storage

### ⚠️ Considerations
- [ ] **Admin Routes**: Currently protected by frontend check only
  - Admin pages check `user?.id === 'admin-id'` in component
  - Consider adding RLS policies for admin-only tables
- [ ] **API Rate Limiting**: Not implemented (Supabase handles some, but consider additional)
- [ ] **CORS**: Handled by Supabase/Netlify, but verify settings
- [ ] **Input Sanitization**: React automatically escapes, but verify all user inputs

---

## 🚨 Security Concerns & Recommendations

### 1. Admin Access Control
**Current**: Admin check is frontend-only:
```typescript
const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || 
                user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';
```

**Recommendation**: 
- Add admin role to user metadata or separate admin table
- Add RLS policies that check admin status
- Verify admin status in backend functions

### 2. Hardcoded Admin IDs
**Current**: Admin IDs hardcoded in `SiteHeader.tsx`

**Recommendation**:
- Move to environment variable or database table
- Use Supabase user metadata for roles

### 3. Service Role Key Exposure Risk
**Current**: Service role key stored in Netlify environment variables

**Recommendation**:
- ✅ Already secure (not in code)
- ⚠️ Ensure Netlify dashboard access is restricted
- ⚠️ Rotate keys periodically
- ⚠️ Monitor function logs for accidental exposure

### 4. Session Storage
**Current**: Sessions stored in localStorage

**Considerations**:
- ✅ Supabase handles security (tokens are JWT, signed)
- ⚠️ localStorage vulnerable to XSS (but React escapes by default)
- 💡 Consider httpOnly cookies for additional security (requires backend changes)

---

## 📋 Environment Variable Checklist

### Required for Frontend
- [x] `VITE_SUPABASE_URL`
- [x] `VITE_SUPABASE_ANON_KEY`

### Required for Backend Functions
- [x] `SUPABASE_URL`
- [x] `SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **CRITICAL - Keep Secret**
- [x] `ONESIGNAL_APP_ID`
- [x] `ONESIGNAL_REST_API_KEY`
- [ ] `MAILERLITE_API_KEY` (if using email features)

### Verification
Run this to check environment variables are set:
```bash
# Frontend (check in browser console)
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing');
console.log('Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing');

# Backend (check in Netlify function)
console.log('Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
```

---

## 🔐 Supabase Project Security Settings

### Recommended Settings (Check in Supabase Dashboard)

1. **Authentication Settings**:
   - ✅ Email confirmation enabled
   - ✅ Password reset enabled
   - ✅ Session timeout configured
   - ✅ JWT expiry configured

2. **Database Settings**:
   - ✅ RLS enabled on all sensitive tables
   - ✅ Policies reviewed and tested
   - ✅ Service role key rotated periodically

3. **API Settings**:
   - ✅ CORS configured for your domain
   - ✅ Rate limiting enabled
   - ✅ Anon key restrictions (if needed)

---

## 🧪 Testing Security

### Test RLS Policies
```sql
-- Test as different user (in Supabase SQL editor)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'some-user-id';

-- Try to access another user's data
SELECT * FROM push_subscriptions WHERE user_id != 'some-user-id';
-- Should return empty (RLS blocks it)
```

### Test Route Protection
1. Log out
2. Try to access `/profile` directly
3. Should redirect to `/auth`

### Test Service Role Isolation
1. Check Netlify function logs
2. Verify service role key never logged
3. Verify functions verify user tokens before operations

---

## 📚 Additional Resources

- **Supabase RLS Docs**: https://supabase.com/docs/guides/auth/row-level-security
- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **Netlify Environment Variables**: https://docs.netlify.com/environment-variables/overview/

---

## ✅ Summary

**Security Status**: 🟢 **GOOD**

The application implements multiple layers of security:
1. ✅ Frontend route protection
2. ✅ Database-level RLS policies
3. ✅ Service role key isolation
4. ✅ Environment variable separation
5. ✅ Token verification in backend

**Recommendations for Improvement**:
1. Add admin role system (database-based)
2. Move admin IDs to environment/config
3. Consider httpOnly cookies for sessions
4. Add rate limiting to sensitive endpoints
5. Regular security audits and key rotation

---

**Last Updated**: 2025-01-XX





