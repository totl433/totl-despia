---
title: Goal Disallowed
description: Notification sent when a goal is disallowed by VAR
head: []
---

# Goal Disallowed Notification

**Notification Key:** `goal-disallowed`  
**Owner:** score-webhook  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `goal_disallowed:{api_match_id}:{minute}` |
| Dedupe Scope | per_user_per_event |
| TTL | 120 seconds |
| Preference Key | `score-updates` |
| Collapse ID | `goal_disallowed:{api_match_id}` |
| Thread ID | `match:{api_match_id}` |
| Android Group | `totl_scores` |

## Trigger

Triggered when score decreases (indicates VAR disallowed a goal).

## Audience

Users with picks for the fixture.
