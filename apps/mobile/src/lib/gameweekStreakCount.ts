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

/**
 * Drop chips above `lastCompletedGw`.
 * When `liveSeasonLabel` is set, only that season is capped — prior-season chips stay
 * (so a 26/27 last-completed of 8 does not erase 25/26 GW9–38).
 */
/**
 * Old BFF returns last season’s 1–38 ladder with no labels (or the client
 * mistags it as 2026/27). Keep that as the prior season and append this season.
 */
export function mergeCareerAndLiveSeasonStreak(args: {
  careerRows: GameweekStreakRow[];
  liveSeasonLabel: string;
  priorSeasonLabel: string;
  liveRows: GameweekStreakRow[];
}): GameweekStreakRow[] {
  const live = args.liveSeasonLabel.trim();
  const prior = args.priorSeasonLabel.trim();
  const seasons = new Set(
    args.careerRows.map((r) => r.seasonLabel?.trim()).filter((s): s is string => !!s && s.length > 0)
  );
  if (seasons.has(live) && seasons.has(prior)) return args.careerRows;

  const maxGw = args.careerRows.length ? Math.max(...args.careerRows.map((r) => r.gw)) : 0;
  const mistaggedLive =
    seasons.size === 1 && seasons.has(live) && maxGw >= 30 && args.careerRows.length >= 30;
  const unlabeledOrPrior = seasons.size === 0 || (seasons.size === 1 && seasons.has(prior));
  if (!unlabeledOrPrior && !mistaggedLive) {
    return args.liveRows.length ? [...args.careerRows, ...args.liveRows] : args.careerRows;
  }

  const priorRows = args.careerRows.map((r) => ({ ...r, seasonLabel: prior }));
  if (!args.liveRows.length) return priorRows;
  return [...priorRows, ...args.liveRows];
}

export function scoreUserPicksForGwFromLive(args: {
  gw: number;
  picks: Array<{ gw: number; fixture_index: number; pick: string | null }>;
  fixtures: Array<{ fixture_index?: number; api_match_id?: number | null }>;
  liveScores: Array<{
    status?: string | null;
    home_score?: number | null;
    away_score?: number | null;
    fixture_index?: number | null;
    api_match_id?: number | null;
  }>;
}): number | null {
  const gw = Number(args.gw);
  if (!Number.isFinite(gw) || gw < 1) return null;
  const gwPicks = args.picks.filter((p) => Number(p.gw) === gw);
  if (!gwPicks.length) return null;

  const apiToFi = new Map<number, number>();
  for (const f of args.fixtures) {
    const fi = Number(f.fixture_index);
    const aid = Number(f.api_match_id);
    if (!Number.isFinite(fi) || !Number.isFinite(aid) || aid <= 0) continue;
    apiToFi.set(aid, fi);
  }

  const outcome = new Map<number, 'H' | 'D' | 'A'>();
  for (const ls of args.liveScores) {
    const status = String(ls.status ?? '');
    if (status !== 'IN_PLAY' && status !== 'PAUSED' && status !== 'FINISHED') continue;
    const aid = Number(ls.api_match_id);
    const fi = Number.isFinite(aid) && aid > 0 ? apiToFi.get(aid) : undefined;
    if (fi == null) continue;
    const hs = Number(ls.home_score ?? 0);
    const as = Number(ls.away_score ?? 0);
    outcome.set(fi, hs > as ? 'H' : hs < as ? 'A' : 'D');
  }
  if (!outcome.size) return null;

  let pts = 0;
  let scored = false;
  for (const row of gwPicks) {
    const pick = String(row.pick ?? '').trim().toUpperCase();
    if (pick !== 'H' && pick !== 'D' && pick !== 'A') continue;
    const res = outcome.get(Number(row.fixture_index));
    if (!res) continue;
    scored = true;
    if (pick === res) pts += 1;
  }
  return scored ? pts : null;
}

export function scoreUserPicksByGw(
  picks: Array<{ gw: number; fixture_index: number; pick: string | null }>,
  results: Array<{ gw: number; fixture_index: number; result: string | null }>
): Map<number, number> {
  const outcome = new Map<string, 'H' | 'D' | 'A'>();
  for (const row of results) {
    const res = String(row.result ?? '').trim().toUpperCase();
    if (res !== 'H' && res !== 'D' && res !== 'A') continue;
    const gw = Number(row.gw);
    const fi = Number(row.fixture_index);
    if (!Number.isFinite(gw) || !Number.isFinite(fi)) continue;
    outcome.set(`${gw}:${fi}`, res);
  }
  const byGw = new Map<number, number>();
  for (const row of picks) {
    const pick = String(row.pick ?? '').trim().toUpperCase();
    if (pick !== 'H' && pick !== 'D' && pick !== 'A') continue;
    const gw = Number(row.gw);
    const fi = Number(row.fixture_index);
    if (!Number.isFinite(gw) || !Number.isFinite(fi)) continue;
    const res = outcome.get(`${gw}:${fi}`);
    if (!res) continue;
    byGw.set(gw, (byGw.get(gw) ?? 0) + (pick === res ? 1 : 0));
  }
  return byGw;
}

export function buildLiveSeasonStreakRows(args: {
  seasonLabel: string;
  pointsByGw: Map<number, number>;
  playedGws: Iterable<number>;
  maxGw: number;
}): GameweekStreakRow[] {
  if (args.maxGw < 1) return [];
  const played = new Set<number>();
  for (const gw of args.playedGws) {
    if (Number.isFinite(gw) && gw >= 1) played.add(Number(gw));
  }
  for (const gw of args.pointsByGw.keys()) played.add(gw);
  if (!played.size) return [];

  const rows: GameweekStreakRow[] = [];
  for (let gw = 1; gw <= args.maxGw; gw++) {
    rows.push({
      gw,
      points: args.pointsByGw.has(gw) ? args.pointsByGw.get(gw)! : null,
      seasonLabel: args.seasonLabel,
    });
  }
  return rows;
}

export function capGameweekStreakRowsAtLastCompleted(
  rows: GameweekStreakRow[] | null | undefined,
  lastCompletedGw: number | null | undefined,
  liveSeasonLabel?: string | null
): GameweekStreakRow[] | null {
  if (!rows?.length) return rows ?? null;
  const cap =
    typeof lastCompletedGw === 'number' && lastCompletedGw > 0 ? lastCompletedGw : null;
  if (cap == null) return rows;
  const live = liveSeasonLabel?.trim() || null;
  const next = rows.filter((r) => {
    if (live && (r.seasonLabel?.trim() || '') !== live) return true;
    return r.gw <= cap;
  });
  return next.length ? next : null;
}
