/**
 * Session-scoped active season context for sync readers (gameweekState, shared caches).
 * Hydrated by useSeasonStack / useDisplayGameweek — not a React context dependency for pure utils.
 */

import type { SeasonCtx } from './seasonStack';

let active: SeasonCtx | null = null;

export function setActiveSeasonCtx(ctx: SeasonCtx | null): void {
  active = ctx;
}

export function getActiveSeasonCtx(): SeasonCtx | null {
  return active;
}
