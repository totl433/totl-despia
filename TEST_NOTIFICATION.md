# Testing notifyLeagueMessage Function

To test the function directly and see what it returns, run this curl command:

```bash
curl -X POST https://totl-staging.netlify.app/.netlify/functions/notifyLeagueMessage \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN' \
  -d '{
    "leagueId": "c5602a5b-4cf1-45f1-b6dc-db0670db577a",
    "senderId": "f8a1669e-2512-4edf-9c21-b9f87b3efbe2",
    "senderName": "Test User",
    "content": "Test message"
  }'
```

Replace `YOUR_SUPABASE_JWT_TOKEN` with your actual Supabase JWT token (you can get this from the app's local storage or use the dev override).

This will show you exactly what the function is returning, which will help us understand why the status banner isn't appearing.

