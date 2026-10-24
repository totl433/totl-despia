import { describe, expect, it } from 'vitest';

import { playersWeekStart, playersWeekdayIndex, shiftPlayersDay } from './day';
import {
  markPlayersResultSeen,
  mergePlayersResultsSeen,
  parsePlayersResultsSeen,
  pendingPlayersResults,
  playersOrdinal,
  playersPosition,
  playersResultPeriods,
  playersWinnerLabel,
} from './results';
import type { PlayersScoreStore } from './scores';

const ME = 'me';

function s(correct: number, total = 10) {
  return { correct, total };
}

function pending(scoresByUser: Record<string, PlayersScoreStore>, todayKey: string, seen = {}) {
  return pendingPlayersResults({ scoresByUser, userId: ME, todayKey, seen });
}

describe('Players calendar', () => {
  it('weeks start on Monday', () => {
    expect(playersWeekStart('2026-10-12')).toBe('2026-10-12'); // Monday
    expect(playersWeekStart('2026-10-17')).toBe('2026-10-12'); // Saturday
    expect(playersWeekStart('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(playersWeekStart('2026-10-19')).toBe('2026-10-19');
    expect(playersWeekdayIndex('2026-10-19')).toBe(0);
    expect(playersWeekdayIndex('2026-10-24')).toBe(5);
    expect(playersWeekdayIndex('2026-10-25')).toBe(6);
  });

  it('crosses month, year and the October clock change without drifting', () => {
    expect(shiftPlayersDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftPlayersDay('2026-10-25', 1)).toBe('2026-10-26'); // UK clocks go back on 25 Oct
    expect(shiftPlayersDay('2027-01-01', -1)).toBe('2026-12-31');
    expect(playersWeekStart('2027-01-01')).toBe('2026-12-28');
  });

  it('picks yesterday, the previous Monday–Sunday and the previous month', () => {
    const p = playersResultPeriods('2026-11-01');
    expect(p.day.range).toEqual({ from: '2026-10-31', to: '2026-10-31' });
    expect(p.week.range).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(p.month).toEqual({ key: '2026-10', range: { from: '2026-10-01', to: '2026-10-31' } });
    expect(playersResultPeriods('2026-03-05').month.range.to).toBe('2026-02-28');
    expect(playersResultPeriods('2026-01-10').month.key).toBe('2025-12');
  });
});

describe('ranking', () => {
  it('shares positions on ties and skips the next (as the Scoreboard)', () => {
    const totals = { a: 9, b: 9, me: 7, c: 7, d: 3 };
    expect(playersPosition(totals, 'a')).toEqual({ rank: 1, tied: true });
    expect(playersPosition(totals, ME)).toEqual({ rank: 3, tied: true });
    expect(playersPosition(totals, 'd')).toEqual({ rank: 5, tied: false });
    expect(playersPosition(totals, 'nobody')).toBeNull();
  });

  it('formats ordinals', () => {
    expect(['1', '2', '3', '4', '11', '12', '13', '21', '22', '23', '101', '111'].map((n) => playersOrdinal(Number(n)))).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
    ]);
    expect(playersOrdinal(1335)).toBe('1,335th');
  });
});

describe('daily result', () => {
  it('shows when the player played yesterday', () => {
    const [day] = pending({ me: { '2026-10-16': s(8) }, jof: { '2026-10-16': s(6) } }, '2026-10-17');
    expect(day).toMatchObject({ period: 'day', key: '2026-10-16', title: 'Yesterday', winner: true, points: 8, maxPoints: 10 });
    expect(day?.position).toEqual({ rank: 1, tied: false });
  });

  it('is not shown when yesterday was missed, and no older day stands in', () => {
    // Played Monday, back Friday of the same week.
    expect(pending({ me: { '2026-10-12': s(8) } }, '2026-10-16')).toEqual([]);
  });

  it('gives the non-winner their real position', () => {
    const [day] = pending(
      { me: { '2026-10-16': s(4) }, a: { '2026-10-16': s(9) }, b: { '2026-10-16': s(9) }, c: { '2026-10-16': s(5) } },
      '2026-10-17'
    );
    expect(day?.winner).toBe(false);
    expect(day?.position).toEqual({ rank: 4, tied: false });
    expect(day?.winners).toEqual({ score: 9, userIds: ['a', 'b'] });
  });

  it('treats joint first as a win', () => {
    const [day] = pending({ me: { '2026-10-16': s(7) }, jof: { '2026-10-16': s(7) } }, '2026-10-17');
    expect(day?.winner).toBe(true);
    expect(day?.position).toEqual({ rank: 1, tied: true });
  });

  it('is not a win when the top score is 0', () => {
    const [day] = pending({ me: { '2026-10-16': s(0) } }, '2026-10-17');
    expect(day?.winner).toBe(false);
  });

  it('carries week, month and overall positions as at the end of yesterday', () => {
    const scores = {
      me: { '2026-10-02': s(9), '2026-10-13': s(5), '2026-10-16': s(5) },
      jof: { '2026-10-14': s(9), '2026-10-17': s(10) }, // today's game doesn't count yet
      old: { '2026-09-10': s(10), '2026-09-11': s(10) },
    };
    const [day] = pending(scores, '2026-10-17');
    expect(day?.standings).toEqual({
      monthName: 'October',
      week: { rank: 1, tied: false }, // 10 vs 9
      month: { rank: 1, tied: false }, // 19 vs 9
      overall: { rank: 2, tied: false }, // 19 vs old's 20
    });
  });
});

