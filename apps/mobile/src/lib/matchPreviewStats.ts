/**
 * Types + helpers for prediction-card flip stats (season + H2H).
 */

export type BetterSide = 'home' | 'away' | 'neither';

export interface TeamSeasonStats {
  teamCode: string;
  position: number | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  cleanSheets: number | null;
}

export interface FixtureH2HStats {
  homeWins: number;
  draws: number;
  awayWins: number;
  numberOfMatches: number;
}

export interface MatchPreviewStats {
  competitionLabel: string;
  subtitle: string;
  home: TeamSeasonStats;
  away: TeamSeasonStats;
  h2h: FixtureH2HStats | null;
}

export interface StatRow {
  id: string;
  label: string;
  homeDisplay: string;
  awayDisplay: string;
  highlight: BetterSide;
}

/** Mock payload for Phase 1 flip UX (Newcastle vs Arsenal–style numbers). */
export function buildMockMatchPreviewStats(opts: {
  homeCode?: string | null;
  awayCode?: string | null;
  gw?: number | null;
}): MatchPreviewStats {
  const homeCode = (opts.homeCode || 'NEW').toUpperCase();
  const awayCode = (opts.awayCode || 'ARS').toUpperCase();
  const gw = opts.gw ?? 5;

  return {
    competitionLabel: 'Premier League',
    subtitle: `Gameweek ${gw}`,
    home: {
      teamCode: homeCode,
      position: 9,
      played: 7,
      won: 3,
      drawn: 1,
      lost: 3,
      goalsFor: 14,
      goalsAgainst: 8,
      cleanSheets: 2,
    },
    away: {
      teamCode: awayCode,
      position: 12,
      played: 7,
      won: 2,
      drawn: 3,
      lost: 2,
      goalsFor: 10,
      goalsAgainst: 11,
      cleanSheets: 1,
    },
    h2h: {
      homeWins: 1,
      draws: 2,
      awayWins: 9,
      numberOfMatches: 12,
    },
  };
}

export function perMatchRate(total: number | null, played: number | null): number | null {
  if (total == null || played == null || played <= 0) return null;
  return Math.round((total / played) * 100) / 100;
}

