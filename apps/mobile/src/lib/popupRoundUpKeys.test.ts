import { describe, expect, it } from 'vitest';

import {
  formatLeaderboardSeasonPill,
  parsePersonalWinnerTypeFromEventKey,
  parseSeasonLabelFromEventKey,
  roundUpEventKey,
  roundUpSeasonScope,
} from './popupRoundUpKeys';

describe('round-up season event keys', () => {
  it('scopes pile-B cards so GW1 is not last season’s seen key', () => {
    expect(roundUpSeasonScope({ useSeasonStack: true, seasonLabel: '2026/27' })).toBe('2026/27');
    expect(roundUpEventKey('winners', 1, '2026/27')).toBe('winners:gw1:2026/27');
    expect(roundUpEventKey('winners', 1, '2026/27')).not.toBe('winners:gw1');
  });

  it('keeps pile-A cards on 2025/26', () => {
    expect(roundUpSeasonScope({ useSeasonStack: false, seasonLabel: '2026/27' })).toBe('2025/26');
    expect(roundUpEventKey('results', 1, '2025/26')).toBe('results:gw1:2025/26');
  });

  it('shortens the leaderboard pill', () => {
    expect(formatLeaderboardSeasonPill('2026/27')).toBe('26/27 Leaderboard');
    expect(formatLeaderboardSeasonPill('2025/26')).toBe('25/26 Leaderboard');
  });

  it('reads season and personal-winner type from scoped keys', () => {
    expect(parseSeasonLabelFromEventKey('personalWinner:monthly:gw2:2026/27')).toBe('2026/27');
    expect(parsePersonalWinnerTypeFromEventKey('personalWinner:monthly:gw2:2026/27')).toBe('monthly');
    expect(parsePersonalWinnerTypeFromEventKey('personalWinner:gameweek:gw1:2026/27')).toBe('gameweek');
    expect(parsePersonalWinnerTypeFromEventKey('simulator:personalWinner:monthly')).toBe('monthly');
    expect(roundUpEventKey('personalWinner:monthly', 2, '2026/27')).toBe(
      'personalWinner:monthly:gw2:2026/27'
    );
  });
});
