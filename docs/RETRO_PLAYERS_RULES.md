# Retro Totl Daily — The Players

Behind-the-scenes rules for how a round is dealt and played. Written 8 October 2026.

The live web game and the Expo app both read the same Supabase table. This file is the place to check the rules. The short rules popup in the game is the player-facing version.

## What a round is

Ten cards. One Premier League player per card, and that player appears only once in the round. Each card shows his name and one season. The player picks which club he played for in that season. Three clubs are offered. One is correct.

The number on the card, on the reveal, and in the appearances column of the score list is Premier League games **at that club**. A long spell at the club is the easier card.

## Where the list comes from

The game loads `public.retro_player_club_apps`. It does not read the TypeScript seed at runtime, and it does not call Wikipedia while someone is playing.

Each row is one player at one club. `appearances` is the Premier League total for that spell, summed if he had more than one stint there. `spells` keeps those stints separate, so the season on the front of the card is never a gap year. `wiki_views` is the same number on every club row for that player. It is not shown in the game.

Wikipedia views are English Wikipedia user pageviews, all-access, added up month by month from July 2015 through October 2026. The count uses the canonical article (Petr Čech, Sergio Agüero, Nemanja Vidić), not a low-traffic ASCII spelling.

Counts below are from the checked list on 8 October 2026: 731 players, 1,517 club rows. A player with two clubs in the same pot is counted once. A player with clubs in two pots is counted in both.

## The ten pots

Fame is a floor, and the floor steps down as the spells get shorter. A player is dealt on a card when his games at that club are in the band and his Wikipedia views meet that card’s floor. A famous player can still appear later if the spell at that club is short. Someone under 250,000 views only shows up from card 8 onward.

652 of the 731 players can be dealt.

| Card | Games at that club | Players | Fame floor |
|---|---|---|---|
| 1 | 200 or more | 94 | 2 million or more |
| 2 | 150–199 | 81 | 1 million or more |
| 3 | 100–149 | 141 | 1 million or more |
| 4 | 80–99 | 119 | 500,000 or more |
| 5 | 60–79 | 125 | 500,000 or more |
| 6 | 40–59 | 134 | 250,000 or more |
| 7 | 30–39 | 98 | 250,000 or more |
| 8 | 20–29 | 114 | anyone |
| 9 | 10–19 | 137 | anyone |
| 10 | 1–9 | 132 | anyone |

These bands are in `src/lib/retroPlayers/buildPuzzle.ts` (`CARD_APPEARANCE_BANDS`, `CARD_MIN_WIKI_VIEWS`). The same constants are in the Expo app copy of that file.

## Wrong clubs

Cards 1–5: both wrong clubs are ones he never played for in the Premier League.

Cards 6–10: if he has another Premier League club on the list, one wrong answer is that club. The other wrong answer is a club he never played for. The season on the front is what separates a real other club from the right one.

Cards 6–9 prefer a player who has another Premier League club, so that real other club can be offered. Card 10 uses the whole 1–9 pot, so a one-club cameo can still come up.

## How a round plays

- Start goes straight to card 1.
- Ten seconds on each card (`PLAYERS_TIMER_MS`).
- Swipe the card or tap a club.
- A correct answer stays up for 0.9 seconds (`PLAYERS_RESULT_HOLD_MS`), then the next card starts.
- A wrong answer, a timeout, or the last card shows the result and waits. Swipe, or tap “See score”.
- Timeout ends the run and shows the correct club.
- There is no 3-2-1 countdown, no “Checking…”, and no confetti.
