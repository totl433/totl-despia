---
title: Goal Scored
description: Notification sent when a goal is scored in a tracked match
head: []
---

# Goal Scored Notification

**Notification Key:** `goal-scored`  
**Owner:** score-webhook  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `goal:{api_match_id}:{scorer_normalized}:{minute}` |
| Dedupe Scope | per_user_per_event |
| TTL | 120 seconds |
| Preference Key | `score-updates` |
| Collapse ID | `goal:{api_match_id}` |
| Thread ID | `match:{api_match_id}` |
| Android Group | `totl_scores` |

## Trigger Conditions

1. `live_scores` table is updated via Supabase webhook
2. Goals array has new entries compared to `notification_state.last_notified_goals`
3. Score has not decreased (that would trigger `goal-disallowed` instead)

## Audience

- All users who have submitted picks for the fixture
- Filtered by `score-updates` preference
- Filtered by OneSignal subscription status

## Payload Data

```json
{
  "type": "goal",
  "api_match_id": 12345,
  "fixture_index": 3,
  "gw": 16
}
```

## Message Template

**Title:** `Goal {teamName}!`

**Body:** `{minute}' {scorer}\n{homeTeam} [{homeScore}] - {awayScore} {awayTeam} {indicator}`

The indicator shows whether the user's pick is currently on track:
- `✅` - User's pick matches the current result (e.g., picked Home and Home is winning, or picked Draw and score is tied)
- `❌` - User's pick doesn't match the current result
- No indicator - User has no pick for this fixture

Examples: 
- Title: `Goal Man United!`
- Body (pick on track): `52' Marcus Rashford\nMan United [2] - 1 Liverpool ✅`
- Body (pick off track): `52' Marcus Rashford\nMan United [2] - 1 Liverpool ❌`
- Body (no pick): `52' Marcus Rashford\nMan United [2] - 1 Liverpool`
