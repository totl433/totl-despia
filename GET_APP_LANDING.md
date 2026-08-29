# TotL web — download-first landing (handoff)

> For Carl — product rules, what’s built, and design notes.
> Last updated: 29 Aug 2026

## Goal

Most users should land on a **Get the App** page, not the game. Ads / physical QR codes can point here. People who only want the browser can still **Play online**, with a limited “remember me” so we can nudge them back to the app later.

## What’s built

- Download-first marketing page with **horizontal swipe** (5 slides)
- Same column layout on mobile + desktop (max ~430px, centred on wide screens)
- Routes + 30-day preference cookie
- Persistent **Get the app** entry points inside the logged-in product (web only)
- Feature art = Carl’s phone screenshots in `public/assets/get-app/*.jpg`; copy is HTML

**Local:** `http://localhost:5173/app` or `http://localhost:5174/app`  
**Prod URLs (once deployed):** `https://playtotl.com/` and `https://playtotl.com/app`

## Behaviour rules (current)

| Rule | Detail |
|------|--------|
| Homepage `/` | **Still the normal web game** (download-first not flipped yet) |
| Share / ads URL | `playtotl.com/app` **always** shows the download landing |
| Play online | Sets cookie for later when `/` becomes download-first; for now still useful from `/app` |
| In-product | **Get the app** in Profile + Desktop nav → `/app` |
| Platforms | Web + Expo only. Despia is deprecated. |

### Store CTAs

- **iOS:** [App Store — TotL](https://apps.apple.com/gb/app/totl-top-of-the-league/id6754661450)
- **Android:** **Coming soon** (disabled button for now)

## Slide structure (swipe — 5 pages)

1. **Crowd splash** — TotL logo, “Gamify your gameday”, Download / Coming soon / Play online  
2. **Predict every gameweek** — HTML copy + `predict.jpg`  
3. **Climb the global leaderboard** — HTML copy + `leaderboard.jpg`  
4. **Mini leagues get personal** — HTML copy + `leagues.jpg`  
5. **Start anytime and still compete** — HTML copy + `form.jpg` (+ Continue in browser)

Layout: always a **max 430px full-height column** (full-bleed on phones; centred on wide screens). No separate phone-shell breakpoint.

Assets live in `public/assets/get-app/`.

| Section | Body |
|---------|------|
| Predict every gameweek | Ten fixtures. Three outcomes. Score out of 10 depending on how often you’re right, or confidently wrong. |
| Climb the global leaderboard | Every correct prediction adds up. Follow your gut, stay consistent and work from beginner to actual menace. |
| Mini leagues get personal | Create leagues with 2–8 friends. Each week is head-to-head. Highest score wins. Group chats take a hit. |
| Start anytime and still compete | Joined late? Fear not. Your form tracks the last 5 and 10 weeks, so every gameweek is a chance to push on. |

## Design notes for Carl

- Brand green `#1C8376` / deep navy `#0a1224` / Gramatika
- Brand-first splash; one job per slide
- **Do not** paste full App Store marketing screens (text baked into image)
- Ideal handoff: export **phone UI / illustration only** PNGs @2x from Figma (nothing selected → no purple chrome), drop into `public/assets/get-app/`, wire in `GetApp.tsx`
- Crowd hero: `crowd.jpg` is a stand-in — replace when ready
- Android → real Play Store button when listing exists
- Desktop: centred column on crowd backdrop (not a separate phone-shell mode)

## Key code

| Piece | Location |
|-------|----------|
| Landing page | `src/pages/GetApp.tsx` |
| Preference cookie | `src/lib/playOnlinePreference.ts` |
| Route gate | `src/main.tsx` (`HomeOrGetApp`, `/app`) |
| In-product links | `src/pages/Profile.tsx`, `src/components/DesktopNav.tsx` |
| Storybook | `src/pages/GetApp.stories.tsx` |

Cookie: `totl_prefer_play_online` (30 days, `SameSite=Lax`).
