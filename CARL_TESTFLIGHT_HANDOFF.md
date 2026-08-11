# Carl – TestFlight Build Handoff

Instructions for building and submitting the Expo app to TestFlight.

## Critical: EAS only

**Do not run `netlify deploy`, trigger a Netlify deploy, or upload this repository to Netlify.**

`playtotl.com` is deployed separately from the web `main` branch. Publishing this mobile branch to that Netlify site replaces the current website with an old web artifact. The production functions required by the Expo app are already live.

## Build and submit

Use the mobile directory and EAS only:

```bash
cd apps/mobile
eas build --platform ios --profile production --auto-submit
```

Do not add any Netlify step before or after this command.

## Release target

| Setting | Value |
|--------|--------|
| Branch | `expo-ui-carl` |
| Version | `2.0.24` |
| Build | `47` |
| Bundle ID | `com.despia.totlnative` |
| `EXPO_PUBLIC_SITE_URL` | `https://playtotl.com` |
| `EXPO_PUBLIC_BFF_URL` | `https://totl-despia-production.up.railway.app` |
| OneSignal APNs mode | Production |

All public configuration is supplied by `apps/mobile/app.json` and `apps/mobile/app.config.ts`. No local environment file or website deployment is required.

## Troubleshooting

- **Push not working on Expo** – See `EXPO_PUSH_DEBUGGING.md`.
- **Build fails** – Check EAS build logs.
- **Submit fails** – Check Apple credentials with `eas credentials`.
- **Never use Netlify as a TestFlight troubleshooting step.**
