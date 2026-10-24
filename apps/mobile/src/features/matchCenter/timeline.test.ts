import type { Fixture } from '@totl/domain';
import { describe, expect, it, vi } from 'vitest';

// League avatars load images through react-native, which vitest can't parse.
vi.mock('../../lib/leagueAvatars', () => ({
  resolveLeagueAvatarUri: () => null,
}));

import type { FeedItem } from './feed';
import { compareFeedItems, gameweekOpensAtMs, placeRoundUp, timelineRows } from './timeline';

const card = (id: string, sortAt: number, kind: FeedItem['kind'] = 'goal'): FeedItem =>
  ({
    id,
    sortAt,
    kind,
    timeLabel: '',
    eyebrow: '',
    title: '',
    body: '',
  }) as FeedItem;

describe('gameweek timeline', () => {
  it('opens a gameweek 75 minutes before its first kickoff', () => {
    const fixtures = [{ kickoff_time: '2026-10-24T14:00:00Z' }, { kickoff_time: '2026-10-24T11:30:00Z' }] as Fixture[];
    expect(gameweekOpensAtMs(fixtures)).toBe(Date.parse('2026-10-24T10:15:00Z'));
    expect(gameweekOpensAtMs([])).toBeNull();
  });

  it('puts older gameweeks under the top one, newest first, each under its divider', () => {
    const top = [card('ft:9', 30), card('goal:9:H1', 20)];
    const rows = timelineRows(top, [
      {
        gw: 7,
        items: [card('ko:9', 1), card('chat:abc', 2, 'message'), card('ft:9', 3)],
      },
      { gw: 6, items: [] },
      { gw: 5, items: [card('ft:9', 1)] },
    ]);
    expect(rows.map((row) => row.key)).toEqual([
      'ft:9',
      'goal:9:H1',
      'gw-divider:7',
      'gw7|ft:9',
      'gw7|chat:abc',
      'gw7|ko:9',
      'gw-divider:5',
      'gw5|ft:9',
    ]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.filter((row) => row.type === 'item').map((row) => (row.type === 'item' ? row.gw : 0))).toEqual([
      null,
      null,
      7,
      7,
      7,
      5,
    ]);
  });

  it('orders cards by time, then half-time before goals before messages', () => {
    const sorted = [
      card('chat:x', 5, 'message'),
      card('goal:1:H1', 5),
      card('ht:1', 5, 'half-time'),
      card('ko:1', 1, 'kickoff'),
    ].sort(compareFeedItems);
    expect(sorted.map((item) => item.id)).toEqual(['ko:1', 'ht:1', 'goal:1:H1', 'chat:x']);
  });

  it('puts the round-up just after the last match card, so later messages sit above it', () => {
    const roundUp = [card('roundup:leagues', Number.MAX_SAFE_INTEGER - 2, 'round-up')];
    const placed = placeRoundUp(roundUp, [card('ft:9', 500, 'full-time'), card('ft:3', 200, 'full-time')]);
    expect(placed[0]?.sortAt).toBe(501);
    const later = card('chat:late', 900, 'message');
    expect([later, ...placed].sort(compareFeedItems).map((item) => item.id)).toEqual(['roundup:leagues', 'chat:late']);
    expect(placeRoundUp(roundUp, [])).toBe(roundUp);
  });
});
