---
title: Member Join
description: Notification sent when someone joins a mini-league
head: []
---

# Member Join Notification

**Notification Key:** `member-join`  
**Owner:** client-triggered  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `member_join:{league_id}:{user_id}` |
| Dedupe Scope | per_user_per_event |
| TTL | 300 seconds |
| Cooldown | 0 seconds per user |
| Quiet Hours | null |
| Preference Key | `member-joins` |
| Collapse ID | `member_join:{league_id}` |
| Thread ID | `league:{league_id}` |
| Android Group | `totl_leagues` |

## Trigger

Triggered when a user joins a mini-league.

## Audience

- All league members except the person who joined
- Filtered by `member-joins` preference



