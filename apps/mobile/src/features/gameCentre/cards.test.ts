import { describe, expect, it } from 'vitest';

import { gameCentreCardHeader, gameCentreCardType, gameCentreReactionChips } from './cards';

describe('card types', () => {
  it('splits match events, league chat and personal cards', () => {
    expect(['goal', 'half-time', 'second-half', 'opener', 'xi'].map((kind) => gameCentreCardType(kind as never))).toEqual([
      'public',
      'public',
      'public',
      'public',
      'public',
    ]);
    expect(gameCentreCardType('message')).toBe('league');
    expect(['rank', 'overall', 'round-up', 'waiting'].map((kind) => gameCentreCardType(kind as never))).toEqual([
      'personal',
      'personal',
      'personal',
      'personal',
    ]);
  });
});

describe('card header', () => {
  it('names a goal and moves the scorer line up', () => {
    expect(gameCentreCardHeader({ kind: 'goal', eyebrow: 'Goal', title: 'GOAL', body: 'Keane Lewis-Potter Scores!!! ⚽' })).toEqual({
      title: 'Goal!!',
      subtitle: 'Keane Lewis-Potter Scores!!! ⚽',
      body: null,
    });
  });

  it('drops a headline that repeats the event', () => {
    expect(gameCentreCardHeader({ kind: 'half-time', eyebrow: 'Half-time', title: 'Half time', body: '' })).toEqual({
      title: 'Half-time',
      subtitle: null,
      body: null,
    });
    expect(gameCentreCardHeader({ kind: 'second-half', eyebrow: 'Second half', title: "They're back", body: 'Second half.' })).toEqual({
      title: 'Second half',
      subtitle: "They're back",
      body: null,
    });
  });

  it('leads with the headline on the opener and full-time', () => {
    expect(
      gameCentreCardHeader({ kind: 'opener', eyebrow: 'Match Center', title: 'Gameweek 7, Here We Go!', body: 'First teams are out.' })
    ).toEqual({ title: 'Gameweek 7, Here We Go!', subtitle: 'First teams are out.', body: null });
    expect(gameCentreCardHeader({ kind: 'full-time', eyebrow: 'Full-time', title: 'Full-time!!', body: '3 out of 4 correct' })).toEqual({
      title: 'Full-time!!',
      subtitle: '3 out of 4 correct',
      body: null,
    });
  });

  it('keeps a third line with the content', () => {
    expect(gameCentreCardHeader({ kind: 'kickoff', eyebrow: 'Kickoff', title: "We're off", body: 'Arsenal v Coventry' })).toEqual({
      title: 'Kickoff',
      subtitle: "We're off",
      body: 'Arsenal v Coventry',
    });
  });
});

describe('reaction chips', () => {
  it('always shows the three defaults, then extras in arrival order', () => {
    const chips = gameCentreReactionChips([
      { emoji: '👍', count: 2, hasUserReacted: false },
      { emoji: '🔥', count: 99, hasUserReacted: true },
      { emoji: '😂', count: 1, hasUserReacted: false },
    ]);
    expect(chips.map((chip) => `${chip.emoji}${chip.count}`)).toEqual(['😎0', '🫠0', '🔥99', '👍2', '😂1']);
    expect(chips[2]?.hasUserReacted).toBe(true);
  });
});
