/**
 * Session-scoped active season context for sync readers (gameweekState, shared caches).
 * Hydrated by useSeasonStack / useDisplayGameweek — not a React context dependency for pure utils.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeasonCtx } from './seasonStack';
import { resolveSeasonCtx } from './seasonStack';

let active: SeasonCtx | null = null;
let activeUserId: string | null = null;

export function setActiveSeasonCtx(ctx: SeasonCtx | null, userId: string | null = null): void {
  active = ctx;
  activeUserId = ctx ? userId : null;
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
    activeUserId = userId;
    return resolved;
  } catch (e) {
    // A transient refresh may reuse this same user's known context. Never leak
    // the previous account's season or caches into a newly signed-in account.
    if (active && activeUserId === userId) return active;
    active = null;
    activeUserId = null;
    throw e;
  }
}

