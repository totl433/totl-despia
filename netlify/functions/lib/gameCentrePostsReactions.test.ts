import { describe, expect, it } from 'vitest';

import { newCardId } from './gameCentrePostsReactions';

const goal = (id: string, minute: number, after: [number, number]) => ({
  id: `mc:gw7:goal:9:${id}`,
  fixture_index: 9,
  kind: 'goal',
  details: { minute, score_after: { home: after[0], away: after[1] } },
});
const posts = [goal('H1', 14, [1, 0]), goal('A1', 49, [1, 1]), goal('H2', 58, [2, 1])];

describe('moving goal reactions to posts', () => {
  it('maps the old minute-and-position id to the post with that minute', () => {
    expect(newCardId('mc:gw7:goal:9:14:0', 7, posts)).toBe('mc:gw7:goal:9:H1');
    expect(newCardId('mc:gw7:goal:9:58:2', 7, posts)).toBe('mc:gw7:goal:9:H2');
  });

  it('maps a score-only card to the goal that made that score', () => {
    expect(newCardId('mc:gw7:score:9:1-1', 7, posts)).toBe('mc:gw7:goal:9:A1');
  });

  it('leaves ids it cannot place, and other cards, alone', () => {
    expect(newCardId('mc:gw7:goal:9:77:3', 7, posts)).toBeNull();
    expect(newCardId('mc:gw7:ht:9', 7, posts)).toBeNull();
    expect(newCardId('mc:gw8:goal:9:14:0', 7, posts)).toBeNull();
  });
});
