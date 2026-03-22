# Chat Reporting

## Overview

The mobile app supports reporting chat messages to help with Online Safety Act compliance.

Users can:
1. Long-press a chat message
2. Tap `Report` from the reactions sheet
3. Enter a reason
4. Submit the report
5. See a success confirmation sheet

The backend stores the report in Supabase and attempts to email the moderation inbox.

## User Flow

### Entry point

The report flow starts from the existing long-press chat action sheet.

Relevant mobile files:
- `apps/mobile/src/components/chat/ChatActionsSheet.tsx`
- `apps/mobile/src/components/chat/LeagueChatTab.tsx`
- `apps/mobile/src/components/chat/LeagueChatTabV2.tsx`

### Sheet states

`ChatActionsSheet` supports 3 states:
- `actions`: emoji reactions, `Reply`, and top-right `Report`
- `reportForm`: multiline reason input and `Report` button
- `reportSuccess`: thank-you confirmation and `Close`

## Backend Flow

Relevant backend files:
- `apps/bff/src/server.ts`
- `apps/bff/src/reporting.ts`
- `apps/bff/src/auth.ts`
- `apps/bff/src/env.ts`

### API endpoint

Authenticated endpoint:

`POST /v1/chat/reports`

Request body:

```json
{
  "messageId": "uuid",
  "reason": "string"
}
```

### What the endpoint does

The BFF:
1. Authenticates the user
2. Loads the target message from `league_messages`
3. Confirms the reporting user belongs to the same league
4. Inserts a row into `league_message_reports`
5. Attempts to send a moderation email
6. Returns `{ "ok": true }`

Important behavior:
- report storage in Supabase is the source of truth
- email delivery is best-effort
- if email fails after the report is stored, the API still returns success and logs the failure

## Supabase Storage

Migration file:
- `supabase/sql/league_message_reports.sql`

Table:
- `public.league_message_reports`

Stored fields:
- `id`
- `reporter_user_id`
- `reporter_email`
- `league_id`
- `message_id`
- `reason`
- `reported_message_content`
- `reported_message_user_id`
- `status`
- `created_at`

### RLS

Policies allow:
- insert only by the authenticated reporting user
- insert only for leagues the user belongs to
- select only for the reporting user

## Email Delivery

Moderation emails are sent to:
- `hello+onlinesafety@playtotl.com`

The email includes:
- report id
- reporter id, email, and name
- reported message id, content, and time
- reported user id and name
- league id, name, and code
- report reason
- chat link

### Chat link format

The email includes a league chat URL in this format:

`{SITE_URL}/league/{LEAGUE_CODE}?tab=chat&messageId={MESSAGE_ID}`

This matches the app's existing league/chat deep-link structure.

## Environment Variables

BFF env vars:
- `RESEND_API_KEY`
- `SITE_URL`
- `REPORT_EMAIL_FROM`
- `REPORT_EMAIL_TO`

Defaults:
- `REPORT_EMAIL_TO` defaults to `hello+onlinesafety@playtotl.com`
- `REPORT_EMAIL_FROM` defaults to `hello@playtotl.com`

### Resend behavior

If the configured sender domain is not verified, the BFF retries with:
- `onboarding@resend.dev`

If email still fails:
- the report remains stored
- the user still sees success
- the failure is logged in Railway and captured by Sentry

## Mobile API Client

Relevant file:
- `packages/api-client/src/index.ts`

Client method:
- `submitChatMessageReport({ messageId, reason })`

The mobile app uses the existing authenticated API client from:
- `apps/mobile/src/lib/api.ts`

## Verification

### In app

Successful UX result:
- the user sees the `Thanks for your feedback` confirmation sheet

### In Supabase

Run:

```sql
select
  id,
  reporter_user_id,
  reporter_email,
  league_id,
  message_id,
  reason,
  reported_message_content,
  reported_message_user_id,
  status,
  created_at
from public.league_message_reports
order by created_at desc
limit 20;
```

Expected:
- a new row appears for the submitted report

### In Railway

Check logs for:
- successful request handling for `POST /v1/chat/reports`
- any email delivery warnings or errors

### In email inbox

Check:
- `hello+onlinesafety@playtotl.com`

Expected:
- moderation email arrives if Resend sender rules allow delivery

## Failure Modes

### `Route POST:/v1/chat/reports not found`

Cause:
- deployed BFF does not include the new route yet

Fix:
- deploy the latest BFF code

### Resend 403 sender/domain error

Cause:
- sender domain not verified in Resend

Current behavior:
- report is still stored
- email is retried with `onboarding@resend.dev`
- user still sees success

### No row in Supabase

Cause:
- request failed before insert
- auth failure
- league membership failure
- invalid message id

## Notes

- report persistence is the authoritative signal that the feature worked
- email is a notification layer, not the source of truth
- the current implementation stores reports but does not yet include moderation tooling or admin triage UI
