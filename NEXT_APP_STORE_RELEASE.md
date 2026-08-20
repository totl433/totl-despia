# Carl – App Store push

Branch: `expo-ui-carl`  
Bump version/build from **2.0.24 / 48**, then:

```bash
cd apps/mobile
eas build --platform ios --profile production --auto-submit
```

Do **not** deploy this branch to Netlify.

## What’s in this build

- Signup now requires a username (plus confirm password).
- Anyone already signed in with no username is asked to choose one before they can play.
- New accounts land on 2026/27 GW1, not last season.
- Mini-leagues play from GW1 this season (old “started at GW7/8” names no longer apply).
- Coventry, Hull and Ipswich colours/patterns on swipe cards.

## App Store “What’s New” (paste)

Choose a username to play. Mini-leagues are ready for GW1. Coventry, Hull and Ipswich are in.

## After it’s live

Jof will send a one-off push to the handful of people who signed up with no username:

**Title:** Choose a username to play!  
**Body:** Update TotL, choose a username, and you’re ready for GW1.
