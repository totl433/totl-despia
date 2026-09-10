# Carl — TestFlight build 57

**Branch:** `feat/carl-tf-51` (push after this handoff)  
**Build:** iOS **57** · Android **2022220** · version **2.0.27**

## What’s in this build

### Make Your Predictions Test
- Live **GW fixtures** (no fake GW3 list)
- Never locked by deadline/submit in test mode
- Flip-card stats from cache (`app_team_forms` + `app_fixture_h2h`) — positions use PL-style tie-break
- Swipe deck Map crash fix (`statsByFixtureIndex.get`)

### Retro Totl Daily
- Swipe / flip / reveal stack fixes and polish
- Shared flip + progress pips components

### The Players (new admin prototype)
- Admin → **The Players** — Retro Totl Daily–style player×club puzzle flow

### Other
- Username / display-name / auth small fixes
- Team colour tweak

## Ship it (EAS only — no Netlify)

```bash
git fetch origin
git checkout feat/carl-tf-51
git pull
cd apps/mobile
eas build --platform ios --profile production --auto-submit
```

## Quick smoke
1. Admin → Make Your Predictions Test → live GW fixtures, flip shows W/D/L + H2H (not all zeros)
2. Admin → Retro Totl Daily → swipe/flip still works
3. Admin → The Players → intro → play a short run
4. Normal Predictions unchanged (no admin flip)
5. Open on a **real phone** once so push re-registers (sim login can steal the active device)

## Notes
- Prediction flip stats are filled by web Api Admin publish / **Refresh card stats** — already backfilled for GW4.
- Do **not** deploy this branch to Netlify / playtotl.com.
