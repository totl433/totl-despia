/**
 * Shared Home predictions fixture helpers — must stay in sync with `HomeScreen`
 * so HP Simulator and production Home render identical grids/cards.
 */
import type { Fixture, LiveStatus } from '@totl/domain';
import { normalizeTeamCode } from './teamColors';

export function fixtureDateLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'No date';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fixtureKickoffTimeLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'KO';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'KO';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatMinute(status: LiveStatus, minute: number | null | undefined) {
  if (status === 'FINISHED') return 'FT';
  if (status === 'PAUSED') return 'HT';
  if (status === 'IN_PLAY') return typeof minute === 'number' ? `${minute}'` : 'LIVE';
  return '';
}

export function formToDotColors(form: string | null | undefined): string[] {
  const chars = (typeof form === 'string' ? form.toUpperCase() : '').replace(/[^WDL]/g, '').slice(-5).split('');
  const padded = chars.length >= 5 ? chars : [...Array(5 - chars.length).fill('D'), ...chars];
  return padded.map((ch) => (ch === 'W' ? '#10B981' : ch === 'L' ? '#DC2626' : '#CBD5E1'));
}

export function ordinalLabel(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return '—';
  const n = Math.trunc(Number(value));
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/** Same ordering as `HomeScreen` before date grouping (fixture_index ascending). */
export function sortFixturesByFixtureIndex(fixtures: Fixture[]): Fixture[] {
  return [...fixtures].sort((a, b) => Number(a?.fixture_index ?? 0) - Number(b?.fixture_index ?? 0));
}

/**
 * Group fixtures under date headings — **must** match `HomeScreen` (sort by `fixture_index`, not kickoff).
 */
export function buildFixturesByDate(fixtures: Fixture[]): Array<{ date: string; fixtures: Fixture[] }> {
  const ordered = sortFixturesByFixtureIndex(fixtures);
  const groups = new Map<string, Fixture[]>();
  ordered.forEach((fixture) => {
    const key = fixtureDateLabel(fixture.kickoff_time ?? null);
    const arr = groups.get(key) ?? [];
    arr.push(fixture);
    groups.set(key, arr);
  });

  const keys = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'No date') return 1;
    if (b === 'No date') return -1;
    const a0 = groups.get(a)?.[0]?.kickoff_time;
    const b0 = groups.get(b)?.[0]?.kickoff_time;
    const da = a0 ? new Date(a0).getTime() : Number.POSITIVE_INFINITY;
    const db = b0 ? new Date(b0).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });

  return keys.map((date) => ({ date, fixtures: groups.get(date) ?? [] }));
}

export function normalizeTeamForms(input: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(input ?? {}).forEach(([rawCode, rawForm]) => {
    const code = normalizeTeamCode(rawCode);
    const form = typeof rawForm === 'string' ? rawForm.trim().toUpperCase() : '';
    if (code && form) out[code] = form;
  });
  return out;
}