describe('weekly result', () => {
  it('needs only one game in the previous week, not on Sunday', () => {
    // Played Monday 5 Oct, back Friday 16 Oct (the following week).
    const results = pending({ me: { '2026-10-05': s(6) }, jof: { '2026-10-05': s(8), '2026-10-06': s(9) } }, '2026-10-16');
    expect(results.map((r) => r.period)).toEqual(['week']);
    expect(results[0]).toMatchObject({ key: '2026-10-05', title: 'Last week', winner: false, points: 6, maxPoints: 70 });
    expect(results[0]?.winners).toEqual({ score: 17, userIds: ['jof'] });
  });

  it('is not shown for a week the player sat out', () => {
    expect(pending({ me: { '2026-10-01': s(6) }, jof: { '2026-10-06': s(9) } }, '2026-10-16')).toEqual([]);
  });

  it('is not shown for the week still in progress', () => {
    expect(pending({ me: { '2026-10-12': s(6) } }, '2026-10-16').filter((r) => r.period === 'week')).toEqual([]);
  });

  it('is only offered during the following week', () => {
    expect(pending({ me: { '2026-10-05': s(6) } }, '2026-10-19')).toEqual([]);
  });
});

describe('monthly result', () => {
  it('needs only one game in the previous month', () => {
    const results = pending({ me: { '2026-09-03': s(7) }, jof: { '2026-09-03': s(7) } }, '2026-10-16');
    expect(results.map((r) => r.period)).toEqual(['month']);
    expect(results[0]).toMatchObject({ key: '2026-09', title: 'September', winner: true, points: 7, maxPoints: 300 });
    expect(results[0]?.position).toEqual({ rank: 1, tied: true });
  });

  it('is not shown for a month the player sat out', () => {
    expect(pending({ me: { '2026-08-31': s(7) }, jof: { '2026-09-03': s(7) } }, '2026-10-16')).toEqual([]);
  });
});

describe('ordering and acknowledgement', () => {
  // Sunday 31 Oct... 2026-11-01 is a Sunday; the week before is 19–25 Oct.
  const scores = {
    me: { '2026-10-20': s(6), '2026-10-31': s(5) },
    jof: { '2026-10-20': s(9), '2026-10-31': s(2) },
  };

  it('shows monthly, then weekly, then daily', () => {
    expect(pending(scores, '2026-11-01').map((r) => r.period)).toEqual(['month', 'week', 'day']);
  });

  it('does not show an acknowledged result again', () => {
    let seen = markPlayersResultSeen({}, 'month', '2026-10');
    seen = markPlayersResultSeen(seen, 'day', '2026-10-31');
    expect(pending(scores, '2026-11-01', seen).map((r) => r.period)).toEqual(['week']);
  });

  it('never moves a mark backwards', () => {
    const seen = markPlayersResultSeen({ week: '2026-10-19' }, 'week', '2026-10-12');
    expect(seen.week).toBe('2026-10-19');
  });

  it('keeps the later mark from the phone and the account', () => {
    expect(mergePlayersResultsSeen({ day: '2026-10-15', week: '2026-10-05' }, { day: '2026-10-16', month: '2026-09' })).toEqual({
      month: '2026-09',
      week: '2026-10-05',
      day: '2026-10-16',
    });
  });

  it('ignores malformed stored marks', () => {
    expect(parsePlayersResultsSeen({ day: '2026-10-16', week: 5, month: 'soon' })).toEqual({ day: '2026-10-16' });
    expect(parsePlayersResultsSeen(null)).toEqual({});
  });
});

describe('winner wording', () => {
  const names = { jof: 'Jof', carl: 'Carl' };
  it('names a single winner, or you', () => {
    expect(playersWinnerLabel({ score: 59, userIds: ['jof'] }, ME, names)).toBe('Jof · 59');
    expect(playersWinnerLabel({ score: 52, userIds: [ME] }, ME, names)).toBe('You · 52');
  });
  it('summarises ties', () => {
    expect(playersWinnerLabel({ score: 59, userIds: ['a', 'b', 'c', 'd', 'e'] }, ME, names)).toBe('5 players tied · 59');
    expect(playersWinnerLabel({ score: 52, userIds: [ME, 'jof'] }, ME, names)).toBe('You + 1 other · 52');
    expect(playersWinnerLabel({ score: 52, userIds: [ME, 'jof', 'carl'] }, ME, names)).toBe('You + 2 others · 52');
  });
});
