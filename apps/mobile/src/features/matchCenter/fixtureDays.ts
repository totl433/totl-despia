import type { FeedFixtureRow } from './feed';

export type FixtureDay = { key: string; label: string; rows: Array<FeedFixtureRow & { time: string }> };

/**
 * The fixtures card's games grouped by the day they kick off, in the phone's time zone:
 * "Saturday 31 October", then each game with its kick-off ("13:30"). Rows keep their order;
 * games with no kick-off yet go last under "Date to be confirmed".
 */
export function groupFixturesByDay(rows: FeedFixtureRow[]): FixtureDay[] {
  const days: FixtureDay[] = [];
  const byKey = new Map<string, FixtureDay>();
  const unscheduled: FixtureDay = { key: 'tbc', label: 'Date to be confirmed', rows: [] };
  for (const row of rows) {
    const d = row.kickoff ? new Date(row.kickoff) : null;
    if (!d || Number.isNaN(d.getTime())) {
      unscheduled.rows.push({ ...row, time: 'TBC' });
      continue;
    }
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let day = byKey.get(key);
    if (!day) {
      day = { key, label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), rows: [] };
      byKey.set(key, day);
      days.push(day);
    }
    day.rows.push({ ...row, time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
  }
  return unscheduled.rows.length ? [...days, unscheduled] : days;
}
