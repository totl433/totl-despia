import { describe, expect, it, vi } from 'vitest';

const allRows = Array.from({ length: 2345 }, (_, i) => ({
  user_id: `u${String(i % 60).padStart(2, '0')}`,
  day_key: `d${String(i).padStart(5, '0')}`,
  correct: i % 11,
  total: 10,
}));
const ranges: Array<[number, number]> = [];

vi.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => {
      const query = {
        select: () => query,
        order: () => query,
        range: async (from: number, to: number) => {
          ranges.push([from, to]);
          return { data: allRows.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

import { readSharedPlayersScores } from './scores';

describe('readSharedPlayersScores', () => {
  it('reads every row, not just the first 1,000', async () => {
    const shared = await readSharedPlayersScores();
    const count = Object.values(shared).reduce((sum, store) => sum + Object.keys(store).length, 0);
    expect(count).toBe(2345);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
});
