# App Review Notes

Copy the reply below into App Store Connect before resubmitting, then replace the bracketed placeholders with the current review values.

## Reply To App Review

Hello App Review,

We have addressed the issues from the previous review:

1. The photo library permission text now explains exactly how photos are used in the app. Top of the League only requests photo library access when a user chooses an image for a profile picture, a mini-league badge, or a chat group icon.
2. We removed the in-app "Restore Purchases" option. Our branded leaderboard season-access products are consumable one-time purchases, so the app no longer presents an Apple-style restore flow.
3. In-app purchases can be found from the Branded Leaderboards flow using the steps below.

### Steps To Find The In-App Purchase

1. Launch the app and sign in with:
   - Email: `[REVIEW_EMAIL]`
   - Password: `[REVIEW_PASSWORD]`
2. Open the `Leaderboards` tab.
3. Tap `Join`.
4. Enter join code: `[REVIEW_JOIN_CODE]`
5. This resolves to the paid branded leaderboard: `[LEADERBOARD_NAME]`
6. The app will show the season-access purchase screen for that leaderboard.
7. Complete the sandbox purchase to unlock that leaderboard for the season.

### Important Review Notes

- The season-access products under review are `totl_access_099` and `totl_access_199`.
- These are consumable one-time purchases used to unlock a specific branded leaderboard for the season.
- The app does not support Apple-style purchase restoration for these consumable products.
- If needed, please review in Apple's sandbox environment with the Paid Apps Agreement accepted in App Store Connect.

Thank you.

## Pre-Submit Checklist

- Confirm the App Store Connect products `totl_access_099` and `totl_access_199` are active and still configured as consumables.
- Confirm the matching RevenueCat products and offerings point to the same IDs.
- Confirm `[REVIEW_JOIN_CODE]` resolves to an active paid branded leaderboard before submission.
- Confirm the review account credentials above are valid.
- Confirm the build shows the updated photo-library permission text.
- Confirm the app no longer shows `Restore Purchases` anywhere in Profile.