export function formatStatNumber(value: number | null, opts?: { decimals?: number; ordinal?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (opts?.ordinal) return toOrdinal(Math.trunc(value));
  if (opts?.decimals != null) return value.toFixed(opts.decimals);
  return String(value);
}

export function toOrdinal(n: number): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (abs % 10) {
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

/**
 * Pick which side to highlight. Equal → neither.
 * lowerIsBetter: position, lost, goals conceded.
 */
export function betterSide(
  home: number | null,
  away: number | null,
  lowerIsBetter = false
): BetterSide {
  if (home == null || away == null || !Number.isFinite(home) || !Number.isFinite(away)) {
    return 'neither';
  }
  if (home === away) return 'neither';
  if (lowerIsBetter) return home < away ? 'home' : 'away';
  return home > away ? 'home' : 'away';
}

export function buildStatRows(stats: MatchPreviewStats): StatRow[] {
  const { home, away } = stats;
  const homeGpm = perMatchRate(home.goalsFor, home.played);
  const awayGpm = perMatchRate(away.goalsFor, away.played);
  const homeConceded = perMatchRate(home.goalsAgainst, home.played);
  const awayConceded = perMatchRate(away.goalsAgainst, away.played);

  return [
    {
      id: 'position',
      label: 'Table position',
      homeDisplay: formatStatNumber(home.position, { ordinal: true }),
      awayDisplay: formatStatNumber(away.position, { ordinal: true }),
      highlight: betterSide(home.position, away.position, true),
    },
    {
      id: 'won',
      label: 'Won',
      homeDisplay: formatStatNumber(home.won),
      awayDisplay: formatStatNumber(away.won),
      highlight: betterSide(home.won, away.won),
    },
    {
      id: 'drawn',
      label: 'Drawn',
      homeDisplay: formatStatNumber(home.drawn),
      awayDisplay: formatStatNumber(away.drawn),
      highlight: betterSide(home.drawn, away.drawn),
    },
    {
      id: 'lost',
      label: 'Lost',
      homeDisplay: formatStatNumber(home.lost),
      awayDisplay: formatStatNumber(away.lost),
      highlight: betterSide(home.lost, away.lost, true),
    },
    {
      id: 'gpm',
      label: 'Goals per match',
      homeDisplay: formatStatNumber(homeGpm, { decimals: 2 }),
      awayDisplay: formatStatNumber(awayGpm, { decimals: 2 }),
      highlight: betterSide(homeGpm, awayGpm),
    },
    {
      id: 'conceded',
      label: 'Goals conceded per match',
      homeDisplay: formatStatNumber(homeConceded, { decimals: 2 }),
      awayDisplay: formatStatNumber(awayConceded, { decimals: 2 }),
      highlight: betterSide(homeConceded, awayConceded, true),
    },
    {
      id: 'cs',
      label: 'Clean sheets',
      homeDisplay: formatStatNumber(home.cleanSheets),
      awayDisplay: formatStatNumber(away.cleanSheets),
      highlight: betterSide(home.cleanSheets, away.cleanSheets),
    },
  ];
}

export interface TeamFormsDbRow {
  team_code: string;
  form?: string | null;
  league_position?: number | null;
  played?: number | null;
  won?: number | null;
  drawn?: number | null;
  lost?: number | null;
  goals_for?: number | null;
  goals_against?: number | null;
}

export interface FixtureH2HDbRow {
  home_wins: number;
  draws: number;
  away_wins: number;
  number_of_matches?: number | null;
}

export function teamStatsFromFormsRow(
  row: TeamFormsDbRow | null | undefined,
  teamCode: string,
  cleanSheets: number | null
): TeamSeasonStats {
  return {
    teamCode: teamCode.toUpperCase(),
    position: finiteOrNull(row?.league_position),
    played: finiteOrNull(row?.played),
    won: finiteOrNull(row?.won),
    drawn: finiteOrNull(row?.drawn),
    lost: finiteOrNull(row?.lost),
    goalsFor: finiteOrNull(row?.goals_for),
    goalsAgainst: finiteOrNull(row?.goals_against),
    cleanSheets,
  };
}

function finiteOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Count clean sheets this season from finished results joined to fixtures.
 * home_score / away_score: CS for home when away_score === 0, for away when home_score === 0.
 */
export function computeCleanSheetsFromResults(
  rows: Array<{
    home_code?: string | null;
    away_code?: string | null;
    home_score?: number | null;
    away_score?: number | null;
  }>,
  homeCode: string,
  awayCode: string
): { home: number; away: number } {
  const home = homeCode.toUpperCase();
  const away = awayCode.toUpperCase();
  let homeCs = 0;
  let awayCs = 0;

  for (const row of rows) {
    const hc = (row.home_code || '').toUpperCase();
    const ac = (row.away_code || '').toUpperCase();
    const hs = row.home_score;
    const as = row.away_score;
    if (hs == null || as == null) continue;

    if (hc === home && as === 0) homeCs += 1;
    if (ac === home && hs === 0) homeCs += 1;
    if (hc === away && as === 0) awayCs += 1;
    if (ac === away && hs === 0) awayCs += 1;
  }

  return { home: homeCs, away: awayCs };
}

export function buildMatchPreviewStatsFromCache(opts: {
  gw: number;
  homeCode: string;
  awayCode: string;
  homeForms: TeamFormsDbRow | null;
  awayForms: TeamFormsDbRow | null;
  h2h: FixtureH2HDbRow | null;
  cleanSheets: { home: number; away: number } | null;
  subtitle?: string;
}): MatchPreviewStats {
  const homeCode = opts.homeCode.toUpperCase();
  const awayCode = opts.awayCode.toUpperCase();
  const cs = opts.cleanSheets;

  return {
    competitionLabel: 'Premier League',
    subtitle: opts.subtitle || `Gameweek ${opts.gw}`,
    home: teamStatsFromFormsRow(opts.homeForms, homeCode, cs ? cs.home : null),
    away: teamStatsFromFormsRow(opts.awayForms, awayCode, cs ? cs.away : null),
    h2h: opts.h2h
      ? {
          homeWins: opts.h2h.home_wins,
          draws: opts.h2h.draws,
          awayWins: opts.h2h.away_wins,
          numberOfMatches: opts.h2h.number_of_matches ?? opts.h2h.home_wins + opts.h2h.draws + opts.h2h.away_wins,
        }
      : null,
  };
}

/** True when season fields were persisted (not just form/position). */
export function hasSeasonStats(row: TeamFormsDbRow | null | undefined): boolean {
  if (!row) return false;
  return (
    finiteOrNull(row.played) != null ||
    finiteOrNull(row.won) != null ||
    finiteOrNull(row.goals_for) != null
  );
}
