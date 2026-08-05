export type GameweekStreakRow = {
  gw: number;
  points: number | null;
  /**
   * Season folder this GW belongs to (e.g. "2025/26"). Required when a ladder spans seasons
   * so GW1 of 25/26 ≠ GW1 of 26/27.
   */
  seasonLabel?: string;
};

/**
 * Consecutive gameweeks with a score, counting backward from the latest chip (Stats ladder order).
 * Streaks intentionally span seasons when rows are concatenated oldest → newest.
 */
export function countTrailingGameweekParticipationStreak(rows: GameweekStreakRow[]): number {
  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (typeof rows[i]!.points === 'number') streak++;
    else break;
  }
  return streak;
}

export function streakRowKey(row: GameweekStreakRow): string {
  const season = row.seasonLabel?.trim() || '_';
  return `${season}|${row.gw}`;
}

/** Short form for chip eyebrow: "25/26" from "2025/26". */
export function shortSeasonLabel(label: string | undefined | null): string | null {
  if (!label?.trim()) return null;
  const m = label.trim().match(/^(\d{2})(\d{2})\/(\d{2})$/);
  // "2025/26" → "25/26"
  const m2 = label.trim().match(/^(\d{4})\/(\d{2})$/);
  if (m2) return `${m2[1]!.slice(2)}/${m2[2]}`;
  return label.trim();
}

/**
 * Ladder span footer under the streak strip.
 * Cross-season: "25/26 GW32 → 26/27 GW1 · 8 gameweeks"
 * Single season: "GW1–GW38 · 38 gameweeks"
 */
export function formatStreakLadderFooter(rows: GameweekStreakRow[]): string {
  if (!rows.length) return '';
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const n = rows.length;
  const unit = n === 1 ? 'gameweek' : 'gameweeks';

  const seasons = new Set(
    rows.map((r) => r.seasonLabel?.trim()).filter((s): s is string => !!s && s.length > 0)
  );
  const multiSeason = seasons.size > 1;

  if (multiSeason) {
    const a = shortSeasonLabel(first.seasonLabel) ?? first.seasonLabel ?? '';
    const b = shortSeasonLabel(last.seasonLabel) ?? last.seasonLabel ?? '';
    return `${a} GW${first.gw} → ${b} GW${last.gw} · ${n} ${unit}`;
  }

  const seasonTag = shortSeasonLabel(first.seasonLabel ?? last.seasonLabel);
  if (seasonTag && first.gw === last.gw) {
    return `${seasonTag} · GW${first.gw} · ${n} ${unit}`;
  }
  if (seasonTag) {
    return `${seasonTag} · GW${first.gw}–GW${last.gw} · ${n} ${unit}`;
  }
  if (first.gw === last.gw) return `GW${first.gw} · ${n} ${unit}`;
  return `GW${first.gw}–GW${last.gw} · ${n} ${unit}`;
}

/** Tag every row with a season label (mutates copies only). */
export function withSeasonLabel(rows: GameweekStreakRow[], seasonLabel: string): GameweekStreakRow[] {
  return rows.map((r) => ({ ...r, seasonLabel: r.seasonLabel ?? seasonLabel }));
}
