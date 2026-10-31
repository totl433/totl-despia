function normalizeTeamCode(code: string | null | undefined): string {
  const raw = String(code ?? '')
    .trim()
    .toUpperCase();
  if (!raw) return '';
  return raw === 'NOT' ? 'NFO' : raw;
}

export type CareerPile = 'legacy' | 'season';

export type CareerPickRow = {
  pile: CareerPile;
  gw: number;
  fixture_index: number;
  pick: string | null;
};

export type CareerResultRow = {
  pile: CareerPile;
  gw: number;
  fixture_index: number;
  result: string | null;
};

export type CareerFixtureRow = {
  pile: CareerPile;
  gw: number;
  fixture_index: number;
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
};

export type CareerTeamStat = { code: string | null; name: string; percentage: number };

export type CareerGwStat = { points: number; gw: number; seasonLabel: string };

export type CareerWeeklyParRow = {
  gw: number;
  userPoints: number;
  averagePoints: number;
  seasonLabel: string;
};

export type CareerPickStats = {
  correctPredictionRate: number | null;
  correctPicks: number;
  scoredPicks: number;
  fieldAveragePct: number | null;
  mostCorrectTeam: CareerTeamStat | null;
  mostIncorrectTeam: CareerTeamStat | null;
  bestSingleGw: CareerGwStat | null;
  lowestSingleGw: CareerGwStat | null;
  chaosIndex: number | null;
  chaosCorrectCount: number | null;
  chaosTotalCount: number | null;
};

const PL_CODES = new Set([
  'ARS',
  'AVL',
  'BOU',
  'BRE',
  'BHA',
  'BUR',
  'CHE',
  'CRY',
  'EVE',
  'FUL',
  'HUL',
  'IPS',
  'COV',
  'LEE',
  'LEI',
  'LIV',
  'MCI',
  'MUN',
  'NEW',
  'NFO',
  'SOU',
  'SUN',
  'TOT',
  'WHU',
  'WOL',
]);

const PL_NAMES: Record<string, string> = {
  ARS: 'Arsenal',
  AVL: 'Aston Villa',
  BOU: 'Bournemouth',
  BRE: 'Brentford',
  BHA: 'Brighton',
  BUR: 'Burnley',
  CHE: 'Chelsea',
  CRY: 'Crystal Palace',
  EVE: 'Everton',
  FUL: 'Fulham',
  HUL: 'Hull',
  IPS: 'Ipswich',
  COV: 'Coventry',
  LEE: 'Leeds United',
  LEI: 'Leicester City',
  LIV: 'Liverpool',
  MCI: 'Man City',
  MUN: 'Man United',
  NEW: 'Newcastle',
  NFO: "Nott'm Forest",
  SOU: 'Southampton',
  SUN: 'Sunderland',
  TOT: 'Spurs',
  WHU: 'West Ham',
  WOL: 'Wolves',
};

/** True when your pick is the underdog: ≤25% of everyone who picked that game agreed. */
export function isChaosUnderdogPick(userPickCount: number, fieldSize: number): boolean {
  if (fieldSize <= 0 || userPickCount < 0) return false;
  return userPickCount / fieldSize <= 0.25;
}

function pickKey(pile: CareerPile, gw: number, fixtureIndex: number): string {
  return `${pile}:${gw}:${fixtureIndex}`;
}

function letter(value: string | null | undefined): 'H' | 'D' | 'A' | null {
  const v = String(value ?? '')
    .trim()
    .toUpperCase();
  return v === 'H' || v === 'D' || v === 'A' ? v : null;
}

function canonCode(code: string | null | undefined): string | null {
  const c = normalizeTeamCode(code);
  return c && PL_CODES.has(c) ? c : null;
}

/**
 * Career pick rate + team cards across season piles.
 * GW1 of 25/26 is not GW1 of 26/27. Only fixtures with a result are scored
 * (finished matches in a live week count; scheduled ones do not).
 */
export function calculateCareerPercentile(userValue: number, allValues: number[]): number {
  if (!allValues.length) return 50;
  const rank = allValues.filter((v) => v <= userValue).length;
  return Math.round((rank / allValues.length) * 10000) / 100;
}

