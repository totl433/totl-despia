import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

import { scoreForMonth, scoreForWeek } from './scores';

const s = (correct: number) => ({ correct, total: 10 });

describe('Players scoreboard totals', () => {
  // Sunday 18 Oct 2026; that week started Monday 12 Oct.
  const store = { '2026-10-11': s(9), '2026-10-12': s(4), '2026-10-15': s(6), '2026-10-18': s(3), '2026-10-19': s(10) };

  it('adds up the week from Monday to the given day', () => {
    expect(scoreForWeek(store, '2026-10-18')).toBe(13);
    expect(scoreForWeek(store, '2026-10-15')).toBe(10);
  });

  it('starts a new week on Monday', () => {
    expect(scoreForWeek(store, '2026-10-19')).toBe(10);
    expect(scoreForWeek({ '2026-10-11': s(9) }, '2026-10-19')).toBeNull();
  });

  it('runs across the end of a month', () => {
    expect(scoreForWeek({ '2026-09-28': s(5), '2026-10-01': s(7) }, '2026-10-01')).toBe(12);
    expect(scoreForMonth({ '2026-09-28': s(5), '2026-10-01': s(7) }, '2026-10-01')).toBe(7);
  });
});
