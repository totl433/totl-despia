# Carl — TestFlight build 51

**Branch:** `feat/carl-tf-51` (pushed)  
**Build:** iOS **51** · Android **2022220** · version **2.0.26**

## What’s in this build

### Small fix
- **ML tied ranks** — if two players are level on points, both show `1=` (etc.) on GW + Season tables, with avatars

### Big features
- **Retro Totl Daily** — Admin → Retro Totl Daily (full daily prototype game)
- **Prediction flip + stats** — Admin → Make Your Predictions Test only (tap card to flip; live GW predictions unchanged)

## Ship it

```bash
git fetch origin
git checkout feat/carl-tf-51
git pull
cd apps/mobile
eas build --platform ios --profile production   # or your usual TF profile
```

Then submit that build to TestFlight as normal.

## Quick smoke
1. Mini-league table with two level players → both show tied rank (`1=`)  
2. Admin → Retro Totl Daily → play a run  
3. Admin → Make Your Predictions Test → tap to flip stats, swipe still works  
4. Normal Predictions still swipe-only (no flip)
