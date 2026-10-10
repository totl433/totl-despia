---
title: Kickoff
description: Notification sent when a match kicks off (1st or 2nd half)
head: []
---

# Kickoff Notification

**Notification Key:** `kickoff`  
**Owner:** score-webhook  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | Single: `kickoff:{api_match_id}:{half}` · Slot: `kickoff:slot:{gw}:{slotKey}:{half}` |
| Dedupe Scope | per_user_per_event |
| TTL | 300 seconds |
| Preference Key | `score-updates` |
| Collapse ID | `kickoff:{api_match_id}:{half}` (slot uses shared `slot-{gw}-{slotKey}`) |
| Thread ID | `match:{api_match_id}` |
| Android Group | `totl_scores` |
| Deep Link | `/predictions` |

## Trigger

- First half: first time the match status reaches `IN_PLAY` (regardless of score)
- Second half: status changes from `PAUSED`/`HALF_TIME` to `IN_PLAY`
- **Simultaneous first-half kickoffs** (same GW + same UTC kickoff minute, e.g. six 15:00 games) send **one** notification: `Gameweek {n}` / `{count} games are underway!`, deduped via the slot event id
- Second-half kickoffs stay per-match (restarts are staggered)
- Idempotency: deduped per user via event id

## Audience

- Single match: users with picks for that fixture
- Slot batch: users with picks for **any** fixture in the kickoff slot
