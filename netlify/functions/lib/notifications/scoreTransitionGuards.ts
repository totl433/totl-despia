export function resolveKickoffHalf(input: {
  status: string | null | undefined;
  oldStatus: string | null | undefined;
  existingHalf: number;
  kickoffTooOld: boolean;
}): 1 | 2 | null {
  const { status, oldStatus, existingHalf, kickoffTooOld } = input;
  if (kickoffTooOld || status !== 'IN_PLAY') return null;

  if (oldStatus === 'PAUSED' || oldStatus === 'HALF_TIME') return 2;
  if (oldStatus === 'IN_PLAY') return null;

  // An INSERT has no old row and represents first-half kickoff when no kickoff
  // has been logged. Never infer second half solely from missing history.
  if (!oldStatus) return existingHalf === 0 ? 1 : null;

  return existingHalf === 0 ? 1 : null;
}

export function matchesGoalNotificationMinute(
  eventId: string,
  apiMatchId: number,
  minute: number
): boolean {
  const prefix = `goal:${apiMatchId}:`;
  if (!eventId.startsWith(prefix)) return false;

  const parts = eventId.slice(prefix.length).split(':');
  return parts.length >= 2 && parts[1] === String(minute);
}

export function resolveMatchTransitions(input: {
  status: string | null | undefined;
  oldStatus: string | null | undefined;
  homeScore: number;
  awayScore: number;
  oldHomeScore: number;
  oldAwayScore: number;
}): {
  goalScored: boolean;
  goalDisallowed: boolean;
  halfTime: boolean;
  fullTime: boolean;
} {
  const { status, oldStatus, homeScore, awayScore, oldHomeScore, oldAwayScore } = input;
  const scoreDelta = homeScore + awayScore - oldHomeScore - oldAwayScore;
  const isFinished = status === 'FINISHED' || status === 'FT';
  const wasFinished = oldStatus === 'FINISHED' || oldStatus === 'FT';

  return {
    goalScored: scoreDelta > 0,
    goalDisallowed: scoreDelta < 0,
    halfTime: status === 'PAUSED' && oldStatus !== 'PAUSED',
    fullTime: isFinished && !wasFinished,
  };
}

export function buildGameweekCompleteEventId(gw: number, seasonId?: string | null): string {
  return seasonId ? `gw_complete:season:${seasonId}:${gw}` : `gw_complete:${gw}`;
}
