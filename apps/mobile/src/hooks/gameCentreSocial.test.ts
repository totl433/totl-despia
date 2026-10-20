import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../lib/api', () => ({ api: {} }));

import { applyCardReactionToggle, summariseCardReactions } from './useGameCentreReactions';
import { commentsAsMessages } from './useCardComments';
import { fitReactionChips } from '../features/gameCentre/cards';

describe('card reactions', () => {
  it('counts each emoji once per card, in the order it first arrived, and marks yours', () => {
    const rows = [
      { card_id: 'a', emoji: '🔥', user_id: 'me', created_at: '2026-10-20T10:00:02Z' },
      { card_id: 'a', emoji: '😎', user_id: 'u2', created_at: '2026-10-20T10:00:01Z' },
      { card_id: 'a', emoji: '🔥', user_id: 'u2', created_at: '2026-10-20T10:00:03Z' },
      { card_id: 'b', emoji: '🎃', user_id: 'u3', created_at: '2026-10-20T10:00:04Z' },
    ];
    expect(summariseCardReactions(rows, 'me')).toEqual({
      a: [
        { emoji: '😎', count: 1, hasUserReacted: false },
        { emoji: '🔥', count: 2, hasUserReacted: true },
      ],
      b: [{ emoji: '🎃', count: 1, hasUserReacted: false }],
    });
  });

  it('lets you add several emoji and take each back', () => {
    let chips = applyCardReactionToggle([], '🔥');
    chips = applyCardReactionToggle(chips, '🎃');
    expect(chips).toEqual([
      { emoji: '🔥', count: 1, hasUserReacted: true },
      { emoji: '🎃', count: 1, hasUserReacted: true },
    ]);
    chips = applyCardReactionToggle(chips, '🔥');
    expect(chips).toEqual([{ emoji: '🎃', count: 1, hasUserReacted: true }]);
  });

  it("adds yours to someone else's emoji without removing theirs", () => {
    const chips = applyCardReactionToggle([{ emoji: '😎', count: 2, hasUserReacted: false }], '😎');
    expect(chips).toEqual([{ emoji: '😎', count: 3, hasUserReacted: true }]);
    expect(applyCardReactionToggle(chips, '😎')).toEqual([{ emoji: '😎', count: 2, hasUserReacted: false }]);
  });
});

describe('two rows of reaction chips', () => {
  const chips = (n: number) => Array.from({ length: n }, (_, i) => ({ emoji: `e${i}`, count: 0, hasUserReacted: false }));

  it('shows everything when it fits', () => {
    expect(fitReactionChips(chips(3), 327)).toBe(3);
  });

  it('stops at two rows and keeps room for the + chip', () => {
    // 28pt chips with 12pt gaps: 8 per 327pt row; the second row leaves space for +.
    const shown = fitReactionChips(chips(30), 327);
    expect(shown).toBe(15);
  });

  it('shows all chips before the first layout', () => {
    expect(fitReactionChips(chips(30), 0)).toBe(30);
  });
});

describe('comments as chat messages', () => {
  it('keeps the thread order and links replies', () => {
    const messages = commentsAsMessages([
      { id: 'c1', card_id: 'mc:gw7:goal:9:H1', user_id: 'u1', content: 'What a strike', reply_to_comment_id: null, created_at: '2026-10-19T19:15:00Z' },
      { id: 'c2', card_id: 'mc:gw7:goal:9:H1', user_id: 'u2', content: 'Offside', reply_to_comment_id: 'c1', created_at: '2026-10-19T19:16:00Z' },
    ]);
    expect(messages.map((m) => m.id)).toEqual(['c1', 'c2']);
    expect(messages[1]?.reply_to).toEqual({ id: 'c1', content: 'What a strike', user_id: 'u1' });
    expect(messages[0]?.league_id).toBe('mc:gw7:goal:9:H1');
  });
});
