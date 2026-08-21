import { describe, expect, it } from 'vitest';

import {
  buildGameweekCompleteEventId,
  matchesGoalNotificationMinute,
  resolveKickoffHalf,
  resolveMatchTransitions,
} from './scoreTransitionGuards';

describe('score notification transition guards', () => {
  it('detects first-half kickoff on an initial live insert', () => {
    expect(
      resolveKickoffHalf({
        status: 'IN_PLAY',
        oldStatus: null,
        existingHalf: 0,
        kickoffTooOld: false,
      })
    ).toBe(1);
  });

  it('does not invent second-half kickoff when old status is missing', () => {
    expect(
      resolveKickoffHalf({
        status: 'IN_PLAY',
        oldStatus: null,
        existingHalf: 1,
        kickoffTooOld: false,
      })
    ).toBeNull();
  });

  it('detects second-half kickoff only from a paused transition', () => {
    expect(
      resolveKickoffHalf({
        status: 'IN_PLAY',
        oldStatus: 'PAUSED',
        existingHalf: 1,
        kickoffTooOld: false,
      })
    ).toBe(2);
  });

  it('recognizes personalized goal event IDs for the same minute', () => {
    expect(matchesGoalNotificationMinute('goal:560542:player_name:17:ontrack', 560542, 17)).toBe(true);
    expect(matchesGoalNotificationMinute('goal:560542:player_name:18:offtrack', 560542, 17)).toBe(false);
  });

  it('detects goals and VAR reversals from score transitions', () => {
    expect(
      resolveMatchTransitions({
        status: 'IN_PLAY',
        oldStatus: 'IN_PLAY',
        homeScore: 1,
        awayScore: 0,
        oldHomeScore: 0,
        oldAwayScore: 0,
      })
    ).toMatchObject({ goalScored: true, goalDisallowed: false });

    expect(
      resolveMatchTransitions({
        status: 'IN_PLAY',
        oldStatus: 'IN_PLAY',
        homeScore: 0,
        awayScore: 0,
        oldHomeScore: 1,
        oldAwayScore: 0,
      })
    ).toMatchObject({ goalScored: false, goalDisallowed: true });
  });

  it('detects half-time and full-time transitions without repeats', () => {
    expect(
      resolveMatchTransitions({
        status: 'PAUSED',
        oldStatus: 'IN_PLAY',
        homeScore: 1,
        awayScore: 0,
        oldHomeScore: 1,
        oldAwayScore: 0,
      }).halfTime
    ).toBe(true);

    expect(
      resolveMatchTransitions({
        status: 'FT',
        oldStatus: 'IN_PLAY',
        homeScore: 1,
        awayScore: 0,
        oldHomeScore: 1,
        oldAwayScore: 0,
      }).fullTime
    ).toBe(true);

    expect(
      resolveMatchTransitions({
        status: 'FINISHED',
        oldStatus: 'FT',
        homeScore: 1,
        awayScore: 0,
        oldHomeScore: 1,
        oldAwayScore: 0,
      }).fullTime
    ).toBe(false);
  });

  it('season-scopes gameweek completion event IDs', () => {
    expect(buildGameweekCompleteEventId(1, 'season-26-27')).toBe(
      'gw_complete:season:season-26-27:1'
    );
    expect(buildGameweekCompleteEventId(1, null)).toBe('gw_complete:1');
  });
});