export function computeCareerWeeklyPar(args: {
  userId: string;
  legacyPoints: Array<{ user_id: string; gw: number; points: number }>;
  seasonPoints: Array<{ user_id: string; gw: number; points: number }>;
  legacyLabel: string;
  seasonLabel: string;
}): CareerWeeklyParRow[] {
  const piles: Array<{
    rows: Array<{ user_id: string; gw: number; points: number }>;
    label: string;
  }> = [
    { rows: args.legacyPoints, label: args.legacyLabel },
    { rows: args.seasonPoints, label: args.seasonLabel },
  ];
  const out: CareerWeeklyParRow[] = [];
  for (const pile of piles) {
    const poolByGw = new Map<number, number[]>();
    const mineByGw = new Map<number, number>();
    for (const row of pile.rows) {
      const gw = Number(row.gw);
      const pts = Number(row.points ?? 0);
      if (!Number.isFinite(gw) || gw < 1) continue;
      const arr = poolByGw.get(gw) ?? [];
      arr.push(pts);
      poolByGw.set(gw, arr);
      if (String(row.user_id) === String(args.userId)) mineByGw.set(gw, pts);
    }
    const gws = [...mineByGw.keys()].sort((a, b) => a - b);
    for (const gw of gws) {
      const pool = poolByGw.get(gw) ?? [];
      const userPoints = mineByGw.get(gw) ?? 0;
      const averagePoints = pool.length ? pool.reduce((s, n) => s + n, 0) / pool.length : userPoints;
      out.push({ gw, userPoints, averagePoints, seasonLabel: pile.label });
    }
  }
  return out;
}

export function computeCareerOverallPercentile(args: {
  userId: string;
  legacy: Array<{ user_id: string; ocp: number }>;
  season: Array<{ user_id: string; ocp: number }>;
}): number | null {
  const totals = new Map<string, number>();
  const add = (rows: Array<{ user_id: string; ocp: number }>) => {
    for (const row of rows) {
      const id = String(row.user_id);
      if (!id) continue;
      totals.set(id, (totals.get(id) ?? 0) + Number(row.ocp ?? 0));
    }
  };
  add(args.legacy);
  add(args.season);
  if (!totals.size) return null;
  const mine = totals.get(String(args.userId));
  if (mine == null) return null;
  return calculateCareerPercentile(mine, [...totals.values()]);
}

