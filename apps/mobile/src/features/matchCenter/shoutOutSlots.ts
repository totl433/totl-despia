/**
 * Quiet slots for winner shout-outs after the last full-time.
 * Players owns 8am; these cards never use that minute.
 */

const HOUR = 3_600_000;
const MINUTE = 60_000;
const PLAYERS_AFTER_MS = 8 * HOUR + 5 * MINUTE;
const EVENING_MS = 19 * HOUR;
const EIGHT_PM_MS = 20 * HOUR;
const GAP_MS = 12 * HOUR;
const SOON_MS = 45 * MINUTE;
const HERE_WE_GO_LEAD_MS = 75 * MINUTE;
const MIDWEEK_HOUR_MS = 10 * HOUR;

export type WinnerShoutKind = 'gw' | 'monthly' | 'season';
export type FillerShoutKind = 'midweek-month' | 'midweek-overall';
export type StatMomentKind = 'draws' | 'away' | 'missed' | 'easiest' | 'late';
export type ScheduledShout = { kind: WinnerShoutKind | FillerShoutKind; at: number };
export type ScheduledStat = { kind: StatMomentKind; at: number };
export type BusyInterval = { from: number; to: number };

/** Prediction-week first: draws / away, then the season table stats. */
export const OPEN_STAT_ORDER: StatMomentKind[] = ['draws', 'away', 'missed', 'easiest', 'late'];
/** After kick-off: table stats first, then leftover draw / away reminders. */
export const WEEK_STAT_ORDER: StatMomentKind[] = ['missed', 'easiest', 'late', 'draws', 'away'];

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function localTimeOnDay(ms: number, timeOfDayMs: number): number {
  return startOfLocalDay(ms) + timeOfDayMs;
}

export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function isWeekendGameweek(kickoffMs: number[]): boolean {
  if (!kickoffMs.length) return false;
  return kickoffMs.every((ms) => {
    const day = new Date(ms).getDay();
    return day === 0 || day === 5 || day === 6;
  });
}

/** First winner card: +45m if the last FT is before 8pm, else next morning after Players. */
export function firstWinnerSlot(lastFtMs: number): number {
  if (lastFtMs - startOfLocalDay(lastFtMs) >= EIGHT_PM_MS) {
    return localTimeOnDay(startOfLocalDay(lastFtMs) + 24 * HOUR, PLAYERS_AFTER_MS);
  }
  return lastFtMs + SOON_MS;
}

/** Next winner card: at least 12h later, morning after Players or that evening. */
export function nextWinnerSlot(prevMs: number): number {
  const earliest = prevMs + GAP_MS;
  const morning = localTimeOnDay(earliest, PLAYERS_AFTER_MS);
  if (morning >= earliest) return morning;
  const evening = localTimeOnDay(earliest, EVENING_MS);
  if (evening >= earliest) return evening;
  return localTimeOnDay(startOfLocalDay(earliest) + 24 * HOUR, PLAYERS_AFTER_MS);
}

function nextTuesdayAfter(lastFtMs: number): number {
  const start = startOfLocalDay(lastFtMs);
  for (let i = 1; i <= 8; i += 1) {
    const day = start + i * 24 * HOUR;
    if (new Date(day).getDay() === 2) return day + MIDWEEK_HOUR_MS;
  }
  return start + 2 * 24 * HOUR + MIDWEEK_HOUR_MS;
}

export function scheduleWinnerShouts(input: {
  lastFtMs: number;
  nowMs: number;
  nextHereWeGoMs: number | null;
  monthClosed: boolean;
  seasonClosed: boolean;
  weekendGw: boolean;
}): ScheduledShout[] {
  const kinds: WinnerShoutKind[] = ['gw'];
  if (input.monthClosed) kinds.push('monthly');
  if (input.seasonClosed) kinds.push('season');

  const hardStop = input.nextHereWeGoMs == null ? Number.POSITIVE_INFINITY : input.nextHereWeGoMs;
  const slots: ScheduledShout[] = [];
  let at = firstWinnerSlot(input.lastFtMs);
  for (const kind of kinds) {
    if (at >= hardStop) break;
    slots.push({ kind, at });
    at = nextWinnerSlot(at);
  }

  if (!input.weekendGw) return slots.filter((slot) => slot.at <= input.nowMs);

  const takenDays = new Set(slots.map((slot) => localDayKey(slot.at)));
  const tuesday = nextTuesdayAfter(input.lastFtMs);
  const wednesday = localTimeOnDay(tuesday + 24 * HOUR, MIDWEEK_HOUR_MS);
  const fillers: ScheduledShout[] = [
    { kind: 'midweek-month', at: tuesday },
    { kind: 'midweek-overall', at: wednesday },
  ];
  for (const filler of fillers) {
    if (filler.at >= hardStop) continue;
    if (takenDays.has(localDayKey(filler.at))) continue;
    if (filler.at > input.nowMs) continue;
    slots.push(filler);
  }

  return slots.filter((slot) => slot.at <= input.nowMs);
}

