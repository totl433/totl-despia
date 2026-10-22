---
title: The Players Daily Reminder
description: Scheduled 9:30am reminder that today's The Players game is ready
head: []
---

# The Players Daily Reminder

**Notification Key:** `players-daily`  
**Owner:** scheduled  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `players_daily:{day}` (UTC Players day, e.g. `2026-10-22`) |
| Dedupe Scope | global (one send log row per day, `user_id` null) |
| TTL | 86400 seconds |
| Preference Key | `daily-game-reminders` (Notification Centre > Games > Daily Game Reminders) |
| Collapse ID | `players_daily:{day}` |
| Thread ID | `totl_players` |
| Android Group | `totl_players` |

## Trigger

Scheduled function `sendPlayersDailyReminder`, run at 08:30 and 09:30 UTC. It sends only
on the run that is 9:30am in London (08:30 UTC during BST, 09:30 UTC during GMT).

## Audience

Everyone with an active, subscribed device who hasn't switched off Daily Game
Reminders in Notification Centre.

## Message

**Title:** `The Players`  
**Body:** `Today's ten players are in. Can you name their clubs?`

## Data Payload

```json
{
  "type": "players-daily",
  "screen": "players",
  "day": "2026-10-22",
  "url": "https://playtotl.com/players",
  "navigateTo": "https://playtotl.com/players"
}
```

The native app routes `type: players-daily` to The Players.
