import { describe, expect, it } from 'vitest';
import {
  buildGoalEventId,
  buildGoalFingerprint,
  diffGoalsByFingerprint,
} from './scoreHelpers';

describe('score notification goal fingerprinting', () => {
  it('distinguishes multiple goals in the same minute', () => {
    const homeGoal = buildGoalFingerprint({
      minute: 54,
      scorer: 'Erling Haaland',
      scorerId: 101,
      team: 'Man City',
      teamId: 65,
    });
    const awayGoal = buildGoalFingerprint({
      minute: 54,
      scorer: 'Bukayo Saka',
      scorerId: 202,
      team: 'Arsenal',
      teamId: 57,
    });

    expect(homeGoal).not.toEqual(awayGoal);
  });

  it('keeps the same event id when scorer formatting changes but scorer id is stable', () => {
    const first = buildGoalEventId(12345, {
      minute: 61,
      scorer: 'M. Salah',
      scorerId: 77,
      team: 'Liverpool',
      teamId: 64,
      type: 'REGULAR',
    });
    const second = buildGoalEventId(12345, {
      minute: 61,
      scorer: 'Mohamed Salah',
      scorerId: 77,
      team: 'Liverpool FC',
      teamId: 64,
      type: 'regular',
    });

    expect(first).toEqual(second);
  });

  it('preserves both new goals when they arrive in one update', () => {
    const oldGoals = [
      {
        minute: 12,
        scorer: 'Cole Palmer',
        scorerId: 11,
        team: 'Chelsea',
        teamId: 61,
      },
    ];
    const newGoals = [
      ...oldGoals,
      {
        minute: 54,
        scorer: 'Erling Haaland',
        scorerId: 101,
        team: 'Man City',
        teamId: 65,
      },
      {
        minute: 54,
        scorer: 'Bukayo Saka',
        scorerId: 202,
        team: 'Arsenal',
        teamId: 57,
      },
    ];

    expect(diffGoalsByFingerprint(newGoals, oldGoals)).toEqual(newGoals.slice(1));
  });
});
