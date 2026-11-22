---
notification_key: players-shootout
owner: client-triggered
status: active
channels:
  - push
audience: other_shootout_player
source: client_post
trigger:
  name: players_shootout_move
  event_id_format: "shootout:{challenge_id}:{event}:{version}"
dedupe:
  scope: per_user_per_event
  ttl_seconds: 86400
cooldown:
  per_user_seconds: 0
quiet_hours:
  start: null
  end: null
preferences:
  preference_key: players-shootout
  default: true
onesignal:
  collapse_id_format: "shootout:{challenge_id}"
  thread_id_format: "shootout:{challenge_id}"
  android_group_format: totl_players
deep_links:
  url_format: "/players/shootout/{challenge_id}"
rollout:
  enabled: true
  percentage: 100
---

# Players Shootout Notification

**Notification Key:** `players-shootout`  
**Owner:** client-triggered (the BFF, after a Shootout move)  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `shootout:{challenge_id}:{event}:{version}` |
| Dedupe Scope | per_user_per_event |
| TTL | 86400 seconds |
| Cooldown | 0 seconds per user |
| Quiet Hours | null |
| Preference Key | `players-shootout` |
| Collapse ID | `shootout:{challenge_id}` |
| Thread ID | `shootout:{challenge_id}` |
| Android Group | `totl_players` |

## Trigger

The BFF posts to `notifyPlayersShootout` with `{ challengeId, event }` and the signed-in player's token after a move in a Shootout (The Players head-to-head). The function checks the challenge itself, so it only sends what the challenge's current state supports.

| Event | When | Sent to |
|-------|------|---------|
| `invite` | A player is challenged | The challenged player |
| `accepted` | The challenge is accepted | The challenger (they play first) |
| `your-turn` | A card has been played and it's the other player's go | The player whose turn it is |
| `finished` | The challenge has a winner, or a player left it | The other player |

## Audience

- The other player in the challenge only
- Filtered by the `players-shootout` preference ("Shootout Challenges")

## Message

| Event | Title | Body |
|-------|-------|------|
| `invite` | `{name} wants a Shootout` | `The Players, head to head. You've got 24 hours to accept.` |
| `accepted` | `{name} accepted your Shootout` | `You're up first. You've got 24 hours to play your card.` |
| `your-turn` | `Your turn vs {name}` | `{name} scored. Match it to stay in.` / `{name} missed. Score to win the round.` / `Your card is ready.` |
| `finished` | `{name} won the Shootout` / `You beat {name} in the Shootout` | `Final score {me}–{them}` |
| `finished` (they left) | `{name} left the Shootout` | `You win. Fancy another?` |

## Deep Link

`https://playtotl.com/players/shootout/{challenge_id}` opens the challenge in the app.
