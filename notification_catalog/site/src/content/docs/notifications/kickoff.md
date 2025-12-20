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
| Event ID Format | `kickoff:{api_match_id}:{half}` |
| Dedupe Scope | per_user_per_event |
| TTL | 300 seconds |
| Preference Key | `score-updates` |
| Collapse ID | `kickoff:{api_match_id}:{half}` |
| Thread ID | `match:{api_match_id}` |
| Android Group | `totl_scores` |

## Trigger

- First half: first time the match status reaches `IN_PLAY` (regardless of score)
- Second half: status changes from `PAUSED`/`HALF_TIME` to `IN_PLAY`
- Idempotency: deduped per user via `kickoff:{api_match_id}:{half}` event id

## Audience

Users with picks for the fixture.
