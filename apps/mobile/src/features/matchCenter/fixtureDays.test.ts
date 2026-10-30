import { describe, expect, it } from 'vitest';

import { groupFixturesByDay } from './fixtureDays';

const row = (homeCode: string, kickoff: string | null) => ({ homeCode, awayCode: 'XXX', homeName: homeCode, awayName: 'X', kickoff });

describe('groupFixturesByDay', () => {
  it('groups games under the day they kick off, with each kick-off time', () => {
    const local = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min).toISOString();
    const days = groupFixturesByDay([
      row('CHE', local(2026, 9, 31, 13, 30)),
      row('BOU', local(2026, 9, 31, 16, 0)),
      row('MCI', local(2026, 10, 1, 14, 0)),
      row('NEW', null),
    ]);
    expect(days.map((day) => day.rows.map((r) => r.homeCode))).toEqual([['CHE', 'BOU'], ['MCI'], ['NEW']]);
    expect(days[0].label).toMatch(/^Saturday,? 31 October$/);
    expect(days[0].rows.map((r) => r.time)).toEqual(['13:30', '16:00']);
    expect(days[2]).toMatchObject({ key: 'tbc', label: 'Date to be confirmed' });
    expect(days[2].rows[0].time).toBe('TBC');
  });
});
