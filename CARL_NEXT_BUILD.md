# Next App Store / TestFlight push

Already in the live store: **2.0.25**, including signup keyboard + confirm-email in the app.

## To include in the next build

1. **Prediction swipe — draws are less jumpy**
   - Rushed diagonal flicks were saving as draws instead of home/away (Will Middleton GW1).
   - Draw now needs a clearer downward swipe: 140px (was 110) and the same 1.2 direction lock as home/away.
   - File: `apps/mobile/src/components/predictions/PredictionsSwipeDeck.tsx`

2. **Mini-league Predictions — current GW only**
   - Removed the leftover “2026/27 · fixtures out…” bar and season switcher.
   - Predictions always show this gameweek; you cannot jump season or GW from that tab.
   - File: `apps/mobile/src/screens/LeagueDetailScreen.tsx`

## Not an app change (already live on the server)

- Mini-league join window resets at the start of each season (existing leagues open through GW4 of 26/27). Invite join uses the Netlify function; no binary needed.
