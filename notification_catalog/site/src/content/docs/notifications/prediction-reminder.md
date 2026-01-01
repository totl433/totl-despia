---
title: Prediction Reminder
description: Scheduled reminder notification sent 5 hours before the prediction deadline
head: []
---

# Prediction Reminder Notification

**Notification Key:** `prediction-reminder`  
**Owner:** scheduled  
**Status:** Active  

## Configuration

| Field | Value |
|-------|-------|
| Event ID Format | `prediction_reminder_gw{gw}` |
| Dedupe Scope | global |
| TTL | 86400 seconds |
| Preference Key | `prediction-reminder` |
| Collapse ID | `prediction_reminder_gw{gw}` |
| Thread ID | `totl_predictions` |
| Android Group | `totl_predictions` |

## Trigger

Automatically triggered by scheduled function (`sendPredictionReminder`) 5 hours before the prediction deadline.

**Timing:**
- Deadline = 75 minutes before first kickoff
- Reminder = 5 hours before deadline (5 hours 75 minutes before first kickoff)
- Reminder window: 30 minutes before or after reminder time

## Audience

All subscribed users who:
- Have `prediction-reminder` preference enabled (default: enabled)
- Have NOT yet submitted predictions for the current gameweek
- Have active push notification subscriptions

## Message

**Title:** `Gameweek {gw} Predictions Due Soon!`  
**Body:** `Don't forget to make your predictions! Deadline: {deadline}`

## Data Payload

```json
{
  "type": "prediction-reminder",
  "gw": {gameweek_number},
  "deadline": "{ISO_timestamp}",
  "url": "/predictions"
}
```





