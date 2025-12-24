---
title: English Templates
description: Message templates for all notification types
head: []
---

# Notification Templates (English)

## Goal Scored
```
Title: Goal {teamName}!
Body: {minute}' {scorer}
      {homeTeam} [{homeScore}] - {awayScore} {awayTeam}
```

## Goal Disallowed
```
Title: Goal Disallowed
Body: {minute}' {scorer}'s goal for {teamName} was disallowed
      {homeTeam} {homeScore}-{awayScore} {awayTeam}
```

## Kickoff (First Half)
```
Title: {homeTeam} vs {awayTeam}
Body: Kickoff!
```

## Kickoff (Second Half)
```
Title: {homeTeam} vs {awayTeam}
Body: Second half underway
```

## Half-Time
```
Title: Half-Time
Body: {homeTeam} {homeScore}-{awayScore} {awayTeam}
```

## Final Whistle (Correct Pick)
```
Title: FT: {homeTeam} {homeScore}-{awayScore} {awayTeam}
Body: ✅ Got it right! {percentage}% of players got this fixture correct
```

## Final Whistle (Wrong Pick)
```
Title: FT: {homeTeam} {homeScore}-{awayScore} {awayTeam}
Body: ❌ Wrong pick {percentage}% of players got this fixture correct
```

## Gameweek Complete
```
Title: Gameweek {gw} Complete!
Body: All games finished. Check your results!
```

## Chat Message
```
Title: {senderName}
Body: {messageContent}
```

## Final Submission
```
Title: All predictions submitted!
Body: Everyone in {leagueName} has submitted for GW {gw}. Check out who picked what!
```

## New Gameweek (Admin Custom)
```
Title: ⚽ Gameweek {gw} is live!
Body: Fixtures are now available. Make your picks before kickoff!
```

