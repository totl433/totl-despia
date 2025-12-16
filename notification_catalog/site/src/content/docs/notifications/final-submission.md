---
title: Final Submission
description: Notification sent when all league members have submitted their picks
head: []
---

# Final Submission Notification

**Notification Key:** `final-submission`  
**Owner:** client-triggered  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `final_sub:{league_id}:{gw}` |
| Dedupe Scope | per_league_per_gw |
| TTL | 86400 seconds |
| Collapse ID | `final_sub:{league_id}:{gw}` |
| Thread ID | `league:{league_id}` |
| Android Group | `totl_leagues` |

## Trigger

Triggered when the last member of a league submits their picks.

## Audience

All league members.
