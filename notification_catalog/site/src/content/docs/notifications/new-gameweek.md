---
title: New Gameweek
description: Broadcast notification when new gameweek fixtures are published
head: []
---

# New Gameweek Notification

**Notification Key:** `new-gameweek`  
**Owner:** admin-triggered  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `new_gw:{gw}` |
| Dedupe Scope | global |
| TTL | 86400 seconds |
| Preference Key | `new-gameweek` |
| Collapse ID | `new_gw:{gw}` |
| Thread ID | `totl_gameweek` |
| Android Group | `totl_gameweek` |

## Trigger

Triggered manually by admin when new gameweek fixtures are published.

## Audience

All subscribed users.
