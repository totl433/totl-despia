# Local Push Notifications System

This document explains how the local push notification system works for the TOTL app, specifically for the API Test league.

## Overview

The app uses the Despia SDK (`despia-native`) to send local push notifications. These notifications are scheduled and sent directly from the device, even when the app is closed.

## Notification Types

### 1. **Game Week Starting Soon** 🚀
**When:** 25 minutes before the first kickoff

**Example for API Test GW 1:**
- If first game kicks off at **Sat 15 Nov, 15:00 UTC**
- Notification sent at **Sat 15 Nov, 14:35 UTC** (25 minutes before)

**Notification:**
```
Title: "Gameweek 1 Starting Soon! ⚽"
Message: "The action begins in 25 minutes! Get ready for some football magic! 🎯"
```

### 2. **Deadline Reminders** ⏰
**When:** 2 hours before the gameweek deadline (75 minutes before first kickoff)

**Example for API Test GW 1:**
- If first game kicks off at **Sat 15 Nov, 15:00 UTC**
- Deadline is **75 minutes before** = **Sat 15 Nov, 13:45 UTC**
- Reminder sent **2 hours before deadline** = **Sat 15 Nov, 11:45 UTC**

**Notification:**
```
Title: "GW1 Deadline Reminder"
Message: "Don't forget to submit your predictions! Deadline in 2 hours."
```

### 3. **Live Game Notifications** ⚽
**When:** Exactly at kickoff time for each game

**Examples for API Test GW 1 fixtures:**

**Game 1: SC Recife vs CR Flamengo**
- Kickoff: **Sat 15 Nov, 15:00 UTC**
- Notification sent at: **Sat 15 Nov, 15:00 UTC**

```
Title: "Game Starting Now!"
Message: "SC Recife vs CR Flamengo is kicking off now!"
```

**Game 2: Santos FC vs SE Palmeiras**
- Kickoff: **Sun 16 Nov, 14:00 UTC**
- Notification sent at: **Sun 16 Nov, 14:00 UTC**

```
Title: "Game Starting Now!"
Message: "Santos FC vs SE Palmeiras is kicking off now!"
```

**Game 3: RB Bragantino vs CA Mineiro**
- Kickoff: **Sun 16 Nov, 17:00 UTC**
- Notification sent at: **Sun 16 Nov, 17:00 UTC**

```
Title: "Game Starting Now!"
Message: "RB Bragantino vs CA Mineiro is kicking off now!"
```

### 4. **Score Update Notifications** 📊
**When:** When a score changes during live games OR when a game finishes (FT)

**Live Score Examples:**
- Game 3 (RB Bragantino vs CA Mineiro) is live
- Score changes from 0-0 to 1-0 at 23'
- Notification sent immediately:

```
Title: "RB Bragantino 1-0 CA Mineiro"
Message: "Score update: 23'"
```

- Score changes to 2-1 at 56'
- Notification:

```
Title: "RB Bragantino 2-1 CA Mineiro"
Message: "Score update: 56'"
```

**Full Time (FT) Examples with Personalization:**
- Game 1 finishes: SC Recife 3-1 CR Flamengo
- If you picked Home Win (H) - **You got it right!**:

```
Title: "SC Recife 3-1 CR Flamengo"
Message: "FT - Correct! 🎯"
```

- Game 2 finishes: Santos FC 1-1 SE Palmeiras
- If you picked Draw (D) - **You got it right!**:

```
Title: "Santos FC 1-1 SE Palmeiras"
Message: "FT - Correct! 🎯"
```

- Game 3 finishes: RB Bragantino 2-1 CA Mineiro
- If you picked Away Win (A) but result was Home Win - **Wrong pick**:

```
Title: "RB Bragantino 2-1 CA Mineiro"
Message: "FT - Wrong pick"
```

**Note:** 
- Notifications are only sent when scores actually change, not on every poll
- FT notifications are personalized based on whether your pick was correct
- The app tracks previous scores to avoid duplicate notifications

### 5. **Results Notifications** 🏆
**When:** When ALL games in the gameweek have finished (the last game ends)

