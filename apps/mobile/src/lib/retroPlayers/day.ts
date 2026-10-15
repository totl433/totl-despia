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

/** Players days whose shared puzzle was redealt. */
const RESHUFFLED_DAYS: Record<string, string> = {
  '2026-10-13': 'reshuffle-1',
};

/**
 * The Players day rolls at midnight GMT (UTC), the same moment for every player
 * wherever they are. That is 1am in London during British Summer Time.
 */
export function playersDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Milliseconds until the next Players day starts. */
export function msUntilNextPlayersDay(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
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

/** "Next game in 5h 12m" — counts down to midnight GMT. */
export function playersNextGameLine(now = new Date()): string {
  const minutes = Math.max(1, Math.ceil(msUntilNextPlayersDay(now) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `Next game in ${m}m`;
  return m === 0 ? `Next game in ${h}h` : `Next game in ${h}h ${m}m`;
}

export function playersMonthName(dayKey: string): string {
  const month = Number(dayKey.slice(5, 7));
  return MONTHS[month - 1] ?? 'Month';
}

export function playersMonthKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}
