# Next App Store / TestFlight push

Live store binary is **2.0.25 (build 49)**. Add anything below that is not already in that binary.

## To include in the next build

1. **Prediction swipe — draws are less jumpy**
   - Rushed diagonal flicks were saving as draws instead of home/away (Will Middleton GW1).
   - Draw now needs a clearer downward swipe: 140px (was 110) and the same 1.2 direction lock as home/away.
   - File: `apps/mobile/src/components/predictions/PredictionsSwipeDeck.tsx`

2. **Signup keyboard + confirm-email in the app** (commit `e366a5e`, after build 49)
   - Keyboard-aware signup so Sign up sits above the keyboard.
   - Confirm-email deep link opens in the app (`com.despia.totlnative://auth/callback`).
   - Confirm with Carl whether this already shipped in a later TestFlight; if not, include it.

## Not an app change (already live on the server)

- Mini-league join window resets at the start of each season (existing leagues open through GW4 of 26/27). Invite join uses the Netlify function; no binary needed.
