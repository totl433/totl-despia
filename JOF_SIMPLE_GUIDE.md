# Simple Guide: How to Check Your Notifications

## What This Does
This script shows you which notifications were sent to you and whether they worked or failed.

---

## Step 1: Open Terminal
- Press `Cmd + Space` (Spotlight)
- Type "Terminal"
- Press Enter

---

## Step 2: Go to Your Project Folder
Type this and press Enter:
```bash
cd /Users/jof/Documents/GitHub/totl-web
```

---

## Step 3: Run the Script
Type this and press Enter:
```bash
node scripts/monitor-jof-notifications.mjs
```

You'll see a report like this:

```
📱 PUSH SUBSCRIPTION STATUS:
  Device 1: Active ✅, Subscribed ✅

📨 RECENT NOTIFICATIONS:
  ✅ accepted: 3 notifications
  ⏸️ suppressed_unsubscribed: 3 notifications
```

---

## Step 4: Understand What You See

### ✅ Good Signs:
- **`accepted`** = Notification was sent successfully
- **`Active: ✅`** = Your device is registered
- **`Subscribed: ✅`** = You have notifications enabled

### ❌ Bad Signs:
- **`suppressed_unsubscribed`** = Notification failed (this is the problem we're fixing)
- **`failed`** = Something went wrong

---

## When to Run It

**Run it AFTER a game event happens:**
- Goal scored
- Game starts (kickoff)
- Half-time
- Game ends

**Example:**
1. You see a goal scored in a game
2. Open Terminal
3. Run the script
4. Check if you see a new notification entry

---

## What to Look For

At the bottom of the output, you'll see:

```
📋 Recent notifications:
  ✅ [time] kickoff - accepted
  ⏸️ [time] goal-scored - suppressed_unsubscribed
```

**This tells you:**
- What time the notification was sent
- What type it was (kickoff, goal-scored, etc.)
- Whether it worked (`accepted`) or failed (`suppressed_unsubscribed`)

---

## Quick Reference

**One-time check:**
```bash
node scripts/monitor-jof-notifications.mjs
```

**Keep refreshing (updates every 5 seconds):**
```bash
watch -n 5 node scripts/monitor-jof-notifications.mjs
```
(Press `Ctrl+C` to stop)

---

## Still Confused?

Just remember:
1. Open Terminal
2. Type: `cd /Users/jof/Documents/GitHub/totl-web`
3. Type: `node scripts/monitor-jof-notifications.mjs`
4. Read the output

That's it! 🎉





