/**
 * Session-scoped active season context for sync readers (gameweekState, shared caches).
 * Hydrated by useSeasonStack / useDisplayGameweek — not a React context dependency for pure utils.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeasonCtx } from './seasonStack';
import { resolveSeasonCtx } from './seasonStack';

let active: SeasonCtx | null = null;

export function setActiveSeasonCtx(ctx: SeasonCtx | null): void {
  active = ctx;
}

export function getActiveSeasonCtx(): SeasonCtx | null {
  return active;
}

/**
 * Ensure stack ctx is resolved and cached before any GW/fixture query.
 * Call with a user-scoped or anon Supabase client (RLS applies).
 */
export async function ensureActiveSeasonCtx(
  supa: SupabaseClient,
  userId: string
): Promise<SeasonCtx> {
  // Always re-resolve once we have a user id during early app boot so we never
  // keep a stale "legacy" default before prefs load.
  try {
    const resolved = await resolveSeasonCtx(supa, userId);
    active = resolved;
    return resolved;
  } catch (e) {
    if (active) return active;
    const fallback: SeasonCtx = {
      useSeasonStack: false,
      seasonId: null,
      seasonLabel: null,
      currentGw: 1,
      viewingGw: null,
    };
    active = fallback;
    return fallback;
  }
}