export function computeCareerPickStats(args: {
  picks: CareerPickRow[];
  results: CareerResultRow[];
  fixtures: CareerFixtureRow[];
  /** All players’ picks — field average + chaos. */
  fieldPicks?: CareerPickRow[];
  pileLabels?: { legacy: string; season: string };
}): CareerPickStats {
  const outcome = new Map<string, 'H' | 'D' | 'A'>();
  for (const row of args.results) {
    const res = letter(row.result);
    const gw = Number(row.gw);
    const fi = Number(row.fixture_index);
    if (!res || !Number.isFinite(gw) || !Number.isFinite(fi)) continue;
    outcome.set(pickKey(row.pile, gw, fi), res);
  }

  const fx = new Map<string, CareerFixtureRow>();
  for (const row of args.fixtures) {
    const gw = Number(row.gw);
    const fi = Number(row.fixture_index);
    if (!Number.isFinite(gw) || !Number.isFinite(fi)) continue;
    fx.set(pickKey(row.pile, gw, fi), row);
  }

  const pileLabels = args.pileLabels ?? { legacy: '2025/26', season: '2026/27' };
  let correctPicks = 0;
  let scoredPicks = 0;
  const teamStats = new Map<string, { correct: number; total: number; name: string }>();
  const ptsByGw = new Map<string, { pile: CareerPile; gw: number; pts: number }>();

  const bumpTeam = (codeRaw: string | null | undefined, fallback: string, gotItRight: boolean) => {
    const code = canonCode(codeRaw);
    if (!code) return;
    const existing = teamStats.get(code) ?? {
      correct: 0,
      total: 0,
      name: PL_NAMES[code] ?? (fallback.trim() || code),
    };
    existing.total += 1;
    if (gotItRight) existing.correct += 1;
    existing.name = PL_NAMES[code] ?? existing.name;
    teamStats.set(code, existing);
  };

  for (const row of args.picks) {
    const pick = letter(row.pick);
    const gw = Number(row.gw);
    const fi = Number(row.fixture_index);
    if (!pick || !Number.isFinite(gw) || !Number.isFinite(fi)) continue;
    const key = pickKey(row.pile, gw, fi);
    const res = outcome.get(key);
    if (!res) continue;
    scoredPicks += 1;
    const gotItRight = pick === res;
    if (gotItRight) correctPicks += 1;
    const gwKey = `${row.pile}:${gw}`;
    const cur = ptsByGw.get(gwKey) ?? { pile: row.pile, gw, pts: 0 };
    if (gotItRight) cur.pts += 1;
    ptsByGw.set(gwKey, cur);
    const fixture = fx.get(key);
    if (!fixture) continue;
    bumpTeam(fixture.home_code, String(fixture.home_name ?? 'Home'), gotItRight);
    bumpTeam(fixture.away_code, String(fixture.away_name ?? 'Away'), gotItRight);
  }

  let mostCorrect: CareerTeamStat | null = null;
  let mostIncorrect: CareerTeamStat | null = null;
  let mostCorrectWeight = -1;
  let mostIncorrectWeight = -1;
  teamStats.forEach((s, code) => {
    if (s.total < 1) return;
    const correctPct = (s.correct / s.total) * 100;
    const incorrectPct = ((s.total - s.correct) / s.total) * 100;
    if (
      !mostCorrect ||
      correctPct > mostCorrect.percentage ||
      (correctPct === mostCorrect.percentage && s.total > mostCorrectWeight)
    ) {
      mostCorrect = { code, name: s.name, percentage: correctPct };
      mostCorrectWeight = s.total;
    }
    if (
      !mostIncorrect ||
      incorrectPct > mostIncorrect.percentage ||
      (incorrectPct === mostIncorrect.percentage && s.total > mostIncorrectWeight)
    ) {
      mostIncorrect = { code, name: s.name, percentage: incorrectPct };
      mostIncorrectWeight = s.total;
    }
  });

  let bestSingleGw: CareerGwStat | null = null;
  let lowestSingleGw: CareerGwStat | null = null;
  ptsByGw.forEach((row) => {
    const seasonLabel = row.pile === 'season' ? pileLabels.season : pileLabels.legacy;
    if (!bestSingleGw || row.pts > bestSingleGw.points) {
      bestSingleGw = { points: row.pts, gw: row.gw, seasonLabel };
    }
    if (!lowestSingleGw || row.pts < lowestSingleGw.points) {
      lowestSingleGw = { points: row.pts, gw: row.gw, seasonLabel };
    }
  });

  let fieldAveragePct: number | null = null;
  let chaosIndex: number | null = null;
  let chaosCorrectCount: number | null = null;
  let chaosTotalCount: number | null = null;
  if (args.fieldPicks?.length) {
    const counts = new Map<string, Map<'H' | 'D' | 'A', number>>();
    let fieldCorrect = 0;
    let fieldTotal = 0;
    for (const row of args.fieldPicks) {
      const pick = letter(row.pick);
      const gw = Number(row.gw);
      const fi = Number(row.fixture_index);
      if (!pick || !Number.isFinite(gw) || !Number.isFinite(fi)) continue;
      const key = pickKey(row.pile, gw, fi);
      const res = outcome.get(key);
      if (!res) continue;
      fieldTotal += 1;
      if (pick === res) fieldCorrect += 1;
      const m = counts.get(key) ?? new Map();
      m.set(pick, (m.get(pick) ?? 0) + 1);
      counts.set(key, m);
    }
    if (fieldTotal > 0) fieldAveragePct = (fieldCorrect / fieldTotal) * 100;

    let chaosPicks = 0;
    let chaosCorrect = 0;
    let checked = 0;
    for (const row of args.picks) {
      const pick = letter(row.pick);
      const gw = Number(row.gw);
      const fi = Number(row.fixture_index);
      if (!pick || !Number.isFinite(gw) || !Number.isFinite(fi)) continue;
      const key = pickKey(row.pile, gw, fi);
      if (!outcome.has(key)) continue;
      const m = counts.get(key);
      if (!m) continue;
      const totalPickers = Array.from(m.values()).reduce((s, n) => s + n, 0);
      if (!totalPickers) continue;
      checked += 1;
      if (isChaosUnderdogPick(m.get(pick) ?? 0, totalPickers)) {
        chaosPicks += 1;
        if (pick === outcome.get(key)) chaosCorrect += 1;
      }
    }
    if (checked > 0) {
      chaosIndex = (chaosPicks / checked) * 100;
      chaosCorrectCount = chaosCorrect;
      chaosTotalCount = chaosPicks;
    }
  }

  return {
    correctPredictionRate: scoredPicks > 0 ? (correctPicks / scoredPicks) * 100 : null,
    correctPicks,
    scoredPicks,
    fieldAveragePct,
    mostCorrectTeam: mostCorrect,
    mostIncorrectTeam: mostIncorrect,
    bestSingleGw,
    lowestSingleGw,
    chaosIndex,
    chaosCorrectCount,
    chaosTotalCount,
  };
}

export function tagCareerPile<T extends Record<string, unknown>>(
  pile: CareerPile,
  rows: T[] | null | undefined
): Array<T & { pile: CareerPile }> {
  return (rows ?? []).map((row) => ({ ...row, pile }));
}
