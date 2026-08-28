import { describe, expect, it } from 'vitest';

import {
  buildGoalDisallowedCandidateEventId,
  decideGoalDisallowedCandidate,
  findRemovedGoals,
  goalStillMissing,
  isSuspiciousGoalsWipe,
  normalizeGoalIdentity,
} from './goalDisallowedConfirm';

describe('goal disallowed confirmation', () => {
  it('normalizes goal identity by scorer + minute', () => {
    expect(normalizeGoalIdentity({ scorer: ' Erling Haaland ', minute: 17 })).toBe(
      'erling haaland|17'
    );
  });

  it('finds goals removed from the list', () => {
    const removed = findRemovedGoals(
      [
        { scorer: 'Haaland', minute: 17 },
        { scorer: 'Cherki', minute: 54 },
      ],
      [{ scorer: 'Cherki', minute: 54 }]
    );
    expect(removed).toHaveLength(1);
    expect(removed[0].scorer).toBe('Haaland');
  });

  it('flags suspicious full goals wipes', () => {
    expect(
      isSuspiciousGoalsWipe(
        [
          { scorer: 'A', minute: 10 },
          { scorer: 'B', minute: 20 },
          { scorer: 'C', minute: 30 },
        ],
        [],
        1
      )
    ).toBe(true);

    expect(
      isSuspiciousGoalsWipe(
        [
          { scorer: 'A', minute: 10 },
          { scorer: 'B', minute: 20 },
        ],
        [{ scorer: 'A', minute: 10 }],
        1
      )
    ).toBe(false);
  });

  it('cancels when the goal reappears (VAR stands)', () => {
    const decision = decideGoalDisallowedCandidate({
      candidateCreatedAt: new Date(Date.now() - 120_000).toISOString(),
      goals: [{ scorer: 'Haaland', minute: 17 }],
      candidate: { scorer: 'Haaland', minute: 17 },
      scoreWentDownThisUpdate: false,
    });
    expect(decision).toEqual({ action: 'cancel', reason: 'goal_restored' });
  });

  it('waits during the same score-drop update', () => {
    const decision = decideGoalDisallowedCandidate({
      candidateCreatedAt: new Date().toISOString(),
      goals: [],
      candidate: { scorer: 'Haaland', minute: 17 },
      scoreWentDownThisUpdate: true,
    });
    expect(decision).toEqual({ action: 'wait' });
  });

  it('waits until the confirm window elapses', () => {
    const decision = decideGoalDisallowedCandidate({
      candidateCreatedAt: new Date(Date.now() - 30_000).toISOString(),
      goals: [],
      candidate: { scorer: 'Haaland', minute: 17 },
      scoreWentDownThisUpdate: false,
      confirmAfterMs: 90_000,
    });
    expect(decision).toEqual({ action: 'wait' });
  });

  it('confirms when the goal stays missing past the window', () => {
    const decision = decideGoalDisallowedCandidate({
      candidateCreatedAt: new Date(Date.now() - 120_000).toISOString(),
      goals: [{ scorer: 'Cherki', minute: 54 }],
      candidate: { scorer: 'Haaland', minute: 17 },
      scoreWentDownThisUpdate: false,
      confirmAfterMs: 90_000,
    });
    expect(decision).toEqual({
      action: 'confirm',
      reason: 'goal_still_missing_after_confirm_window',
    });
  });

  it('builds stable candidate event ids', () => {
    expect(buildGoalDisallowedCandidateEventId(123, 17, 'Erling Haaland')).toBe(
      'goal_disallowed_candidate:123:17:erling_haaland'
    );
  });

  it('detects whether a candidate goal is still missing', () => {
    expect(
      goalStillMissing([{ scorer: 'Haaland', minute: 17 }], {
        scorer: 'Haaland',
        minute: 17,
      })
    ).toBe(false);
    expect(
      goalStillMissing([{ scorer: 'Cherki', minute: 54 }], {
        scorer: 'Haaland',
        minute: 17,
      })
    ).toBe(true);
  });
});
