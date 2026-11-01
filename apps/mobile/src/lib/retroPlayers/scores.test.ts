import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

import { recordPlayersProgress, scoreForMonth, scoreForWeek, scoresForWeekDays, settlePlayersAttempts } from './scores';

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

  it('lists Mon–Sun scores for the week columns', () => {
    expect(scoresForWeekDays(store, '2026-10-18')).toEqual([4, null, null, 6, null, null, 3]);
    expect(scoresForWeekDays(store, '2026-10-15')).toEqual([4, null, null, 6, null, null, null]);
  });
});

describe('Players attempts', () => {
  const day = '2026-10-30';

  it('starts an attempt at zero, unfinished', () => {
    expect(recordPlayersProgress({}, day, { correct: 0, total: 10 }, false)).toEqual({
      [day]: { correct: 0, total: 10, finished: false },
    });
  });

  it('raises the attempt after each answer and finishes it', () => {
    let store = recordPlayersProgress({}, day, { correct: 0, total: 10 }, false);
    store = recordPlayersProgress(store, day, { correct: 1, total: 10 }, false);
    store = recordPlayersProgress(store, day, { correct: 2, total: 10 }, false);
    expect(store[day]).toEqual({ correct: 2, total: 10, finished: false });
    store = recordPlayersProgress(store, day, { correct: 2, total: 10 }, true);
    expect(store[day]).toEqual({ correct: 2, total: 10 });
  });

  it('never changes a finished day, so a second go does not count', () => {
    const store = { [day]: { correct: 3, total: 10 } };
    expect(recordPlayersProgress(store, day, { correct: 0, total: 10 }, false)).toBe(store);
    expect(recordPlayersProgress(store, day, { correct: 9, total: 10 }, true)).toBe(store);
  });

  it('never lowers a score or goes past the total', () => {
    const store = { [day]: { correct: 4, total: 10, finished: false } };
    expect(recordPlayersProgress(store, day, { correct: 1, total: 10 }, false)[day].correct).toBe(4);
    expect(recordPlayersProgress(store, day, { correct: 15, total: 20 }, false)[day]).toEqual({
      correct: 10,
      total: 10,
      finished: false,
    });
  });

  it('settles an attempt left mid-game with the score it had', () => {
    const store = { '2026-10-29': s(6), [day]: { correct: 2, total: 10, finished: false } };
    expect(settlePlayersAttempts(store)).toEqual({ '2026-10-29': s(6), [day]: s(2) });
    const done = { [day]: s(2) };
    expect(settlePlayersAttempts(done)).toBe(done);
  });
});
