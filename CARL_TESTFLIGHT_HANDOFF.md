# Carl – TestFlight Build Handoff

Instructions for building and submitting the Expo app to TestFlight. Everything is ready in the branch.

---

## Prerequisites

1. **Deploy totl-staging first** (critical for push notifications)
   - The multi-device push changes are in `netlify/functions/`. These must be live on **totl-staging** before the new TestFlight will work correctly.
   - Push the branch that triggers totl-staging’s Netlify deploy, or manually trigger a deploy.
   - Without this, Expo and Despia will still conflict over push tokens.

2. **EAS CLI** – `npm install -g eas-cli` and `eas login` if needed.

---

## Build & Submit

From repo root:

```bash
# 1. Build for iOS (production profile)
cd apps/mobile && eas build --platform ios --profile production

# 2. After build completes, submit to TestFlight
eas submit --platform ios --profile production --latest
```

Or build and submit in one step:

```bash
cd apps/mobile && eas build --platform ios --profile production --auto-submit
```

---

## Config (already set)

| Setting | Value |
|--------|--------|
| `EXPO_PUBLIC_SITE_URL` | `https://totl-staging.netlify.app` (push registration) |
| `EXPO_PUBLIC_BFF_URL` | `https://totl-despia-production.up.railway.app` |
| `EXPO_PUBLIC_ONESIGNAL_APP_ID` | `b4f056ec-6753-4a80-ba72-bdfbe8527f9e` |
| OneSignal APNs mode | Production (for TestFlight) |

All values are in `apps/mobile/app.json` → `extra`. No `env.local` needed for EAS builds.

---

## Build number

`eas.json` has `"autoIncrement": false` for production. If Apple rejects for duplicate build number, bump `buildNumber` in `apps/mobile/app.json` (e.g. 10 → 11) and rebuild.

---

## After TestFlight

- **Despia** and **Expo** both register with totl-staging.
- Both stay active in the DB (multi-device).
- Notifications go to both apps.
- Users with both installed may see duplicate notifications during overlap.

---

## Troubleshooting

- **Push not working on Expo** – See `EXPO_PUSH_DEBUGGING.md`.
- **Build fails** – Check EAS build logs; OneSignal plugin needs native rebuild.
- **Submit fails** – Ensure Apple credentials are configured in EAS (`eas credentials`).
