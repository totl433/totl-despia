import { describe, expect, it } from 'vitest';

import { predictionsDeadlineMs, predictionsPrompt } from './gameweekState';

const KICKOFF = '2026-10-24T11:30:00Z';
const DEADLINE = Date.parse(KICKOFF) - 75 * 60_000;

const home = (overrides: Record<string, unknown> = {}) => ({
  currentGw: 8,
  viewingGw: 8,
  fixtures: [{ kickoff_time: '2026-10-24T14:00:00Z' }, { kickoff_time: KICKOFF }],
  liveScores: [],
  hasSubmittedViewingGw: false,
  ...overrides,
});

describe('predictions deadline', () => {
  it('is 75 minutes before the first kickoff', () => {
    expect(predictionsDeadlineMs(home().fixtures)).toBe(DEADLINE);
    expect(predictionsDeadlineMs([])).toBeNull();
  });
});

describe('predictions prompt', () => {
  const before = DEADLINE - 3 * 3_600_000;

  it('shows for the current gameweek until picks are in', () => {
    expect(predictionsPrompt(home(), before)).toEqual({ gw: 8, deadlineMs: DEADLINE });
  });

  it('goes once the gameweek is submitted', () => {
    expect(predictionsPrompt(home({ hasSubmittedViewingGw: true }), before)).toBeNull();
  });

  it('waits for the snapshot rather than guessing', () => {
    expect(predictionsPrompt(null, before)).toBeNull();
    expect(predictionsPrompt(home({ hasSubmittedViewingGw: undefined }), before)).toBeNull();
  });

  it('stays through the deadline and goes at the first kickoff', () => {
    expect(predictionsPrompt(home(), DEADLINE + 60_000)).not.toBeNull();
    expect(predictionsPrompt(home(), Date.parse(KICKOFF) + 60_000)).toBeNull();
  });

  it('hides while you are still on last gameweek', () => {
    expect(predictionsPrompt(home({ viewingGw: 7 }), before)).toBeNull();
  });

  it('comes back for the next gameweek', () => {
    const next = home({ currentGw: 9, viewingGw: 9, fixtures: [{ kickoff_time: '2026-10-31T15:00:00Z' }] });
    expect(predictionsPrompt(next, before)).toEqual({ gw: 9, deadlineMs: Date.parse('2026-10-31T15:00:00Z') - 75 * 60_000 });
  });
});
