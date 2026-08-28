/**
 * Premier League kickoff display — always UK local (BST/GMT), not UTC wall
 * and not the browser's local timezone.
 */

export const UK_TIMEZONE = 'Europe/London';

export function formatKickoffTimeUk(
  iso: string | null | undefined,
  options?: { hour12?: boolean }
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: options?.hour12 ?? false,
  }).format(d);
}

export function formatKickoffDateUk(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

/** Combined "Fri 21 Aug · 20:00" label when both needed */
export function formatKickoffLabelUk(iso: string | null | undefined): string {
  if (!iso) return 'TBC';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBC';
  const date = formatKickoffDateUk(iso);
  const time = formatKickoffTimeUk(iso);
  return date && time ? `${date} ${time}` : date || time || 'TBC';
}

/** Prediction deadline = 75 minutes before first kickoff. */
export function getPredictionDeadline(kickoffIso: string): Date {
  return new Date(new Date(kickoffIso).getTime() - 75 * 60 * 1000);
}

/** Banner text e.g. "Fri, Aug 28, 18:45" — always UK local, never UTC wall clock. */
export function formatDeadlineBannerText(kickoffIso: string): string {
  const deadline = getPredictionDeadline(kickoffIso);
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    weekday: 'short',
  }).format(deadline);
  const month = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    month: 'short',
  }).format(deadline);
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    day: 'numeric',
  }).format(deadline);
  const time = formatKickoffTimeUk(deadline.toISOString());
  return `${weekday}, ${month} ${day}, ${time}`;
}

/** Parse banner deadline text (UK local) back to an absolute Date. */
export function parseDeadlineBannerTextUk(deadlineText: string): Date | null {
  try {
    const parts = deadlineText.split(', ');
    if (parts.length < 3) return null;

    const datePart = parts[1];
    const timePart = parts[2];
    const [hours, minutes] = timePart.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthMatch = datePart.match(/(\w+)\s+(\d+)/);
    if (!monthMatch) return null;

    const monthIndex = monthNames.indexOf(monthMatch[1]);
    const day = parseInt(monthMatch[2], 10);
    if (monthIndex === -1) return null;

    const year = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: UK_TIMEZONE, year: 'numeric' }).format(new Date())
    );

    const toUkInstant = (y: number) => ukLocalDateTimeToDate(y, monthIndex, day, hours, minutes);

    let deadline = toUkInstant(year);
    if (deadline <= new Date()) {
      const nextYear = toUkInstant(year + 1);
      if (nextYear <= new Date()) return null;
      deadline = nextYear;
    }
    return deadline;
  } catch {
    return null;
  }
}

function ukLocalDateTimeToDate(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number
): Date {
  let utcMs = Date.UTC(year, monthIndex, day, hours, minutes);
  for (let attempt = 0; attempt < 4; attempt++) {
    const d = new Date(utcMs);
    const ukTime = formatKickoffTimeUk(d.toISOString());
    const ukHour = Number(ukTime.slice(0, 2));
    const ukMin = Number(ukTime.slice(3, 5));
    const deltaMinutes = hours * 60 + minutes - (ukHour * 60 + ukMin);
    if (deltaMinutes === 0) break;
    utcMs += deltaMinutes * 60 * 1000;
  }
  return new Date(utcMs);
}
