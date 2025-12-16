---
title: Chat Message
description: Notification sent when someone sends a message in league chat
head: []
---

# Chat Message Notification

**Notification Key:** `chat-message`  
**Owner:** client-triggered  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `chat:{league_id}:{message_id}` |
| Dedupe Scope | per_user_per_event |
| TTL | 60 seconds |
| Cooldown | 30 seconds per user |
| Quiet Hours | 23:00 - 07:00 |
| Preference Key | `chat-messages` |
| Collapse ID | `chat:{league_id}` |
| Thread ID | `league:{league_id}` |
| Android Group | `totl_chat` |

## Trigger

Triggered when a user sends a message in league chat.

## Audience

- All league members except the sender
- Filtered by `chat-messages` preference
- Filtered by league mute settings
