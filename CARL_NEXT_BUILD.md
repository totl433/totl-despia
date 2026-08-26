# Next TestFlight (after the share-card TestFlight — **not** App Store)

Another TestFlight only. Last build opened Instagram but the photo didn’t attach.

Bump the iOS build (51 → **52**, or whatever is next). Branch: `expo-ui-carl`.

## In this binary

1. Draw swipes less jumpy (rushed diagonals were saving as draws)
2. Mini-league Predictions = this GW only
3. Notif toggle: **New Gameweeks & TOTL Updates** (new GW + occasional all-user messages)
4. Overall + August tick live with the scores (red dots while games are on)
5. Mini-league pick chips sit under H / D / A
6. Forgot password on sign in
7. How To Play: monthly comps, not 5/10-week form
8. GW round-up is **26/27** (winners, results heading, auto-open). Player of the Month only at month-end (August = after GW2)
9. Round-up no longer freezes the app — if already stuck, kill and reopen (⌘R is not enough)
10. **Home SCORE share** — one score-sheet card (not a stacked pile). Instagram / WhatsApp open the apps with the image. First Instagram tap asks for Photos (required). Caption: *Check out my TOTL score sheet.*

## TestFlight / App Store notes

- Draw predictions are less likely to save by accident
- Mini-league Predictions always show this gameweek
- Overall and monthly tables update while games are live
- Gameweek round-up uses the 2026/27 season
- Forgot password on sign in
- How to Play explains monthly competitions
- Sharing a score sheet to Instagram/WhatsApp works again (Photos permission on first Instagram share)

## Not an app change (already on the server)

- Mini-league join window open through GW4 of 26/27
- All-user pushes honour the **New Gameweeks & TOTL Updates** toggle
- End-of-GW push backfill is live on Netlify (`a205c3d`) — no binary needed

## Quick check

- After GW1: round-up auto-opens, **26/27** winners (not last season), results say **2026/27 Season**, no Player of the Month
- Home still tappable after dismissing the round-up
- Live Overall / August move during a game
- Mini-league Predictions = this GW; chips under H/D/A
- Sign in → Forgot password
- Home **SCORE** → one card in the share tray (not stacked) → Instagram / WhatsApp on a phone with those apps installed
