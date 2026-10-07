# Next store build

These fixes are on `mobile/shared-release-base`. They ship in the next iOS and Android binaries cut from that branch.

## Queued for next binary

1. **Mini-league GW Table follows live GW** — once the published gameweek has kicked off, GW Table / header / GW picker advance to that GW (e.g. GW3 → GW4). No more stuck on the previous GW while the rest of the app is live.
2. Stabilised so the table doesn’t thrash 3↔4 (auto-advance only goes forward; available GWs always include the current live GW).
3. **Make Your Predictions Test: swipe vs flip** — pan now wins over tap so swipe picks don’t flip the stats card (reported on iPhone 15 Pro; was fine on 17 Pro). Clean tap still flips for stats.
4. Mini-league tab **GW{n} Table** + red live dot; GW table polls while live; Predictions cards show FT/HT/minute like Home.

## Source

- `apps/mobile/src/screens/LeagueDetailScreen.tsx`
- `apps/mobile/src/components/predictions/PredictionsSwipeDeck.tsx`
- `apps/mobile/src/components/league/LeagueTabBar.tsx`

## Quick check (when built)

- During a live GW: open a mini league → **GW Table** shows current GW in the subtitle and picker (not the previous GW)
- Table stays put (no flickering between GWs)
- Manual GW dropdown still lets you browse older GWs
- Leave and re-enter the league — still on the live GW
- Admin → Make Your Predictions Test: **swipe** commits H/D/A; **tap** flips to stats (try on a smaller phone / 15 Pro if possible)
- Mini league Predictions: FT/HT/minute under expanded fixtures like Home

## Notes

- JS-only change — no native modules; still needs a new binary (no OTA).
- Do **not** deploy Expo branches to Netlify / playtotl.com.
