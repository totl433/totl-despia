---
title: Gameweek Complete
description: Notification sent when all matches in a gameweek have finished
head: []
---

# Gameweek Complete Notification

**Notification Key:** `gameweek-complete`  
**Owner:** score-webhook  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `gw_complete:{gw}` |
| Dedupe Scope | per_user_per_event |
| TTL | 7200 seconds |
| Preference Key | `gw-results` |
| Collapse ID | `gw_complete:{gw}` |
| Thread ID | `totl_gameweek` |
| Android Group | `totl_results` |

## Trigger

Triggered when all fixtures in a gameweek are marked as `FINISHED`.

## Audience

All users with picks in the gameweek.
