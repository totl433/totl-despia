---
title: Half-Time
description: Notification sent at half-time with current score
head: []
---

# Half-Time Notification

**Notification Key:** `half-time`  
**Owner:** score-webhook  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `halftime:{api_match_id}` |
| Dedupe Scope | per_user_per_event |
| TTL | 600 seconds |
| Collapse ID | `halftime:{api_match_id}` |
| Thread ID | `match:{api_match_id}` |
| Android Group | `totl_scores` |

Note: Half-time has no preference key - always sent.

## Trigger

Triggered when match status changes to `PAUSED`.

## Audience

Users with picks for the fixture.

## Payload Data

```json
{
  "type": "half_time",
  "api_match_id": 12345,
  "fixture_index": 3,
  "gw": 16
}
```

## Message Template

**Title:** `Half-Time`

**Body:** `{homeTeam} {homeScore}-{awayScore} {awayTeam} {indicator}`

The indicator shows whether the user's pick matches the current result at half-time:
- `✅` - User's pick matches the current result (e.g., picked Home and Home is winning, or picked Draw and score is tied)
- `❌` - User's pick doesn't match the current result
- No indicator - User has no pick for this fixture

Examples: 
- Title: `Half-Time`
- Body (pick on track): `Chelsea 1-1 Tottenham ✅`
- Body (pick off track): `Chelsea 1-0 Tottenham ❌`
- Body (no pick): `Chelsea 1-1 Tottenham`
