# Android Google Play Release Handoff

## Release

- Branch: `expo-ui-carl`
- App version: `2.0.24`
- Android version code: `2022219`
- Android package: `com.despia.totlnative`
- Android JavaScript engine: Hermes
- iOS remains unchanged at build `48` using JSC

## Successful Android Build

- EAS build ID: `bd25fd3d-d5df-4660-96aa-b759b6095838`
- Build page: https://expo.dev/accounts/carlstratton/projects/mobile/builds/bd25fd3d-d5df-4660-96aa-b759b6095838
- AAB: https://expo.dev/artifacts/eas/SW2qtAT0fDnNOkmcEtB4MIyxYYPSRXDonmIsyedVZcg.aab

The first Android attempt failed because Expo SDK 54 / React Native 0.81 no
longer supports the app's forced Android JSC configuration. Android now
overrides the global engine with Hermes. The successful build includes
RevenueCat React Native `9.15.2`, which uses Google Play Billing Library 8.

## EAS Credentials

EAS stores both credentials remotely; no credential files are committed.

- Android keystore: `Build Credentials 4A9SM7En9f`
- New upload-key SHA-1:
  `10:4C:E3:42:F7:BF:CD:E4:91:16:4C:5E:B3:8D:7B:4B:13:F7:73:01`
- Google service account:
  `eas-submit@totl-despia-b5e69.iam.gserviceaccount.com`

## Google Play Upload-Key Reset

Google Play currently expects the previous upload-key SHA-1:

`23:1D:60:B7:CF:5A:96:3D:46:0A:90:16:60:12:07:34:77:41:66:E0`

An upload-key reset request was submitted on August 13, 2026 using the new
EAS upload certificate. Google Play currently reports:

> There is a pending request for resetting the upload key of this app.

Do not rebuild or resubmit until Google approves the reset.

## Resume Steps

1. Pull `expo-ui-carl`.
2. In Google Play Console, open:
   `Protected with Play → Play Store protection → Manage Play app signing`.
3. Confirm the pending reset has cleared and the upload-key certificate SHA-1
   is the new EAS fingerprint above.
4. Submit the already-built AAB to Internal testing:

   ```bash
   cd apps/mobile
   eas submit --platform android \
     --id bd25fd3d-d5df-4660-96aa-b759b6095838 \
     --profile production \
     --non-interactive \
     --wait
   ```

5. Verify version `2.0.24` / code `2022219` in Internal testing and confirm
   Google recognizes Billing Library 8 or later.
6. Test login, purchases, notifications, and deep links.
7. Promote the same bundle to the active Closed testing - Alpha track and
   then Production. Open testing is paused and does not need updating.

## Previous Submission

- EAS submission ID: `698816e7-af2e-44ac-9210-c73c68f20187`
- It failed safely because the Play upload-key reset was not active yet.
- No Google Play release was changed.

## Guardrails

- Do not run a Netlify deployment.
- Do not build or submit iOS.
- Do not create another Android build unless this AAB is rejected for a reason
  unrelated to the pending upload-key reset.
- Do not commit or share the Google service-account JSON.
