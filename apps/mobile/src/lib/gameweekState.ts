export type GameweekState = 'GW_OPEN' | 'GW_PREDICTED' | 'DEADLINE_PASSED' | 'LIVE' | 'RESULTS_PRE_GW';

const DEADLINE_BUFFER_MINUTES = 75;

type FixtureKickoff = { kickoff_time?: string | null; fixture_index?: number | null; api_match_id?: number | null };
type LiveScoreLike = { status?: string | null; kickoff_time?: string | null; fixture_index?: number | null; api_match_id?: number | null };

function parseDateSafe(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Minimal on-device gameweek state inference using already-fetched Home data.
 * This avoids extra DB/BFF calls and is sufficient for UI toggles.
 */
export function getGameweekStateFromSnapshot(input: {
  fixtures: FixtureKickoff[];
  liveScores: LiveScoreLike[];
  hasSubmittedViewingGw: boolean;
  now?: Date;
}): GameweekState {
  const now = input.now ?? new Date();
  const fixtures = [...(input.fixtures ?? [])].map((f) => ({
    kickoff: parseDateSafe(f.kickoff_time),
    fixture_index: typeof f.fixture_index === 'number' ? f.fixture_index : null,
    api_match_id: typeof f.api_match_id === 'number' ? f.api_match_id : null,
  }));

  const fixturesWithKickoff = fixtures
    .filter((x): x is { kickoff: Date; fixture_index: number | null; api_match_id: number | null } => !!x.kickoff)
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

  if (fixturesWithKickoff.length === 0) return input.hasSubmittedViewingGw ? 'GW_PREDICTED' : 'GW_OPEN';

  const firstKickoff = fixturesWithKickoff[0]!.kickoff;
  const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);

  const deadlinePassed = now >= deadlineTime;
  const firstGameStarted = now >= firstKickoff;

  if (!firstGameStarted) {
    if (deadlinePassed) return 'DEADLINE_PASSED';
    return input.hasSubmittedViewingGw ? 'GW_PREDICTED' : 'GW_OPEN';
  }

  const liveScores = input.liveScores ?? [];
  const hasActiveGame = liveScores.some((ls) => ls?.status === 'IN_PLAY' || ls?.status === 'PAUSED');

  // Match Despia/web logic:
  // GW is finished only when the LAST fixture (by kickoff time) is FINISHED in live_scores AND there are no active games.
  const lastFixtureByKickoff = fixturesWithKickoff[fixturesWithKickoff.length - 1] ?? null;
  const lastFixtureIndex = lastFixtureByKickoff?.fixture_index ?? null;
  const lastApiMatchId = lastFixtureByKickoff?.api_match_id ?? null;

  const lastGameLiveScore =
    typeof lastFixtureIndex === 'number'
      ? liveScores.find((ls) => ls?.fixture_index === lastFixtureIndex) ?? null
      : typeof lastApiMatchId === 'number'
        ? liveScores.find((ls) => ls?.api_match_id === lastApiMatchId) ?? null
        : null;

  const lastGameFinished = lastGameLiveScore?.status === 'FINISHED';

  if (!hasActiveGame && lastGameFinished) return 'RESULTS_PRE_GW';

  return 'LIVE';
}

/**
 * Stats / streak “Round Up” should match Home: GW is final only after the last scheduled kickoff has FINISHED,
 * not when `app_gw_results` max gw has moved (partial GW rows can exist mid-week).
 */
export type StatsGwCompletionContext = {
  currentGw: number | null;
  probeHome: {
    fixtures: FixtureKickoff[];
    liveScores: LiveScoreLike[];
    hasSubmittedViewingGw: boolean;
  } | null;
  probeGw: number | null;
  probeLoading: boolean;
  lastCompletedGw: number | null;
};

