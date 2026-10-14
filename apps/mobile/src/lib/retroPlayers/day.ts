const LONDON = 'Europe/London';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function londonParts(now: Date): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour') };
}

/** Players days whose shared puzzle was redealt. */
const RESHUFFLED_DAYS: Record<string, string> = {
  '2026-10-13': 'reshuffle-1',
};

/**
 * The Players day rolls at 3pm London.
 * A card dealt at 14:00 still belongs to the previous day's puzzle.
 */
export function playersDayKey(now = new Date()): string {
  const parts = londonParts(now);
  let utc = Date.UTC(parts.year, parts.month - 1, parts.day);
  if (parts.hour < 15) utc -= 24 * 60 * 60 * 1000;
  const date = new Date(utc);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Same seed for every player on a given Players day. */
export function playersDaySeed(now = new Date()): number {
  const key = playersDayKey(now);
  const material = RESHUFFLED_DAYS[key] ? `${key}:${RESHUFFLED_DAYS[key]}` : key;
  let hash = 2166136261;
  for (let i = 0; i < material.length; i++) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function playersNextGameLine(now = new Date()): string {
  const parts = londonParts(now);
  if (parts.hour < 15) return 'Next game available at 3pm';
  return "Tomorrow's game available at 3pm";
}

export function playersMonthName(dayKey: string): string {
  const month = Number(dayKey.slice(5, 7));
  return MONTHS[month - 1] ?? 'Month';
}

export function playersMonthKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}
