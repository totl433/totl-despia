---
title: Final Whistle
description: Notification sent when a match finishes with pick result
head: []
---

# Final Whistle Notification

**Notification Key:** `final-whistle`  
**Owner:** score-webhook  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `ft:{api_match_id}` |
| Dedupe Scope | per_user_per_event |
| TTL | 3600 seconds |
| Preference Key | `final-whistle` |
| Collapse ID | `ft:{api_match_id}` |
| Thread ID | `match:{api_match_id}` |
| Android Group | `totl_results` |

## Trigger

Triggered when match status changes to `FINISHED`.

## Audience

Users with picks for the fixture, personalized by pick result (correct/wrong).
