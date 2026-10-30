import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/leagueAvatars', () => ({ resolveLeagueAvatarUri: () => null }));

import { gameweekPin, predictionsDeadlineMs } from './gameweekState';
import { pinnedCardCopy } from '../features/gameCentre/cards';

const KICKOFF = '2026-10-24T11:30:00Z';
const KO = Date.parse(KICKOFF);
const DEADLINE = KO - 75 * 60_000;
const LAST = '2026-10-24T14:00:00Z';

const home = (overrides: Record<string, unknown> = {}) => ({
  currentGw: 8,
  viewingGw: 8,
  fixtures: [
    { kickoff_time: LAST, fixture_index: 1 },
    { kickoff_time: KICKOFF, fixture_index: 0 },
  ],
  liveScores: [] as Array<{ status: string; fixture_index: number }>,
  hasSubmittedViewingGw: false,
  ...overrides,
});
const before = DEADLINE - 4 * 3_600_000;

describe('predictions deadline', () => {
  it('is 75 minutes before the first kickoff', () => {
    expect(predictionsDeadlineMs(home().fixtures)).toBe(DEADLINE);
    expect(predictionsDeadlineMs([])).toBeNull();
  });
});

describe('pinned card state', () => {
  it('1: picks due before the deadline', () => {
    expect(gameweekPin(home(), before)).toEqual({ kind: 'predict', gw: 8, deadlineMs: DEADLINE });
  });

  it('2: picks in before the deadline are locked in, with nothing to edit', () => {
    expect(gameweekPin(home({ hasSubmittedViewingGw: true }), before)).toEqual({
      kind: 'locked',
      gw: 8,
      kickoffMs: KO,
      deadlineMs: DEADLINE,
    });
  });

  it('3 and 4: between the deadline and kickoff', () => {
    expect(gameweekPin(home(), DEADLINE + 60_000)).toEqual({ kind: 'missed', gw: 8, kickoffMs: KO });
    expect(gameweekPin(home({ hasSubmittedViewingGw: true }), DEADLINE + 60_000)).toBeNull();
  });

  it('5: nothing while games are live', () => {
    expect(gameweekPin(home({ liveScores: [{ status: 'IN_PLAY', fixture_index: 0 }] }), KO + 60_000)).toBeNull();
  });

  it('6: coming soon once the last game has finished', () => {
    const done = home({
      hasSubmittedViewingGw: true,
      liveScores: [
        { status: 'FINISHED', fixture_index: 0 },
        { status: 'FINISHED', fixture_index: 1 },
      ],
    });
    expect(gameweekPin(done, Date.parse(LAST) + 3 * 3_600_000)).toEqual({ kind: 'comingSoon', gw: 8, nextGw: 9 });
  });

  it('7: ready to move on once the next gameweek is published', () => {
    expect(gameweekPin(home({ currentGw: 9 }), before)).toEqual({ kind: 'ready', gw: 8, nextGw: 9 });
  });

  it('comes back as picks due after moving on', () => {
    const next = home({ currentGw: 9, viewingGw: 9, fixtures: [{ kickoff_time: '2026-10-31T15:00:00Z' }] });
    expect(gameweekPin(next, before)).toMatchObject({ kind: 'predict', gw: 9 });
  });

  it('waits for the snapshot rather than guessing', () => {
    expect(gameweekPin(null, before)).toBeNull();
    expect(gameweekPin(home({ hasSubmittedViewingGw: undefined }), before)).toBeNull();
  });
});

