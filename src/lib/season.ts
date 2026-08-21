/** Final gameweek of the 2025/26 Premier League season in TOTL. */
export const SEASON_LAST_GW = 38;

/** True when there is no next gameweek to publish or tease after `gw`. */
export function hasNextGameweek(gw: number): boolean {
  return gw < SEASON_LAST_GW;
}
