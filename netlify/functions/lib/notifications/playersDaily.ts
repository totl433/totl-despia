/**
 * The Players daily reminder: one generic nudge at 9:30am London time.
 *
 * Netlify cron runs in UTC, so the function is scheduled for both 08:30 and 09:30 UTC
 * and only sends on the run that lands at 9:30 in London (BST in summer, GMT in winter).
 */

export const PLAYERS_DAILY_KEY = 'players-daily';
/** Notification Centre > Games > Daily Game Reminders. */
export const DAILY_GAME_PREF = 'daily-game-reminders';

export const PLAYERS_DAILY_TITLE = 'The Players';
export const PLAYERS_DAILY_BODY = "Today's ten players are in. Can you name their clubs?";
export const PLAYERS_DAILY_PATH = '/players';

const LONDON_HOUR = 9;
const LONDON_MINUTE = 30;
/** Cron can start a few minutes late; anything later than this waits for tomorrow. */
const WINDOW_MINUTES = 15;

export function londonClock(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? NaN);
  return { hour: read('hour'), minute: read('minute') };
}

/** True from 09:30 to 09:44 London time. */
export function isPlayersReminderTime(now: Date): boolean {
  const { hour, minute } = londonClock(now);
  return hour === LONDON_HOUR && minute >= LONDON_MINUTE && minute < LONDON_MINUTE + WINDOW_MINUTES;
}

/** The Players day rolls at midnight UTC, matching the app's `playersDayKey`. */
export function playersDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function playersDailyEventId(dayKey: string): string {
  return `players_daily:${dayKey}`;
}

/** On unless Daily Game Reminders is switched off. */
export function wantsPlayersDaily(prefs: Record<string, unknown> | null | undefined): boolean {
  return prefs?.[DAILY_GAME_PREF] !== false;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
