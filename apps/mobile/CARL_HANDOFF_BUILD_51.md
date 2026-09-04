# Carl handoff — TestFlight build 51

Branch: **`feat/carl-tf-51`**  
Base: `expo-ui-carl` @ `47c0616d` + unpushed work since TF **build 50**  
App: iOS `buildNumber` **51**, Android `versionCode` **2022220**, version **2.0.26**

## Already on `expo-ui-carl` since build 50 (pushed earlier — included when you branch from latest)

These are already on origin if Carl pulls `expo-ui-carl` first; listed so the “since last build” picture is complete:

### Fixes
- Instagram / WhatsApp share extensions open directly
- Score-sheet photo attached when sharing to Instagram
- Instagram/WhatsApp score-sheet share restored for TestFlight
- Season tables show on two-player mini leagues after results
- Mini-league predictions stay on the current gameweek
- Draw swipes harder to trigger by accident
- Host review email destination isolated (BFF)

### Features
- 26/27 round-up, live tables, forgot password, related TF fixes
- Username requirement + 26/27 leagues start at GW1 (earlier in the TF50 window)

---

## New on this branch (not previously pushed for Expo)

### Feature A — Retro Totl Daily (admin prototype)
- Full RTD game: intro → 3-2-1 → promote flip → 10 fixtures / 10s timer → reveal → score → play again
- Swipe stack (peek under-cards) + Home/Draw/Away
- 33 seasons (93/94→25/26), difficulty bands, favourite-won openers
- Season label as `2009/10` style
- Scoreboard screen (Today / All Time mock)
- Admin entry: Profile → Admin → **Retro Totl Daily**
- Historic club badges + kit colours (white kits use dark primaries so diagonals don’t vanish)
- Data scripts: ingest / tables / badge fetch (optional for Carl; runtime uses bundled JSON)

### Feature B — Prediction card flip + match stats (admin test flow)
- Tap-to-flip prediction cards → form / H2H / standings-style stats back
- Wired on **Make Your Predictions Test** (`PredictionsTestFlow`) so live GW flow stays safe
- Stats helpers in `matchPreviewStats` (live + test GW source)
- Deck / flippable card polish since the Aug 31 WIP commit

### Supporting
- `Screen` accepts optional `backgroundColor` (RTD navy shell)
- Expanded `TEAM_BADGES` / `TEAM_COLORS` for historic + promoted clubs
- Badge PNG refreshes (COV, HUL, IPS, NFO, etc.)

---

## Web-only (already live on playtotl.com — do **not** expect in Expo binary)

These fixed Safari / site chrome; Expo native does not need them:

- Mobile `visualViewport` height lock (top cut-off / bottom gap)
- Web RTD CSS midpoint flips (Expo already uses Reanimated)
- Web RTD route outside app-shell + iPhone button layout

---

## How Carl ships TF 51

```bash
git fetch origin
git checkout feat/carl-tf-51
git pull
cd apps/mobile
# verify
npx expo start   # smoke: Admin → Retro Totl Daily; Admin → Predictions Test → flip cards
# then your usual EAS / TestFlight path, e.g.
eas build --platform ios --profile production   # or whatever profile you use for TF
```

### Smoke checklist
1. Admin → Retro Totl Daily: stack peeks, flip to fixture, timer, reveal, scoreboard, play again  
2. Admin → Make Your Predictions Test: tap card flips to stats, swipe still predicts  
3. Live Predictions (non-test): unchanged swipe behaviour  
4. Share score sheet → Instagram / WhatsApp still works  

---

## Notes / risks
- RTD is **admin-only** prototype (unlimited replay, debug ranks on fixture cards).  
- Prediction flip/stats was previously tagged “Major — do not ship yet”; it is **test-flow only** on this branch. Confirm with Jof before enabling on live GW predictions.  
- Do **not** commit the accidental web copies under repo-root `src/` if they appear locally — Expo app code lives under `apps/mobile/`.