export function isGwFullyCompleteForStatsRoundUp(args: {
  gw: number;
  /** `HomeSnapshot.currentGw` from `/v1/home` (meta line). */
  currentGw: number | null | undefined;
  /** Snapshot from `getHomeSnapshot({ gw })` where `gw` matches this chip (usually `highlightGw` or `currentGw`). */
  probeHome: { fixtures: FixtureKickoff[]; liveScores: LiveScoreLike[]; hasSubmittedViewingGw: boolean } | null | undefined;
  /** `gw` passed to `getHomeSnapshot` for `probeHome` — when it differs from `args.gw`, probe data must not be used. */
  probeGw: number | null | undefined;
  /** BFF `lastCompletedGw` — can be ahead of true final; only used when meta GW unknown or probe missing. */
  lastCompletedGw: number | null | undefined;
  probeLoading?: boolean;
}): boolean {
  const { gw, currentGw, probeHome, probeGw, lastCompletedGw, probeLoading } = args;
  const meta = typeof currentGw === 'number' && currentGw > 0 ? currentGw : null;

  const legacyFinal = (): boolean => {
    if (lastCompletedGw == null || typeof lastCompletedGw !== 'number' || lastCompletedGw <= 0) return true;
    return gw <= lastCompletedGw;
  };

  if (meta == null) return legacyFinal();

  if (gw < meta) return true;
  if (gw > meta) return false;

  // gw === meta (current meta gameweek)
  if (probeLoading && !probeHome) return false;
  if (probeHome != null && typeof probeGw === 'number' && probeGw === gw) {
    return (
      getGameweekStateFromSnapshot({
        fixtures: probeHome.fixtures ?? [],
        liveScores: probeHome.liveScores ?? [],
        hasSubmittedViewingGw: !!probeHome.hasSubmittedViewingGw,
      }) === 'RESULTS_PRE_GW'
    );
  }
  return legacyFinal();
}

export function isGwStatsLiveDot(args: {
  gw: number;
  scored: boolean;
  currentGw: number | null | undefined;
  probeHome: { fixtures: FixtureKickoff[]; liveScores: LiveScoreLike[]; hasSubmittedViewingGw: boolean } | null | undefined;
  probeGw: number | null | undefined;
  lastCompletedGw: number | null | undefined;
  probeLoading?: boolean;
}): boolean {
  if (!args.scored) return false;
  const meta = typeof args.currentGw === 'number' && args.currentGw > 0 ? args.currentGw : null;
  if (meta != null && args.gw > meta) return false;
  return !isGwFullyCompleteForStatsRoundUp({
    gw: args.gw,
    currentGw: args.currentGw,
    probeHome: args.probeHome,
    probeGw: args.probeGw,
    lastCompletedGw: args.lastCompletedGw,
    probeLoading: args.probeLoading,
  });
}

export function hasGameweekKickoffStarted(input: {
  fixtures: FixtureKickoff[];
  liveScores: LiveScoreLike[];
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const liveScores = input.liveScores ?? [];
  if (liveScores.some((ls) => ls?.status === 'IN_PLAY' || ls?.status === 'PAUSED' || ls?.status === 'FINISHED')) {
    return true;
  }

  return (input.fixtures ?? []).some((fixture) => {
    const kickoff = parseDateSafe(fixture?.kickoff_time);
    return kickoff != null && kickoff.getTime() <= now.getTime();
  });
}

export function getLeaderboardDisplayGwFromSnapshot(input: {
  viewingGw?: number | null;
  currentGw?: number | null;
  latestCompletedGw?: number | null;
  fixtures: FixtureKickoff[];
  liveScores: LiveScoreLike[];
  now?: Date;
}): number | null {
  const sourceGw =
    typeof input.viewingGw === 'number'
      ? input.viewingGw
      : typeof input.currentGw === 'number'
        ? input.currentGw
        : null;
  if (sourceGw == null) return input.latestCompletedGw ?? null;
  if (
    hasGameweekKickoffStarted({
      fixtures: input.fixtures ?? [],
      liveScores: input.liveScores ?? [],
      now: input.now,
    })
  ) {
    return sourceGw;
  }
  if (typeof input.latestCompletedGw === 'number' && input.latestCompletedGw < sourceGw) {
    return input.latestCompletedGw;
  }
  return sourceGw > 1 ? sourceGw - 1 : sourceGw;
}

