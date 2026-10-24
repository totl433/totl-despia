export type CopyVersion = { title: string; line: string };

/** Stable pick so a card does not change copy every time the feed rebuilds. */
export function hashSeed(seed: string | number): number {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash;
}

export function pickCopy<T>(options: readonly T[], seed: string | number): T {
  if (!options.length) throw new Error('pickCopy needs at least one option');
  return options[Math.abs(hashSeed(seed)) % options.length] as T;
}

export function fixturesCopy(gw: number): CopyVersion[] {
  return [
    { title: `Gameweek ${gw} fixtures`, line: 'The games are in.' },
    { title: `Gameweek ${gw} fixtures`, line: "Here's who plays." },
    { title: `Gameweek ${gw} fixtures`, line: 'New fixtures. Get your Predictions in.' },
  ];
}

export function deadlinePinTitles(): string[] {
  return ["Don't miss the deadline!", 'Get your Predictions in', 'Deadline Friday, 18:00'];
}

export function youreInCopy(kind: 'open' | 'soon', gw: number): CopyVersion[] {
  if (kind === 'soon') {
    return [
      { title: "You're in", line: `Gameweek ${gw} starting soon!` },
      { title: "You're in", line: 'First teams are nearly out' },
      { title: 'Locked in', line: `Gameweek ${gw} is almost here` },
    ];
  }
  return [
    { title: "You're in", line: 'Make sure everybody in your Mini Leagues has made their Predictions' },
    { title: "You're in", line: 'Your Mini Leagues are still waiting on a few Predictions' },
    { title: 'Locked in', line: "Nudge your Mini Leagues — there's still time" },
  ];
}

export function comingSoonCopy(nextGw: number, lastLine: string): CopyVersion[] {
  return [
    { title: `Gameweek ${nextGw} coming soon`, line: lastLine },
    { title: `Gameweek ${nextGw} is on the way`, line: lastLine },
    { title: `Next up, Gameweek ${nextGw}`, line: lastLine },
  ];
}

export function nextGwHereCopy(nextGw: number, lastLine: string): CopyVersion[] {
  return [
    { title: `Gameweek ${nextGw} is here`, line: lastLine },
    { title: `Gameweek ${nextGw} is ready`, line: lastLine },
    { title: `Time for Gameweek ${nextGw}`, line: lastLine },
  ];
}

export function startingSoonCopy(gw: number): CopyVersion[] {
  return [
    { title: `Gameweek ${gw} starting soon!`, line: 'First teams are almost out.' },
    { title: 'Almost time', line: 'First teams are on the way.' },
    { title: `Gameweek ${gw} is about to start`, line: 'Waiting on the first XIs.' },
  ];
}

export function openerCopy(gw: number): CopyVersion[] {
  return [
    { title: `Gameweek ${gw}, Here We Go!`, line: 'First teams are out.' },
    { title: `Gameweek ${gw}, Here We Go!`, line: "The teams are in. We're underway." },
    { title: 'Here We Go!', line: `First XIs are out for Gameweek ${gw}.` },
  ];
}

export function lineupCopy(team: string): CopyVersion[] {
  return [
    { title: 'Line-up', line: `Players are backing ${team} for the win.` },
    { title: 'Line-up', line: `Teams are out. ${team}, and it's not even close.` },
    { title: 'Line-up', line: `Teams are out. Tight one. ${team}, just about.` },
  ];
}

export function kickoffCopy(match: string): CopyVersion[] {
  return [
    { title: "We're off", line: `${match}. Let's get the conversation started — add a comment below.` },
    { title: "We're off", line: `${match}. Say something. Comments are open.` },
    { title: 'Kick-off', line: `${match} is live. Get in the comments.` },
  ];
}

export type LiveCopyMoment = 'goal' | 'ruled-out' | 'half-time' | 'second-half' | 'full-time';