**Example for API Test GW 1:**
- Game 1 finishes: SC Recife 3-1 CR Flamengo (FT)
- Game 2 finishes: Santos FC 1-1 SE Palmeiras (FT)
- Game 3 finishes: RB Bragantino 2-1 CA Mineiro (FT) ← **Last game ends**
- **Once the last game finishes**, notification sent immediately:

```
Title: "Gameweek 1 Finished! 🏆"
Message: "All games are done! Come see the results and find out who won!"
```

**Note:** This notification is only sent once per gameweek, even if the app polls multiple times.

## Technical Details

### Scheduling
- **Game Week Starting Soon:** Scheduled when fixtures are loaded, 25 minutes before first kickoff
- **Deadline reminders:** Scheduled when fixtures are loaded, calculated from first kickoff time
- **Live game notifications:** Scheduled when fixtures are loaded, one per game at kickoff time
- **Score updates:** Sent immediately when score changes are detected (no scheduling needed)
- **Results notifications:** Sent immediately when all games finish (no scheduling needed)

### Deep Links
All notifications include deep links that open the app:
- Game Week Starting Soon → `/league/api-test` (league page)
- Deadline reminders → `/test-api-predictions` (predictions page)
- Live game notifications → `/league/api-test` (league page)
- Score updates → `/league/api-test` (league page)
- Results notifications → `/league/api-test` (league page)

### Limitations
- Notifications can only be scheduled up to 7 days in advance
- Score update notifications only trigger if there was a previous score (to avoid notifying on initial load)
- Results notification is only sent once per gameweek

## Example Timeline for API Test GW 1

Assuming fixtures kick off on **Sat 15 Nov, 15:00 UTC**:

1. **Sat 15 Nov, 11:45 UTC** - Deadline reminder notification
   - "Don't forget to submit your predictions! Deadline in 2 hours."

2. **Sat 15 Nov, 13:45 UTC** - Deadline passes (75 min before kickoff)

3. **Sat 15 Nov, 14:35 UTC** - Game Week Starting Soon notification
   - "Gameweek 1 Starting Soon! ⚽ - The action begins in 25 minutes! Get ready for some football magic! 🎯"

4. **Sat 15 Nov, 15:00 UTC** - Game 1 starts
   - "SC Recife vs CR Flamengo is kicking off now!"

5. **During Game 1** - Score updates (if scores change)
   - "SC Recife 1-0 CR Flamengo - Score update: 23'"
   - "SC Recife 2-0 CR Flamengo - Score update: 45'"
   - "SC Recife 3-1 CR Flamengo - Score update: 78'"

6. **Sat 15 Nov, ~17:00 UTC** - Game 1 finishes
   - No notification (waiting for all games)

7. **Sun 16 Nov, 14:00 UTC** - Game 2 starts
   - "Santos FC vs SE Palmeiras is kicking off now!"

8. **During Game 2** - Score updates (if scores change)
   - "Santos FC 1-0 SE Palmeiras - Score update: 12'"
   - "Santos FC 1-1 SE Palmeiras - Score update: 67'"

9. **Sun 16 Nov, ~16:00 UTC** - Game 2 finishes

10. **Sun 16 Nov, 17:00 UTC** - Game 3 starts
   - "RB Bragantino vs CA Mineiro is kicking off now!"

11. **During Game 3** - Score updates (if scores change)
    - "RB Bragantino 1-0 CA Mineiro - Score update: 34'"
    - "RB Bragantino 1-1 CA Mineiro - Score update: 52'"
    - "RB Bragantino 2-1 CA Mineiro - Score update: 78'"

12. **Sun 16 Nov, ~19:00 UTC** - Game 3 finishes (last game)
    - **Results notification sent immediately:**
    - "Gameweek 1 Finished! 🏆 - All games are done! Come see the results and find out who won!"

## Implementation Files

- `src/lib/notifications.ts` - Notification utility functions
- `src/pages/Home.tsx` - Notification triggers for API Test league users
- Uses `despia-native` package for native notification support

