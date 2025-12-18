# MailerLite Integration Setup Guide

This document explains how to set up and use the MailerLite email integration for TOTL.

## Overview

The MailerLite integration allows users to:
- Opt in/out of email notifications via the Email Preferences page
- Automatically sync preferences to MailerLite groups
- Receive targeted emails based on their preferences

## Prerequisites

1. **MailerLite Account**: You need an active MailerLite account
2. **DNS Configuration**: DKIM, SPF, and DMARC records must be configured in Netlify DNS (already done per screenshots from Steve)
3. **API Access**: MailerLite API key

## Step 1: Get MailerLite API Key

1. Log in to your MailerLite account
2. Navigate to **Integrations** → **MailerLite API**
3. Click **Generate new token**
4. Give it a name (e.g., "TOTL Web Integration")
5. Copy the API key immediately (it's only shown once)
6. Store it securely

## Step 2: Add Environment Variable

Add the MailerLite API key to your Netlify environment variables:

1. Go to Netlify Dashboard → Your Site → **Site settings** → **Environment variables**
2. Add new variable:
   - **Key**: `MAILERLITE_API_KEY`
   - **Value**: (paste your API key from Step 1)
3. Click **Save**
4. **Important**: Redeploy your site for the environment variable to take effect

## Step 3: Verify DNS Configuration

Verify that DNS records are correctly configured (should already be done):

- ✅ **DKIM CNAME**: `litesrv._domainkey` → `litesrv._domainkey.mlsend.com`
- ✅ **SPF TXT**: `@` → `v=spf1 include:zoho.com include:_spf.mlsend.com ~all`
- ✅ **DMARC TXT**: `_dmarc` → `v=DMARC1; p=none; rua=mailto:hello@playtotl.com`
- ✅ **Domain Verification TXT**: `@` → `mailerlite-domain-verification=...`

Verify in MailerLite:
1. Go to MailerLite → **Settings** → **Sending domains**
2. Click **Check records**
3. All should show ✅ (green checkmarks)

## Step 4: Test the Integration

### Test User Preference Sync

1. Sign in to the app
2. Go to **Profile** → **Email Preferences**
3. Toggle one or more preferences ON
4. Check browser console for sync success message
5. In MailerLite, verify the user appears in the appropriate groups:
   - "New Gameweek Published" group
   - "Results Published" group
   - "TOTL News & Updates" group

### Test Sync Function Directly

You can test the sync function via curl or Postman:

```bash
# Get your Supabase access token first (from browser dev tools after signing in)
curl -X POST https://your-site.netlify.app/.netlify/functions/syncEmailPreferences \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "synced": true,
  "email": "user@example.com",
  "preferences": {
    "new_gameweek": true,
    "results_published": false,
    "news_updates": true
  }
}
```

## How It Works

### User Preference Storage

- Preferences are stored in the `email_preferences` table in Supabase
- Each user has three boolean columns:
  - `new_gameweek`: Email when new fixtures are published
  - `results_published`: Email when results are updated
  - `news_updates`: Occasional feature updates

### Automatic Sync

When a user toggles a preference on the Email Preferences page:
1. Preference is saved to the database
2. A background sync is triggered automatically
3. User is added/removed from MailerLite groups based on preferences
4. If all preferences are OFF, user is unsubscribed from MailerLite

### MailerLite Groups

The integration automatically creates three groups in MailerLite:
- **New Gameweek Published**: Users who want gameweek notification emails
- **Results Published**: Users who want results notification emails
- **TOTL News & Updates**: Users who want news/update emails

Users can be in multiple groups if they've opted into multiple email types.

## Sending Emails

### Check Preferences Before Sending

Use the helper functions to check if users should receive emails:

```typescript
import { shouldSendEmail, getEmailsForEmailType } from './netlify/functions/utils/emailPreferences';

// Check single user
const shouldSend = await shouldSendEmail(userId, 'new-gameweek');

// Get all users who should receive an email type
const emails = await getEmailsForEmailType('new-gameweek');
```

### Send via MailerLite

1. In MailerLite dashboard, create a campaign
2. Target one of the preference groups:
   - "New Gameweek Published"
   - "Results Published"
   - "TOTL News & Updates"
3. Compose and send your email

Only users who have opted in will receive the email.

## API Endpoints

### Sync User Preferences

**Endpoint**: `POST /.netlify/functions/syncEmailPreferences`

**Headers**:
- `Authorization: Bearer <supabase-access-token>` (required for single user sync)

**Body** (optional):
```json
{
  "userId": "uuid"  // Optional - defaults to authenticated user
}
```

**Response**:
```json
{
  "synced": true,
  "email": "user@example.com",
  "preferences": {
    "new_gameweek": true,
    "results_published": false,
    "news_updates": true
  }
}
```

### Sync All Users (Admin Only)

**Endpoint**: `POST /.netlify/functions/syncEmailPreferences?all=true&serviceKey=YOUR_SERVICE_ROLE_KEY`

**Note**: This requires the Supabase service role key in the query parameter for security.

**Response**:
```json
{
  "synced": 150,
  "errors": 2,
  "total": 152
}
```

## Troubleshooting

### Preferences Not Syncing

1. **Check environment variable**: Ensure `MAILERLITE_API_KEY` is set in Netlify
2. **Check browser console**: Look for error messages when toggling preferences
3. **Check Netlify function logs**: View function logs in Netlify dashboard
4. **Verify API key**: Test the API key is valid and has proper permissions

### Users Not Appearing in MailerLite

1. **Check sync function**: Manually trigger sync for the user
2. **Verify email exists**: User must have an email address in Supabase auth
3. **Check MailerLite groups**: Groups are created automatically on first sync

### API Errors

Common errors:
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Group doesn't exist (should auto-create)
- `429 Too Many Requests`: Rate limit exceeded (wait and retry)

## Default Behavior

- **New users**: All preferences default to `false` (opted out)
- **Existing users**: No preferences row until they visit Email Preferences page
- **Missing preference**: Treated as opted out (don't send email)
- **All preferences OFF**: User is unsubscribed from MailerLite

## Security Notes

- API key is stored as environment variable (never in code)
- User preferences are protected by Row Level Security (RLS)
- Users can only manage their own preferences
- Service role key required for admin operations (syncing all users)

## Next Steps

1. ✅ Add `MAILERLITE_API_KEY` to Netlify environment variables
2. ✅ Verify DNS records are configured correctly
3. ✅ Test user preference sync
4. ✅ Create email campaigns in MailerLite targeting preference groups
5. ✅ Use helper functions to check preferences before sending emails programmatically

## Support

If you encounter issues:
1. Check Netlify function logs
2. Check MailerLite API documentation: https://developers.mailerlite.com/docs/
3. Verify all environment variables are set correctly
4. Ensure DNS records are verified in MailerLite dashboard

