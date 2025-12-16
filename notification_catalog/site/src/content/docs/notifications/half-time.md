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
