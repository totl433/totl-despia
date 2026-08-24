import { SEASON_2025_26_LABEL, SEASON_2026_27_LABEL } from './leaderboardMonths';

/**
 * Scope round-up popup event keys by season so 2026/27 GW1 is not treated as
 * already-seen 2025/26 GW1 (`winners:gw1`, `results:gw1`, …).
 */
export function roundUpSeasonScope(input: {
  useSeasonStack: boolean;
  seasonLabel?: string | null;
}): string {
  if (!input.useSeasonStack) return SEASON_2025_26_LABEL;
  const label = (input.seasonLabel ?? '').trim();
  return label || SEASON_2026_27_LABEL;
}

export function roundUpEventKey(kind: string, gw: number, seasonScope: string): string {
  return `${kind}:gw${gw}:${seasonScope}`;
}

/** `results:gw1:2026/27` → `2026/27` */
export function parseSeasonLabelFromEventKey(eventKey: string | undefined): string | null {
  const match = eventKey?.match(/:(\d{4}\/\d{2})(?::|$)/);
  return match?.[1] ?? null;
}

/** `personalWinner:monthly:gw2:2026/27` and `simulator:personalWinner:monthly`. */
export function parsePersonalWinnerTypeFromEventKey(
  eventKey: string | undefined
): 'gameweek' | 'monthly' {
  if (!eventKey) return 'gameweek';
  return /(?:^|:)monthly(?::|$)/i.test(eventKey) ? 'monthly' : 'gameweek';
}

/** "2026/27" → "26/27 Leaderboard" */
export function formatLeaderboardSeasonPill(seasonLabel: string): string {
  const shortened = seasonLabel.trim().replace(/^20/, '');
  return `${shortened} Leaderboard`;
}
