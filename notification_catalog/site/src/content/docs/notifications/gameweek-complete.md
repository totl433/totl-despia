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
| Event ID Format | Legacy: `gw_complete:{gw}`; season: `gw_complete:season:{season_id}:{gw}` |
| Dedupe Scope | per_user_per_event |
| TTL | 7200 seconds |
| Preference Key | `gw-results` |
| Collapse ID | `gw_complete:{season_scope}:{gw}` |
| Thread ID | `totl_gameweek` |
| Android Group | `totl_results` |
| Deep Link | `/predictions` |

## Trigger

Triggered when all fixtures in a gameweek are marked as `FINISHED`.

## Audience

All users with picks in the gameweek.