export function liveCopy(moment: LiveCopyMoment, right: boolean): CopyVersion[] {
  if (moment === 'goal') {
    return right
      ? [
          { title: 'Goal!!', line: 'Going your way' },
          { title: 'Goal!!', line: 'Still with you' },
          { title: 'Goal!!', line: 'Your Prediction is looking good' },
        ]
      : [
          { title: 'Goal!!', line: "That's gone against you" },
          { title: 'Goal!!', line: 'Not your goal' },
          { title: 'Goal!!', line: "This one's drifting away" },
        ];
  }
  if (moment === 'ruled-out') {
    return right
      ? [
          { title: 'Goal ruled out', line: "VAR's just done you a favour." },
          { title: 'Goal ruled out', line: 'Still with you. VAR wiped that.' },
          { title: 'Goal ruled out', line: "That one wasn't standing. Your call is back on." },
        ]
      : [
          { title: 'Goal ruled out', line: "That was yours. VAR's had a word." },
          { title: 'Goal ruled out', line: "Unlucky. Goal's gone." },
          { title: 'Goal ruled out', line: "VAR's taken that off you." },
        ];
  }
  if (moment === 'half-time') {
    return right
      ? [
          { title: 'Half-time', line: 'Still with you' },
          { title: 'Half-time', line: 'Holding at the break' },
          { title: 'Half-time', line: 'Your call is still on' },
        ]
      : [
          { title: 'Half-time', line: 'Not your scoreline at the break' },
          { title: 'Half-time', line: 'Against you at half-time' },
          { title: 'Half-time', line: 'Your Prediction is off at the break' },
        ];
  }
  if (moment === 'second-half') {
    return right
      ? [
          { title: 'Second half', line: "They're back. Still with you." },
          { title: 'Second half', line: 'Here we go again. Your call is still on.' },
          { title: 'Second half', line: "Back out. Plenty of time — you're in front." },
        ]
      : [
          { title: 'Second half', line: "They're back. Time to turn this." },
          { title: 'Second half', line: 'Here we go again. You need something here.' },
          { title: 'Second half', line: 'Back out. Not your game yet.' },
        ];
  }
  return right
    ? [
        { title: 'Full-time!!', line: 'You had it' },
        { title: 'Full-time!!', line: 'Called it. On to the next.' },
        { title: 'Full-time!!', line: 'That one is yours' },
      ]
    : [
        { title: 'Full-time!!', line: "Didn't go your way" },
        { title: 'Full-time!!', line: 'So close' },
        { title: 'Full-time!!', line: 'Not this one' },
      ];
}

export function scoreSheetCopy(): CopyVersion[] {
  return [
    { title: 'Score Sheet', line: 'Your ten Predictions vs results' },
    { title: 'Score Sheet', line: "Here's how your Predictions landed" },
    { title: 'Score Sheet', line: 'Ten Predictions. Ten results.' },
  ];
}

export function everyonePredictedCopy(league: string): CopyVersion[] {
  return [
    { title: league, line: 'Everyone has their Predictions in.' },
    { title: league, line: "That's everyone. Predictions are in." },
    { title: league, line: "Fully in. Everybody's predicted." },
  ];
}

export function playerJoinedCopy(name: string, league: string): CopyVersion[] {
  return [
    { title: 'Mini-leagues', line: `${name} has joined ${league}` },
    { title: 'Mini-leagues', line: `${name}'s in ${league}` },
    { title: 'Mini-leagues', line: `New face: ${name} just joined ${league}` },
  ];
}

export function inviteCopy(league: string): CopyVersion[] {
  return [
    { title: 'Mini-leagues', line: `You've been invited to ${league}` },
    { title: 'Mini-leagues', line: `${league} wants you in` },
    { title: 'Mini-leagues', line: `You've got an invite. ${league}.` },
  ];
}

export function goodLuckCopy(names: string, many: boolean, plural = true): CopyVersion[] {
  if (many) {
    return [
      { title: 'Good luck', line: 'Many players are on a nine going into the final game. Good luck!' },
      { title: 'Good luck', line: 'A lot of you are on nine. One game left. Good luck!' },
      { title: 'Good luck', line: "Plenty of players are one result from a ten. Don't blow it." },
    ];
  }
  const be = plural ? 'are' : 'is';
  return [
    { title: 'Good luck', line: `${names} ${be} on a nine going into the final game. Good luck!` },
    { title: 'Good luck', line: `Nine out of nine for ${names}. One game left. Good luck!` },
    { title: 'Good luck', line: `${names} ${be} one result from a ten. Don't blow it.` },
  ];
}

export function winnerShoutCopy(
  kind: 'gw' | 'monthly' | 'season' | 'midweek-month' | 'midweek-overall',
  names: string
): CopyVersion[] {
  if (kind === 'gw') {
    return [
      { title: 'Game week shout out', line: `Shout out to ${names} who won this game week.` },
      { title: 'Game week shout out', line: `Game week belongs to ${names}.` },
      { title: 'Game week shout out', line: `Hats off to ${names} — this week's winners.` },
    ];
  }
  if (kind === 'monthly') {
    return [
      { title: 'Monthly shout out', line: `Shout out to ${names} who won this month.` },
      { title: 'Monthly shout out', line: `${names} own this month.` },
      { title: 'Monthly shout out', line: `Monthly honours: ${names}.` },
    ];
  }
  if (kind === 'season') {
    return [
      { title: 'Season shout out', line: `Shout out to ${names} who won the overall season.` },
      { title: 'Season shout out', line: `${names} take the season.` },
      { title: 'Season shout out', line: `Season done. ${names} are top of the league.` },
    ];
  }
  if (kind === 'midweek-month') {
    return [
      { title: 'Top of the table', line: `${names}'s looking pretty at the top of the monthly table. Doing great!` },
      { title: 'Top of the table', line: `${names}'s topping the month. Keep going.` },
      { title: 'Top of the table', line: `Monthly table: ${names}'s out in front.` },
    ];
  }
  return [
    { title: 'Top of the table', line: `${names}'s looking pretty at the top of the overall table. Doing great!` },
    { title: 'Top of the table', line: `${names}'s sitting pretty overall.` },
    { title: 'Top of the table', line: `Overall table: ${names}'s the one to catch.` },
  ];
}

