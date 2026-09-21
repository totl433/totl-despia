import type { RetroFixture, RetroPick } from './mockPuzzle';

/** Historic row as stored by ingest-retro-daily-history.mjs */
export type RetroHistoricFixture = {
  id: string;
  seasonLabel: string;
  seasonKey: string;
  matchDate: string;
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  result: RetroPick;
  htHome: number | null;
  htAway: number | null;
  source: string;
};

/** Final-table row embedded by scripts/build-retro-daily-tables.mjs */
export type RetroTableRow = {
  position: number;
  code: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  deduction: number;
};

export type RetroSeasonPack = {
  seasonKey: string;
  seasonLabel: string;
  fixtures: RetroHistoricFixture[];
  /** Final league table for difficulty ordering (not shown in UI). */
  table?: RetroTableRow[];
};

export type RetroDailyIndex = {
  generatedAt: string;
  source: string;
  from: string;
  to: string;
  totalFixtures: number;
  seasons: Array<{
    seasonKey: string;
    seasonLabel: string;
    fixtureCount: number;
    file: string;
  }>;
};

export function historicToRetroFixture(
  h: RetroHistoricFixture,
  index: number,
  positions?: Map<string, number>
): RetroFixture {
  return {
    id: h.id,
    index,
    homeCode: h.homeCode,
    awayCode: h.awayCode,
    homeName: h.homeName,
    awayName: h.awayName,
    kickoffLabel: formatRetroMatchDate(h.matchDate),
    result: h.result,
    homeScore: h.homeScore,
    awayScore: h.awayScore,
    homeFinish: positions?.get(h.homeCode) ?? null,
    awayFinish: positions?.get(h.awayCode) ?? null,
  };
}

/** `1996-09-21` → `Sat 21st Sep 1996` */
export function formatRetroMatchDate(isoDate: string): string {
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return isoDate;

  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
    month - 1
  ];
  return `${weekday} ${ordinal(day)} ${mon} ${year}`;
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function finishMap(pack: RetroSeasonPack): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of pack.table ?? []) {
    map.set(row.code, row.position);
  }
  return map;
}

/**
 * How “easy” a fixture is to call from final table alone.
 * Larger |homeFinish − awayFinish| ⇒ easier (e.g. 1st vs 20th).
 */
export function finishGap(
  f: RetroHistoricFixture,
  positions: Map<string, number>
): number {
  const home = positions.get(f.homeCode);
  const away = positions.get(f.awayCode);
  if (home == null || away == null) return 0;
  return Math.abs(home - away);
}

/** True when the higher-finishing team won (no draws / upsets). */
export function favouriteWon(
  f: RetroHistoricFixture,
  positions: Map<string, number>
): boolean {
  const home = positions.get(f.homeCode);
  const away = positions.get(f.awayCode);
  if (home == null || away == null || home === away) return false;
  if (home < away) return f.result === 'H';
  return f.result === 'A';
}

/**
 * Build a 10-fixture RTD puzzle from a season pack.
 *
 * Constraints: no team twice; prefer mix of H/D/A when possible.
 * Difficulty: pick mostly mid/close finish clashes (only a couple of blowouts),
 * then order easiest → hardest by finish gap so the board tightens quickly.
 * First two fixtures are always favourite wins (higher finisher won) to avoid early shock exits.
 */
export function buildPuzzleFromSeason(
  pack: RetroSeasonPack,
  seed: number,
  size = 10
): RetroFixture[] {
  const rng = mulberry32(seed >>> 0);
  const positions = finishMap(pack);
  const pool = [...pack.fixtures];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const gapOf = (f: RetroHistoricFixture) => finishGap(f, positions);
  const OPENER_COUNT = Math.min(2, size);

  const picked: RetroHistoricFixture[] = [];
  const used = new Set<string>();

  const tryTake = (
    pred: (f: RetroHistoricFixture) => boolean,
    limit: number,
    preferResult?: RetroPick
  ) => {
    let taken = 0;
    const prefer =
      preferResult == null
        ? pool
        : [
            ...pool.filter((f) => f.result === preferResult),
            ...pool.filter((f) => f.result !== preferResult),
          ];
    for (const f of prefer) {
      if (picked.length >= size || taken >= limit) break;
      if (used.has(f.homeCode) || used.has(f.awayCode)) continue;
      if (!pred(f)) continue;
      picked.push(f);
      used.add(f.homeCode);
      used.add(f.awayCode);
      taken += 1;
    }
    return taken;
  };

  // --- Safe openers: higher-finishing team won (largest gaps first) ---
  const openerPool = pool
    .filter((f) => favouriteWon(f, positions))
    .sort((a, b) => gapOf(b) - gapOf(a) || a.id.localeCompare(b.id));
  const openers: RetroHistoricFixture[] = [];
  for (const f of openerPool) {
    if (openers.length >= OPENER_COUNT) break;
    if (used.has(f.homeCode) || used.has(f.awayCode)) continue;
    openers.push(f);
    used.add(f.homeCode);
    used.add(f.awayCode);
  }
  picked.push(...openers);

  const remaining = size - picked.length;

  // Absolute Prem bands for the rest — mid then mostly close.
  // Easy ≥10 · Mid 5–9 · Hard ≤4
  const easyQuota = Math.min(1, remaining);
  const midQuota = Math.min(Math.max(2, Math.round(size * 0.3)), Math.max(0, remaining - easyQuota));
  const hardQuota = Math.max(0, remaining - easyQuota - midQuota);

  const resultCycle: RetroPick[] = ['H', 'D', 'A'];
  let ri = Math.floor(rng() * 3);

  const takeBand = (pred: (f: RetroHistoricFixture) => boolean, quota: number) => {
    let need = quota;
    for (let attempt = 0; attempt < 3 && need > 0; attempt++) {
      const got = tryTake(pred, need, resultCycle[(ri + attempt) % 3]);
      need -= got;
    }
    if (need > 0) tryTake(pred, need);
    ri += 1;
    return need;
  };

  if (remaining > 0) {
    takeBand((f) => gapOf(f) >= 10, easyQuota);
    const midShort = takeBand((f) => {
      const g = gapOf(f);
      return g >= 5 && g <= 9;
    }, midQuota);
    takeBand((f) => gapOf(f) <= 4, hardQuota + midShort);

    if (picked.length < size) {
      const leftovers = pool
        .filter((f) => !used.has(f.homeCode) && !used.has(f.awayCode))
        .sort((a, b) => {
          const aBlow = gapOf(a) >= 10 ? 1 : 0;
          const bBlow = gapOf(b) >= 10 ? 1 : 0;
          if (aBlow !== bBlow) return aBlow - bBlow;
          return gapOf(a) - gapOf(b) || a.id.localeCompare(b.id);
        });
      for (const f of leftovers) {
        if (picked.length >= size) break;
        if (used.has(f.homeCode) || used.has(f.awayCode)) continue;
        picked.push(f);
        used.add(f.homeCode);
        used.add(f.awayCode);
      }
    }
  }

  // Keep openers first (easy→hard among themselves); rest of run also easy→hard
  const openerIds = new Set(openers.map((f) => f.id));
  const rest = picked
    .filter((f) => !openerIds.has(f.id))
    .sort((a, b) => gapOf(b) - gapOf(a) || a.id.localeCompare(b.id));
  openers.sort((a, b) => gapOf(b) - gapOf(a) || a.id.localeCompare(b.id));

  const ordered = [...openers, ...rest].slice(0, size);
  return ordered.map((f, i) => historicToRetroFixture(f, i, positions));
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
