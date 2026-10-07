/**
 * Premier League head-to-head from a Football Data match list.
 * Used when a gameweek is published so the prediction cards have stats ready.
 */

export interface FixtureH2HStats {
  homeWins: number;
  draws: number;
  awayWins: number;
  numberOfMatches: number;
}

/** Inclusive start of the H2H window we can reliably get from Football Data. */
export const H2H_SINCE_ISO = '2020-01-01T00:00:00.000Z';

export type FdH2HMatch = {
  utcDate?: string | null;
  status?: string | null;
  competition?: { code?: string | null } | null;
  homeTeam?: { id?: number | null; tla?: string | null; shortName?: string | null; name?: string | null } | null;
  awayTeam?: { id?: number | null; tla?: string | null; shortName?: string | null; name?: string | null } | null;
  score?: { fullTime?: { home?: number | null; away?: number | null } | null } | null;
};

/**
 * Build PL-only H2H from the FD matches list (do NOT trust aggregates).
 * Finished Premier League meetings since 2020 only.
 */
export function computePlH2HFromMatches(opts: {
  matches: FdH2HMatch[];
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeCode: string;
  awayCode: string;
  sinceIso?: string;
}): FixtureH2HStats {
  const sinceMs = Date.parse(opts.sinceIso || H2H_SINCE_ISO) || Date.parse(H2H_SINCE_ISO);
  const homeCode = opts.homeCode.toUpperCase();
  const awayCode = opts.awayCode.toUpperCase();

  const finishedPl = (opts.matches || [])
    .filter((m) => (m.competition?.code || '').toUpperCase() === 'PL')
    .filter((m) => String(m.status || '').toUpperCase() === 'FINISHED')
    .filter((m) => {
      const hs = m.score?.fullTime?.home;
      const as = m.score?.fullTime?.away;
      return hs != null && as != null;
    })
    .filter((m) => {
      const t = Date.parse(String(m.utcDate || ''));
      return Number.isFinite(t) && t >= sinceMs;
    });

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;

  for (const m of finishedPl) {
    const hs = Number(m.score?.fullTime?.home);
    const as = Number(m.score?.fullTime?.away);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;

    const homeIsFixtureHome =
      (opts.homeTeamId != null && m.homeTeam?.id === opts.homeTeamId) ||
      String(m.homeTeam?.tla || '').toUpperCase() === homeCode;
    const homeIsFixtureAway =
      (opts.homeTeamId != null && m.awayTeam?.id === opts.homeTeamId) ||
      String(m.awayTeam?.tla || '').toUpperCase() === homeCode;

    let fixtureHomeGoals: number | null = null;
    let fixtureAwayGoals: number | null = null;
    if (homeIsFixtureHome) {
      fixtureHomeGoals = hs;
      fixtureAwayGoals = as;
    } else if (homeIsFixtureAway) {
      fixtureHomeGoals = as;
      fixtureAwayGoals = hs;
    } else {
      const listedHome = String(m.homeTeam?.tla || '').toUpperCase();
      if (listedHome === homeCode) {
        fixtureHomeGoals = hs;
        fixtureAwayGoals = as;
      } else if (listedHome === awayCode) {
        fixtureHomeGoals = as;
        fixtureAwayGoals = hs;
      }
    }

    if (fixtureHomeGoals == null || fixtureAwayGoals == null) continue;
    if (fixtureHomeGoals > fixtureAwayGoals) homeWins += 1;
    else if (fixtureHomeGoals < fixtureAwayGoals) awayWins += 1;
    else draws += 1;
  }

  return {
    homeWins,
    draws,
    awayWins,
    numberOfMatches: homeWins + awayWins + draws,
  };
}