export function playersDailyCopy(names: string): CopyVersion[] {
  return [
    { title: "Yesterday's winners", line: `Yesterday's winners were ${names}.` },
    { title: "Yesterday's winners", line: `${names} won yesterday's Players.` },
    { title: "Yesterday's winners", line: `Yesterday belonged to ${names}.` },
  ];
}

export function playersWeeklyCopy(names: string): CopyVersion[] {
  return [
    { title: "This week's winners", line: `This week's winners were ${names}.` },
    { title: "This week's winners", line: `${names} take the Players week.` },
    { title: "This week's winners", line: `Weekly honours: ${names}.` },
  ];
}

export function playersMonthlyCopy(names: string): CopyVersion[] {
  return [
    { title: "This month's winners", line: `This month's winners were ${names}.` },
    { title: "This month's winners", line: `${names} take the Players month.` },
    { title: "This month's winners", line: `Monthly Players honours: ${names}.` },
  ];
}

export function playersReadyCopy(): CopyVersion[] {
  return [
    { title: 'The Players', line: 'New game ready for you.' },
    { title: 'The Players', line: "Today's Players is up." },
    { title: 'The Players', line: 'New Players game. Have a go.' },
  ];
}

export function playersNudgeCopy(): CopyVersion[] {
  return [
    { title: 'The Players', line: "You haven't played today's game yet." },
    { title: 'The Players', line: "Still time tonight. Today's Players is waiting." },
    { title: 'The Players', line: "Haven't had a go today? Players is still open." },
  ];
}

export function playersPerfectCopy(name: string): CopyVersion[] {
  return [
    { title: 'Players shout out', line: `${name} scored a perfect 10 on today's players' game!` },
    { title: 'Players shout out', line: `${name} just went 10/10 on Players.` },
    { title: 'Players shout out', line: `Perfect 10 for ${name}. That's how you do it.` },
  ];
}

export function mostMissedCopy(team: string, pct: number): CopyVersion[] {
  return [
    { title: 'Most missed', line: `${team} are currently the team most players get wrong this season. Only ${pct}% of players predict them correctly.` },
    { title: 'Most missed', line: `${team} are the trap this season. Only ${pct}% get them right.` },
    { title: 'Most missed', line: `Careful with ${team}. Most people miss them — ${pct}% right so far.` },
  ];
}

export function easiestTeamCopy(team: string, pct: number): CopyVersion[] {
  return [
    { title: 'Easiest team', line: `${team} are running as the easiest team this season so far. People get them right ${pct}% of the time.` },
    { title: 'Easiest team', line: `${team} are the banker this season. ${pct}% of Predictions land.` },
    { title: 'Easiest team', line: `If you're stuck, ${team}. People get them right ${pct}% of the time.` },
  ];
}

export function lastMinuteCopy(team: string): CopyVersion[] {
  return [
    { title: 'Last minute heroes', line: `${team} are the last minute heroes this season — they most often draw or win games at 90 plus minutes.` },
    { title: 'Last minute heroes', line: `${team} keep nicking it at 90 plus this season.` },
    { title: "Last minute heroes", line: `Don't write ${team} off. They win or draw late more than anyone.` },
  ];
}

export function drawsCopy(pct: number): CopyVersion[] {
  return [
    { title: 'Draws this season', line: `Don't forget, ${pct} percent of games this season are draws. Think about that when you're doing your Predictions.` },
    { title: 'Draws this season', line: `${pct} percent of games this season are draws. Worth a look.` },
    { title: 'Draws this season', line: `Draws are in play — ${pct} percent this season. Don't ignore them.` },
  ];
}

export function awayWinsCopy(pct: number): CopyVersion[] {
  return [
    { title: 'Away wins this season', line: `Don't forget, ${pct} percent of games this season are away wins.` },
    { title: 'Away wins this season', line: `Away wins: ${pct} percent this season. Not rare.` },
    { title: 'Away wins this season', line: 'Nearly a third of games this season go to the away side.' },
  ];
}

export function mlSnapshotCopy(line: string): CopyVersion[] {
  return [
    { title: 'Mini-leagues', line },
    { title: 'Mini-leagues', line },
    { title: 'Mini-leagues', line },
  ];
}