export function hereWeGoMs(firstKickoffMs: number | null): number | null {
  return firstKickoffMs == null ? null : firstKickoffMs - HERE_WE_GO_LEAD_MS;
}

/** First midweek / Predictions-open slot: morning after Players, or that evening. */
export function firstOpenSlot(fromMs: number): number {
  const morning = localTimeOnDay(fromMs, PLAYERS_AFTER_MS);
  if (morning >= fromMs) return morning;
  const evening = localTimeOnDay(fromMs, EVENING_MS);
  if (evening >= fromMs) return evening;
  return localTimeOnDay(startOfLocalDay(fromMs) + 24 * HOUR, PLAYERS_AFTER_MS);
}

export function generateQuietSlots(input: {
  startMs: number;
  hardStopMs: number;
  firstSoon?: boolean;
}): number[] {
  const hard = Number.isFinite(input.hardStopMs) ? input.hardStopMs : Number.POSITIVE_INFINITY;
  let at = input.firstSoon ? firstWinnerSlot(input.startMs) : firstOpenSlot(input.startMs);
  const slots: number[] = [];
  for (let i = 0; i < 16 && at < hard; i += 1) {
    slots.push(at);
    at = nextWinnerSlot(at);
  }
  return slots;
}

function intervalCovers(ms: number, busy: BusyInterval[]): boolean {
  return busy.some((span) => ms >= span.from && ms < span.to);
}

/**
 * Unused quiet slots — same clock as winner shout-outs. Skips days that already
 * have a reserved card, live-match windows, and anything after Here We Go.
 */
export function leftoverQuietSlots(input: {
  startMs: number;
  hardStopMs: number;
  nowMs: number;
  firstSoon?: boolean;
  reservedMs?: number[];
  busy?: BusyInterval[];
}): number[] {
  const reservedDays = new Set((input.reservedMs ?? []).map((ms) => localDayKey(ms)));
  const reservedAt = new Set(input.reservedMs ?? []);
  return generateQuietSlots(input).filter((at) => {
    if (at > input.nowMs) return false;
    if (reservedAt.has(at)) return false;
    if (reservedDays.has(localDayKey(at))) return false;
    if (intervalCovers(at, input.busy ?? [])) return false;
    return true;
  });
}

export function assignStatSlots(kinds: StatMomentKind[], slots: number[], used: Set<StatMomentKind>): ScheduledStat[] {
  const out: ScheduledStat[] = [];
  for (const at of slots) {
    const kind = kinds.find((next) => !used.has(next));
    if (!kind) break;
    used.add(kind);
    out.push({ kind, at });
  }
  return out;
}

/**
 * Drop one season-stat card into each leftover quiet slot.
 * Predictions-open days take draws / away first; live and after-FT leftovers take the rest.
 */
export function scheduleStatMoments(input: {
  nowMs: number;
  gwOpenMs: number | null;
  deadlineMs: number | null;
  lastFtMs: number | null;
  nextHereWeGoMs: number | null;
  reservedMs?: number[];
  busy?: BusyInterval[];
  available: StatMomentKind[];
}): ScheduledStat[] {
  const used = new Set<StatMomentKind>();
  const available = new Set(input.available);
  const pick = (order: StatMomentKind[]) => order.filter((kind) => available.has(kind));
  const hardStop = input.nextHereWeGoMs ?? Number.POSITIVE_INFINITY;
  const assigned: ScheduledStat[] = [];

  if (input.gwOpenMs != null && input.deadlineMs != null) {
    assigned.push(
      ...assignStatSlots(
        pick(OPEN_STAT_ORDER),
        leftoverQuietSlots({
          startMs: input.gwOpenMs,
          hardStopMs: Math.min(input.deadlineMs, hardStop),
          nowMs: input.nowMs,
          busy: input.busy,
        }),
        used
      )
    );
  }

  if (input.lastFtMs != null) {
    assigned.push(
      ...assignStatSlots(
        pick(WEEK_STAT_ORDER),
        leftoverQuietSlots({
          startMs: input.lastFtMs,
          hardStopMs: hardStop,
          nowMs: input.nowMs,
          firstSoon: true,
          reservedMs: input.reservedMs,
          busy: input.busy,
        }),
        used
      )
    );
    return assigned;
  }

  if (input.deadlineMs != null && input.nowMs >= input.deadlineMs) {
    assigned.push(
      ...assignStatSlots(
        pick(WEEK_STAT_ORDER),
        leftoverQuietSlots({
          startMs: input.deadlineMs,
          hardStopMs: hardStop,
          nowMs: input.nowMs,
          reservedMs: input.reservedMs,
          busy: input.busy,
        }),
        used
      )
    );
  }

  return assigned;
}