describe('pinned card copy', () => {
  it('uses the Figma wording and a button only where there is something to do', () => {
    const predict = pinnedCardCopy({ kind: 'predict', gw: 8, deadlineMs: DEADLINE }, DEADLINE - 2.5 * 3_600_000, null);
    expect(predict).toEqual({ title: "Don't miss the deadline!", subtitle: 'Gameweek 8: Closes in 2h 30m', action: 'predict', actionLabel: 'Submit your Predictions' });

    expect(pinnedCardCopy({ kind: 'missed', gw: 8, kickoffMs: KO }, before, null)).toMatchObject({ title: 'Deadline passed', action: null });
    expect(pinnedCardCopy({ kind: 'locked', gw: 8, kickoffMs: KO, deadlineMs: DEADLINE }, before, null)).toMatchObject({
      title: "You're in",
      subtitle: 'Make sure everybody in your Mini Leagues has made their predictions',
      action: 'viewPicks',
      actionLabel: 'Your Predictions',
    });
    const locked = { kind: 'locked', gw: 8, kickoffMs: KO, deadlineMs: DEADLINE } as const;
    expect(pinnedCardCopy(locked, before, null, { leagueCount: 3, missingCount: 2 })).toMatchObject({
      subtitle: 'Make sure everybody in your Mini Leagues has made their predictions',
      action: 'seeMissing',
      actionLabel: "See who's missing",
    });
    expect(pinnedCardCopy(locked, before, null, { leagueCount: 3, missingCount: 0 })).toMatchObject({
      subtitle: 'Everyone in your Mini Leagues is in',
      action: 'viewPicks',
      actionLabel: 'Your Predictions',
    });
    // No mini-leagues to check: the plain card.
    expect(pinnedCardCopy(locked, before, null, { leagueCount: 0, missingCount: 0 })).toMatchObject({ action: 'viewPicks' });
    // Only the version before the countdown changes.
    expect(pinnedCardCopy(locked, DEADLINE - 2 * 3_600_000, null, { leagueCount: 3, missingCount: 2 })).toMatchObject({ action: 'viewPicks', countdownLabel: 'FIRST TEAMS IN' });
    expect(pinnedCardCopy({ kind: 'locked', gw: 8, kickoffMs: KO, deadlineMs: DEADLINE }, DEADLINE - 2 * 3_600_000, null)).toMatchObject({
      title: "You're in",
      subtitle: 'Gameweek 8 starting soon!',
      countdownLabel: 'FIRST TEAMS IN',
    });
    expect(pinnedCardCopy({ kind: 'comingSoon', gw: 7, nextGw: 8 }, before, '6/10')).toEqual({
      title: 'Gameweek 8 coming soon',
      subtitle: 'Gameweek 7: 6/10',
      action: 'roundUp',
      actionLabel: 'View the round-up',
    });
    expect(pinnedCardCopy({ kind: 'ready', gw: 7, nextGw: 8 }, before, '6/10')).toEqual({
      title: 'Gameweek 8 is here',
      subtitle: 'Gameweek 7: 6/10',
      action: 'moveOn',
      actionLabel: 'Move to Gameweek 8',
    });
  });

  it('names the deadline and kickoff as a day and time', () => {
    expect(pinnedCardCopy({ kind: 'locked', gw: 8, kickoffMs: KO, deadlineMs: DEADLINE }, DEADLINE + 60_000, null).subtitle).toMatch(/^Gameweek 8: Kicks off (Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, \d{2}:\d{2}$/);
    expect(pinnedCardCopy({ kind: 'missed', gw: 8, kickoffMs: KO }, before, null).subtitle).toMatch(/^Gameweek 8 kicks off at (Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, \d{2}:\d{2}$/);
  });
});

describe('dismissing the pinned card', () => {
  it('only hides the states that just tell you something', async () => {
    const { pinDismissible } = await import('../features/gameCentre/cards');
    expect(pinDismissible({ kind: 'predict', gw: 8, deadlineMs: DEADLINE })).toBe(false);
    expect(pinDismissible({ kind: 'ready', gw: 7, nextGw: 8 })).toBe(false);
    expect(pinDismissible({ kind: 'missed', gw: 8, kickoffMs: KO })).toBe(true);
    expect(pinDismissible({ kind: 'locked', gw: 8, kickoffMs: KO, deadlineMs: DEADLINE })).toBe(true);
    expect(pinDismissible({ kind: 'comingSoon', gw: 7, nextGw: 8 })).toBe(true);
  });

  it('keeps a dismissal to its gameweek and state, so the next state still shows', async () => {
    const { pinDismissKey } = await import('../features/gameCentre/cards');
    const soon = pinDismissKey('u1', { kind: 'comingSoon', gw: 7, nextGw: 8 });
    expect(soon).not.toBe(pinDismissKey('u1', { kind: 'ready', gw: 7, nextGw: 8 }));
    expect(soon).not.toBe(pinDismissKey('u1', { kind: 'comingSoon', gw: 8, nextGw: 9 }));
    expect(soon).not.toBe(pinDismissKey('u2', { kind: 'comingSoon', gw: 7, nextGw: 8 }));
  });
});
