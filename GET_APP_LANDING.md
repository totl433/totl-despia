# TotL web — download-first landing (handoff)

> For Carl — product rules, what’s built, and design notes.
> Last updated: 28 Aug 2026

## Goal

Most users should land on a **Get the App** page, not the game. Ads / physical QR codes can point here. People who only want the browser can still **Play online**, with a limited “remember me” so we can nudge them back to the app later.

## What’s built

- New download-first marketing page
- Routes wired in the web app
- 30-day preference cookie
- Persistent **Get the app** entry points inside the logged-in product (web only)
- Simple layout + App Store copy — Carl to snazz later

**Local:** `http://localhost:5173/` and `http://localhost:5173/app`  
**Prod URLs (once deployed):** `https://playtotl.com/` and `https://playtotl.com/app`

> Note: as of handoff, this may still be local-only — confirm deploy before pointing ads/QR at `/app`.

## Behaviour rules

| Rule | Detail |
|------|--------|
| Default landing | `playtotl.com` shows the **download page for everyone** (including already logged-in users) |
| Exception | If they chose **Play online** in the last **30 days**, `/` opens the normal web game instead |
| Ads / QR URL | `playtotl.com/app` **always** shows the download page (ignores the 30-day cookie) |
| Play online | Sets cookie → if logged in, go to game; if not, existing `/auth` login/signup, then game |
| Cookie lifetime | **30 days**, then show the download page again on `/` |
| In-product | Small **Get the app** link in **Profile** and **Desktop nav** (web only) → goes to `/app` |
| Platforms | Web + Expo only. Despia is deprecated. Don’t push this landing at Expo users; Get the app links are web-only |

### Store CTAs

- **iOS:** [App Store — TotL](https://apps.apple.com/gb/app/totl-top-of-the-league/id6754661450)
- **Android:** **Coming soon** (disabled button for now)

## Page structure (one scroll on mobile)

Kept simple on purpose — same vibe/copy as the App Store listing:

1. **Hero** — TotL logo, “Gamify your gameday”, short supporting line, Download / Coming soon / Play online
2. **Predict every gameweek**
3. **Climb the global leaderboard**
4. **Mini leagues get personal**
5. **Start anytime and still compete**
6. Footer repeat CTAs

Hero is a **dark green stadium-style placeholder** (gradient). **Carl: swap in the real App Store stadium asset when ready.**

Mobile layout is deliberately **tight above the fold** (logo near the top, less empty air) so CTAs + start of the first section show without much scrolling.

### App Store–aligned copy (current)

| Section | Body |
|---------|------|
| Predict every gameweek | Ten fixtures. Three outcomes. Score out of 10 depending on how often you’re right, or confidently wrong. |
| Climb the global leaderboard | Every correct prediction adds up. Follow your gut, stay consistent and work from beginner to actual menace. |
| Mini leagues get personal | Create leagues with 2–8 friends. Each week is head-to-head. Highest score wins. Group chats take a hit. |
| Start anytime and still compete | Joined late? Fear not. Your form tracks the last 5 and 10 weeks, so every gameweek is a chance to push on. |

## Design notes for Carl

- Brand green / dark forest vibe (avoid purple gradients / cream AI-default looks)
- Brand-first: TotL is the hero signal
- One composition on first viewport — not a dashboard
- No fancy screenshot carousels yet — web-native + App Store copy; polish/visuals are yours
- Android can become a real Play Store button when you have the listing

## Product intent (why 30 days)

We want app install as the main path. Play online is an escape hatch, not a permanent “never show the ad again.” After 30 days they see the download page on `/` again; `/app` always stays the campaign URL.

## Key code (for engineers)

| Piece | Location |
|-------|----------|
| Landing page | `src/pages/GetApp.tsx` |
| Preference cookie helpers | `src/lib/playOnlinePreference.ts` |
| Route gate (`/` vs download) | `src/main.tsx` (`HomeOrGetApp`, `/app`) |
| In-product links | `src/pages/Profile.tsx`, `src/components/DesktopNav.tsx` |
| Storybook | `src/pages/GetApp.stories.tsx` |

Cookie name: `totl_prefer_play_online` (max-age 30 days, `SameSite=Lax`).

## Open for Carl

1. Real hero / marketing imagery (replace gradient placeholder)
2. Visual polish / motion if wanted
3. Android store link when ready
4. Optional App Store screenshot-style mockups later

## Related recent web ship (not this landing)

Already on / going to production separately:

- Username required if profile has no display name
- Unique usernames in DB
- UK deadline time display fix
- Despia auth handoff removed
